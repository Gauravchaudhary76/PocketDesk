from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import require_auth
from app.models.stream import (
    StreamAnswerResponse,
    StreamOfferRequest,
    StreamStatusResponse,
    StreamStopResponse,
)
from app.services.stream import StreamManager

router = APIRouter(prefix="/api/stream", tags=["Screen Stream"])


@router.post(
    "/offer",
    response_model=StreamAnswerResponse,
    summary="Negotiate WebRTC Screen Sharing Session",
    description="Accepts client SDP offer, initializes desktop capture, and returns SDP answer."
)
async def start_stream(
    request: StreamOfferRequest,
    token: str = Depends(require_auth),
) -> StreamAnswerResponse:
    """Initiate screen-sharing session with authenticated client."""
    try:
        answer_data = await StreamManager.start_stream(
            sdp_offer=request.sdp,
            sdp_type=request.type,
            fps=request.fps,
            resolution=request.resolution,
            client_id="PocketDesk Web Client",
        )
        return StreamAnswerResponse(**answer_data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize WebRTC stream: {exc}"
        )


@router.post(
    "/stop",
    response_model=StreamStopResponse,
    summary="Terminate Desktop Stream Session",
    description="Terminates the active WebRTC desktop video stream and releases capture resources."
)
async def stop_stream() -> StreamStopResponse:
    """Stop active screen stream. Can be called from authenticated client or locally on laptop."""
    was_active = await StreamManager.stop_stream()
    message = (
        "Desktop screen sharing terminated successfully."
        if was_active
        else "No active screen sharing session to terminate."
    )
    return StreamStopResponse(status="stopped", message=message)


@router.get(
    "/status",
    response_model=StreamStatusResponse,
    summary="Screen Stream Session Status",
    description="Query current screen sharing status, active client, resolution, and fps."
)
async def get_stream_status() -> StreamStatusResponse:
    """Return whether a stream session is currently active and its runtime metrics."""
    return StreamStatusResponse(**StreamManager.get_status())
