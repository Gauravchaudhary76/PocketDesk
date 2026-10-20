from collections import namedtuple
from unittest.mock import patch
from datetime import datetime
from app.services.auth import AuthService


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_system_unauthorized_without_token(client):
    """Verify GET /api/system rejects requests without an Authorization token."""
    response = client.get("/api/system")
    assert response.status_code == 401


def test_system_unauthorized_with_invalid_token(client):
    """Verify GET /api/system rejects requests with a bogus token."""
    response = client.get("/api/system", headers={"Authorization": "Bearer bogus_token_123"})
    assert response.status_code == 401


def test_system_info_live(client):
    """Verify GET /api/system returns valid host hardware telemetry when authenticated."""
    headers = get_auth_headers(client)
    response = client.get("/api/system", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert "os" in data
    assert "cpu" in data
    assert "memory" in data
    assert "battery" in data
    assert "timestamp" in data

    # Verify OS information
    os_info = data["os"]
    assert "system" in os_info
    assert "release" in os_info
    assert "hostname" in os_info
    assert "architecture" in os_info

    # Verify CPU information
    cpu_info = data["cpu"]
    assert "cores_logical" in cpu_info
    assert cpu_info["cores_logical"] >= 1
    assert "usage_percent" in cpu_info
    assert 0.0 <= cpu_info["usage_percent"] <= 100.0

    # Verify Memory information
    mem_info = data["memory"]
    assert mem_info["total_bytes"] > 0
    assert mem_info["available_bytes"] > 0
    assert mem_info["used_bytes"] > 0
    assert 0.0 <= mem_info["usage_percent"] <= 100.0

    # Verify Battery information (may be None on desktop or present on laptop)
    battery_info = data["battery"]
    assert isinstance(battery_info, dict)
    assert "present" in battery_info
    if battery_info["present"]:
        assert 0.0 <= battery_info["percent"] <= 100.0

    # Verify ISO timestamp
    assert datetime.fromisoformat(data["timestamp"]) is not None


def test_system_info_mock_with_battery(client):
    """Verify battery parsing when psutil reports a battery present and charging."""
    headers = get_auth_headers(client)
    MockBattery = namedtuple("MockBattery", ["percent", "secsleft", "power_plugged"])
    mock_bat = MockBattery(percent=85.5, secsleft=3600, power_plugged=True)

    with patch("psutil.sensors_battery", return_value=mock_bat):
        response = client.get("/api/system", headers=headers)
        assert response.status_code == 200
        data = response.json()
        bat = data["battery"]
        assert bat["present"] is True
        assert bat["percent"] == 85.5
        assert bat["power_plugged"] is True
        assert bat["is_charging"] is True
        assert bat["seconds_left"] == 3600


def test_system_info_mock_without_battery(client):
    """Verify battery reporting when host is a desktop PC or VM without battery hardware."""
    headers = get_auth_headers(client)
    with patch("psutil.sensors_battery", return_value=None):
        response = client.get("/api/system", headers=headers)
        assert response.status_code == 200
        data = response.json()
        bat = data["battery"]
        assert bat["present"] is False
        assert bat["percent"] is None
        assert bat["is_charging"] is None
        assert bat["power_plugged"] is None
        assert bat["seconds_left"] is None


def test_system_info_graceful_error_handling(client):
    """Verify system telemetry endpoint does not crash with 500 when hardware queries raise exceptions."""
    headers = get_auth_headers(client)
    with patch("psutil.virtual_memory", side_effect=PermissionError("Access denied")):
        response = client.get("/api/system", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["memory"]["total_bytes"] == 0
        assert data["memory"]["usage_percent"] == 0.0
