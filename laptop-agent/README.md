# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 3 implemented. Supports local Wi-Fi device pairing and authenticated telemetry.

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides terminal-authorized device pairing, system health reporting, and live hardware telemetry over your local Wi-Fi network.

---

## Architecture & Endpoints

| Method | Path | Summary | Authentication | Response Model |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Agent health check, version, and uptime | Unauthenticated | `HealthResponse` |
| `POST` | `/api/pair` | Authorize client with 6-digit terminal PIN | Unauthenticated (PIN required) | `PairResponse` |
| `POST` | `/api/unpair` | Revoke active session token | Bearer Token Required | `UnpairResponse` |
| `GET` | `/api/system` | Host OS, CPU load, RAM allocation, and battery | Bearer Token Required | `SystemInfoResponse` |
| `GET` | `/api/capabilities` | List of implemented vs planned features | Bearer Token Required | `CapabilitiesResponse` |
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
  PocketDesk Laptop Agent v0.3.0 (Stage 3)
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

## Pairing & Authentication Architecture

In Stage 3, PocketDesk enforces a physical pairing authorization workflow:

1. **Terminal PIN Authorization:**
   - Every time the agent starts, a cryptographically random 6-digit numeric PIN (`secrets.randbelow(1000000)`) is generated and logged only on the laptop terminal.
   - A client must send `POST /api/pair` with this PIN to obtain a session token.

2. **Bearer Token Authentication:**
   - Successful pairing returns a 256-bit cryptographically secure session token (`secrets.token_hex(32)`).
   - Subsequent calls to `/api/system` and `/api/capabilities` require `Authorization: Bearer <session_token>`.

3. **Protection Mechanisms:**
   - Sensitive tokens are stored in memory and `sessionStorage` on the client. They are **never** passed in URL query parameters, never printed in browser console logs, and never committed to source control.
   - Brute-force protection: After 5 incorrect pairing attempts, the agent locks out pairing for 30 seconds.

4. **Narrow CORS Policy:**
   - CORS is restricted to localhost (`127.0.0.1`) and private RFC1918 subnets (`192.168.*.*`, `10.*.*.*`, `172.16-31.*.*`).
   - Unrestricted origins (`*`) are disallowed.

---

## Security & Network Assumptions (Requirement 8)

> [!WARNING]
> **Plaintext HTTP Notice:**
> In this Stage 3 local prototype, communication occurs over unencrypted HTTP.
> Ordinary HTTP traffic is **not suitable for transmitting credentials or enabling remote control across untrusted networks** (such as public coffee shop Wi-Fi or the open internet), as packets can be intercepted or manipulated.
> 
> PocketDesk must only be used on a trusted home Wi-Fi network during this stage.
> Before any remote internet access is introduced (Stage 6), PocketDesk will mandate encrypted transport (TLS/HTTPS certificates and WebRTC DTLS-SRTP end-to-end encryption).

---

## Testing the Agent

### 1. Run Automated Test Suite
```powershell
.\.venv\Scripts\pytest.exe -v
```
All 15 automated unit and integration tests will verify pairing, brute-force protection, token revocation, system telemetry, and mock scenarios.

### 2. Manual CLI Testing with PowerShell
```powershell
# Check health
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json

# Attempting /api/system without token will fail with 401:
try { Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/system" } catch { $_.Exception.Response.StatusCode }

# Pair using the PIN shown on your terminal:
$pair = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/pair" -Method POST -Body '{"pairing_code":"<YOUR_PIN>"}' -ContentType "application/json"
$token = $pair.session_token

# Access telemetry with Bearer token:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/system" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 4
```

---

## Stopping the Agent

Press `Ctrl + C` in the PowerShell window running the agent. Uvicorn will cleanly terminate active sessions and exit.

---

## Known Limitations (Stage 3 Scope)

- **No Remote Desktop Video:** Desktop video capture via DXGI/WebRTC is not implemented in Stage 3.
- **No Mouse/Keyboard Control:** Synthetic mouse and keyboard injection are disabled in this stage.
- **No Internet Access:** Connections must be within the same private local Wi-Fi subnet.
