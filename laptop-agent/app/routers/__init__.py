"""API routers package."""
from app.routers.health import router as health_router
from app.routers.system import router as system_router
from app.routers.capabilities import router as capabilities_router

__all__ = ["health_router", "system_router", "capabilities_router"]
