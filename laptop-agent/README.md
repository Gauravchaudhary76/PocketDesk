# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 7 implemented (v0.7.0). Supports restricted filesystem management (browsing, downloading, uploading, folder creation in approved roots), allowlist-restricted application launching with disruptive action confirmation, secure remote internet access via WebRTC NAT traversal, live hardware telemetry, screen streaming, and remote mouse/keyboard control.

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides terminal-authorized device pairing, system health reporting, live hardware telemetry, user-initiated WebRTC screen capture, safe Win32 mouse/keyboard injection, production-grade NAT traversal, safe file operations, and allowlisted application launching.

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
| **Stage 7 File & App Endpoints** | | | | |
| `GET` | `/api/files/roots` | List approved filesystem roots (Downloads, Documents, Desktop) | Bearer Token Required | `ApprovedRootsResponse` |
| `GET` | `/api/files/list` | List directory contents with path traversal defense | Bearer Token Required | `DirectoryListingResponse` |
| `GET` | `/api/files/download` | Download authorized file from approved root | Bearer Token Required | Binary Stream |
| `POST` | `/api/files/upload` | Upload file to approved root (50 MB limit) | Bearer Token Required | `FileOperationResponse` |
| `POST` | `/api/files/mkdir` | Create subdirectory with strict name sanitization | Bearer Token Required | `FileOperationResponse` |
| `GET` | `/api/apps/allowlist` | List allowlisted installed Windows applications | Bearer Token Required | `AppAllowlistResponse` |
| `POST` | `/api/apps/launch` | Launch allowlisted application by ID | Bearer Token Required | `LaunchAppResponse` |

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
cd laptop-agent
.\.venv\Scripts\Activate.ps1
python run.py --lan
```
Terminal output:
```
==================================================
  PocketDesk Laptop Agent v0.7.0 (Stage 7)
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
$env:POCKETDESK_HOST="127.0.0.1"
$env:POCKETDESK_TURN_URL="turn:turn.yourdomain.com:3478"
$env:POCKETDESK_TURN_SECRET="your-256bit-turn-secret"

python run.py
```
For complete reverse proxy and Coturn setup, consult [`docs/deployment_guide.md`](../docs/deployment_guide.md).

---

## Stage 7 Security Controls & Hardening

1. **Approved Roots Only:**
   File operations are strictly confined to approved roots (Downloads, Documents, Desktop, Pictures) or configured via `POCKETDESK_ALLOWED_ROOTS`. Arbitrary system directories cannot be accessed.

2. **Canonical Path Traversal & Symlink Defense:**
   All paths are canonicalized via `Path.resolve()`. Any path escaping the approved root (`../`, `..\`, absolute paths, null bytes, symlinks) is rejected with **HTTP 403 Forbidden**.

3. **Sensitive Pattern & Credential Blacklisting:**
   The agent hides and blocks access to credentials (`.ssh`, `.env`, `id_rsa`), configuration files, browser profiles (`AppData`), and dangerous scripts (`*.bat`, `*.cmd`, `*.ps1`).

4. **Upload Size Limits & Safe Storage:**
   Enforces a strict 50 MB per-file upload limit. Partially written files are automatically deleted upon limit violation.

5. **Predefined Application Allowlist (Zero Shell Commands):**
   The browser only provides an immutable `app_id` (e.g. `notepad`, `calc`, `taskmgr`). The agent executes predefined paths using `subprocess.Popen(..., shell=False)`. No arbitrary commands or shell strings are accepted.

6. **Confirmation for Disruptive Actions:**
   Administrative or system tools (e.g. `taskmgr`, `terminal`) require explicit user confirmation before execution.

---

## Testing the Agent

### Run Automated Test Suite
```powershell
cd laptop-agent
.\.venv\Scripts\pytest.exe -v
```
All **53 automated tests** verify:
- Approved root discovery and directory listing
- Path traversal rejection across multiple vectors (`../`, absolute paths, null bytes)
- Sensitive file blacklisting (`.env`, `id_rsa`, `.key`)
- File upload streaming and 50 MB size limit enforcement
- Safe folder creation and Windows reserved name rejection (`CON`, `PRN`, etc.)
- Application allowlist queries and arbitrary command rejection
- Confirmation enforcement for disruptive applications
- Device registration, 256-bit secret creation, replay protection, and rate limiting
- Win32 coordinate mapping, input boundaries, and WebRTC streaming
