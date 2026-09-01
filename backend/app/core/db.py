from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Text
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


class ForumPost(Base):
    __tablename__ = "forum_posts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author_email: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with SessionLocal() as session:
        yield session