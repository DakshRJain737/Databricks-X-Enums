import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Databricks ---
    DATABRICKS_HOST: str = ""
    DATABRICKS_TOKEN: str = ""
    DATABRICKS_WAREHOUSE_ID: str = ""

    GENIE_CAREER_ACADEMICS_SPACE_ID: str = ""
    GENIE_CAMPUS_OPS_SPACE_ID: str = ""

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

    # --- OTP login (NEW) ---
    # Only emails ending in this domain may sign up / receive a login OTP.
    ALLOWED_EMAIL_DOMAIN: str = "bmsce.ac.in"
    OTP_EXPIRE_MINUTES: int = 10

    # --- SMTP (NEW) — used to email OTP codes ---
    # Leave SMTP_HOST blank during dev: OTPs will just be printed to the
    # backend console instead of emailed, so you can test without creds.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "enums.databricks@gmail.com"
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "CAMPUS.AI <enums.databricks@gmail.com>"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Convenience flag: are we able to call real Databricks Genie, or should
# every Genie-backed endpoint fall back to a clearly-labelled mock response?
DATABRICKS_CONFIGURED = bool(settings.DATABRICKS_HOST and settings.DATABRICKS_TOKEN)