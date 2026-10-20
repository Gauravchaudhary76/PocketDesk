from app.services.auth import AuthService


def test_pairing_success(client):
    """Verify that submitting the correct 6-digit terminal PIN successfully issues a session token."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()

    response = client.post("/api/pair", json={"pairing_code": code, "client_name": "Test Phone"})
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "paired"
    assert "session_token" in data
    assert len(data["session_token"]) == 64  # 32 bytes hex
    assert data["token_type"] == "Bearer"
    assert data["expires_in_seconds"] > 0


def test_pairing_invalid_code(client):
    """Verify that an incorrect pairing PIN is rejected with 401 Unauthorized."""
    AuthService.clear_all_sessions()
    real_code = AuthService.get_active_code()
    wrong_code = "999999" if real_code != "999999" else "111111"

    response = client.post("/api/pair", json={"pairing_code": wrong_code, "client_name": "Attacker"})
    assert response.status_code == 401
    assert "detail" in response.json()


def test_unpair_and_session_invalidation(client):
    """Verify that unpairing invalidates the session token."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()

    # Pair
    pair_res = client.post("/api/pair", json={"pairing_code": code})
    assert pair_res.status_code == 200
    token = pair_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token works for system endpoint
    sys_res = client.get("/api/system", headers=headers)
    assert sys_res.status_code == 200

    # Unpair
    unpair_res = client.post("/api/unpair", headers=headers)
    assert unpair_res.status_code == 200
    assert unpair_res.json()["status"] == "unpaired"

    # Subsequent call with revoked token must fail with 401
    sys_res_after = client.get("/api/system", headers=headers)
    assert sys_res_after.status_code == 401


def test_brute_force_lockout(client):
    """Verify rate-limiting and lockout protection after excessive incorrect attempts."""
    AuthService.clear_all_sessions()
    real_code = AuthService.get_active_code()
    bad_code = "000000" if real_code != "000000" else "111111"

    for _ in range(5):
        client.post("/api/pair", json={"pairing_code": bad_code})

    # The 6th attempt should be locked out
    locked_res = client.post("/api/pair", json={"pairing_code": bad_code})
    assert locked_res.status_code == 401
    assert "locked out" in locked_res.json()["detail"].lower()

    # Reset lockout for other tests
    AuthService.clear_all_sessions()
