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
        status="planned",
        stage=3,
        description="DirectX Desktop Duplication API (DXGI) low-latency desktop capture (planned for future)."
    ),
    CapabilityItem(
        name="screen_streaming",
        status="planned",
        stage=3,
        description="Real-time WebRTC media streaming to client browser."
    ),
    CapabilityItem(
        name="mouse_control",
        status="planned",
        stage=4,
        description="Synthetic mouse movement deltas, clicks, and multi-touch gesture mapping."
    ),
    CapabilityItem(
        name="keyboard_control",
        status="planned",
        stage=4,
        description="Virtual keyboard stroke injection and Windows hotkey dispatches."
    ),
    CapabilityItem(
        name="process_management",
        status="planned",
        stage=4,
        description="Listing running Windows processes and non-elevated app launching."
    ),
    CapabilityItem(
        name="file_transfer",
        status="planned",
        stage=5,
        description="Chunked binary file upload and download with SHA-256 integrity verification."
    ),
    CapabilityItem(
        name="remote_nat_traversal",
        status="planned",
        stage=6,
        description="End-to-end encrypted relay or WebRTC NAT traversal for out-of-LAN access."
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
