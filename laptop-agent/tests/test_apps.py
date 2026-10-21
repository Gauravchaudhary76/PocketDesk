from unittest.mock import MagicMock
from app.services.auth import AuthService
from app.services.app_launcher import app_launcher


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_apps_unauthorized(client):
    """Verify application launcher endpoints reject unauthenticated requests."""
    assert client.get("/api/apps/allowlist").status_code == 401
    assert client.post("/api/apps/launch", json={"app_id": "calc"}).status_code == 401


def test_get_allowlist(client):
    """Verify GET /api/apps/allowlist returns predefined allowlist."""
    headers = get_auth_headers(client)
    res = client.get("/api/apps/allowlist", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "apps" in data
    assert len(data["apps"]) > 0

    app_dict = {a["app_id"]: a for a in data["apps"]}
    assert "notepad" in app_dict
    assert "calc" in app_dict
    assert "explorer" in app_dict
    assert "taskmgr" in app_dict
    assert "terminal" in app_dict

    # Check disruptive flags
    assert app_dict["notepad"]["is_disruptive"] is False
    assert app_dict["taskmgr"]["is_disruptive"] is True
    assert app_dict["terminal"]["is_disruptive"] is True


def test_launch_unknown_app_rejected(client):
    """Verify non-allowlisted apps are rejected with 400 Bad Request."""
    headers = get_auth_headers(client)
    res = client.post(
        "/api/apps/launch",
        json={"app_id": "arbitrary_cmd_exe", "confirmed": False},
        headers=headers,
    )
    assert res.status_code == 400
    assert "not in the approved allowlist" in res.json()["detail"].lower()


def test_launch_disruptive_app_without_confirmation(client):
    """Verify launching a disruptive application without confirmation returns 400."""
    headers = get_auth_headers(client)
    res = client.post(
        "/api/apps/launch",
        json={"app_id": "taskmgr", "confirmed": False},
        headers=headers,
    )
    assert res.status_code == 400
    assert "confirmation required" in res.json()["detail"].lower()


def test_launch_disruptive_app_with_confirmation(client, monkeypatch):
    """Verify launching disruptive app with confirmed=True succeeds."""
    headers = get_auth_headers(client)

    # Mock subprocess.Popen
    mock_proc = MagicMock()
    mock_proc.pid = 9999
    monkeypatch.setattr("subprocess.Popen", lambda *args, **kwargs: mock_proc)
    monkeypatch.setattr(app_launcher, "_resolve_executable", lambda info: r"C:\Windows\System32\taskmgr.exe")

    res = client.post(
        "/api/apps/launch",
        json={"app_id": "taskmgr", "confirmed": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["app_id"] == "taskmgr"
    assert data["pid"] == 9999


def test_launch_safe_app(client, monkeypatch):
    """Verify launching standard safe app without explicit confirmation succeeds."""
    headers = get_auth_headers(client)

    # Mock subprocess.Popen
    mock_proc = MagicMock()
    mock_proc.pid = 8888
    monkeypatch.setattr("subprocess.Popen", lambda *args, **kwargs: mock_proc)
    monkeypatch.setattr(app_launcher, "_resolve_executable", lambda info: r"C:\Windows\System32\calc.exe")

    res = client.post(
        "/api/apps/launch",
        json={"app_id": "calc", "confirmed": False},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["app_id"] == "calc"
    assert data["pid"] == 8888


def test_launch_app_not_installed(client, monkeypatch):
    """Verify 404 is returned when an allowlisted app is not found on host."""
    headers = get_auth_headers(client)
    monkeypatch.setattr(app_launcher, "_resolve_executable", lambda info: None)

    res = client.post(
        "/api/apps/launch",
        json={"app_id": "code", "confirmed": False},
        headers=headers,
    )
    assert res.status_code == 404
    assert "not installed" in res.json()["detail"].lower()
