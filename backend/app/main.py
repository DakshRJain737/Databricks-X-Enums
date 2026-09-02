import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import init_db
from app.core.config import DATABRICKS_CONFIGURED
from app.core.scheduler import start_scheduler, stop_scheduler
from app.services.placement_drives import refresh_drives
from app.routers import auth, users, placement, pdf_qa, leaderboard, facility

app = FastAPI(title="Campus.AI API", version="1.0.0")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(placement.router)
app.include_router(pdf_qa.router)
app.include_router(leaderboard.router)
app.include_router(facility.router)


@app.on_event("startup")
async def on_startup():
    await init_db()
    await refresh_drives()  # populate the cache once before serving traffic
    start_scheduler()


@app.on_event("shutdown")
async def on_shutdown():
    stop_scheduler()


@app.get("/api/health")
async def health():
    return {"status": "ok", "databricks_genie_live": DATABRICKS_CONFIGURED}