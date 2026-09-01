import random
from datetime import datetime
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.core.db import User
from app.core.databricks import get_genie

router = APIRouter(prefix="/api/facility", tags=["facility"])

LABS = ["CS Lab 1", "CS Lab 2", "AIML Lab", "ISE Lab", "Central Library", "Robotics Lab"]


def simulated_occupancy() -> dict:
    # Deterministic-ish simulation seeded by current minute so repeated calls
    # in the same minute look stable, per the deck's "simulated sensor stream" disclosure.
    seed = datetime.now().minute
    rnd = random.Random(seed)
    return {lab: rnd.randint(0, 100) for lab in LABS}


@router.get("/status")
async def facility_status(user: User = Depends(get_current_user)):
    occ = simulated_occupancy()
    return {
        "disclosed_as": "SIMULATED sensor stream (real IoT unavailable per data-honesty statement)",
        "occupancy_percent": occ,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/ask")
async def ask_which_free(question: str = "Which lab is free right now?", user: User = Depends(get_current_user)):
    occ = simulated_occupancy()
    freest = min(occ, key=occ.get)
    genie_prompt = f"Lab occupancy right now (simulated): {occ}. {question} Also predict which is likely to fill up in the next 2 hours."
    genie = get_genie("campus_ops")
    genie_response = await genie.ask(genie_prompt)
    return {
        "freest_lab": freest,
        "occupancy_percent": occ,
        "genie_analysis": genie_response,
    }
