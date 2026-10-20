import asyncio
import json
import logging
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.dependencies.auth import require_auth
from app.models.input import (
    InputControlRequest,
    InputOperationResponse,
    InputStatusResponse,
    KeyRequest,
    MouseClickRequest,
    MouseMoveRequest,
    MouseRelativeMoveRequest,
    MouseScrollRequest,
    ScreenInfoResponse,
    ShortcutRequest,
    TextTypeRequest,
)
from app.services.auth import AuthService
from app.services.input import InputService

logger = logging.getLogger("pocketdesk.routers.input")
router = APIRouter(prefix="/api/input", tags=["Remote Input"])


@router.get("/status", response_model=InputStatusResponse)
async def get_input_status(token: str = Depends(require_auth)) -> InputStatusResponse:
    """Return whether remote input is enabled and how many keys/buttons are active."""
    return InputStatusResponse(**InputService.get_status())


@router.get("/screen-info", response_model=ScreenInfoResponse)
async def get_screen_info(token: str = Depends(require_auth)) -> ScreenInfoResponse:
    """Return primary display resolution and aspect ratio for coordinate mapping."""
    w, h = InputService.get_screen_dimensions()
    return ScreenInfoResponse(
        width=w,
        height=h,
        aspect_ratio=round(w / h, 6),
        input_enabled=InputService.is_enabled(),
    )


