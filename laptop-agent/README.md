# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 4 implemented. Supports local Wi-Fi device pairing, live hardware telemetry, and authenticated WebRTC desktop screen streaming.

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides terminal-authorized device pairing, system health reporting, live hardware telemetry, and user-initiated WebRTC screen capture over your local Wi-Fi network.

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
| `GET` | `/` | Root agent index and interactive doc links | Unauthenticated | `dict` |
| `GET` | `/docs` | Interactive Swagger API documentation | Unauthenticated | OpenAPI UI |

---

## Prerequisites

- **Operating System:** Windows 10 or Windows 11 (64-bit)
- **Python:** Python 3.10+ (Verified on `Python 3.13.3`)
- **PowerShell:** PowerShell 5.1+ or PowerShell 7+
- **Network:** Laptop and phone connected to the same trusted Wi-Fi router / subnet.

---

## Virtual Environment Setup on Windows

### 1. Open PowerShell and Navigate to the Directory
```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent
```

### 2. Create the Python Virtual Environment
```powershell
python -m venv .venv
```

### 3. Activate the Virtual Environment
Depending on your shell:

**PowerShell:**
```powershell
# If execution policy prevents script activation, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

.\.venv\Scripts\Activate.ps1
```

**Command Prompt (cmd.exe):**
```cmd
.venv\Scripts\activate.bat
```

Once activated, your terminal prompt will show `(.venv)`.

---

## Installing Dependencies

With your virtual environment activated, install all dependencies:

```powershell
pip install -r requirements.txt
```

Installed core libraries:
- `fastapi` & `uvicorn`: Web framework and ASGI server
- `pydantic`: Schema validation
- `psutil`: Hardware and OS telemetry
- `aiortc` & `av`: Python WebRTC stack and PyAV media encoders
- `mss` & `Pillow`: Multi-monitor desktop frame capture and bilinear downsampling

---

## Windows Firewall Configuration (Safe Procedure)

To allow your phone to connect to the agent on port 8000 over your local Wi-Fi, you must allow inbound traffic on port 8000 for **Private** networks.

> [!CAUTION]
> **Never disable Windows Firewall.** Do not run commands like `Set-NetFirewallProfile -Enabled False`. Only create specific, port-scoped rules.

### 1. Add Inbound Rule (Run PowerShell as Administrator)
```powershell
New-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
```

### 2. Verify the Rule
```powershell
Get-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)"
```

### 3. Remove the Rule When Testing is Finished
```powershell
Remove-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)"
```

---

## Starting the Agent

### Local Wi-Fi Access Mode (Recommended for Phone Testing):
```powershell
python run.py --lan
```

When started, the terminal output will show:
```
==================================================
  PocketDesk Laptop Agent v0.4.0 (Stage 4)
  Mode: Local Wi-Fi Network Access enabled
  Listening on all interfaces: http://0.0.0.0:8000
  Phone Connection URL: http://192.168.1.145:8000
--------------------------------------------------
  >> PAIRING PIN: 839201 <<
  Enter this 6-digit PIN on your phone to connect.
==================================================
```

### Localhost-Only Mode (Testing on Laptop Browser):
```powershell
python run.py
```

---

## Stage 4 Screen Sharing Indicator & Session Control

In Stage 4, desktop capture **starts strictly upon explicit user command from an authenticated client**:

1. **Laptop Terminal Notice:**
   Whenever a screen sharing session is initiated by the web client, the laptop terminal prominently displays:
   ```
   ==================================================
   [SCREEN SHARING ACTIVE] PocketDesk Web Client is viewing this desktop!
   Active resolution: 720p @ 20 FPS
   To stop screen sharing, press Stop on phone or call POST /api/stream/stop
   ==================================================
   ```

2. **Terminating Screen Sharing:**
   - **From the phone:** Tap **"Stop Sharing"** in the video player overlay.
   - **From the laptop:** Send `POST /api/stream/stop` with the Bearer session token.
   - **On Agent Shutdown:** When the agent is closed (`Ctrl + C`), the FastAPI lifespan hook automatically terminates the WebRTC track and releases the screen capture context cleanly.

3. **Fallback & Headless Capture Safety:**
   If the screen is locked or running in a headless/power-saving state where Windows GDI prevents screen grabbing, the stream track generates a synthetic fallback frame informing the viewer rather than crashing.

---

## Security & Network Assumptions (Requirement 8)

> [!WARNING]
> **Plaintext HTTP Notice:**
> In this Stage 4 local prototype, initial signaling and telemetry communication occurs over unencrypted HTTP.
> Ordinary HTTP traffic is **not suitable for transmitting credentials or enabling remote control across untrusted networks** (such as public coffee shop Wi-Fi or the open internet), as packets can be intercepted or manipulated.
> 
> PocketDesk must only be used on a trusted home Wi-Fi network during this stage.
> Zero video frames are routed to external cloud relays (`iceServers: []`).
> Before any remote internet access is introduced (Stage 6), PocketDesk will mandate encrypted transport (TLS/HTTPS certificates and WebRTC DTLS-SRTP end-to-end encryption).

---

## Testing the Agent

### 1. Run Automated Test Suite
```powershell
.\.venv\Scripts\pytest.exe -v
```
All 19 automated unit and integration tests will verify signaling, track rendering, pairing, brute-force protection, token revocation, system telemetry, and mock scenarios.

### 2. Manual CLI Testing with PowerShell
```powershell
# Check health
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json

# Pair using the PIN shown on your terminal:
$pair = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/pair" -Method POST -Body '{"pairing_code":"<YOUR_PIN>"}' -ContentType "application/json"
$token = $pair.session_token

# Access telemetry with Bearer token:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/system" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 4

# Check streaming status:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/stream/status" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

---

## Stopping the Agent

Press `Ctrl + C` in the PowerShell window running the agent. Uvicorn will cleanly terminate active WebRTC sessions and exit.

---

## Known Limitations (Stage 4 Scope)

- **No Mouse/Keyboard Control:** Synthetic mouse and keyboard injection are disabled in this stage (scheduled for Stage 5).
- **No File Transfer:** File transfer queue is disabled in this stage (scheduled for Stage 5).
- **No Internet Access:** Connections must be within the same private local Wi-Fi subnet.
