import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logger import setup_logging
from app.routers import capabilities_router, health_router, system_router

# Setup application logging
setup_logging()
logger = logging.getLogger("pocketdesk.agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # Record server boot time for health uptime calculation
    app.state.start_time = time.time()
    
    # Run security validation
    settings.validate_security()
    
    logger.info("==================================================")
    logger.info(" Starting %s v%s (Stage %s)", settings.APP_NAME, settings.APP_VERSION, settings.STAGE)
    logger.info(" Listening on http://%s:%s (Localhost only)", settings.HOST, settings.PORT)
    logger.info(" Security policy: Local-only, unauthenticated. WAN access strictly prohibited.")
    logger.info("==================================================")
    
    yield
    
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "PocketDesk Windows Laptop Agent (Stage 2 foundation). "
        "Provides local telemetry, health monitoring, and capabilities discovery."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration to allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

# Global unhandled exception handler
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


# Root informational endpoint
@app.get("/", summary="Agent Index")
async def root():
    """Agent index providing documentation and health links."""
    return {
        "agent": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "stage": settings.STAGE,
        "docs": "/docs",
        "health": "/health",
        "system": "/api/system",
        "capabilities": "/api/capabilities",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Register feature routers
app.include_router(health_router)
app.include_router(system_router)
app.include_router(capabilities_router)
