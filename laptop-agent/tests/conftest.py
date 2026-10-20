import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    """Module-scoped TestClient providing access to the FastAPI agent."""
    with TestClient(app) as test_client:
        yield test_client
