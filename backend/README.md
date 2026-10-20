# PocketDesk Backend (Stage 2)

> **Status:** Architecture definition only. Implementation begins in **Stage 2**.

The PocketDesk backend is a lightweight Python service built on **FastAPI** and **WebSockets**. It acts as the secure local bridge between the mobile web client and the Windows host agent.

---

## Planned Responsibilities

1. **Authentication & Pairing Handshake:**
   - Issues short-lived, cryptographically secure 6-digit PIN codes or QR tokens for pairing.
   - Enforces mutual token validation on every WebSocket message.

2. **WebRTC Signaling & Relay:**
   - Exchanges Session Description Protocol (SDP) offers/answers and ICE candidates between client and agent.
   - Fallback WebSocket binary streaming channel when WebRTC direct connection is unavailable.

3. **Input & Command Dispatch:**
   - Validates incoming mouse movement deltas, clicks, and keystrokes.
   - Forwards sanitized commands to the native Windows agent.

4. **Telemetry & File Streaming:**
   - Periodically streams CPU, RAM, disk, and network stats via WebSocket.
   - Handles multi-part chunked binary file uploads and downloads.

---

## Planned Endpoints

| Protocol | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/pair` | Authenticate client with pairing PIN/token |
| `GET` | `/api/status` | Host status and connection health |
| `GET` | `/ws/signaling` | WebRTC session negotiation channel |
| `GET` | `/ws/control` | Low-latency input events (mouse, keyboard) |
| `GET` | `/ws/telemetry` | 1000ms system resource metrics feed |
| `POST` | `/api/files/upload` | Chunked file upload to Windows file system |

---

## Security Invariants (Development Rule #10)

- Binds exclusively to `127.0.0.1` and private local subnet interfaces (e.g., `192.168.x.x`).
- Never binds to public WAN addresses or opens UPnP ports during early development stages.
- No third-party cloud relays or external paid API keys required.
