from fastapi import APIRouter

from app.models.system import SystemInfoResponse
from app.services.system_info import SystemInfoService

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/system", response_model=SystemInfoResponse, summary="Host System Information")
async def get_system_info() -> SystemInfoResponse:
    """Return basic host system information including OS, CPU, RAM, and battery status."""
    return SystemInfoService.get_system_info()
