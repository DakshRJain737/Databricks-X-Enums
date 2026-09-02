from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Text, Boolean, text
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String, default="")
    branch: Mapped[str] = mapped_column(String, default="")

    # New profile fields
    usn: Mapped[str] = mapped_column(String, default="")
    department: Mapped[str] = mapped_column(String, default="")
    cgpa: Mapped[float] = mapped_column(Float, default=0.0)
    skills: Mapped[str] = mapped_column(Text, default="[]")  # JSON-encoded list of strings

    leetcode_username: Mapped[str] = mapped_column(String, default="")
    github_username: Mapped[str] = mapped_column(String, default="")

    # LeetCode derived stats
    leetcode_total_solved: Mapped[int] = mapped_column(Integer, default=0)
    leetcode_easy_solved: Mapped[int] = mapped_column(Integer, default=0)
    leetcode_medium_solved: Mapped[int] = mapped_column(Integer, default=0)
    leetcode_hard_solved: Mapped[int] = mapped_column(Integer, default=0)
    leetcode_contests_attended: Mapped[int] = mapped_column(Integer, default=0)
    leetcode_rating: Mapped[float] = mapped_column(Float, default=0.0)
    leetcode_global_ranking: Mapped[int] = mapped_column(Integer, default=0)

    # GitHub derived stats
    github_public_repos: Mapped[int] = mapped_column(Integer, default=0)
    github_followers: Mapped[int] = mapped_column(Integer, default=0)
    github_following: Mapped[int] = mapped_column(Integer, default=0)
    github_profile_url: Mapped[str] = mapped_column(String, default="")

    # --- OTP login (NEW) ---
    otp_hash: Mapped[str] = mapped_column(String, default="")
    otp_expires_at: Mapped[str] = mapped_column(String, default="")  # ISO-8601 string
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # True after first OTP verify


class FacilitySlot(Base):
    __tablename__ = "facility_slots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    room_number: Mapped[str] = mapped_column(String)
    room_type: Mapped[str] = mapped_column(String)          # 'classroom' | 'lab'
    floor_number: Mapped[int] = mapped_column(Integer)
    day_of_week: Mapped[str] = mapped_column(String)        # 'Monday'...'Saturday'
    start_time: Mapped[str] = mapped_column(String)         # "14:00"
    end_time: Mapped[str] = mapped_column(String)           # "16:00"
    purpose: Mapped[str] = mapped_column(String, default="")
    created_by_email: Mapped[str] = mapped_column(String, default="")


class ForumPost(Base):
    __tablename__ = "forum_posts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author_email: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)


def _ensure_otp_columns(sync_conn):
    """
    Lightweight auto-migration (NEW).

    Your team already has a campusai.db file with a `users` table that
    predates the otp_hash/otp_expires_at columns. Base.metadata.create_all
    only creates missing TABLES, not missing COLUMNS on existing tables --
    so on first boot after this change we check for the columns via
    PRAGMA table_info and ALTER TABLE them in if they're absent. Safe to
    run on every startup; it's a no-op once the columns exist.
    """
    existing_cols = {
        row[1] for row in sync_conn.execute(text("PRAGMA table_info(users)")).fetchall()
    }
    if "otp_hash" not in existing_cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN otp_hash VARCHAR DEFAULT ''"))
    if "otp_expires_at" not in existing_cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN otp_expires_at VARCHAR DEFAULT ''"))
    if "is_verified" not in existing_cols:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
        # Anyone who already has a row (e.g. signed up before this patch, or
        # already completed an OTP login) is treated as verified so they
        # aren't locked out retroactively.
        sync_conn.execute(text("UPDATE users SET is_verified = 1 WHERE otp_hash = ''"))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_otp_columns)


async def get_db():
    async with SessionLocal() as session:
        yield session