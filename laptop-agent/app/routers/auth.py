from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import get_current_token, require_auth
from app.models.auth import PairRequest, PairResponse, UnpairResponse
from app.services.auth import AuthService
from app.services.input import InputService

router = APIRouter(prefix="/api", tags=["Authentication"])


@router.post(
    "/pair",
    response_model=PairResponse,
    summary="Authorize and Pair Local Client",
    description="Validate the 6-digit PIN displayed on the laptop terminal and issue a local session token."
)
async def pair_client(request: PairRequest) -> PairResponse:
    """Pair a client with the Windows agent using the terminal-authorized PIN."""
    success, token, error_message = AuthService.verify_and_create_session(
        submitted_code=request.pairing_code,
        client_name=request.client_name or "PocketDesk Mobile"
    )

    if not success or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_message or "Pairing authorization failed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return PairResponse(
        status="paired",
        session_token=token,
        token_type="Bearer",
        expires_in_seconds=AuthService._SESSION_TTL_SECONDS,
    )


@router.post(
    "/unpair",
    response_model=UnpairResponse,
    summary="Revoke Session Token",
    description="Invalidate current session token upon client disconnect."
)
async def unpair_client(token: str = Depends(require_auth)) -> UnpairResponse:
    """Explicitly terminate the client session."""
    InputService.disable_input()
    AuthService.revoke_session(token)
    return UnpairResponse(
        status="unpaired",
        message="Session revoked successfully. To reconnect, re-authenticate with pairing code."
    )
