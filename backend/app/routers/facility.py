import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.db import get_db, User, FacilitySlot
from app.core.databricks import get_genie
from app.core.facility_sql import (
    sync_facility_slot_to_databricks,
    delete_facility_slot_from_databricks,
)

router = APIRouter(prefix="/api/facility", tags=["facility"])

VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
VALID_ROOM_TYPES = {"classroom", "lab"}


class FacilitySlotCreate(BaseModel):
    room_number: str
    room_type: str          # 'classroom' | 'lab'
    floor_number: int
    day_of_week: str        # 'Monday' ... 'Saturday'
    start_time: str         # "14:00"
    end_time: str           # "16:00"
    purpose: Optional[str] = ""


class FacilityQuestion(BaseModel):
    question: str


def serialize(s: FacilitySlot) -> dict:
    return {
        "id": s.id,
        "room_number": s.room_number,
        "room_type": s.room_type,
        "floor_number": s.floor_number,
        "day_of_week": s.day_of_week,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "purpose": s.purpose,
        "created_by_email": s.created_by_email,
    }


@router.get("")
async def list_slots(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """All utilisation slots — the frontend derives free/occupied per room/day/time from this."""
    result = await db.execute(select(FacilitySlot))
    slots = result.scalars().all()
    return {"slots": [serialize(s) for s in slots], "days": VALID_DAYS}


@router.post("")
async def create_slot(
    payload: FacilitySlotCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.day_of_week not in VALID_DAYS:
        raise HTTPException(400, f"day_of_week must be one of {VALID_DAYS}")
    if payload.room_type not in VALID_ROOM_TYPES:
        raise HTTPException(400, f"room_type must be one of {sorted(VALID_ROOM_TYPES)}")
    if payload.start_time >= payload.end_time:
        raise HTTPException(400, "start_time must be before end_time")

    # Overlap check: a room is uniquely identified by
    # (room_number, room_type, floor_number) -- e.g. classroom "204" on floor 2
    # and lab "204" on floor 3 are different rooms and should never clash.
    # Within the same room, overlapping time ranges on the same day still conflict.
    result = await db.execute(
        select(FacilitySlot).where(
            FacilitySlot.room_number == payload.room_number,
            FacilitySlot.room_type == payload.room_type,
            FacilitySlot.floor_number == payload.floor_number,
            FacilitySlot.day_of_week == payload.day_of_week,
        )
    )
    existing = result.scalars().all()
    for s in existing:
        if payload.start_time < s.end_time and s.start_time < payload.end_time:
            raise HTTPException(
                409,
                f"{payload.room_number} ({payload.room_type}, floor {payload.floor_number}) is already booked "
                f"{s.start_time}-{s.end_time} on {payload.day_of_week} ({s.purpose or 'no purpose given'})",
            )

    slot = FacilitySlot(
        id=str(uuid.uuid4()),
        room_number=payload.room_number,
        room_type=payload.room_type,
        floor_number=payload.floor_number,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        purpose=payload.purpose or "",
        created_by_email=user.email,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)

    record = serialize(slot)
    await sync_facility_slot_to_databricks(record)

    return record


@router.delete("/{slot_id}")
async def delete_slot(
    slot_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(FacilitySlot).where(FacilitySlot.id == slot_id))
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(404, "Slot not found")

    await db.delete(slot)
    await db.commit()
    await delete_facility_slot_from_databricks(slot_id)

    return {"deleted": slot_id}


@router.post("/ask")
async def ask_facility(
    payload: FacilityQuestion,
    user: User = Depends(get_current_user),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(400, "question cannot be empty")

    # Room/facility utilisation Q&A is a data lookup over
    # main.campus_ai.facility_slots, so it goes to Genie (campus_ops space).
    genie = get_genie("campus_ops")
    genie_question = (
        f"Using the main.campus_ai.facility_slots table (columns: room_number, "
        f"room_type, floor_number, day_of_week, start_time, end_time, purpose), "
        f"answer this question about classroom/lab occupancy or availability: "
        f"{question}"
    )
    genie_response = await genie.ask(genie_question)

    return {"question": question, "genie_analysis": genie_response}