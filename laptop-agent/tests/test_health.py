from datetime import datetime


def test_health_endpoint(client):
    """Verify GET /health returns 200 with valid health and version schema."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert data["version"] == "0.6.0"
    assert data["stage"] == 6
    assert "uptime_seconds" in data
    assert isinstance(data["uptime_seconds"], (int, float))
    assert data["uptime_seconds"] >= 0.0
    assert "agent_name" in data
    assert "timestamp" in data

    # Verify ISO 8601 timestamp format
    parsed_time = datetime.fromisoformat(data["timestamp"])
    assert parsed_time is not None


def test_root_endpoint(client):
    """Verify GET / returns documentation and navigation links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "docs" in data
    assert "health" in data
    assert "system" in data
    assert "capabilities" in data
    assert "pair" in data
