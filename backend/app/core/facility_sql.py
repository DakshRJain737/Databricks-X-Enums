from databricks import sql as databricks_sql
from starlette.concurrency import run_in_threadpool
from app.core.config import settings, DATABRICKS_CONFIGURED

CATALOG = "main"
SCHEMA = "campus_ai"

TABLE_COLUMNS = [
    "id", "room_number", "room_type", "floor_number", "day_of_week",
    "start_time", "end_time", "purpose", "created_by_email",
]


def _upsert_facility_slot_sync(record: dict):
    table = f"{CATALOG}.{SCHEMA}.facility_slots"
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

        cursor.execute(f"DELETE FROM {table} WHERE id = ?", [record["id"]])
        cursor.execute(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", values)
        cursor.close()
    finally:
        connection.close()


def _delete_facility_slot_sync(slot_id: str):
    table = f"{CATALOG}.{SCHEMA}.facility_slots"
    connection = databricks_sql.connect(
        server_hostname=settings.DATABRICKS_HOST.replace("https://", "").replace("http://", ""),
        http_path=settings.DATABRICKS_HTTP_PATH,
        access_token=settings.DATABRICKS_TOKEN,
    )
    try:
        cursor = connection.cursor()
        cursor.execute(f"DELETE FROM {table} WHERE id = ?", [slot_id])
        cursor.close()
    finally:
        connection.close()


async def sync_facility_slot_to_databricks(record: dict):
    if not DATABRICKS_CONFIGURED or not settings.DATABRICKS_HTTP_PATH:
        return  # not configured — skip silently
    await run_in_threadpool(_upsert_facility_slot_sync, record)


async def delete_facility_slot_from_databricks(slot_id: str):
    if not DATABRICKS_CONFIGURED or not settings.DATABRICKS_HTTP_PATH:
        return
    await run_in_threadpool(_delete_facility_slot_sync, slot_id)