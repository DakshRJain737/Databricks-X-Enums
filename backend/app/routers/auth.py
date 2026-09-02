import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr
from app.core.db import get_db, User
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    is_allowed_domain,
    generate_otp,
    hash_otp,
    verify_otp_hash,
    send_otp_email,
)
from app.core.config import settings
from app.services.external_stats import fetch_leetcode_stats, fetch_github_stats
from app.core.databricks_sql import sync_user_to_databricks

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    usn: str = ""
    branch: str = ""
    department: str = ""
    cgpa: float = 0.0
    skills: list[str] = []
    leetcode_username: str = ""
    github_username: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- OTP login (NEW) ---
class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class MessageResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


@router.post("/signup", response_model=MessageResponse)
async def signup(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    print("In signup");
    if not is_allowed_domain(payload.email):
        raise HTTPException(403, f"Only @{settings.ALLOWED_EMAIL_DOMAIN} emails can register")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    # Fetch external stats (blocking calls off the event loop)
    leetcode_stats = await run_in_threadpool(fetch_leetcode_stats, payload.leetcode_username)
    github_stats = await run_in_threadpool(fetch_github_stats, payload.github_username)

    otp = generate_otp()

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        branch=payload.branch,
        usn=payload.usn,
        department=payload.department,
        cgpa=payload.cgpa,
        skills=json.dumps(payload.skills),
        leetcode_username=payload.leetcode_username,
        github_username=payload.github_username,
        **leetcode_stats,
        **github_stats,
        is_verified=False,
        otp_hash=hash_otp(otp),
        otp_expires_at=(
            datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        ).isoformat(),
    )
    db.add(user)
    await db.commit()

    # Account exists in the DB now but is unusable (is_verified=False) until
    # the OTP below is confirmed via /verify-otp -- that's what actually
    # issues the access token and triggers the Databricks sync.
    background_tasks.add_task(send_otp_email, user.email, otp)
    return MessageResponse(message="Almost there — enter the OTP sent to your college email to finish signing up")


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_verified:
        raise HTTPException(403, "Please verify your email via OTP before logging in")
    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


# --- OTP login (NEW) ---

@router.post("/send-otp", response_model=MessageResponse)
async def send_otp(
    payload: SendOtpRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if not is_allowed_domain(payload.email):
        raise HTTPException(403, f"Only @{settings.ALLOWED_EMAIL_DOMAIN} emails can log in")

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found for this email. Please sign up first.")

    otp = generate_otp()
    user.otp_hash = hash_otp(otp)
    user.otp_expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    ).isoformat()
    await db.commit()

    background_tasks.add_task(send_otp_email, user.email, otp)
    return MessageResponse(message="OTP sent to your college email")


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    payload: VerifyOtpRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.otp_hash:
        raise HTTPException(401, "Invalid or expired OTP. Please request a new one.")

    if not user.otp_expires_at or datetime.now(timezone.utc) > datetime.fromisoformat(user.otp_expires_at):
        raise HTTPException(401, "OTP expired. Please request a new one.")

    if not verify_otp_hash(payload.otp, user.otp_hash):
        raise HTTPException(401, "Incorrect OTP")

    # One-time use: clear it so it can't be replayed.
    user.otp_hash = ""
    user.otp_expires_at = ""

    first_verification = not user.is_verified
    if first_verification:
        user.is_verified = True

    await db.commit()

    # Only push to Databricks once the account is confirmed real, and only
    # the first time -- not on every subsequent OTP login.
    if first_verification:
        record = {
            "email": user.email,
            "full_name": user.full_name,
            "usn": user.usn,
            "branch": user.branch,
            "department": user.department,
            "cgpa": user.cgpa,
            "skills": user.skills,
            "leetcode_username": user.leetcode_username,
            "github_username": user.github_username,
            "leetcode_total_solved": user.leetcode_total_solved,
            "leetcode_easy_solved": user.leetcode_easy_solved,
            "leetcode_medium_solved": user.leetcode_medium_solved,
            "leetcode_hard_solved": user.leetcode_hard_solved,
            "leetcode_contests_attended": user.leetcode_contests_attended,
            "leetcode_rating": user.leetcode_rating,
            "leetcode_global_ranking": user.leetcode_global_ranking,
            "github_public_repos": user.github_public_repos,
            "github_followers": user.github_followers,
            "github_following": user.github_following,
            "github_profile_url": user.github_profile_url,
        }
        background_tasks.add_task(sync_user_to_databricks, record)

    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


# --- Forgot password (NEW) ---
# Flow: user requests a code via the existing /send-otp endpoint (same one
# OTP-login uses), then hits this endpoint with that code + a new password.
# Reuses the same OTP storage/expiry -- no separate "reset token" needed.

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.otp_hash:
        raise HTTPException(401, "Invalid or expired OTP. Please request a new one.")

    if not user.otp_expires_at or datetime.now(timezone.utc) > datetime.fromisoformat(user.otp_expires_at):
        raise HTTPException(401, "OTP expired. Please request a new one.")

    if not verify_otp_hash(payload.otp, user.otp_hash):
        raise HTTPException(401, "Incorrect OTP")

    user.hashed_password = hash_password(payload.new_password)
    # One-time use: clear it so it can't be replayed.
    user.otp_hash = ""
    user.otp_expires_at = ""
    await db.commit()

    return MessageResponse(message="Password updated. You can now log in.")