from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DevicePairRequest(BaseModel):
    """Initial pairing request from an untrusted client device over local or remote connection."""
    device_id: str = Field(..., min_length=8, max_length=64, description="Unique client device identifier")
    device_name: str = Field(..., min_length=1, max_length=64, description="Human-readable device name")
    pairing_pin: str = Field(..., min_length=6, max_length=6, description="6-digit PIN displayed on laptop terminal")
    timestamp: float = Field(..., description="Unix timestamp for replay defense")
    nonce: str = Field(..., min_length=8, max_length=64, description="Single-use random cryptographic nonce")


class DevicePairResponse(BaseModel):
    """Response returned upon successful PIN verification and device registration."""
    status: str = "paired"
    device_id: str
    device_secret: str
    session_token: str
    expires_in_seconds: int


class RemoteSessionRequest(BaseModel):
    """Obtain short-lived session token using registered device credentials."""
    device_id: str = Field(..., min_length=8, max_length=64)
    device_secret: str = Field(..., min_length=32, max_length=128)
    timestamp: float = Field(..., description="Unix timestamp for replay defense")
    nonce: str = Field(..., min_length=8, max_length=64, description="Single-use random cryptographic nonce")


class RemoteSessionResponse(BaseModel):
    """Short-lived session credentials for an authorized device."""
    session_token: str
    token_type: str = "Bearer"
    expires_in_seconds: int
    device_id: str
    role: str = "controller"


class PairedDeviceItem(BaseModel):
    """Public metadata for an authorized device."""
    device_id: str
    device_name: str
    paired_at: str
    last_seen: str
    revoked: bool
    role: str
    last_ip: str


class DeviceListResponse(BaseModel):
    """List of all registered devices."""
    devices: List[PairedDeviceItem]
    total: int


class DeviceRevokeResponse(BaseModel):
    """Response returned when an authorized device is revoked."""
    success: bool
    device_id: str
    message: str


class IceServerConfigResponse(BaseModel):
    """WebRTC ICE server configuration with dynamic STUN/TURN credentials."""
    ice_servers: List[Dict[str, Any]]
    turn_configured: bool
    nat_traversal_mode: str
    documentation: str
