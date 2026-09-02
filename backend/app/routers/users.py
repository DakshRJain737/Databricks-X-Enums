import json
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from app.core.security import get_current_user
from app.core.db import get_db, User
from app.services.external_stats import fetch_leetcode_stats, fetch_github_stats

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    # All optional -- PATCH semantics: only fields the client actually sends
    # get updated (see exclude_unset below). email is intentionally absent;
    # it's the login identity and isn't editable here.
    full_name: Optional[str] = None
    usn: Optional[str] = None
    branch: Optional[str] = None
    department: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[list[str]] = None
    leetcode_username: Optional[str] = None
    github_username: Optional[str] = None


def _serialize(user: User) -> dict:
    return {
        "email": user.email,
        "full_name": user.full_name,
        "usn": user.usn,
        "branch": user.branch,
        "department": user.department,
        "cgpa": user.cgpa,
        "skills": json.loads(user.skills or "[]"),
        "leetcode_username": user.leetcode_username,
        "github_username": user.github_username,
        # Read-only derived stats -- shown on the profile page but not editable here.
        # Refreshed immediately below when the underlying username changes;
        # otherwise kept current by the background leaderboard scheduler.
        "leetcode_total_solved": user.leetcode_total_solved,
        "leetcode_rating": user.leetcode_rating,
        "github_public_repos": user.github_public_repos,
        "github_followers": user.github_followers,
    }


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return _serialize(user)


@router.patch("/me")
async def update_me(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = payload.dict(exclude_unset=True)
    if "skills" in data:
        data["skills"] = json.dumps(data["skills"])

    leetcode_changed = "leetcode_username" in data and data["leetcode_username"] != user.leetcode_username
    github_changed = "github_username" in data and data["github_username"] != user.github_username

    for field, value in data.items():
        setattr(user, field, value)

    # Refetch stats synchronously (same blocking-call pattern signup already
    # uses) so the numbers on the profile page update immediately instead of
    # waiting for the next background scheduler tick.
    if leetcode_changed:
        for k, v in (await run_in_threadpool(fetch_leetcode_stats, user.leetcode_username)).items():
            setattr(user, k, v)
    if github_changed:
        for k, v in (await run_in_threadpool(fetch_github_stats, user.github_username)).items():
            setattr(user, k, v)

    await db.commit()
    await db.refresh(user)
    return _serialize(user)