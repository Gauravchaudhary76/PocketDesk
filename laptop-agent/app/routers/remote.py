import logging
import secrets
import time
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.dependencies.auth import require_auth
from app.models.remote import (
    DeviceListResponse,
    DevicePairRequest,
    DevicePairResponse,
    DeviceRevokeResponse,
    IceServerConfigResponse,
    PairedDeviceItem,
    RemoteSessionRequest,
    RemoteSessionResponse,
)
from app.services.auth import AuthService
from app.services.devices import DeviceRegistry
from app.services.input import InputService
from app.services.security import RateLimiter, ReplayProtection, SecurityAuditLogger
from app.services.stream import StreamManager
from app.services.turn import TurnService

logger = logging.getLogger("pocketdesk.routers.remote")
router = APIRouter(prefix="/api/remote", tags=["Remote Access & NAT Traversal"])


def _get_client_ip(request: Request) -> str:
    """Extract client IP, taking into account trusted forward headers if available."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/devices/pair", response_model=DevicePairResponse)
async def pair_remote_device(payload: DevicePairRequest, request: Request) -> DevicePairResponse:
    """
    Explicitly pair an untrusted client device over local or remote connection.
    Requires one-time 6-digit PIN displayed on laptop terminal.
    Enforces replay protection and brute-force rate limiting.
    """
    client_ip = _get_client_ip(request)

    # 1. Rate limiting check
    allowed, lockout_remaining = RateLimiter.check_limit(f"pair:{client_ip}", max_attempts=5, window_seconds=60, lockout_seconds=300)
    if not allowed:
        SecurityAuditLogger.log_event(
            "RATE_LIMIT_EXCEEDED",
            client_ip=client_ip,
            device_id=payload.device_id,
            success=False,
            details={"lockout_seconds": lockout_remaining},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed pairing attempts. Locked out for {int(lockout_remaining or 300)} seconds.",
        )

    # 2. Replay attack check
    valid_replay, replay_err = ReplayProtection.validate_and_consume(payload.nonce, payload.timestamp)
    if not valid_replay:
        SecurityAuditLogger.log_event(
            "REPLAY_ATTACK_BLOCKED",
            client_ip=client_ip,
            device_id=payload.device_id,
            success=False,
            details={"error": replay_err},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=replay_err)

    # 3. Verify PIN and register device
    success, device_secret, err_msg = DeviceRegistry.register_device_with_pin(
        device_id=payload.device_id,
        device_name=payload.device_name,
        pairing_pin=payload.pairing_pin,
        client_ip=client_ip,
    )

    if not success or not device_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_msg or "Invalid pairing code.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reset rate limiter upon success
    RateLimiter.reset_key(f"pair:{client_ip}")

    # 4. Issue initial short-lived session token
    session_token = secrets.token_hex(32)
    session_ttl = 3600  # 1 hour
    AuthService._sessions[session_token] = {
        "created_at": time.time(),
        "expires_at": time.time() + session_ttl,
        "client_name": payload.device_name,
        "device_id": payload.device_id,
    }

    return DevicePairResponse(
        status="paired",
        device_id=payload.device_id,
        device_secret=device_secret,
        session_token=session_token,
        expires_in_seconds=session_ttl,
    )


@router.post("/session/create", response_model=RemoteSessionResponse)
async def create_remote_session(payload: RemoteSessionRequest, request: Request) -> RemoteSessionResponse:
    """
    Establish a short-lived authenticated session for an already registered, paired device.
    Validates cryptographic device secret and prevents replayed requests.
    """
    client_ip = _get_client_ip(request)

    # 1. Rate limiting
    allowed, lockout = RateLimiter.check_limit(f"session:{payload.device_id}", max_attempts=10, window_seconds=60, lockout_seconds=300)
    if not allowed:
        SecurityAuditLogger.log_event(
            "RATE_LIMIT_EXCEEDED",
            client_ip=client_ip,
            device_id=payload.device_id,
            success=False,
            details={"lockout_seconds": lockout},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many session requests. Locked out for {int(lockout or 300)} seconds.",
        )

    # 2. Replay check
    valid_replay, replay_err = ReplayProtection.validate_and_consume(payload.nonce, payload.timestamp)
    if not valid_replay:
        SecurityAuditLogger.log_event(
            "REPLAY_ATTACK_BLOCKED",
            client_ip=client_ip,
            device_id=payload.device_id,
            success=False,
            details={"error": replay_err},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=replay_err)

    # 3. Check credentials and revocation
    if not DeviceRegistry.verify_device_credentials(payload.device_id, payload.device_secret):
        SecurityAuditLogger.log_event(
            "SESSION_AUTH_FAILURE",
            client_ip=client_ip,
            device_id=payload.device_id,
            success=False,
            details={"reason": "Invalid secret or device revoked"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Device is not registered, credentials invalid, or device has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Issue short-lived session token
    session_token = secrets.token_hex(32)
    session_ttl = 3600  # 1 hour
    device = DeviceRegistry.get_device(payload.device_id)

    AuthService._sessions[session_token] = {
        "created_at": time.time(),
        "expires_at": time.time() + session_ttl,
        "client_name": device["device_name"] if device else "Remote Device",
        "device_id": payload.device_id,
    }

    SecurityAuditLogger.log_event(
        "SESSION_CREATED",
        client_ip=client_ip,
        device_id=payload.device_id,
        success=True,
        details={"session_ttl": session_ttl},
    )

    return RemoteSessionResponse(
        session_token=session_token,
        token_type="Bearer",
        expires_in_seconds=session_ttl,
        device_id=payload.device_id,
        role="controller",
    )


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices(token: str = Depends(require_auth)) -> DeviceListResponse:
    """List all registered trusted devices with their status and last seen timestamps."""
    devices = DeviceRegistry.list_authorized_devices()
    items = [PairedDeviceItem(**d) for d in devices]
    return DeviceListResponse(devices=items, total=len(items))


@router.post("/devices/{device_id}/revoke", response_model=DeviceRevokeResponse)
async def revoke_device(device_id: str, token: str = Depends(require_auth)) -> DeviceRevokeResponse:
    """
    Immediately revoke an authorized device, terminating its active sessions,
    video stream, and remote input permissions.
    """
    success = DeviceRegistry.revoke_device(device_id, revoked_by="authorized_session")
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")

    # Invalidate active sessions tied to this device_id
    sessions_to_drop = [
        t for t, s in AuthService._sessions.items() if s.get("device_id") == device_id
    ]
    for s_token in sessions_to_drop:
        AuthService.revoke_session(s_token)

    # If stream was active for this client, stop stream and input
    InputService.disable_input()
    await StreamManager.stop_stream()

    return DeviceRevokeResponse(
        success=True,
        device_id=device_id,
        message=f"Device '{device_id}' has been permanently revoked. Active sessions and streams terminated.",
    )


@router.get("/ice-servers", response_model=IceServerConfigResponse)
async def get_ice_servers(token: str = Depends(require_auth)) -> IceServerConfigResponse:
    """
    Return dynamic WebRTC ICE server configuration with authenticated time-limited
    TURN credentials (RFC 5766) and public STUN servers for NAT traversal.
    """
    session = AuthService.get_session_info(token)
    device_id = session.get("device_id", "remote-client") if session else "remote-client"

    config = TurnService.build_ice_server_config(device_id=device_id)
    return IceServerConfigResponse(**config)
