from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.config import settings
from app.dependencies.auth import require_auth
from app.models.capabilities import CapabilitiesResponse, CapabilityItem

router = APIRouter(prefix="/api", tags=["Capabilities"])

# Comprehensive registry of agent capabilities across all project stages
REGISTERED_CAPABILITIES = [
    CapabilityItem(
        name="health_check",
        status="available",
        stage=2,
        description="Agent operational health, version, and uptime reporting."
    ),
    CapabilityItem(
        name="system_telemetry",
        status="available",
        stage=2,
        description="Querying host OS, CPU load, RAM allocation, and battery telemetry."
    ),
    CapabilityItem(
        name="capabilities_discovery",
        status="available",
        stage=2,
        description="Dynamic discovery of supported agent features and roadmap states."
    ),
    CapabilityItem(
        name="local_network_pairing",
        status="available",
        stage=3,
        description="6-digit PIN terminal pairing with bearer token authorization over local Wi-Fi."
    ),
    CapabilityItem(
        name="screen_capture",
        status="available",
        stage=4,
        description="Real-time Windows desktop capture with resolution scaling and fallback support."
    ),
    CapabilityItem(
        name="screen_streaming",
        status="available",
        stage=4,
        description="Peer-to-peer WebRTC video transport with authenticated signaling."
    ),
    CapabilityItem(
        name="mouse_control",
        status="available",
        stage=5,
        description="Synthetic mouse movement, clicks, drag-and-drop, and scroll wheel dispatches."
    ),
    CapabilityItem(
        name="keyboard_control",
        status="available",
        stage=5,
        description="Virtual keyboard stroke injection, Unicode text entry, and Windows hotkey dispatches."
    ),
    CapabilityItem(
        name="restricted_file_management",
        status="available",
        stage=7,
        description="Restricted filesystem browsing, uploading, downloading, and folder creation in explicitly approved user directories."
    ),
    CapabilityItem(
        name="application_launcher",
        status="available",
        stage=7,
        description="Allowlist-restricted launching of approved installed Windows applications with confirmation for disruptive tools."
    ),
    CapabilityItem(
        name="remote_nat_traversal",
        status="available",
        stage=6,
        description="Secure remote access via WebRTC NAT traversal (STUN) and authenticated TURN relay with replay defense."
    ),
]


@router.get(
    "/capabilities",
    response_model=CapabilitiesResponse,
    summary="Agent Capabilities & Roadmap Discovery",
    description="Returns capability registry. Requires valid session token."
)
async def get_capabilities(token: str = Depends(require_auth)) -> CapabilitiesResponse:
    """Return a list of currently implemented capabilities and roadmap items."""
    return CapabilitiesResponse(
        agent_version=settings.APP_VERSION,
        current_stage=settings.STAGE,
        capabilities=REGISTERED_CAPABILITIES,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
