import asyncio
import json
import logging
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.db import SessionLocal, User
from app.core.databricks_sql import sync_user_to_databricks
from app.services.external_stats import fetch_leetcode_stats, fetch_github_stats
from app.services.placement_drives import refresh_drives

logger = logging.getLogger("campusai.scheduler")

# ---- in-memory state (deliberately NOT persisted — no schema change) ----
# Round-robin cursor so each tick only refreshes a bounded slice of users
# instead of the whole table (spreads external API load over time).
_cursor = 0

# Last-seen leaderboard shape, used to decide whether to fire an SSE refresh
# signal. A cheap tuple hash, not stored anywhere.
_last_board_hash: int | None = None

# Event broadcast to any connected SSE clients when the board changes.
board_changed_event = asyncio.Event()


def _record_for_sync(u: User) -> dict:
    return {
        "email": u.email,
        "full_name": u.full_name,
        "usn": u.usn,
        "branch": u.branch,
        "department": u.department,
        "cgpa": u.cgpa,
        "skills": u.skills,
        "leetcode_username": u.leetcode_username,
        "github_username": u.github_username,
        "leetcode_total_solved": u.leetcode_total_solved,
        "leetcode_easy_solved": u.leetcode_easy_solved,
        "leetcode_medium_solved": u.leetcode_medium_solved,
        "leetcode_hard_solved": u.leetcode_hard_solved,
        "leetcode_contests_attended": u.leetcode_contests_attended,
        "leetcode_rating": u.leetcode_rating,
        "leetcode_global_ranking": u.leetcode_global_ranking,
        "github_public_repos": u.github_public_repos,
        "github_followers": u.github_followers,
        "github_following": u.github_following,  # repurposed: commit count
        "github_profile_url": u.github_profile_url,
    }


async def refresh_batch():
    """Refresh a bounded slice of users, push each to Databricks, then
    check whether the leaderboard's ranking-relevant shape changed and
    wake up any SSE listeners if so."""
    global _cursor, _last_board_hash

    async with SessionLocal() as db:
        result = await db.execute(select(User).order_by(User.id))
        all_users = result.scalars().all()
        if not all_users:
            return

        n = len(all_users)
        batch_size = min(settings.SYNC_BATCH_SIZE, n)
        batch = [all_users[(_cursor + i) % n] for i in range(batch_size)]
        _cursor = (_cursor + batch_size) % n

        for u in batch:
            try:
                leetcode_stats = await run_in_threadpool(fetch_leetcode_stats, u.leetcode_username)
                github_stats = await run_in_threadpool(fetch_github_stats, u.github_username)
                for k, v in {**leetcode_stats, **github_stats}.items():
                    setattr(u, k, v)
            except Exception:
                logger.exception("stat refresh failed for user id=%s", u.id)
                continue

        await db.commit()

        # Push the refreshed batch to Databricks (batched write, not per-poll-tick).
        for u in batch:
            try:
                await sync_user_to_databricks(_record_for_sync(u))
            except Exception:
                logger.exception("databricks sync failed for user id=%s", u.id)

        # Recompute a cheap signature of ranking-relevant fields across
        # ALL users (not just the batch) to detect any order change.
        sig = tuple(
            (
                u.id,
                u.leetcode_total_solved,
                u.leetcode_easy_solved,
                u.leetcode_medium_solved,
                u.leetcode_hard_solved,
                u.leetcode_rating,
                u.leetcode_contests_attended,
                u.github_following,  # commit count
                u.github_followers,
            )
            for u in all_users
        )
        new_hash = hash(sig)
        if new_hash != _last_board_hash:
            _last_board_hash = new_hash
            board_changed_event.set()


async def force_refresh_user(usn: str) -> bool:
    """Manual 'sync now' trigger for a single user (e.g. a 'refresh my stats'
    button). Rate-limit this at the route level — it's not scheduler-bounded."""
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.usn == usn))
        u = result.scalar_one_or_none()
        if not u:
            return False
        leetcode_stats = await run_in_threadpool(fetch_leetcode_stats, u.leetcode_username)
        github_stats = await run_in_threadpool(fetch_github_stats, u.github_username)
        for k, v in {**leetcode_stats, **github_stats}.items():
            setattr(u, k, v)
        await db.commit()
        await sync_user_to_databricks(_record_for_sync(u))
        board_changed_event.set()
        return True


scheduler = AsyncIOScheduler()


def start_scheduler():
    scheduler.add_job(
        refresh_batch,
        "interval",
        seconds=settings.SYNC_INTERVAL_SECONDS,
        id="refresh_batch",
        max_instances=1,
        coalesce=True,
    )
    # Placement drives change far less often than student stats — a longer
    # interval is plenty. Runs independently of the user-stats job above.
    scheduler.add_job(
        refresh_drives,
        "interval",
        seconds=settings.DRIVES_SYNC_INTERVAL_SECONDS,
        id="refresh_drives",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)