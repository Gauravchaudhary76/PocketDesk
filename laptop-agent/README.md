# PocketDesk Laptop Agent (Windows 10/11)

> **Status:** Stage 2 foundation implemented. Binds to `127.0.0.1` (localhost only).

The PocketDesk Laptop Agent is a lightweight Python service built on **FastAPI** that runs locally on your Windows 10 or 11 laptop. It provides system health reporting, hardware telemetry, and capabilities discovery.

---

## Architecture & Endpoints

| Method | Path | Summary | Response Model |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Agent health check, version, and uptime | `HealthResponse` |
| `GET` | `/api/system` | Host OS, CPU load, RAM allocation, and battery | `SystemInfoResponse` |
| `GET` | `/api/capabilities` | List of implemented vs planned features | `CapabilitiesResponse` |
| `GET` | `/` | Root agent index and interactive doc links | `dict` |
| `GET` | `/docs` | Interactive Swagger API documentation | OpenAPI UI |

---

## Prerequisites

- **Operating System:** Windows 10 or Windows 11 (64-bit recommended)
- **Python:** Python 3.10+ (Checked and verified on `Python 3.13.3`)
- **PowerShell:** PowerShell 5.1+ or PowerShell 7+

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
Depending on your shell of choice:

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

With your virtual environment activated, install all pinned dependencies:

```powershell
pip install -r requirements.txt
```

Core dependencies installed:
- `fastapi` — High-performance API framework
- `uvicorn[standard]` — ASGI server
- `pydantic` — Type validation and response models
- `psutil` — Windows hardware and process telemetry
- `pytest` & `httpx` — Automated test suite and test client

---

## Starting the Agent

### Standard Startup (Localhost Default: 127.0.0.1:8000)
```powershell
python run.py
```

### Development Mode with Auto-Reload:
```powershell
python run.py --reload
```

### Custom Port:
```powershell
python run.py --port 8080
```

When started, you will see:
```
2026-10-20 12:15:00 [INFO] [pocketdesk.agent] ==================================================
2026-10-20 12:15:00 [INFO] [pocketdesk.agent]  Starting PocketDesk Laptop Agent v0.2.0 (Stage 2)
2026-10-20 12:15:00 [INFO] [pocketdesk.agent]  Listening on http://127.0.0.1:8000 (Localhost only)
2026-10-20 12:15:00 [INFO] [pocketdesk.agent]  Security policy: Local-only, unauthenticated. WAN access strictly prohibited.
2026-10-20 12:15:00 [INFO] [pocketdesk.agent] ==================================================
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## Testing the Endpoints

### 1. Using PowerShell `Invoke-RestMethod` / `curl`

**Health Check:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json
```
Example Output:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "agent_name": "PocketDesk Laptop Agent",
  "stage": 2,
  "uptime_seconds": 14.25,
  "timestamp": "2026-10-20T06:45:00.123456+00:00"
}
```

**System Telemetry:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/system" | ConvertTo-Json -Depth 4
```
Example Output:
```json
{
  "os": {
    "system": "Windows",
    "release": "11",
    "version": "10.0.26100",
    "architecture": "AMD64",
    "hostname": "MY-LAPTOP"
  },
  "cpu": {
    "model": "Intel64 Family 6 Model 186",
    "cores_physical": 14,
    "cores_logical": 20,
    "usage_percent": 12.4,
    "frequency_mhz": 2400.0
  },
  "memory": {
    "total_bytes": 34091380736,
    "available_bytes": 18234859520,
    "used_bytes": 15856521216,
    "usage_percent": 46.5
  },
  "battery": {
    "present": true,
    "percent": 92.0,
    "is_charging": false,
    "power_plugged": false,
    "seconds_left": 14200
  },
  "timestamp": "2026-10-20T06:45:05.123456+00:00"
}
```

**Capabilities Discovery:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/capabilities" | ConvertTo-Json -Depth 4
```

### 2. Using Web Browser & Interactive Documentation
Open your browser and navigate to:
- **Interactive Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 3. Running Automated Tests
```powershell
.\.venv\Scripts\pytest.exe -v
```

---

## Stopping the Agent

To gracefully stop the agent:
1. In the terminal running the agent, press `Ctrl + C`.
2. Uvicorn will trigger the shutdown lifecycle and exit cleanly.

---

## Security Assumptions & Threat Model (Requirement 6)

In strict accordance with the Stage 2 requirements:
1. **Local-Only Boundary (127.0.0.1):**
   - The agent strictly binds to `127.0.0.1` by default.
   - It is never exposed to the local network (LAN) or public internet.
   - Any process running locally under the same Windows user session can access this agent.

2. **No Decorative Authentication:**
   - No fake tokens or cosmetic passwords are added.
   - Real cryptographic pairing (ephemeral 6-digit PIN or QR token validation with HMAC-SHA256) will only be introduced when LAN / remote bridging is designed in future stages.

3. **No Dangerous Execution:**
   - No arbitrary shell execution (`os.system`, `subprocess.Popen` from user input) is permitted.
   - No arbitrary file system access is allowed.
   - Screen capture and input injection are completely isolated and not implemented in this stage.

---

## Known Limitations (Stage 2 Scope)

- **No Remote Streaming:** Screen capture via DirectX Desktop Duplication API (DXGI) is scheduled for **Stage 3**.
- **No Remote Input:** Mouse movement, clicks, and keyboard strokes cannot be injected in Stage 2. This is scheduled for **Stage 4**.
- **Localhost Only:** The agent cannot be queried from an external device or phone yet because secure network pairing is not implemented.
