# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing authenticated local network pairing, high-performance WebRTC screen capture, low-latency input controls, and encrypted NAT traversal.

---

## Technology Stack

### Frontend (Stages 1 through 6 — Current)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **Screen Streaming:** Standard WebRTC `RTCPeerConnection` with DTLS-SRTP encryption, HTML5 `<video>` viewport with native Fullscreen API support, and configurable resolution & FPS controls.
- **NAT Traversal Client (Stage 6):** Dynamically acquires time-limited STUN/TURN credentials from the laptop agent; supports dual-mode connection ("Local Wi-Fi Mode" vs "Remote Internet Mode").
- **Device Security & Management (Stage 6):**
  - Persistent unique client device identification (`dev_...`) stored in `localStorage`.
  - Single-use cryptographic nonces and client timestamps ($\pm 60$s) for replay protection.
  - Dedicated **Authorized Devices Modal** to inspect all paired clients and execute instant revocation.
- **Remote Input (Stage 5):**
  - Direct touch-to-screen cursor control with letterbox/pillarbox aspect-ratio compensation.
  - Dedicated virtual trackpad zone with sensitivity controls, tap-to-click, and drag lock.
  - On-screen virtual keyboard supporting special navigation keys (`Enter`, `Esc`, `Tab`, `Backspace`, arrows).
  - Native mobile text entry field with Unicode character batching.
  - Safety controls: Default-disabled input with explicit consent confirmation modal and persistent Emergency Stop button.

### Laptop Agent (Stages 2 through 6 — Current)
- **Framework:** Python 3.10+ with FastAPI and Uvicorn
- **Validation:** Pydantic v2 data models with strict input bounds
- **Authentication:** Ephemeral 6-digit terminal PIN authorization with Bearer session tokens (1-hour TTL)
- **Remote NAT Traversal (Stage 6):** Dynamic RFC 5766 TURN ephemeral credentials (`TurnService`) with HMAC-SHA1 signature and STUN server discovery.
- **Device Management & Replay Protection (Stage 6):**
  - Persistent `DeviceRegistry` (`data/devices.json`) managing 256-bit cryptographic device secrets.
  - `ReplayProtection` service validating timestamp windows ($\pm 60$s) and caching consumed nonces.
  - `RateLimiter` sliding-window lockout enforcing a 5-minute lockout after 5 consecutive failed attempts.
  - Zero-tolerance revocation: dropping a device instantly drops its active WebRTC stream and disables input.
- **Desktop Capture (Stage 4):** Fast Windows desktop frame capture via `mss` with Pillow bilinear downscaling
- **WebRTC Video Engine (Stage 4 & 6):** `aiortc` and PyAV (`av`) generating paced H.264 / VP8 video streams over DTLS-SRTP
- **Win32 Input Injection (Stage 5):**
  - Native `ctypes.windll.user32` interface calling `SetCursorPos`, `mouse_event`, and `SendInput`.
  - Unicode character typing via `KEYEVENTF_UNICODE` (independent of host keyboard layout).
  - In-memory tracking of all held keys and mouse buttons with automatic emergency release upon disconnect.
  - Rate limiting (max 150 events/sec) and stale-packet discarding (> 1.5s).
- **Hardware Telemetry:** `psutil` (OS, CPU load, RAM allocation, battery sensors)
- **Testing:** `pytest` and `httpx` (34 passing automated unit & integration tests)
- **Network Scope:** Dual-mode: Local private Wi-Fi (LAN) or secure remote internet access via reverse proxy and TURN relay.

---

## Project Structure

