import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Databricks ---
    DATABRICKS_HOST: str = ""
    DATABRICKS_TOKEN: str = ""
    DATABRICKS_WAREHOUSE_ID: str = ""

    GENIE_CAREER_ACADEMICS_SPACE_ID: str = ""
    GENIE_RESEARCH_SPACE_ID: str = ""
    GENIE_CAMPUS_OPS_SPACE_ID: str = ""
    GENIE_COMMUNITY_SPACE_ID: str = ""
    GENIE_SAFETY_SPACE_ID: str = ""

    FOUNDATION_MODEL_ENDPOINT: str = "databricks-meta-llama-3-3-70b-instruct"

    # --- DB (defaults to local SQLite so the app runs with zero setup) ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./campusai.db"

    # --- Auth ---
    JWT_SECRET: str = "dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 720

    # --- External public APIs (no key needed) ---
    GITHUB_API_BASE: str = "https://api.github.com"
    CODEFORCES_API_BASE: str = "https://codeforces.com/api"

    DATABRICKS_HTTP_PATH: str = ""

    GENIE_LEADERBOARD_SPACE_ID: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Convenience flag: are we able to call real Databricks Genie, or should
# every Genie-backed endpoint fall back to a clearly-labelled mock response?
DATABRICKS_CONFIGURED = bool(settings.DATABRICKS_HOST and settings.DATABRICKS_TOKEN)
