import asyncio
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_current_user
from app.core.db import get_db, User
from app.core.config import settings
from app.core.databricks import get_genie
from app.core.scheduler import board_changed_event, force_refresh_user
from app.services.external_stats import fetch_leetcode_calendar, fetch_github_contribution_calendar
from pydantic import BaseModel

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

class LeaderboardQuestion(BaseModel):
    question: str


def compute_score(u: User) -> float:
    """Composite ranking score.

    Difficulty-weighted LeetCode solves dominate (they're the clearest signal
    of skill). Contest rating is dampened and only counts above a 1200
    baseline so it doesn't swamp everything else on its own scale. GitHub
    commit count (stored in the `github_following` column — see
    external_stats.py) is capped so one outlier repo can't blow out the board.
    """
    solved_score = (
        (u.leetcode_easy_solved or 0) * 1
        + (u.leetcode_medium_solved or 0) * 3
        + (u.leetcode_hard_solved or 0) * 5
    )
    contest_score = max(0, (u.leetcode_rating or 0) - 1200) * 0.3
    consistency_score = (u.leetcode_contests_attended or 0) * 4
    commit_count = u.github_following or 0  # repurposed field, see external_stats.py
    commit_score = min(commit_count, 2000) * 0.05
    community_score = (u.github_followers or 0) * 0.5

    return round(
        solved_score + contest_score + consistency_score + commit_score + community_score, 2
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
        "github_commit_count": u.github_following,  # exposed under its real meaning
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


@router.get("/stream")
async def leaderboard_stream():
    """SSE endpoint — deliberately UNAUTHENTICATED. Browser EventSource
    cannot send an Authorization header, so this route can't use the normal
    Bearer-token dependency. That's fine: it emits only a bare 'refresh'
    event with no payload — no user data crosses this endpoint. Clients
    refetch the (still-authenticated) /api/leaderboard on receipt."""

    async def event_gen():
        while True:
            await board_changed_event.wait()
            board_changed_event.clear()
            yield "event: refresh\ndata: {}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/sync/{usn}")
async def sync_now(usn: str, user: User = Depends(get_current_user)):
    """Manual 'refresh my stats now' trigger. Frontend should debounce/
    rate-limit calls to this — it hits LeetCode/GitHub directly."""
    ok = await force_refresh_user(usn)
    if not ok:
        raise HTTPException(404, f"No user with USN '{usn}'")
    return {"synced": True}


@router.get("/students/{usn}")
async def student_profile(
    usn: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.usn == usn))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, f"No student found with USN '{usn}'")

    ranked = await _get_ranked_users(db)
    rank = next((i + 1 for i, u in enumerate(ranked) if u.usn == usn), None)

    leetcode_calendar, github_calendar = await asyncio.gather(
        asyncio.to_thread(fetch_leetcode_calendar, target.leetcode_username),
        asyncio.to_thread(fetch_github_contribution_calendar, target.github_username),
    )

    profile = serialize(rank or 0, target)
    return {
        "profile": profile,
        "leetcode_heatmap": leetcode_calendar,   # {submissionCalendar, totalActiveDays, streak}
        "github_heatmap": github_calendar,       # {totalContributions, days: [{date,count}]}
    }


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

    genie = get_genie("leaderboard")
    genie_question = (
        f"Using the main.campus_ai.users table, answer this question about "
        f"student rankings, LeetCode stats, GitHub stats, CGPA, branch, or skills: "
        f"{question}"
    )
    genie_response = await genie.ask(genie_question)

    return {"question": question, "genie_analysis": genie_response}