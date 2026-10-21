from fastapi import APIRouter, Depends

from app.dependencies.auth import require_auth
from app.services.app_launcher import app_launcher
from app.models.apps import (
    AppAllowlistResponse,
    LaunchAppRequest,
    LaunchAppResponse,
)

router = APIRouter(prefix="/api/apps", tags=["Application Launcher"])


@router.get(
    "/allowlist",
    response_model=AppAllowlistResponse,
    summary="List allowlisted installed applications",
    description="Returns preconfigured approved applications. Rejects arbitrary executable paths.",
)
async def get_allowlist(token: str = Depends(require_auth)) -> AppAllowlistResponse:
    """Return preconfigured list of allowable applications."""
    return app_launcher.get_allowlist()


@router.post(
    "/launch",
    response_model=LaunchAppResponse,
    summary="Launch an approved application",
    description="Spawns an allowlisted executable by ID. Disallows arbitrary commands and requires confirmation for disruptive tools.",
)
async def launch_application(
    body: LaunchAppRequest,
    token: str = Depends(require_auth),
) -> LaunchAppResponse:
    """Launch approved application by ID."""
    return app_launcher.launch_app(body.app_id, body.confirmed)
