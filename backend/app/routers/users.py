from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.core.db import User

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"email": user.email, "full_name": user.full_name, "branch": user.branch}
