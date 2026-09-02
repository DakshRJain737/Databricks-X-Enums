"""
Live placement-drive data, sourced from Databricks (main... wait — the
provided INSERT targets career_academics.raw.placement_drives, a different
catalog/schema than the `main.campus_ai.users` table used elsewhere. Keep
that table name exactly as given.

Cached in memory rather than queried per-request: a resume upload hitting
the Databricks warehouse on every call would add real latency (and cost,
if the warehouse isn't already warm). A background refresh keeps the cache
current without that per-request cost — see scheduler.py's refresh_drives job.

Falls back to a small static list if Databricks isn't configured (local
dev without a warehouse) so /placement/analyze still works without one.
"""
import logging
from app.core.databricks_sql import run_databricks_query
from app.core.config import DATABRICKS_CONFIGURED

logger = logging.getLogger("campusai.placement_drives")

DRIVES_TABLE = "career_academics.raw.placement_drives"

# Same shape/spirit as the original hardcoded DRIVES — used only when
# Databricks isn't configured at all, so local dev keeps working.
_FALLBACK_DRIVES = [
    {
        "company": "Amazon",
        "role": "SDE-1",
        "min_cgpa": 7.0,
        "branches": ["CSE", "ISE", "AIML"],
        "skills": ["dsa", "system design", "java", "python"],
    },
    {
        "company": "TCS",
        "role": "Digital",
        "min_cgpa": 6.0,
        "branches": ["CSE", "ISE", "ECE", "AIML"],
        "skills": ["dsa", "sql", "communication"],
    },
    {
        "company": "Infosys",
        "role": "SDE",
        "min_cgpa": 6.5,
        "branches": ["CSE", "ISE"],
        "skills": ["dsa", "oops", "dbms"],
    },
]

# In-memory cache — deliberately not persisted; refreshed on a schedule.
_cached_drives: list[dict] = list(_FALLBACK_DRIVES)


def _row_to_drive(row: dict) -> dict:
    """Maps a career_academics.raw.placement_drives row to the shape
    placement.py / opportunity_analysis.py already expect (min_cgpa,
    branches, skills — same keys as the old hardcoded DRIVES).

    Real table schema (confirmed via DESCRIBE TABLE):
      company (string), role (string), min_cgpa (double),
      eligible_branches (array<string>), required_skills (array<string>),
      ctc_lpa (double)
    """
    branches = row.get("eligible_branches")
    skills = row.get("required_skills")
    return {
        "company": row["company"],
        "role": row["role"],
        "min_cgpa": float(row["min_cgpa"]) if row.get("min_cgpa") is not None else 0.0,
        "branches": list(branches) if branches is not None else [],
        "skills": list(skills) if skills is not None else [],
        # kept for anything that wants it later (not read by existing code,
        # so this is additive — doesn't change eligibility/opportunity logic)
        "ctc_lpa": row.get("ctc_lpa"),
    }


async def refresh_drives() -> int:
    """Refetches placement_drives from Databricks and swaps the cache.
    Returns the number of drives now cached. On any failure, logs and
    leaves the existing cache untouched (stale data beats a crash)."""
    global _cached_drives

    if not DATABRICKS_CONFIGURED:
        return len(_cached_drives)  # stays on the static fallback

    try:
        rows = await run_databricks_query(
            f"SELECT company, role, min_cgpa, eligible_branches, required_skills, ctc_lpa FROM {DRIVES_TABLE}"
        )
        if not rows:
            logger.warning("placement_drives query returned 0 rows — keeping previous cache")
            return len(_cached_drives)

        new_drives = [_row_to_drive(r) for r in rows]
        _cached_drives = new_drives
        logger.info("refreshed placement_drives cache: %d drives", len(new_drives))
        return len(new_drives)
    except Exception:
        logger.exception("failed to refresh placement_drives from Databricks — keeping previous cache")
        return len(_cached_drives)


def get_drives() -> list[dict]:
    """Synchronous read of whatever's currently cached — call this from
    request handlers instead of the module-level DRIVES constant."""
    return _cached_drives