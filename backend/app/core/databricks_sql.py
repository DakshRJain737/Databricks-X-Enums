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


def _upsert_user_sync(record: dict):
    table = f"{CATALOG}.{SCHEMA}.users"
    connection = databricks_sql.connect(
        server_hostname=settings.DATABRICKS_HOST.replace("https://", "").replace("http://", ""),
        http_path=settings.DATABRICKS_HTTP_PATH,
        access_token=settings.DATABRICKS_TOKEN,
    )
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