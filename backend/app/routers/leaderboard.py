import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_current_user
from app.core.db import get_db, User
from app.core.config import settings
from app.core.databricks import get_genie
from pydantic import BaseModel

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

class LeaderboardQuestion(BaseModel):
    question: str


def compute_score(u: User) -> float:
    """Composite ranking score. Tune weights as you like."""
    return (
        (u.leetcode_total_solved or 0) * 2
        + (u.leetcode_rating or 0) * 0.5
        + (u.leetcode_contests_attended or 0) * 5
        + (u.github_public_repos or 0) * 3
        + (u.github_followers or 0) * 1
    )


def serialize(rank: int, u: User) -> dict:
    return {
        "rank": rank,
        "full_name": u.full_name,
        "usn": u.usn,
        "branch": u.branch,
        "department": u.department,
        "cgpa": u.cgpa,
        "skills": json.loads(u.skills or "[]"),
        "leetcode_username": u.leetcode_username,
        "github_username": u.github_username,
        "leetcode_total_solved": u.leetcode_total_solved,
        "leetcode_easy_solved": u.leetcode_easy_solved,
        "leetcode_medium_solved": u.leetcode_medium_solved,
        "leetcode_hard_solved": u.leetcode_hard_solved,
        "leetcode_rating": u.leetcode_rating,
        "leetcode_contests_attended": u.leetcode_contests_attended,
        "github_public_repos": u.github_public_repos,
        "github_followers": u.github_followers,
        "score": round(compute_score(u), 2),
    }


async def _get_ranked_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User))
    users = result.scalars().all()
    return sorted(users, key=compute_score, reverse=True)


@router.get("")
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ranked = await _get_ranked_users(db)
    leaderboard = [serialize(i + 1, u) for i, u in enumerate(ranked)]
    return {"leaderboard": leaderboard, "total": len(leaderboard)}


@router.get("/rank")
async def get_rank(
    query: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Look up a person's rank by USN, LeetCode username, GitHub username, or name."""
    ranked = await _get_ranked_users(db)
    q = query.strip().lower()
    if not q:
        raise HTTPException(400, "query cannot be empty")

    match_idx = None
    for i, u in enumerate(ranked):
        if (
            q == (u.usn or "").lower()
            or q == (u.leetcode_username or "").lower()
            or q == (u.github_username or "").lower()
            or q in (u.full_name or "").lower()
        ):
            match_idx = i
            break

    if match_idx is None:
        raise HTTPException(404, f"No user found matching '{query}'")

    total = len(ranked)
    percentile = round((1 - match_idx / total) * 100, 1) if total else 0.0

    start = max(0, match_idx - 2)
    end = min(total, match_idx + 3)
    nearby = [serialize(idx + 1, ranked[idx]) for idx in range(start, end)]

    return {
        "you": serialize(match_idx + 1, ranked[match_idx]),
        "percentile": percentile,
        "total_users": total,
        "nearby_peers": nearby,
    }


@router.get("/compare")
async def compare(
    github_handle: str,
    codeforces_handle: str,
    user: User = Depends(get_current_user),
):
    async with httpx.AsyncClient(timeout=15) as client:
        gh_data, cf_data = {}, {}
        try:
            gh_resp = await client.get(f"{settings.GITHUB_API_BASE}/users/{github_handle}")
            gh_repos = await client.get(f"{settings.GITHUB_API_BASE}/users/{github_handle}/repos?per_page=100")
            if gh_resp.status_code == 200:
                profile = gh_resp.json()
                repos = gh_repos.json() if gh_repos.status_code == 200 else []
                gh_data = {
                    "public_repos": profile.get("public_repos", 0),
                    "followers": profile.get("followers", 0),
                    "total_stars": sum(r.get("stargazers_count", 0) for r in repos) if isinstance(repos, list) else 0,
                }
        except Exception:
            gh_data = {"error": "GitHub lookup failed"}

        try:
            cf_resp = await client.get(f"{settings.CODEFORCES_API_BASE}/user.info?handles={codeforces_handle}")
            if cf_resp.status_code == 200:
                body = cf_resp.json()
                if body.get("status") == "OK" and body["result"]:
                    u = body["result"][0]
                    cf_data = {
                        "rating": u.get("rating", 0),
                        "max_rating": u.get("maxRating", 0),
                        "rank": u.get("rank", "unrated"),
                    }
        except Exception:
            cf_data = {"error": "Codeforces lookup failed"}

    question = f"GitHub stats: {gh_data}. Codeforces stats: {cf_data}. Give a ranked comparison against a typical strong CS batch peer and a 3-point improvement plan."
    genie = get_genie("career_academics")
    genie_response = await genie.ask(question)

    return {"github": gh_data, "codeforces": cf_data, "genie_analysis": genie_response}

@router.post("/ask")
async def ask_leaderboard(
    payload: LeaderboardQuestion,
    user: User = Depends(get_current_user),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(400, "question cannot be empty")

    # Leaderboard Q&A is a data lookup over main.campus_ai.users,
    # so it goes to Genie (NL-to-SQL) rather than the raw foundation model.
    genie = get_genie("leaderboard")

    genie_question = (
        f"Using the main.campus_ai.users table, answer this question about "
        f"student rankings, LeetCode stats, GitHub stats, CGPA, branch, or skills: "
        f"{question}"
    )
    genie_response = await genie.ask(genie_question)

    return {"question": question, "genie_analysis": genie_response}