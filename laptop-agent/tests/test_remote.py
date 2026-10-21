import os
import time
import uuid
import pytest
from app.services.auth import AuthService
from app.services.devices import DeviceRegistry
from app.services.security import RateLimiter, ReplayProtection
from app.services.turn import TurnService


@pytest.fixture(autouse=True)
def reset_security_services():
    """Reset device registry, rate limiters, and replay caches before each test."""
    DeviceRegistry.clear_all()
    RateLimiter.reset_all()
    ReplayProtection.reset()
    AuthService.clear_all_sessions()
    yield
    DeviceRegistry.clear_all()
    RateLimiter.reset_all()
    ReplayProtection.reset()
    AuthService.clear_all_sessions()


def get_fresh_nonce_payload():
    return {
        "timestamp": time.time(),
        "nonce": uuid.uuid4().hex,
    }


def test_device_pairing_with_pin(client):
    """Verify explicit device pairing registers device and issues initial session token."""
    pin = DeviceRegistry.generate_pairing_pin()
    device_id = "test_device_phone_001"
    nonce_info = get_fresh_nonce_payload()

    res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Test iPhone 15",
            "pairing_pin": pin,
            **nonce_info,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "paired"
    assert data["device_id"] == device_id
    assert "device_secret" in data
    assert "session_token" in data
    assert data["expires_in_seconds"] == 3600

    # Device is now authorized
    assert DeviceRegistry.is_device_authorized(device_id) is True

    # One-time PIN is consumed and cannot be reused
    reuse_nonce = get_fresh_nonce_payload()
    res2 = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": "test_device_phone_002",
            "device_name": "Another Phone",
            "pairing_pin": pin,
            **reuse_nonce,
        },
    )
    assert res2.status_code == 401


def test_replay_attack_prevention(client):
    """Verify replayed nonces or stale timestamps are rejected."""
    pin = DeviceRegistry.generate_pairing_pin()
    device_id = "test_device_replay_001"
    fixed_nonce = "fixed_test_nonce_12345"
    now = time.time()

    # 1. Stale timestamp (> 60s in past) rejected
    stale_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Replay Tester",
            "pairing_pin": pin,
            "timestamp": now - 120.0,
            "nonce": fixed_nonce,
        },
    )
    assert stale_res.status_code == 400
    assert "expired" in stale_res.json()["detail"].lower()

    # 2. Fresh request succeeds
    fresh_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Replay Tester",
            "pairing_pin": pin,
            "timestamp": now,
            "nonce": fixed_nonce,
        },
    )
    assert fresh_res.status_code == 200

    # 3. Same nonce submitted again is rejected as replay attack
    new_pin = DeviceRegistry.generate_pairing_pin()
    replay_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": "another_device",
            "device_name": "Replay Attack",
            "pairing_pin": new_pin,
            "timestamp": now + 1.0,
            "nonce": fixed_nonce,  # Reused!
        },
    )
    assert replay_res.status_code == 400
    assert "replay attack detected" in replay_res.json()["detail"].lower()


def test_pairing_rate_limiter(client):
    """Verify rapid failed pairing attempts trigger rate limit lockout (429)."""
    device_id = "brute_force_bot_001"

    # Send 5 incorrect PIN attempts
    for i in range(5):
        nonce_info = get_fresh_nonce_payload()
        res = client.post(
            "/api/remote/devices/pair",
            json={
                "device_id": device_id,
                "device_name": "Bot Device",
                "pairing_pin": "000000",
                **nonce_info,
            },
        )
        assert res.status_code == 401

    # 6th attempt should be locked out with 429 Too Many Requests
    nonce_info = get_fresh_nonce_payload()
    lockout_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Bot Device",
            "pairing_pin": "000000",
            **nonce_info,
        },
    )
    assert lockout_res.status_code == 429
    assert "too many" in lockout_res.json()["detail"].lower()


