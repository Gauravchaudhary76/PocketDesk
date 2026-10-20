from fastapi import APIRouter, Depends

from app.dependencies.auth import require_auth
from app.models.system import SystemInfoResponse
from app.services.system_info import SystemInfoService

router = APIRouter(prefix="/api", tags=["System"])


@router.get(
    "/system",
    response_model=SystemInfoResponse,
    summary="Host System Information",
    description="Returns host hardware telemetry. Requires a valid session token obtained via pairing."
)
async def get_system_info(token: str = Depends(require_auth)) -> SystemInfoResponse:
    """Return host system information including OS, CPU, RAM, and battery status."""
    return SystemInfoService.get_system_info()
