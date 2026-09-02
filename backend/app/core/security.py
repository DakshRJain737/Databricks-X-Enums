import hashlib
import hmac
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.db import get_db, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Plain PBKDF2-HMAC-SHA256 password hashing (stdlib only -- avoids the
# passlib/bcrypt binary-compat issues seen across environments).
_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _, iterations, salt_hex, hash_hex = hashed.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, int(iterations))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


# ----------------------------------------------------------------------
# OTP login (NEW)
# ----------------------------------------------------------------------

def is_allowed_domain(email: str) -> bool:
    """Only @<ALLOWED_EMAIL_DOMAIN> addresses may sign up or receive an OTP."""
    return email.strip().lower().endswith("@" + settings.ALLOWED_EMAIL_DOMAIN.lower())


def generate_otp() -> str:
    """Cryptographically-random 6-digit code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    # Reuse the same PBKDF2 scheme as passwords -- no new dependency needed.
    return hash_password(otp)


def verify_otp_hash(otp: str, hashed: str) -> bool:
    return verify_password(otp, hashed)


def send_otp_email(to_email: str, otp: str) -> None:
    """
    Sends the OTP via SMTP (stdlib smtplib -- no extra pip installs).

    Called from a BackgroundTask, so this blocking call doesn't hold up
    the request/response cycle. If SMTP isn't configured yet (no
    SMTP_HOST in .env), it prints the OTP to the backend console instead
    of failing, so you can develop/test end-to-end before wiring real
    email credentials.
    """
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        print(f"[DEV] OTP for {to_email}: {otp}  (SMTP_PASSWORD not set yet -- see SETUP_OTP.md)")
        return

    msg = MIMEText(
        f"Your CAMPUS.AI login code is {otp}.\n\n"
        f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
        f"If you didn't request this, you can ignore this email."
    )
    msg["Subject"] = "Your CAMPUS.AI login code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())