@router.post("/control", response_model=InputOperationResponse)
async def control_input(
    payload: InputControlRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Explicitly enable, disable, or trigger emergency stop for remote input."""
    if payload.action == "enable":
        session_info = AuthService.get_session_info(token)
        client_name = session_info.get("client_name", "PocketDesk Web Client") if session_info else "PocketDesk Web Client"
        InputService.enable_input(client_name=client_name)
        return InputOperationResponse(
            success=True, action="enable", message="Remote input enabled successfully."
        )

    elif payload.action in ("disable", "emergency_stop"):
        InputService.disable_input()
        return InputOperationResponse(
            success=True,
            action=payload.action,
            message="Remote input disabled and all held keys/buttons released.",
        )

    elif payload.action == "status":
        return InputOperationResponse(
            success=True,
            action="status",
            message=f"Input is currently {'enabled' if InputService.is_enabled() else 'disabled'}.",
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown action")


def _ensure_input_enabled() -> None:
    if not InputService.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Remote input is disabled. User must explicitly enable remote input before sending events.",
        )


@router.post("/mouse/move", response_model=InputOperationResponse)
async def mouse_move(
    payload: MouseMoveRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Move cursor to normalized coordinates [0.0, 1.0]."""
    _ensure_input_enabled()
    target_x, target_y = InputService.move_mouse_absolute(payload.x, payload.y)
    return InputOperationResponse(
        success=True, action="mouse_move", message=f"Moved to ({target_x}, {target_y})"
    )


@router.post("/mouse/relative", response_model=InputOperationResponse)
async def mouse_move_relative(
    payload: MouseRelativeMoveRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Move cursor relative to current position (touchpad mode)."""
    _ensure_input_enabled()
    target_x, target_y = InputService.move_mouse_relative(payload.dx, payload.dy)
    return InputOperationResponse(
        success=True, action="mouse_relative", message=f"Moved to ({target_x}, {target_y})"
    )


@router.post("/mouse/click", response_model=InputOperationResponse)
async def mouse_click(
    payload: MouseClickRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Dispatch mouse button click, down, or up."""
    _ensure_input_enabled()
    InputService.click_mouse(
        button=payload.button,
        action=payload.action,
        norm_x=payload.x,
        norm_y=payload.y,
    )
    return InputOperationResponse(
        success=True, action="mouse_click", message=f"{payload.action} on {payload.button}"
    )


@router.post("/mouse/scroll", response_model=InputOperationResponse)
async def mouse_scroll(
    payload: MouseScrollRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Dispatch vertical wheel scroll."""
    _ensure_input_enabled()
    InputService.scroll_mouse(payload.delta_y)
    return InputOperationResponse(
        success=True, action="mouse_scroll", message=f"Scrolled delta {payload.delta_y}"
    )


@router.post("/keyboard/key", response_model=InputOperationResponse)
async def keyboard_key(
    payload: KeyRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Press, hold down, or release a virtual key."""
    _ensure_input_enabled()
    InputService.send_key(payload.key, action=payload.action)
    return InputOperationResponse(
        success=True, action="keyboard_key", message=f"{payload.action} {payload.key}"
    )


@router.post("/keyboard/text", response_model=InputOperationResponse)
async def keyboard_text(
    payload: TextTypeRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Type arbitrary Unicode text string into active window."""
    _ensure_input_enabled()
    InputService.type_text(payload.text)
    return InputOperationResponse(
        success=True, action="keyboard_text", message=f"Typed {len(payload.text)} characters"
    )


@router.post("/keyboard/shortcut", response_model=InputOperationResponse)
async def keyboard_shortcut(
    payload: ShortcutRequest, token: str = Depends(require_auth)
) -> InputOperationResponse:
    """Execute standard multi-key combination (e.g. ['ctrl', 'c'])."""
    _ensure_input_enabled()
    InputService.execute_shortcut(payload.keys)
    return InputOperationResponse(
        success=True, action="keyboard_shortcut", message=f"Executed shortcut {'+'.join(payload.keys)}"
    )


# WebSocket for high-frequency low-latency touch/trackpad input streaming
@router.websocket("/ws")
async def input_websocket(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    Low-latency WebSocket endpoint for real-time mouse motion and keyboard streaming.
    Requires valid session token in query parameter or initial auth frame.
    Automatically triggers emergency cleanup if client disconnects.
    """
    await websocket.accept()

    # Authenticate token from query parameter or initial packet
    authed_token = token
    if not authed_token or not AuthService.validate_session(authed_token):
        # Await auth message if not in query param
        try:
            init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
            data = json.loads(init_msg)
            if data.get("type") == "auth" and AuthService.validate_session(data.get("token", "")):
                authed_token = data.get("token")
            else:
                await websocket.close(code=4001, reason="Unauthorized")
                return
        except Exception:
            await websocket.close(code=4001, reason="Authentication timeout or failure")
            return

    logger.info("Input WebSocket connected and authenticated.")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception:
                continue

            # Drop stale input events older than 1.5 seconds to avoid post-reconnection queue bursts
            msg_ts = msg.get("timestamp")
            if msg_ts and (time.time() - float(msg_ts) > 1.5):
                continue

            event_type = msg.get("type")

            # Control actions (enable/disable) can be run even if currently disabled
            if event_type == "control":
                action = msg.get("action")
                if action == "enable":
                    session_info = AuthService.get_session_info(authed_token)
                    client_name = session_info.get("client_name", "PocketDesk Web Client") if session_info else "PocketDesk Web Client"
                    InputService.enable_input(client_name=client_name)
                    await websocket.send_json({"type": "control", "status": "enabled"})
                elif action in ("disable", "emergency_stop"):
                    InputService.disable_input()
                    await websocket.send_json({"type": "control", "status": "disabled"})
                continue

            # Check if input is enabled before processing motion/keystrokes
            if not InputService.is_enabled():
                continue

            if event_type == "move":
                InputService.move_mouse_absolute(float(msg["x"]), float(msg["y"]))

            elif event_type == "move_rel":
                InputService.move_mouse_relative(float(msg["dx"]), float(msg["dy"]))

            elif event_type == "click":
                InputService.click_mouse(
                    button=msg.get("button", "left"),
                    action=msg.get("action", "click"),
                    norm_x=float(msg["x"]) if "x" in msg and msg["x"] is not None else None,
                    norm_y=float(msg["y"]) if "y" in msg and msg["y"] is not None else None,
                )

            elif event_type == "scroll":
                InputService.scroll_mouse(int(msg.get("delta_y", 0)))

            elif event_type == "key":
                InputService.send_key(str(msg.get("key", "")), action=msg.get("action", "press"))

            elif event_type == "text":
                text = str(msg.get("text", ""))[:500]
                InputService.type_text(text)

            elif event_type == "shortcut":
                keys = [str(k) for k in msg.get("keys", [])][:5]
                InputService.execute_shortcut(keys)

    except WebSocketDisconnect:
        logger.info("Input WebSocket disconnected.")
    except Exception as exc:
        logger.warning("Input WebSocket connection terminated with error: %s", exc)
    finally:
        # Guarantee that all held keys and mouse buttons are released on disconnect
        InputService.emergency_cleanup()
