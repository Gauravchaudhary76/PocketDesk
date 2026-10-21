import pytest
from unittest.mock import MagicMock
from app.services.auth import AuthService
from app.services.assistant import assistant_service


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_assistant_unauthorized(client):
    """Verify assistant endpoints reject unauthenticated requests."""
    assert client.get("/api/assistant/intents").status_code == 401
    assert client.post("/api/assistant/parse", json={"prompt": "help"}).status_code == 401
    assert client.post("/api/assistant/execute", json={"command_id": "c1", "action_type": "show_help"}).status_code == 401


def test_get_intents_catalog(client):
    """Verify GET /api/assistant/intents returns intent catalog."""
    headers = get_auth_headers(client)
    res = client.get("/api/assistant/intents", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "intents" in data
    assert len(data["intents"]) >= 6

    intent_names = [i["intent"] for i in data["intents"]]
    assert "open_app" in intent_names
    assert "system_status" in intent_names
    assert "search_files" in intent_names
    assert "screen_stream" in intent_names
    assert "screenshot" in intent_names
    assert "help" in intent_names


def test_parse_help_command(client):
    """Verify parsing 'help' instruction."""
    headers = get_auth_headers(client)
    res = client.post("/api/assistant/parse", json={"prompt": "what can you do?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "help"
    assert data["action_type"] == "show_help"
    assert data["is_supported"] is True
    assert data["requires_confirmation"] is False


def test_parse_system_status(client):
    """Verify parsing system status instructions."""
    headers = get_auth_headers(client)
    res = client.post("/api/assistant/parse", json={"prompt": "how is my laptop doing?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "system_status"
    assert data["action_type"] == "get_system_status"
    assert data["is_supported"] is True


def test_parse_open_app(client):
    """Verify parsing application launch instructions."""
    headers = get_auth_headers(client)

    # Standard safe app: Notepad
    res = client.post("/api/assistant/parse", json={"prompt": "open notepad"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "open_app"
    assert data["action_type"] == "launch_app"
    assert data["parameters"]["app_id"] == "notepad"
    assert data["requires_confirmation"] is False

    # Standard safe app: Calculator
    res2 = client.post("/api/assistant/parse", json={"prompt": "launch calculator"}, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["parameters"]["app_id"] == "calc"

    # Disruptive app: Task Manager requires confirmation
    res3 = client.post("/api/assistant/parse", json={"prompt": "run task manager"}, headers=headers)
    assert res3.status_code == 200
    assert res3.json()["parameters"]["app_id"] == "taskmgr"
    assert res3.json()["requires_confirmation"] is True
    assert res3.json()["risk_level"] == "disruptive"


def test_parse_unsupported_app(client):
    """Verify requesting an app outside the allowlist is rejected."""
    headers = get_auth_headers(client)
    res = client.post("/api/assistant/parse", json={"prompt": "open random_game.exe"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["is_supported"] is False
    assert "not in the approved" in data["rejection_reason"].lower()


def test_parse_search_files(client):
    """Verify parsing file search instructions."""
    headers = get_auth_headers(client)
    res = client.post("/api/assistant/parse", json={"prompt": "search for report in documents"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "search_files"
    assert data["action_type"] == "search_files"
    assert data["parameters"]["query"] == "report"
    assert data["parameters"]["root_id"] == "documents"


def test_parse_screenshot(client):
    """Verify parsing screenshot instruction requires explicit confirmation."""
    headers = get_auth_headers(client)
    res = client.post("/api/assistant/parse", json={"prompt": "take a screenshot"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "screenshot"
    assert data["action_type"] == "capture_screenshot"
    assert data["requires_confirmation"] is True
    assert data["risk_level"] == "moderate"


def test_parse_prohibited_destructive_commands(client):
    """Verify destructive instructions and raw shell attempts are blocked."""
    headers = get_auth_headers(client)

    prohibited_prompts = [
        "rm -rf /",
        "del /f /q C:\\Windows",
        "format C:",
        "shutdown my computer",
        "powershell -command 'Invoke-WebRequest evil'",
        "cmd /c net user hacker pass /add",
    ]

    for p in prohibited_prompts:
        res = client.post("/api/assistant/parse", json={"prompt": p}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "prohibited"
        assert data["action_type"] == "none"
        assert data["is_supported"] is False
        assert data["risk_level"] == "prohibited"
        assert "prohibited" in data["rejection_reason"].lower()


def test_execute_system_status(client):
    """Verify executing get_system_status returns real telemetry."""
    headers = get_auth_headers(client)
    res = client.post(
        "/api/assistant/execute",
        json={"command_id": "cmd_test1", "action_type": "get_system_status", "confirmed": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["action_type"] == "get_system_status"
    assert "result_data" in data
    assert "cpu" in data["result_data"]
    assert "memory" in data["result_data"]


def test_execute_screenshot_unconfirmed_rejected(client):
    """Verify executing screenshot without confirmation returns 400."""
    headers = get_auth_headers(client)
    res = client.post(
        "/api/assistant/execute",
        json={"command_id": "cmd_test2", "action_type": "capture_screenshot", "confirmed": False},
        headers=headers,
    )
    assert res.status_code == 400
    assert "confirmation required" in res.json()["detail"].lower()


def test_execute_screenshot_confirmed(client, monkeypatch):
    """Verify executing screenshot with confirmation returns image data URI."""
    headers = get_auth_headers(client)

    # Mock _capture_desktop_screenshot
    mock_data = {
        "image_data_uri": "data:image/jpeg;base64,dummybase64data",
        "width": 1280,
        "height": 720,
        "original_width": 1920,
        "original_height": 1080,
        "timestamp": "2026-10-21T10:00:00Z",
    }
    monkeypatch.setattr(assistant_service, "_capture_desktop_screenshot", lambda: mock_data)

    res = client.post(
        "/api/assistant/execute",
        json={"command_id": "cmd_test3", "action_type": "capture_screenshot", "confirmed": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["result_data"]["image_data_uri"].startswith("data:image/jpeg;base64,")


def test_execute_launch_app(client, monkeypatch):
    """Verify executing launch_app spawns allowlisted app."""
    headers = get_auth_headers(client)

    mock_res = MagicMock()
    mock_res.pid = 4321
    monkeypatch.setattr("app.services.app_launcher.app_launcher.launch_app", lambda app_id, conf: mock_res)

    res = client.post(
        "/api/assistant/execute",
        json={
            "command_id": "cmd_test4",
            "action_type": "launch_app",
            "parameters": {"app_id": "calc"},
            "confirmed": False,
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["result_data"]["pid"] == 4321
