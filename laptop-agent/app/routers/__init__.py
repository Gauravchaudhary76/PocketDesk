"""API routers package."""
from app.routers.health import router as health_router
from app.routers.system import router as system_router
from app.routers.capabilities import router as capabilities_router
from app.routers.auth import router as auth_router
from app.routers.stream import router as stream_router
from app.routers.input import router as input_router
from app.routers.remote import router as remote_router
from app.routers.files import router as files_router
from app.routers.apps import router as apps_router

__all__ = [
    "health_router",
    "system_router",
    "capabilities_router",
    "auth_router",
    "stream_router",
    "input_router",
    "remote_router",
    "files_router",
    "apps_router",
]
