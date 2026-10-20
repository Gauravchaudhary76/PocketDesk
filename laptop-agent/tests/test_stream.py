import pytest
from aiortc import RTCPeerConnection
from app.services.auth import AuthService
from app.services.stream import StreamManager


def get_auth_headers(client):
    """Helper to pair and return valid authorization headers."""
    AuthService.clear_all_sessions()
    code = AuthService.get_active_code()
    res = client.post("/api/pair", json={"pairing_code": code})
    assert res.status_code == 200
    token = res.json()["session_token"]
    return {"Authorization": f"Bearer {token}"}


def test_stream_offer_unauthorized_without_token(client):
    """Verify that initiating a stream without authentication is rejected with 401."""
    response = client.post(
        "/api/stream/offer",
        json={"sdp": "dummy_sdp", "type": "offer", "fps": 20, "resolution": "720p"}
    )
    assert response.status_code == 401


def test_stream_status_endpoint(client):
    """Verify querying stream status returns valid schema."""
    response = client.get("/api/stream/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_streaming" in data
    assert isinstance(data["is_streaming"], bool)


def test_stream_stop_endpoint(client):
    """Verify stopping screen share returns confirmation."""
    response = client.post("/api/stream/stop")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "stopped"
    assert "message" in data


def test_webrtc_signaling_offer_and_answer(client):
    """
    Simulate full WebRTC signaling handshake:
    1. Browser client creates local RTCPeerConnection with recvonly video transceiver.
    2. Generates SDP offer and submits to /api/stream/offer with valid bearer token.
    3. Agent responds with valid SDP answer.
    4. Client sets remote description.
    5. Clean termination via /api/stream/stop.
    """
    import asyncio

    async def run_signaling_test():
        headers = get_auth_headers(client)

        # 1. Simulate client peer connection
        client_pc = RTCPeerConnection()
        client_pc.addTransceiver("video", direction="recvonly")
        offer = await client_pc.createOffer()
        await client_pc.setLocalDescription(offer)

        # 2. Submit offer to agent
        payload = {
            "sdp": client_pc.localDescription.sdp,
            "type": "offer",
            "fps": 15,
            "resolution": "540p",
        }
        response = client.post("/api/stream/offer", json=payload, headers=headers)
        assert response.status_code == 200

        answer_data = response.json()
        assert answer_data["status"] == "streaming"
        assert answer_data["type"] == "answer"
        assert "sdp" in answer_data
        assert len(answer_data["sdp"]) > 0
        assert answer_data["fps"] == 15
        assert answer_data["resolution"] == "540p"

        # 3. Verify agent status endpoint reflects active streaming
        status_res = client.get("/api/stream/status")
        assert status_res.status_code == 200
        assert status_res.json()["is_streaming"] is True
        assert status_res.json()["fps"] == 15
        assert status_res.json()["resolution"] == "540p"

        # 4. Stop stream
        stop_res = client.post("/api/stream/stop")
        assert stop_res.status_code == 200
        assert stop_res.json()["status"] == "stopped"

        # 5. Verify status returns inactive
        status_after = client.get("/api/stream/status")
        assert status_after.status_code == 200
        assert status_after.json()["is_streaming"] is False

        # Cleanup client PC
        await client_pc.close()
        await StreamManager.stop_stream()

    asyncio.run(run_signaling_test())
