from fastapi import APIRouter, Depends, Request

from app.dependencies.auth import require_auth
from app.services.assistant import assistant_service
from app.models.assistant import (
    ParseCommandRequest,
    InterpretedCommandResponse,
    ExecuteCommandRequest,
    ExecuteCommandResponse,
    IntentCatalogResponse,
)

router = APIRouter(prefix="/api/assistant", tags=["AI Desktop Assistant"])


@router.get(
    "/intents",
    response_model=IntentCatalogResponse,
    summary="List supported desktop command intents",
    description="Returns the catalog of authorized natural language intents and examples.",
)
async def get_intents(token: str = Depends(require_auth)) -> IntentCatalogResponse:
    """Return catalog of supported intents."""
    return assistant_service.get_intent_catalog()


@router.post(
    "/parse",
    response_model=InterpretedCommandResponse,
    summary="Parse natural-language desktop instruction",
    description="Maps a natural-language prompt to an authorized action and checks if confirmation is required.",
)
async def parse_instruction(
    body: ParseCommandRequest,
    token: str = Depends(require_auth),
) -> InterpretedCommandResponse:
    """Parse prompt into structured desktop action proposal."""
    return assistant_service.parse_command(body.prompt)


@router.post(
    "/execute",
    response_model=ExecuteCommandResponse,
    summary="Execute an approved desktop command",
    description="Executes a parsed command if authorization and confirmation requirements are satisfied.",
)
async def execute_instruction(
    body: ExecuteCommandRequest,
    request: Request,
    token: str = Depends(require_auth),
) -> ExecuteCommandResponse:
    """Execute confirmed action through existing agent subsystems."""
    client_ip = request.client.host if request.client else "unknown"
    return await assistant_service.execute_command(
        command_id=body.command_id,
        action_type=body.action_type,
        parameters=body.parameters,
        confirmed=body.confirmed,
        client_ip=client_ip,
        device_id=token[:8] if token else None,
    )
