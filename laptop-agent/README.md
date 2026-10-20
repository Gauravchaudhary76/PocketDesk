# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 5 implemented. Supports local Wi-Fi device pairing, live hardware telemetry, WebRTC desktop screen streaming, and authenticated remote mouse and keyboard control.

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides terminal-authorized device pairing, system health reporting, live hardware telemetry, user-initiated WebRTC screen capture, and safe Win32 mouse/keyboard injection over your local Wi-Fi network.

---

## Architecture & Endpoints

| Method | Path | Summary | Authentication | Response Model |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Agent health check, version, and uptime | Unauthenticated | `HealthResponse` |
| `POST` | `/api/pair` | Authorize client with 6-digit terminal PIN | Unauthenticated (PIN required) | `PairResponse` |
| `POST` | `/api/unpair` | Revoke active session token | Bearer Token Required | `UnpairResponse` |
| `GET` | `/api/system` | Host OS, CPU load, RAM allocation, and battery | Bearer Token Required | `SystemInfoResponse` |
| `GET` | `/api/capabilities` | List of implemented vs planned features | Bearer Token Required | `CapabilitiesResponse` |
| `POST` | `/api/stream/offer` | Authenticated WebRTC SDP offer/answer exchange | Bearer Token Required | `StreamAnswerResponse` |
| `POST` | `/api/stream/stop` | Terminate active desktop screen streaming session | Bearer Token Required | `StreamStopResponse` |
| `GET` | `/api/stream/status` | Inquire whether desktop capture is active | Bearer Token Required | `StreamStatusResponse` |
| `GET` | `/api/input/status` | Inquire whether remote input is currently authorized | Bearer Token Required | `InputStatusResponse` |
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

---

## Operating System Limitations (Windows UIPI / UAC)

> [!IMPORTANT]
> **Windows User Interface Privilege Isolation (UIPI) & Secure Desktop Restrictions:**
> 1. **Elevated Windows:** If a window on the Windows laptop is running as Administrator (elevated), Windows kernel security blocks non-elevated applications from sending synthetic input to it.
> 2. **Secure Desktop (UAC & Ctrl+Alt+Del):** When a User Account Control prompt appears ("Do you want to allow this app to make changes...") or when the Windows Lock/Login screen is active, Windows shifts to the isolated Secure Desktop. Standard non-elevated user processes cannot inject keystrokes or mouse clicks into this screen.
> 3. **Remediation:** To control elevated windows remotely, start the laptop agent by opening PowerShell with **"Run as Administrator"**.

---

## Starting the Agent

### Local Wi-Fi Access Mode:
```powershell
python run.py --lan
```

Terminal output:
```
==================================================
  PocketDesk Laptop Agent v0.5.0 (Stage 5)
  Mode: Local Wi-Fi Network Access enabled
  Listening on all interfaces: http://0.0.0.0:8000
  Phone Connection URL: http://192.168.1.145:8000
--------------------------------------------------
  >> PAIRING PIN: 839201 <<
  Enter this 6-digit PIN on your phone to connect.
==================================================
```

---

## Stage 5 Input Security Model & Controls

1. **Explicit Enablement:**
   Remote input is **disabled by default**. It requires explicit user activation from the authenticated client via `POST /api/input/control` with `{"action": "enable"}`.

2. **Laptop Terminal Notice:**
   When remote input is enabled, the laptop terminal outputs:
   ```
   ==============================================================
   [INPUT CONTROL ENABLED] Client 'PocketDesk Web Client' authorized for mouse/keyboard!
   Emergency Stop: POST http://127.0.0.1:8000/api/input/control
   ==============================================================
   ```

3. **Immediate Emergency Stop:**
   Calling `POST /api/input/control` with `{"action": "emergency_stop"}` or tapping "Emergency Disable" in the web UI immediately halts input and releases all held mouse buttons and keys.

4. **Stuck Key Protection:**
   The service maintains an in-memory registry of all currently held virtual keys and mouse buttons. Whenever a client disconnects, unpairs, or the agent shuts down, `emergency_cleanup()` is automatically executed to prevent stuck modifier keys.

5. **Rate Limiting & Anti-Flood:**
   The agent enforces an upper limit of 150 events per second and drops stale packets older than 1.5 seconds.

---

## Testing the Agent

### 1. Run Automated Test Suite
```powershell
.\.venv\Scripts\pytest.exe -v
```
All 28 automated tests verify:
- Coordinate mapping and letterbox boundary clamping
- Input validation (rejection of malformed coordinates, unwhitelisted keys, oversized text payloads)
- Authentication enforcement on all input endpoints (401 Unauthorized)
- Permission gating (403 Forbidden when remote input is disabled)
- Explicit input enable / disable / emergency stop lifecycle
- Automatic key and mouse button release during cleanup
- WebRTC SDP offer/answer signaling exchange (`/api/stream/offer`)
- Pairing authorization & lockout protection

### 2. Manual CLI Testing with PowerShell
```powershell
# 1. Check health
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json

# 2. Pair using PIN:
$pair = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/pair" -Method POST -Body '{"pairing_code":"<YOUR_PIN>"}' -ContentType "application/json"
$token = $pair.session_token

# 3. Enable remote input:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/input/control" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body '{"action":"enable"}' -ContentType "application/json"

# 4. Check display info:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/input/screen-info" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json

# 5. Move mouse to screen center:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/input/mouse/move" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body '{"x":0.5,"y":0.5}' -ContentType "application/json"

# 6. Type text into active window:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/input/keyboard/text" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body '{"text":"Hello from PocketDesk!"}' -ContentType "application/json"

# 7. Disable input:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/input/control" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body '{"action":"disable"}' -ContentType "application/json"
```

---

## Stopping the Agent

Press `Ctrl + C` in the PowerShell window running the agent. Uvicorn will cleanly terminate active WebRTC sessions, release any held keys or mouse buttons, and exit.
