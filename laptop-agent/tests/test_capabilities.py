from app.services.auth import AuthService


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_capabilities_unauthorized_without_token(client):
    """Verify GET /api/capabilities rejects unauthenticated requests."""
    response = client.get("/api/capabilities")
    assert response.status_code == 401


def test_capabilities_endpoint(client):
    """Verify GET /api/capabilities returns full capability inventory when authenticated."""
    headers = get_auth_headers(client)
    response = client.get("/api/capabilities", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert "agent_version" in data
    assert data["current_stage"] == 4
    assert "capabilities" in data
    assert isinstance(data["capabilities"], list)
    assert len(data["capabilities"]) > 0

    cap_dict = {cap["name"]: cap for cap in data["capabilities"]}

    # Verify Stage 2, 3 & 4 available capabilities
    assert "health_check" in cap_dict
    assert cap_dict["health_check"]["status"] == "available"

    assert "system_telemetry" in cap_dict
    assert cap_dict["system_telemetry"]["status"] == "available"

    assert "capabilities_discovery" in cap_dict
    assert cap_dict["capabilities_discovery"]["status"] == "available"

    assert "local_network_pairing" in cap_dict
    assert cap_dict["local_network_pairing"]["status"] == "available"

    assert "screen_capture" in cap_dict
    assert cap_dict["screen_capture"]["status"] == "available"

    assert "screen_streaming" in cap_dict
    assert cap_dict["screen_streaming"]["status"] == "available"

    # Verify future stage planned capabilities
    assert "mouse_control" in cap_dict
    assert cap_dict["mouse_control"]["status"] == "planned"


def test_invalid_endpoint_returns_404(client):
    """Verify non-existent endpoints return 404 Not Found."""
    response = client.get("/api/nonexistent-feature")
    assert response.status_code == 404
