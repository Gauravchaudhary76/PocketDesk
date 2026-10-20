import pytest
from app.services.auth import AuthService
from app.services.input import InputService


@pytest.fixture(autouse=True)
def setup_input_mock():
    """Ensure mock mode is active so test execution never touches the developer's physical mouse/keyboard."""
    InputService.set_mock_mode(True)
    InputService.disable_input()
    yield
    InputService.disable_input()
    InputService.set_mock_mode(False)


def get_auth_headers(client):
    """Pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code, "client_name": "Test Client"})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_coordinate_mapping_logic():
    """Verify coordinate normalization and screen boundary clamping."""
    # Test screen dimensions (mock returns 1920x1080)
    w, h = InputService.get_screen_dimensions()
    assert w > 0 and h > 0

    # Test top-left origin
    x0, y0 = InputService.map_normalized_to_screen(0.0, 0.0)
    assert x0 == 0
    assert y0 == 0

    # Test bottom-right extreme
    x1, y1 = InputService.map_normalized_to_screen(1.0, 1.0)
    assert x1 == w - 1
    assert y1 == h - 1

    # Test center point
    xc, yc = InputService.map_normalized_to_screen(0.5, 0.5)
    assert abs(xc - (w - 1) // 2) <= 1
    assert abs(yc - (h - 1) // 2) <= 1

    # Test clamping out-of-bounds coordinates
    x_neg, y_neg = InputService.map_normalized_to_screen(-0.5, -0.2)
    assert x_neg == 0
    assert y_neg == 0

    x_over, y_over = InputService.map_normalized_to_screen(1.5, 2.0)
    assert x_over == w - 1
    assert y_over == h - 1


def test_input_unauthorized_without_token(client):
    """Verify input endpoints reject requests without a valid session token."""
    assert client.get("/api/input/status").status_code == 401
    assert client.get("/api/input/screen-info").status_code == 401
    assert client.post("/api/input/control", json={"action": "enable"}).status_code == 401
    assert client.post("/api/input/mouse/move", json={"x": 0.5, "y": 0.5}).status_code == 401
    assert client.post("/api/input/mouse/click", json={"button": "left"}).status_code == 401
    assert client.post("/api/input/keyboard/key", json={"key": "enter"}).status_code == 401


def test_input_disabled_by_default(client):
    """Verify input requests are rejected with 403 Forbidden until explicitly enabled."""
    headers = get_auth_headers(client)

    # Status shows disabled
    status_res = client.get("/api/input/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["enabled"] is False

    # Attempting mouse move while disabled returns 403
    move_res = client.post("/api/input/mouse/move", json={"x": 0.5, "y": 0.5}, headers=headers)
    assert move_res.status_code == 403
    assert "disabled" in move_res.json()["detail"].lower()

    # Attempting click returns 403
    click_res = client.post("/api/input/mouse/click", json={"button": "left"}, headers=headers)
    assert click_res.status_code == 403

    # Attempting key returns 403
    key_res = client.post("/api/input/keyboard/key", json={"key": "enter"}, headers=headers)
    assert key_res.status_code == 403


def test_input_enable_and_disable_lifecycle(client):
    """Verify explicit input enablement and emergency disable control."""
    headers = get_auth_headers(client)

    # Enable input
    enable_res = client.post("/api/input/control", json={"action": "enable"}, headers=headers)
    assert enable_res.status_code == 200
    assert enable_res.json()["success"] is True

    # Check status
    status_res = client.get("/api/input/status", headers=headers)
    assert status_res.json()["enabled"] is True

    # Mouse move now succeeds
    move_res = client.post("/api/input/mouse/move", json={"x": 0.25, "y": 0.75}, headers=headers)
    assert move_res.status_code == 200
    assert move_res.json()["success"] is True

    # Emergency stop / disable
    disable_res = client.post("/api/input/control", json={"action": "emergency_stop"}, headers=headers)
    assert disable_res.status_code == 200
    assert disable_res.json()["success"] is True

    # Status is now disabled
    assert client.get("/api/input/status", headers=headers).json()["enabled"] is False

    # Further move is blocked with 403
    assert client.post("/api/input/mouse/move", json={"x": 0.5, "y": 0.5}, headers=headers).status_code == 403


def test_mouse_interactions(client):
    """Verify mouse clicks, relative moves, and scrolling."""
    headers = get_auth_headers(client)
    client.post("/api/input/control", json={"action": "enable"}, headers=headers)

    # Relative move
    rel_res = client.post("/api/input/mouse/relative", json={"dx": 20.0, "dy": -15.0}, headers=headers)
    assert rel_res.status_code == 200
    assert rel_res.json()["success"] is True

    # Click with position
    click_res = client.post(
        "/api/input/mouse/click",
        json={"button": "right", "action": "click", "x": 0.3, "y": 0.4},
        headers=headers,
    )
    assert click_res.status_code == 200

    # Double click
    dbl_res = client.post(
        "/api/input/mouse/click",
        json={"button": "left", "action": "double_click"},
        headers=headers,
    )
    assert dbl_res.status_code == 200

    # Scroll
    scroll_res = client.post("/api/input/mouse/scroll", json={"delta_y": 120}, headers=headers)
    assert scroll_res.status_code == 200


def test_keyboard_interactions(client):
    """Verify key press, Unicode text typing, and multi-key shortcuts."""
    headers = get_auth_headers(client)
    client.post("/api/input/control", json={"action": "enable"}, headers=headers)

    # Special key press
    key_res = client.post("/api/input/keyboard/key", json={"key": "escape", "action": "press"}, headers=headers)
    assert key_res.status_code == 200
    assert key_res.json()["success"] is True

    # Arrow keys
    for arrow in ["up", "down", "left", "right"]:
        res = client.post("/api/input/keyboard/key", json={"key": arrow}, headers=headers)
        assert res.status_code == 200

    # Text typing
    text_res = client.post(
        "/api/input/keyboard/text", json={"text": "PocketDesk Test 123! @#$"}, headers=headers
    )
    assert text_res.status_code == 200

    # Shortcut
    shortcut_res = client.post(
        "/api/input/keyboard/shortcut", json={"keys": ["ctrl", "c"]}, headers=headers
    )
    assert shortcut_res.status_code == 200


def test_input_validation_rejections(client):
    """Verify malformed, invalid, or excessive inputs are strictly rejected."""
    headers = get_auth_headers(client)
    client.post("/api/input/control", json={"action": "enable"}, headers=headers)

    # Coordinate out of [0.0, 1.0] bounds
    assert client.post("/api/input/mouse/move", json={"x": 1.5, "y": 0.5}, headers=headers).status_code == 422
    assert client.post("/api/input/mouse/move", json={"x": -0.1, "y": 0.5}, headers=headers).status_code == 422

    # Invalid button
    assert client.post("/api/input/mouse/click", json={"button": "laser"}, headers=headers).status_code == 422

    # Invalid action
    assert client.post("/api/input/mouse/click", json={"action": "explode"}, headers=headers).status_code == 422

    # Unrecognized key name (not in allowed list)
    assert client.post("/api/input/keyboard/key", json={"key": "some_arbitrary_shell_command"}, headers=headers).status_code == 422

    # Oversized text (> 500 characters)
    assert client.post("/api/input/keyboard/text", json={"text": "a" * 501}, headers=headers).status_code == 422


def test_unpair_disables_input(client):
    """Verify that unpairing automatically terminates remote input authorization."""
    headers = get_auth_headers(client)

    # Enable input
    client.post("/api/input/control", json={"action": "enable"}, headers=headers)
    assert InputService.is_enabled() is True

    # Unpair
    unpair_res = client.post("/api/unpair", headers=headers)
    assert unpair_res.status_code == 200

    # Input should be disabled
    assert InputService.is_enabled() is False


def test_emergency_cleanup_releases_held_keys_and_buttons():
    """Verify emergency cleanup clears any held keys or mouse buttons."""
    InputService.set_mock_mode(True)
    InputService.enable_input()

    # Simulate held button and key
    InputService._held_buttons.add("left")
    InputService._held_keys.add(0x11)  # Ctrl
    assert len(InputService._held_buttons) == 1
    assert len(InputService._held_keys) == 1

    # Cleanup
    InputService.emergency_cleanup()
    assert len(InputService._held_buttons) == 0
    assert len(InputService._held_keys) == 0