def test_session_creation_for_paired_device(client):
    """Verify authorized devices can request short-lived session tokens."""
    pin = DeviceRegistry.generate_pairing_pin()
    device_id = "authorized_pixel_001"
    nonce_info = get_fresh_nonce_payload()

    # 1. Pair
    pair_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Pixel 8 Pro",
            "pairing_pin": pin,
            **nonce_info,
        },
    )
    secret = pair_res.json()["device_secret"]

    # 2. Request new session token later using device_secret
    session_nonce = get_fresh_nonce_payload()
    session_res = client.post(
        "/api/remote/session/create",
        json={
            "device_id": device_id,
            "device_secret": secret,
            **session_nonce,
        },
    )
    assert session_res.status_code == 200
    s_data = session_res.json()
    assert "session_token" in s_data
    assert s_data["device_id"] == device_id

    # 3. Request with bad secret rejected
    bad_nonce = get_fresh_nonce_payload()
    bad_res = client.post(
        "/api/remote/session/create",
        json={
            "device_id": device_id,
            "device_secret": "wrong_secret_abcdef1234567890abcdef1234567890",
            **bad_nonce,
        },
    )
    assert bad_res.status_code == 401


def test_device_revocation(client):
    """Verify revoking a device terminates its authorization and active sessions."""
    pin = DeviceRegistry.generate_pairing_pin()
    device_id = "device_to_be_revoked"
    nonce_info = get_fresh_nonce_payload()

    # 1. Pair
    pair_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "Stolen Laptop",
            "pairing_pin": pin,
            **nonce_info,
        },
    )
    token = pair_res.json()["session_token"]
    secret = pair_res.json()["device_secret"]

    # 2. Verify device appears in authorized list
    list_res = client.get("/api/remote/devices", headers={"Authorization": f"Bearer {token}"})
    assert list_res.status_code == 200
    devices = list_res.json()["devices"]
    assert any(d["device_id"] == device_id for d in devices)

    # 3. Revoke device
    revoke_res = client.post(
        f"/api/remote/devices/{device_id}/revoke",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["success"] is True

    # 4. Old session token is now invalid (401)
    probe_res = client.get("/api/remote/devices", headers={"Authorization": f"Bearer {token}"})
    assert probe_res.status_code == 401

    # 5. Device cannot create new session tokens
    renew_nonce = get_fresh_nonce_payload()
    renew_res = client.post(
        "/api/remote/session/create",
        json={
            "device_id": device_id,
            "device_secret": secret,
            **renew_nonce,
        },
    )
    assert renew_res.status_code == 401
    assert "revoked" in renew_res.json()["detail"].lower()


def test_dynamic_ice_server_configuration(client):
    """Verify dynamic ICE server response returns STUN and time-limited TURN credentials."""
    pin = DeviceRegistry.generate_pairing_pin()
    device_id = "device_ice_tester"
    nonce_info = get_fresh_nonce_payload()

    pair_res = client.post(
        "/api/remote/devices/pair",
        json={
            "device_id": device_id,
            "device_name": "ICE Tester",
            "pairing_pin": pin,
            **nonce_info,
        },
    )
    token = pair_res.json()["session_token"]

    # Test without TURN configured
    res = client.get("/api/remote/ice-servers", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "ice_servers" in data
    assert any("stun:" in u for s in data["ice_servers"] for u in s["urls"])

    # Test with TURN configured via environment
    os.environ["POCKETDESK_TURN_URL"] = "turn:turn.pocketdesk.example.com:3478?transport=udp"
    os.environ["POCKETDESK_TURN_SECRET"] = "super_secure_turn_shared_secret_998877"

    try:
        res_turn = client.get("/api/remote/ice-servers", headers={"Authorization": f"Bearer {token}"})
        assert res_turn.status_code == 200
        turn_data = res_turn.json()
        assert turn_data["turn_configured"] is True
        assert turn_data["nat_traversal_mode"] == "turn_relay_available"

        turn_entry = next(s for s in turn_data["ice_servers"] if "turn:" in s["urls"][0])
        assert "username" in turn_entry
        assert "credential" in turn_entry
        assert device_id in turn_entry["username"]
    finally:
        os.environ.pop("POCKETDESK_TURN_URL", None)
        os.environ.pop("POCKETDESK_TURN_SECRET", None)
