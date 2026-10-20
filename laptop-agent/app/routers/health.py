import time
from datetime import datetime, timezone
from fastapi import APIRouter, Request

from app.config import settings
from app.models.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Agent Health Check")
async def get_health(request: Request) -> HealthResponse:
    """Return the health status, semantic version, and uptime of the PocketDesk agent."""
    start_time: float = getattr(request.app.state, "start_time", time.time())
    uptime = max(0.0, time.time() - start_time)

    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        agent_name=settings.APP_NAME,
        stage=settings.STAGE,
        uptime_seconds=round(uptime, 2),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
