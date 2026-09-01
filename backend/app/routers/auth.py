import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr
from app.core.db import get_db, User
from app.core.security import hash_password, verify_password, create_access_token
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


@router.post("/signup", response_model=TokenResponse)
async def signup(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    # Fetch external stats (blocking calls off the event loop)
    leetcode_stats = await run_in_threadpool(fetch_leetcode_stats, payload.leetcode_username)
    github_stats = await run_in_threadpool(fetch_github_stats, payload.github_username)

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
    )
    db.add(user)
    await db.commit()

    # Push a copy to Databricks Unity Catalog without blocking the response
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


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    token = create_access_token(user.email)
    return TokenResponse(access_token=token)