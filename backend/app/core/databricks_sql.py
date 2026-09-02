from databricks import sql as databricks_sql
from starlette.concurrency import run_in_threadpool
from app.core.config import settings, DATABRICKS_CONFIGURED

CATALOG = "main"
SCHEMA = "campus_ai"

TABLE_COLUMNS = [
    "email", "full_name", "usn", "branch", "department", "cgpa", "skills",
    "leetcode_username", "github_username",
    "leetcode_total_solved", "leetcode_easy_solved", "leetcode_medium_solved",
    "leetcode_hard_solved", "leetcode_contests_attended", "leetcode_rating",
    "leetcode_global_ranking",
    "github_public_repos", "github_followers", "github_following", "github_profile_url",
]


def _connect():
    return databricks_sql.connect(
        server_hostname=settings.DATABRICKS_HOST.replace("https://", "").replace("http://", ""),
        http_path=settings.DATABRICKS_HTTP_PATH,
        access_token=settings.DATABRICKS_TOKEN,
    )


def _upsert_user_sync(record: dict):
    table = f"{CATALOG}.{SCHEMA}.users"
    connection = _connect()
    try:
        cursor = connection.cursor()
        cols = ", ".join(TABLE_COLUMNS)
        placeholders = ", ".join(["?"] * len(TABLE_COLUMNS))
        values = [record.get(col) for col in TABLE_COLUMNS]

        cursor.execute(f"DELETE FROM {table} WHERE email = ?", [record["email"]])
        cursor.execute(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", values)
        cursor.close()
    finally:
        connection.close()


async def sync_user_to_databricks(record: dict):
    if not DATABRICKS_CONFIGURED or not settings.DATABRICKS_HTTP_PATH:
        return  # not configured — skip silently
    await run_in_threadpool(_upsert_user_sync, record)


def _run_query_sync(query: str, params: list | None = None) -> list[dict]:
    """Generic SELECT runner — returns rows as a list of dicts keyed by
    column name. Caller decides caching/refresh strategy; this is a raw
    query executor only, safe to reuse for any read-only table (not just
    placement_drives)."""
    connection = _connect()
    try:
        cursor = connection.cursor()
        cursor.execute(query, params or [])
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        return rows
    finally:
        connection.close()


async def run_databricks_query(query: str, params: list | None = None) -> list[dict]:
    """Async wrapper around _run_query_sync. Returns [] (not an exception)
    when Databricks isn't configured, so callers can either treat 'not
    configured' and 'configured but empty result' the same, or check
    DATABRICKS_CONFIGURED themselves first to tell the two apart."""
    if not DATABRICKS_CONFIGURED or not settings.DATABRICKS_HTTP_PATH:
        return []
    return await run_in_threadpool(_run_query_sync, query, params)