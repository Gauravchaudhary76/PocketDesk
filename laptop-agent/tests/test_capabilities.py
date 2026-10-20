def test_capabilities_endpoint(client):
    """Verify GET /api/capabilities returns full capability inventory."""
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    
    data = response.json()
    assert "agent_version" in data
    assert data["current_stage"] == 2
    assert "capabilities" in data
    assert isinstance(data["capabilities"], list)
    assert len(data["capabilities"]) > 0

    cap_dict = {cap["name"]: cap for cap in data["capabilities"]}

    # Verify Stage 2 available capabilities
    assert "health_check" in cap_dict
    assert cap_dict["health_check"]["status"] == "available"
    assert cap_dict["health_check"]["stage"] == 2

    assert "system_telemetry" in cap_dict
    assert cap_dict["system_telemetry"]["status"] == "available"
    assert cap_dict["system_telemetry"]["stage"] == 2

    assert "capabilities_discovery" in cap_dict
    assert cap_dict["capabilities_discovery"]["status"] == "available"
    assert cap_dict["capabilities_discovery"]["stage"] == 2

    # Verify future stage planned capabilities
    assert "screen_capture" in cap_dict
    assert cap_dict["screen_capture"]["status"] == "planned"
    assert cap_dict["screen_capture"]["stage"] == 3

    assert "mouse_control" in cap_dict
    assert cap_dict["mouse_control"]["status"] == "planned"
    assert cap_dict["mouse_control"]["stage"] == 4

    assert "keyboard_control" in cap_dict
    assert cap_dict["keyboard_control"]["status"] == "planned"
    assert cap_dict["keyboard_control"]["stage"] == 4

    assert "file_transfer" in cap_dict
    assert cap_dict["file_transfer"]["status"] == "planned"
    assert cap_dict["file_transfer"]["stage"] == 5


def test_invalid_endpoint_returns_404(client):
    """Verify non-existent endpoints return 404 Not Found."""
    response = client.get("/api/nonexistent-feature")
    assert response.status_code == 404
