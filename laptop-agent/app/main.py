import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logger import setup_logging
from app.routers import auth_router, capabilities_router, health_router, system_router
from app.services.auth import AuthService

# Setup application logging
setup_logging()
logger = logging.getLogger("pocketdesk.agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    app.state.start_time = time.time()
    
    # Run security validation & display network endpoints
    settings.validate_security()
    
    # Ensure a pairing PIN is initialized and displayed
    AuthService.get_active_code()
    
    yield
    
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "PocketDesk Windows Laptop Agent (Stage 3). "
        "Provides authenticated local network system telemetry and device pairing."
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Register feature routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(capabilities_router)
