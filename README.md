# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing authenticated local network pairing, high-performance WebRTC screen capture, low-latency input controls, and encrypted NAT traversal.

---

## Technology Stack

### Frontend (Stages 1, 3 & 4 — Current)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **Design Philosophy:** Mobile-first, responsive dark theme, accessible semantic controls
- **Screen Streaming (Stage 4):** Standard WebRTC `RTCPeerConnection` with empty `iceServers: []` (zero third-party relay leakage), HTML5 `<video>` viewport with native Fullscreen API support, and configurable resolution & FPS controls.
- **Connection Workflow:** Configurable agent address, PIN pairing dialog, automatic telemetry polling.

### Laptop Agent (Stages 2, 3 & 4 — Current)
- **Framework:** Python 3.10+ with FastAPI and Uvicorn
- **Validation:** Pydantic v2 data models
- **Authentication:** Ephemeral 6-digit terminal PIN authorization with Bearer session tokens
- **Desktop Capture (Stage 4):** Fast Windows desktop frame capture via `mss` with Pillow bilinear downscaling
- **WebRTC Video Engine (Stage 4):** `aiortc` and PyAV (`av`) generating paced H.264 / VP8 video streams
- **Session Safety:** Visible terminal banner `[SCREEN SHARING ACTIVE]`, automatic replacement of stale connections upon browser refresh, and graceful cleanup on server shutdown
- **Hardware Telemetry:** `psutil` (OS, CPU load, RAM allocation, battery sensors)
- **Testing:** `pytest` and `httpx` (19 passing automated tests)
- **Network Scope:** Local private Wi-Fi network (RFC1918 subnets: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`)

### Future Stages (Stages 5 to 6)
- **Low-Latency Input Control:** Win32 `SendInput` / `pynput` for virtual trackpad and keyboard injection *(Stage 5)*
- **File Transfer:** Chunked binary streaming with SHA-256 verification *(Stage 5)*
- **Encrypted Remote Access:** WebRTC NAT traversal, TLS certificates, and end-to-end encryption *(Stage 6)*
- **Cost & Dependencies:** 100% free and open-source. Zero paid external APIs, zero third-party AI keys.

---

## Project Structure

```
pocketdesk/
├── frontend/                 # React + Vite + TypeScript web dashboard (Stage 1, 3 & 4)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.tsx               # Branding, status, state preview switcher
│   │   │   ├── DeviceCard.tsx           # Paired laptop info, address config & Connect button
│   │   │   ├── ConnectModal.tsx         # Address configuration & 6-digit PIN pairing dialog
│   │   │   ├── RemoteDisplay.tsx        # WebRTC video stream viewport, FPS/resolution & Stop Sharing
│   │   │   ├── MouseKeyboardSection.tsx # Virtual trackpad & hotkeys (disabled in Stage 4)
│   │   │   ├── FileTransferSection.tsx  # File drag & drop queue (disabled in Stage 4)
│   │   │   ├── ApplicationsSection.tsx  # Quick launcher & task manager (disabled in Stage 4)
│   │   │   ├── SystemMonitorSection.tsx # Live hardware telemetry & resource meters
│   │   │   ├── StatusBadge.tsx          # Connection state indicator pill
│   │   │   ├── StageBadge.tsx           # Roadmap milestone indicator
│   │   │   └── InfoModal.tsx            # Stage notification dialog (Rule #6)
│   │   ├── services/
│   │   │   └── webrtc.ts                # WebRTC RTCPeerConnection & signaling client
│   │   ├── types/            # TypeScript interfaces & domain models
│   │   ├── App.tsx           # Root layout, pairing workflow & stream state manager
│   │   ├── index.css         # Base styles and dark scrollbars
│   │   └── main.tsx          # Entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── laptop-agent/             # Python FastAPI Windows Desktop Agent (Stage 2, 3 & 4)
│   ├── app/
│   │   ├── models/           # Pydantic schemas (auth, health, system, capabilities, stream)
│   │   ├── routers/          # FastAPI routes (/health, /api/pair, /api/system, /api/stream/*)
│   │   ├── services/         # Telemetry providers, PIN auth manager & WebRTC DesktopVideoStreamTrack
│   │   ├── dependencies/     # Bearer token validation dependencies
│   │   ├── config.py         # App settings & LAN IP discovery
│   │   ├── logger.py         # Structured logging configuration
│   │   └── main.py           # FastAPI entry & WebRTC stream lifespan cleanup
│   ├── tests/                # Automated pytest suite (19 unit/integration tests)
│   ├── run.py                # Agent CLI launcher with --lan support
│   ├── requirements.txt      # Python dependencies (fastapi, aiortc, mss, pillow, av, psutil)
│   └── README.md             # Virtual environment setup & usage guide
├── docs/                     # Engineering architecture & roadmap
│   ├── architecture.md
│   └── roadmap.md
└── README.md                 # Project overview & documentation
```

---

## Prerequisites

Before setting up PocketDesk, ensure your development machine has the following tools installed:

| Tool | Minimum Version | Checked Environment Version | Status |
| :--- | :--- | :--- | :--- |
| **Node.js** | v18.0.0+ | `v22.20.0` | Installed |
| **npm** | v9.0.0+ | `10.9.3` | Installed |
| **Python** | 3.10+ | `3.13.3` | Installed |
| **Git** | Any modern version | `2.50.1.windows.1` | Installed |

---

## Step-by-Step Local Wi-Fi Testing Procedure (Stage 4)

Follow this guide to connect your smartphone to your Windows laptop over your local home Wi-Fi and stream your desktop screen:

### Step 1: Ensure Devices Are on the Same Wi-Fi
Connect your mobile phone and your Windows laptop to the same Wi-Fi router / SSID.

### Step 2: Configure Windows Firewall Safely
To permit incoming agent connections on port 8000 without disabling your firewall, run **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
```

*(To remove this rule after testing: `Remove-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)"`)*

### Step 3: Start the Python Laptop Agent
In a PowerShell terminal:

```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent
.\.venv\Scripts\Activate.ps1
python run.py --lan
```

The terminal will display your laptop's local IP and a unique 6-digit pairing PIN:
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

### Step 4: Start the Frontend Web Server
In a second PowerShell terminal:

```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\frontend
npm run dev -- --host
```

Vite will display your phone's connection URL (e.g., `http://192.168.1.145:5173/`).

### Step 5: Open on Phone and Pair
1. On your phone's browser, navigate to the Vite network address (e.g. `http://192.168.1.145:5173`).
2. Tap the **"Pair with Laptop"** button or **"Connect to Laptop"** on the Device Card.
3. Verify that the agent address matches your laptop's IP and port (e.g. `http://192.168.1.145:8000`).
4. Enter the **6-digit Pairing PIN** displayed on your laptop terminal.
5. Tap **"Authorize & Connect"**.

### Step 6: Start Screen Sharing
1. In the **Screen** tab or main display viewport, click **"Start Screen Sharing"**.
   - Optional: Click the gear icon to configure resolution (`720p Recommended`, `1080p Native`, `540p`, `480p`) and frame rate (`15`, `20`, or `30` FPS).
2. The phone initiates an authenticated WebRTC SDP offer to `/api/stream/offer`.
3. Notice that your laptop terminal immediately prints:
   ```
   ==================================================
   [SCREEN SHARING ACTIVE] PocketDesk Web Client is viewing this desktop!
   Active resolution: 720p @ 20 FPS
   To stop screen sharing, press Stop on phone or call POST /api/stream/stop
   ==================================================
   ```
4. The live Windows desktop video appears directly inside the phone browser's video viewport with a green `● LIVE` badge!
5. Tap the **Fullscreen** button to expand the stream across your phone display.

### Step 7: Stop Sharing
- **From Phone:** Click the red **"Stop Sharing"** button in the video overlay or top bar.
- **From Laptop:** Send `POST /api/stream/stop` with your session token or terminate the agent with `Ctrl+C`.
- The screen sharing indicator clears and the capture pipeline is safely closed.

---

## Security Invariants & Transport Notice (Requirement 8)

> [!WARNING]
> **Plaintext HTTP Limitation:**
> In Stage 4, initial signaling and telemetry communication between your phone and laptop occurs over unencrypted HTTP.
> **Ordinary HTTP traffic is not suitable for transmitting credentials, tokens, or enabling remote control across untrusted networks** (such as public coffee shops, guest Wi-Fi, or the internet), because packets can be snooped or altered by local network eavesdroppers.
> 
> **Stage 4 Scope Rule:** PocketDesk must strictly be operated on trusted private home/work Wi-Fi networks during this stage. Zero video data is transmitted to external STUN/TURN servers (`iceServers: []`).
> 
> **Internet Access Requirement (Stage 6):** Before any remote internet access is enabled, PocketDesk will require:
> - Encrypted transport (TLS/HTTPS certificates)
> - WebRTC DTLS-SRTP encryption with authenticated NAT traversal (TURN credentials)
> - Hardened key-exchange protocols

---

## Automated Tests

Run the automated test suite in `laptop-agent/`:

```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent
.\.venv\Scripts\pytest.exe -v
```

All 19 unit and integration tests verify:
- WebRTC SDP offer/answer signaling exchange (`/api/stream/offer`)
- Authenticated stream stop and status inquiries (`/api/stream/stop`, `/api/stream/status`)
- Screen capture track generation and headless/lock-screen fallback rendering
- PIN pairing authorization & lockout protection
- Bearer session token validation & revocation
- Hardware telemetry parsing & sensor failure fallbacks
- Unauthenticated access rejection (401)
