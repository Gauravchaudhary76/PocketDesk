import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logger import setup_logging
from app.routers import (
    auth_router,
    capabilities_router,
    health_router,
    input_router,
    remote_router,
    files_router,
    apps_router,
    assistant_router,
    stream_router,
    system_router,
)
from app.services.auth import AuthService
from app.services.devices import DeviceRegistry
from app.services.input import InputService
from app.services.stream import StreamManager
from app.services.win32_desktop import attach_to_default_desktop

# Setup application logging
setup_logging()
logger = logging.getLogger("pocketdesk.agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    app.state.start_time = time.time()

    # Run security validation & display network endpoints
    settings.validate_security()

    # Ensure attached to interactive desktop for screen capture and input injection
    attach_to_default_desktop()

    # Initialize device registry and ensure pairing PINs are displayed
    DeviceRegistry.initialize(settings.STORAGE_DIR)
    AuthService.get_active_code()
    DeviceRegistry.get_active_pin()

    yield

    logger.info("Cleaning up active streams, disabling remote input, and shutting down %s...", settings.APP_NAME)
    InputService.disable_input()
    await StreamManager.stop_stream()
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "PocketDesk Windows Laptop Agent. "
        "Provides authenticated WebRTC desktop streaming, remote mouse/keyboard control, "
        "restricted filesystem management, allowlisted app launching, and AI-assisted desktop command interface."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Narrow CORS configuration:
# Strictly permits only loopback (localhost/127.0.0.1) and private RFC1918 subnets (192.168.*, 10.*, 172.16-31.*).
# Rejects all public internet origins.
LOCAL_NETWORK_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=LOCAL_NETWORK_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ensure unexpected server errors return clean, structured JSON."""
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred while processing the request.",
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.get("/", summary="Agent Index")
async def root():
    """Agent index providing documentation and health links."""
    return {
        "agent": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "stage": settings.STAGE,
        "docs": "/docs",
        "health": "/health",
        "pair": "/api/pair",
        "system": "/api/system",
        "capabilities": "/api/capabilities",
        "stream_status": "/api/stream/status",
        "input_status": "/api/input/status",
        "remote_devices": "/api/remote/devices",
        "ice_servers": "/api/remote/ice-servers",
        "files_roots": "/api/files/roots",
        "apps_allowlist": "/api/apps/allowlist",
        "assistant_intents": "/api/assistant/intents",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Register feature routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(capabilities_router)
app.include_router(stream_router)
app.include_router(input_router)
app.include_router(remote_router)
app.include_router(files_router)
app.include_router(apps_router)
app.include_router(assistant_router)
