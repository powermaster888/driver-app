from fastapi import APIRouter, Depends

from app.auth import get_current_driver
from app.models import Driver

router = APIRouter(tags=["jobs"])


@router.get("/me/jobs")
def list_jobs(scope: str = "today", driver: Driver = Depends(get_current_driver)):
    return {"jobs": [], "fetched_at": None}
