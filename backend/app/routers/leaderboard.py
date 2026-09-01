import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.db import User
from app.core.config import settings
from app.core.databricks import get_genie

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("/compare")
async def compare(github_handle: str, codeforces_handle: str, user: User = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=15) as client:
        gh_data, cf_data = {}, {}
        try:
            gh_resp = await client.get(f"{settings.GITHUB_API_BASE}/users/{github_handle}")
            gh_repos = await client.get(f"{settings.GITHUB_API_BASE}/users/{github_handle}/repos?per_page=100")
            if gh_resp.status_code == 200:
                profile = gh_resp.json()
                repos = gh_repos.json() if gh_repos.status_code == 200 else []
                gh_data = {
                    "public_repos": profile.get("public_repos", 0),
                    "followers": profile.get("followers", 0),
                    "total_stars": sum(r.get("stargazers_count", 0) for r in repos) if isinstance(repos, list) else 0,
                }
        except Exception:
            gh_data = {"error": "GitHub lookup failed"}

        try:
            cf_resp = await client.get(f"{settings.CODEFORCES_API_BASE}/user.info?handles={codeforces_handle}")
            if cf_resp.status_code == 200:
                body = cf_resp.json()
                if body.get("status") == "OK" and body["result"]:
                    u = body["result"][0]
                    cf_data = {
                        "rating": u.get("rating", 0),
                        "max_rating": u.get("maxRating", 0),
                        "rank": u.get("rank", "unrated"),
                    }
        except Exception:
            cf_data = {"error": "Codeforces lookup failed"}

    question = f"GitHub stats: {gh_data}. Codeforces stats: {cf_data}. Give a ranked comparison against a typical strong CS batch peer and a 3-point improvement plan."
    genie = get_genie("career_academics")
    genie_response = await genie.ask(question)

    return {"github": gh_data, "codeforces": cf_data, "genie_analysis": genie_response}