```
pocketdesk/
├── frontend/                 # React + Vite + TypeScript web dashboard (Stages 1 - 6)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.tsx                 # Branding, status, mode badge & Devices modal trigger
│   │   │   ├── DeviceCard.tsx             # Paired laptop info, address config & Connect button
│   │   │   ├── ConnectModal.tsx           # Dual-mode (Local Wi-Fi vs Remote Internet) pairing dialog
│   │   │   ├── DeviceManagementModal.tsx  # Stage 6 authorized paired devices & revocation manager
│   │   │   ├── RemoteDisplay.tsx          # WebRTC video stream viewport, touch controls & Emergency Stop
│   │   │   ├── VirtualKeyboard.tsx        # On-screen keyboard with special keys & shortcuts
│   │   │   ├── MouseKeyboardSection.tsx   # Virtual trackpad, tactile click buttons & hotkeys
│   │   │   ├── FileTransferSection.tsx    # File drag & drop queue (labeled future stage)
│   │   │   ├── ApplicationsSection.tsx    # Quick launcher & task manager (labeled future stage)
│   │   │   ├── SystemMonitorSection.tsx   # Live hardware telemetry & resource meters
│   │   │   ├── StatusBadge.tsx            # Connection state indicator pill
│   │   │   ├── StageBadge.tsx             # Roadmap milestone indicator
│   │   │   └── InfoModal.tsx              # Stage notification dialog (Rule #6)
│   │   ├── services/
│   │   │   ├── remote.ts                  # Stage 6 remote client, secrets & replay nonces
│   │   │   ├── webrtc.ts                  # WebRTC RTCPeerConnection & signaling client
│   │   │   └── input.ts                   # Input client, WebSocket dispatcher & coordinate mapping
│   │   ├── types/            # TypeScript interfaces & domain models
│   │   ├── App.tsx           # Root layout, pairing workflow & input state manager
│   │   ├── index.css         # Base styles and dark scrollbars
│   │   └── main.tsx          # Entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── laptop-agent/             # Python FastAPI Windows Desktop Agent (Stages 2 - 6)
│   ├── app/
│   │   ├── models/           # Pydantic schemas (auth, health, system, stream, input, remote)
│   │   ├── routers/          # FastAPI routes (/health, /api/pair, /api/stream/*, /api/input/*, /api/remote/*)
│   │   ├── services/         # Telemetry, TurnService, DeviceRegistry, ReplayProtection, RateLimiter
│   │   ├── dependencies/     # Bearer token validation dependencies
│   │   ├── config.py         # App settings & environment discovery
│   │   ├── logger.py         # Structured logging configuration
│   │   └── main.py           # FastAPI entry & WebRTC/Input lifespan cleanup
│   ├── tests/                # Automated pytest suite (34 unit/integration tests)
│   ├── run.py                # Agent CLI launcher with --lan support
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Virtual environment setup & usage guide
├── docs/                     # Engineering architecture, deployment & security guides
│   ├── architecture.md       # High-level component interactions & data flow
│   ├── deployment_guide.md   # Production deployment options (Mesh overlay vs Reverse Proxy + Coturn)
│   ├── security_checklist.md # Threat model, HTTPS warning, and verification procedures
│   └── roadmap.md            # Multi-stage roadmap specifications
└── README.md                 # Project overview & documentation
```

---

## Operating System Limitations (Windows UIPI / UAC)

> [!IMPORTANT]
> **Windows User Interface Privilege Isolation (UIPI) & Secure Desktop Restrictions:**
> 1. **Elevated Windows:** If a window on the Windows laptop is running as Administrator (elevated), Windows kernel security blocks non-elevated applications from sending synthetic input to it.
> 2. **Secure Desktop (UAC & Ctrl+Alt+Del):** When a User Account Control prompt appears ("Do you want to allow this app to make changes...") or when the Windows Lock/Login screen is active, Windows shifts to the isolated Secure Desktop. Standard non-elevated user processes cannot inject keystrokes or mouse clicks into this screen.
> 3. **Remediation:** To control elevated windows remotely, start the laptop agent by opening PowerShell with **"Run as Administrator"**.

---

## Deployment & Remote Access (Stage 6)

For complete production deployment instructions, please review the dedicated documentation:
- **Deployment Guide:** [`docs/deployment_guide.md`](docs/deployment_guide.md) (Details on Tailscale mesh VPN, Caddy/Nginx reverse proxies, Coturn TURN relay setup, and infrastructure costs).
- **Security Checklist:** [`docs/security_checklist.md`](docs/security_checklist.md) (Threat model, "HTTPS is not enough" analysis, and manual verification steps).

---

## Step-by-Step Testing Procedure

### 1. Local Wi-Fi Testing Mode
1. **Configure Firewall:**
   ```powershell
   New-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
   ```
2. **Start Laptop Agent:**
   ```powershell
   cd laptop-agent
   .\.venv\Scripts\Activate.ps1
   python run.py --lan
   ```
3. **Start Web Frontend:**
   ```powershell
   cd frontend
   npm run dev -- --host
   ```
4. On your phone, open the frontend, select **"Local Wi-Fi Mode"**, enter the 6-digit PIN, and connect.

### 2. Remote Internet Testing Mode (Stage 6)
1. In the web client, click **Connect / Pair** and select the **"Remote Internet (Stage 6)"** tab.
2. Enter the remote agent URL (e.g. `https://pocketdesk.yourdomain.com`).
3. For new devices: Enter the 6-digit terminal PIN to register the device. A 256-bit secret is issued and saved locally.
4. For returning devices: Click **"Connect Paired Device"** — the client authenticates instantly using its cryptographic secret and single-use replay nonces.
5. Tap **"Devices"** in the top navigation bar to inspect authorized devices or revoke access immediately.

---

## Automated Test Verification

Run the automated test suite in `laptop-agent/`:
```powershell
cd laptop-agent
.\.venv\Scripts\pytest.exe -v
```

Run the frontend TypeScript & Vite production build:
```powershell
cd frontend
npm run build
```

Both test suites pass with **100% success** (34 Python tests + clean Vite build).
