"""
Thin clients around Databricks Genie (structured data Q&A) and Databricks
Model Serving (free-text reasoning). If DATABRICKS_HOST / DATABRICKS_TOKEN
aren't set (or a call fails), both fall back to a clearly-labeled mock so
the rest of the app keeps working end-to-end without a live workspace.
"""
import asyncio
import httpx
from app.core.config import settings, DATABRICKS_CONFIGURED


class GenieClient:
    def __init__(self, space_id: str):
        self.space_id = space_id
        self.base = settings.DATABRICKS_HOST.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.DATABRICKS_TOKEN}",
            "Content-Type": "application/json",
        }
        self.mock_mode = not (DATABRICKS_CONFIGURED and space_id)

    async def ask(self, question: str) -> dict:
        """Start a Genie conversation and return the final text + query result."""
        if self.mock_mode:
            return {
                "mode": "mock",
                "answer": f"[MOCK GENIE] No live Genie space configured for this "
                          f"feature. In production this question would be sent to "
                          f"Databricks Genie:\n\n\"{question}\"",
                "query_result": None,
            }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                start = await client.post(
                    f"{self.base}/api/2.0/genie/spaces/{self.space_id}/start-conversation",
                    headers=self.headers,
                    json={"content": question},
                )
                start.raise_for_status()
                data = start.json()
                conversation_id = data["conversation_id"]
                message_id = data["message_id"]

                # Poll for completion
                for _ in range(30):
                    msg = await client.get(
                        f"{self.base}/api/2.0/genie/spaces/{self.space_id}"
                        f"/conversations/{conversation_id}/messages/{message_id}",
                        headers=self.headers,
                    )
                    msg.raise_for_status()
                    payload = msg.json()
                    status = payload.get("status")
                    if status in ("COMPLETED", "FAILED", "CANCELLED"):
                        break
                    await asyncio.sleep(1)

                # Each attachment's "text" field, when present, is an object
                # like {"content": "...", "id": "..."} — not a plain string.
                text_parts = [
                    a["text"]["content"] for a in payload.get("attachments", [])
                    if isinstance(a.get("text"), dict) and a["text"].get("content")
                ]
                answer = "\n".join(text_parts) or "Genie returned no text content."
                return {"mode": "live", "answer": answer, "query_result": payload}
        except Exception as exc:  # network / auth / space-not-found etc.
            return {
                "mode": "error",
                "answer": f"[GENIE ERROR] Falling back — could not reach Databricks "
                          f"Genie ({exc.__class__.__name__}: {exc}). Check DATABRICKS_HOST, "
                          f"DATABRICKS_TOKEN and the space ID.",
                "query_result": None,
            }


def get_genie(feature: str) -> GenieClient:
    space_map = {
        "career_academics": settings.GENIE_CAREER_ACADEMICS_SPACE_ID,
        "research": settings.GENIE_RESEARCH_SPACE_ID,
        "campus_ops": settings.GENIE_CAMPUS_OPS_SPACE_ID,
        "community": settings.GENIE_COMMUNITY_SPACE_ID,
        "safety": settings.GENIE_SAFETY_SPACE_ID,
        "leaderboard": settings.GENIE_LEADERBOARD_SPACE_ID,
    }
    return GenieClient(space_map.get(feature, ""))


async def call_foundation_model(prompt: str) -> dict:
    """
    Free-text reasoning (e.g. turning a data lookup into a written readiness
    plan) — NOT a SQL/data question, so it goes to Model Serving, not Genie.
    """
    if not DATABRICKS_CONFIGURED:
        return {
            "mode": "mock",
            "answer": f"[MOCK MODEL] No Databricks connection configured. In "
                      f"production this prompt would go to "
                      f"'{settings.FOUNDATION_MODEL_ENDPOINT}':\n\n{prompt}",
        }

    url = (
        f"{settings.DATABRICKS_HOST.rstrip('/')}/serving-endpoints/"
        f"{settings.FOUNDATION_MODEL_ENDPOINT}/invocations"
    )
    headers = {
        "Authorization": f"Bearer {settings.DATABRICKS_TOKEN}",
        "Content-Type": "application/json",
    }
    body = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            answer = data["choices"][0]["message"]["content"]
            return {"mode": "live", "answer": answer}
    except Exception as exc:
        return {
            "mode": "error",
            "answer": f"[MODEL ERROR] Could not reach {settings.FOUNDATION_MODEL_ENDPOINT} "
                      f"({exc.__class__.__name__}: {exc}).",
        }
