# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 6 implemented. Supports secure remote internet access, WebRTC NAT traversal (dynamic STUN/TURN), persistent device pairing, cryptographic replay protection, sliding-window rate limiting, live hardware telemetry, screen streaming, and remote mouse/keyboard control.

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides terminal-authorized device pairing, system health reporting, live hardware telemetry, user-initiated WebRTC screen capture, safe Win32 mouse/keyboard injection, and production-grade NAT traversal over the internet.

---

## Architecture & Endpoints

| Method | Path | Summary | Authentication | Response Model |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Agent health check, version, and uptime | Unauthenticated | `HealthResponse` |
| `POST` | `/api/pair` | Authorize local client with 6-digit terminal PIN | Unauthenticated (PIN required) | `PairResponse` |
| `POST` | `/api/unpair` | Revoke active local session token | Bearer Token Required | `UnpairResponse` |
| `GET` | `/api/system` | Host OS, CPU load, RAM allocation, and battery | Bearer Token Required | `SystemInfoResponse` |
| `GET` | `/api/capabilities` | List of implemented capabilities | Bearer Token Required | `CapabilitiesResponse` |
| `POST` | `/api/stream/offer` | Authenticated WebRTC SDP offer/answer exchange | Bearer Token Required | `StreamAnswerResponse` |
| `POST` | `/api/stream/stop` | Terminate active desktop screen streaming session | Bearer Token Required | `StreamStopResponse` |
| `GET` | `/api/stream/status` | Inquire whether desktop capture is active | Bearer Token Required | `StreamStatusResponse` |
| `GET` | `/api/input/status` | Inquire whether remote input is authorized | Bearer Token Required | `InputStatusResponse` |
| `GET` | `/api/input/screen-info`| Primary display pixel dimensions & aspect ratio | Bearer Token Required | `ScreenInfoResponse` |
| `POST` | `/api/input/control` | Explicitly enable, disable, or emergency stop input | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/mouse/move` | Move mouse to normalized coordinates `[0.0, 1.0]` | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/mouse/relative` | Move mouse relative to current position (`dx`, `dy`) | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/mouse/click`| Dispatch mouse button click, down, or up | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/mouse/scroll` | Dispatch vertical wheel scroll | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/keyboard/key` | Press, hold down, or release virtual key | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/keyboard/text`| Type Unicode string into active window | Bearer Token Required | `InputOperationResponse` |
| `POST` | `/api/input/keyboard/shortcut`| Execute multi-key combination (e.g. `['ctrl', 'c']`) | Bearer Token Required | `InputOperationResponse` |
| `WS` | `/api/input/ws` | Low-latency bi-directional WebSocket input stream | Token Query / Auth Packet | WebSocket Stream |
| **Stage 6 Remote Endpoints** | | | | |
| `POST` | `/api/remote/devices/pair` | Register trusted device via 5-minute terminal PIN | Rate-limited + Replay-checked | `DevicePairResponse` |
| `POST` | `/api/remote/session/create` | Request 1-hour session token using device secret | Rate-limited + Replay-checked | `RemoteSessionResponse` |
| `GET` | `/api/remote/devices` | List all authorized devices paired with host | Bearer Token Required | `DeviceListResponse` |
| `POST` | `/api/remote/devices/{id}/revoke`| Instantly revoke trusted device & active streams | Bearer Token Required | `DeviceRevokeResponse` |
| `GET` | `/api/remote/ice-servers` | Get dynamic STUN + RFC 5766 TURN credentials | Bearer Token Required | `IceServerConfigResponse` |

---

## Operating System Limitations (Windows UIPI / UAC)

> [!IMPORTANT]
> **Windows User Interface Privilege Isolation (UIPI) & Secure Desktop Restrictions:**
> 1. **Elevated Windows:** If a window on the Windows laptop is running as Administrator (elevated), Windows kernel security blocks non-elevated applications from sending synthetic input to it.
> 2. **Secure Desktop (UAC & Ctrl+Alt+Del):** When a User Account Control prompt appears ("Do you want to allow this app to make changes...") or when the Windows Lock/Login screen is active, Windows shifts to the isolated Secure Desktop. Standard non-elevated user processes cannot inject keystrokes or mouse clicks into this screen.
> 3. **Remediation:** To control elevated windows remotely, start the laptop agent by opening PowerShell with **"Run as Administrator"**.

---

## Starting the Agent

### Mode 1: Local Wi-Fi Access Mode
```powershell
python run.py --lan
```
Terminal output:
```
==================================================
  PocketDesk Laptop Agent v0.6.0 (Stage 6)
  Mode: Local Wi-Fi Network Access enabled
  Listening on all interfaces: http://0.0.0.0:8000
  Phone Connection URL: http://192.168.1.145:8000
--------------------------------------------------
  >> PAIRING PIN: 839201 <<
  Enter this 6-digit PIN on your phone to connect.
==================================================
```

### Mode 2: Remote Internet Access Mode (Behind Reverse Proxy)
When using a reverse proxy (Caddy / Nginx / Cloudflare Tunnel):
```powershell
# Set environment variables for TURN relay and local binding
$env:POCKETDESK_HOST="127.0.0.1"
$env:POCKETDESK_TURN_URL="turn:turn.yourdomain.com:3478"
$env:POCKETDESK_TURN_SECRET="your-256bit-turn-secret"

python run.py
```
For complete reverse proxy and Coturn setup, consult [`docs/deployment_guide.md`](../docs/deployment_guide.md).

---

## Stage 6 Security Controls & Hardening

1. **Persistent Device Registry & 256-bit Secrets:**
   Initial pairing generates a cryptographically random 256-bit secret stored in `data/devices.json` and client `localStorage`.

2. **Cryptographic Replay Protection:**
   Pairing and session requests must include a timestamp within $\pm 60$ seconds and a single-use UUID nonce. Replayed nonces are rejected with HTTP 400.

3. **Sliding-Window Rate Limiting:**
   After 5 consecutive failed authentication attempts, client IP is locked out for 300 seconds (HTTP 429).

4. **Dynamic RFC 5766 TURN Ephemeral Credentials:**
   TURN relay passwords are generated dynamically on demand using HMAC-SHA1 over the timestamp and shared secret.

5. **Instant Revocation Kill Switch:**
   Revoking a device immediately invalidates its secret, closes active WebRTC media tracks, and halts input injection.

---

## Testing the Agent

### Run Automated Test Suite
```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent
.\.venv\Scripts\pytest.exe -v
```
All **34 automated tests** verify:
- Device registration, 256-bit secret creation, and role management
- Cryptographic replay protection and expired timestamp rejection
- Sliding-window rate limiter lockouts
- Device revocation and active session termination
- Dynamic STUN + RFC 5766 TURN credential generation
- Win32 coordinate mapping and boundary clamping
- Input validation (rejection of unwhitelisted keys and oversized text payloads)
- Authentication enforcement on all sensitive endpoints
- Safe key and mouse button release during cleanup
