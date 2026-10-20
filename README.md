# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing authenticated local network pairing, high-performance WebRTC screen capture, low-latency input controls, and encrypted NAT traversal.

---

## Technology Stack

### Frontend (Stages 1, 3, 4 & 5 — Current)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **Screen Streaming (Stage 4):** Standard WebRTC `RTCPeerConnection` with empty `iceServers: []` (zero third-party relay leakage), HTML5 `<video>` viewport with native Fullscreen API support, and configurable resolution & FPS controls.
- **Remote Input (Stage 5):**
  - Direct touch-to-screen cursor control with letterbox/pillarbox aspect-ratio compensation.
  - Dedicated virtual trackpad zone with sensitivity controls, tap-to-click, and drag lock.
  - On-screen virtual keyboard supporting special navigation keys (`Enter`, `Esc`, `Tab`, `Backspace`, arrows).
  - Native mobile text entry field with Unicode character batching.
  - Low-latency bi-directional WebSocket client (`/api/input/ws`) with REST fallback.
  - Safety controls: Default-disabled input with explicit consent confirmation modal and persistent Emergency Stop button.

### Laptop Agent (Stages 2, 3, 4 & 5 — Current)
- **Framework:** Python 3.10+ with FastAPI and Uvicorn
- **Validation:** Pydantic v2 data models with strict input bounds
- **Authentication:** Ephemeral 6-digit terminal PIN authorization with Bearer session tokens
- **Desktop Capture (Stage 4):** Fast Windows desktop frame capture via `mss` with Pillow bilinear downscaling
- **WebRTC Video Engine (Stage 4):** `aiortc` and PyAV (`av`) generating paced H.264 / VP8 video streams
- **Win32 Input Injection (Stage 5):**
  - Native `ctypes.windll.user32` interface calling `SetCursorPos`, `mouse_event`, and `SendInput`.
  - Unicode character typing via `KEYEVENTF_UNICODE` (independent of host keyboard layout).
  - In-memory tracking of all held keys and mouse buttons with automatic emergency release upon disconnect.
  - Rate limiting (max 150 events/sec) and stale-packet discarding (> 1.5s).
- **Hardware Telemetry:** `psutil` (OS, CPU load, RAM allocation, battery sensors)
- **Testing:** `pytest` and `httpx` (28 passing automated tests)
- **Network Scope:** Local private Wi-Fi network (RFC1918 subnets: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`)

### Future Stage (Stage 6)
- **Encrypted Remote Access:** WebRTC NAT traversal (STUN/TURN), TLS certificates, and end-to-end encryption for out-of-LAN internet connectivity *(Stage 6)*
- **Cost & Dependencies:** 100% free and open-source. Zero paid external APIs, zero third-party AI keys.

---

## Project Structure

```
pocketdesk/
├── frontend/                 # React + Vite + TypeScript web dashboard (Stages 1, 3, 4 & 5)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.tsx               # Branding, status, state preview switcher
│   │   │   ├── DeviceCard.tsx           # Paired laptop info, address config & Connect button
│   │   │   ├── ConnectModal.tsx         # Address configuration & 6-digit PIN pairing dialog
│   │   │   ├── RemoteDisplay.tsx        # WebRTC video stream viewport, touch controls & Emergency Stop
│   │   │   ├── VirtualKeyboard.tsx      # On-screen keyboard with special keys & shortcuts
│   │   │   ├── MouseKeyboardSection.tsx # Virtual trackpad, tactile click buttons & hotkeys
│   │   │   ├── FileTransferSection.tsx  # File drag & drop queue (disabled in Stage 5)
│   │   │   ├── ApplicationsSection.tsx  # Quick launcher & task manager (disabled in Stage 5)
│   │   │   ├── SystemMonitorSection.tsx # Live hardware telemetry & resource meters
│   │   │   ├── StatusBadge.tsx          # Connection state indicator pill
│   │   │   ├── StageBadge.tsx           # Roadmap milestone indicator
│   │   │   └── InfoModal.tsx            # Stage notification dialog (Rule #6)
│   │   ├── services/
│   │   │   ├── webrtc.ts                # WebRTC RTCPeerConnection & signaling client
│   │   │   └── input.ts                 # Input client, WebSocket dispatcher & coordinate mapping
│   │   ├── types/            # TypeScript interfaces & domain models
│   │   ├── App.tsx           # Root layout, pairing workflow & input state manager
│   │   ├── index.css         # Base styles and dark scrollbars
│   │   └── main.tsx          # Entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── laptop-agent/             # Python FastAPI Windows Desktop Agent (Stages 2, 3, 4 & 5)
│   ├── app/
│   │   ├── models/           # Pydantic schemas (auth, health, system, capabilities, stream, input)
│   │   ├── routers/          # FastAPI routes (/health, /api/pair, /api/system, /api/stream/*, /api/input/*)
│   │   ├── services/         # Telemetry providers, PIN auth, WebRTC stream & Win32 InputService
│   │   ├── dependencies/     # Bearer token validation dependencies
│   │   ├── config.py         # App settings & LAN IP discovery
│   │   ├── logger.py         # Structured logging configuration
│   │   └── main.py           # FastAPI entry & WebRTC/Input lifespan cleanup
│   ├── tests/                # Automated pytest suite (28 unit/integration tests)
│   ├── run.py                # Agent CLI launcher with --lan support
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Virtual environment setup & usage guide
├── docs/                     # Engineering architecture & roadmap
│   ├── architecture.md
│   └── roadmap.md
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

## Step-by-Step Local Wi-Fi Testing Procedure (Stage 5)

### Step 1: Ensure Devices Are on the Same Wi-Fi
Connect your mobile phone and your Windows laptop to the same Wi-Fi router / SSID.

### Step 2: Configure Windows Firewall Safely
To permit incoming agent connections on port 8000 without disabling your firewall, run **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "PocketDesk Agent (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Private
```

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
  PocketDesk Laptop Agent v0.5.0 (Stage 5)
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
2. Tap **"Pair with Laptop"**, verify the agent address matches (`http://192.168.1.145:8000`), enter the 6-digit PIN, and tap **"Authorize & Connect"**.

### Step 6: Start Screen Sharing
1. Tap **"Start Screen Sharing"** in the Screen tab.
2. The live Windows desktop video appears in the viewport with a green `● LIVE` badge.
3. Check your laptop terminal — it will print `[SCREEN SHARING ACTIVE]`.

### Step 7: Enable Remote Input
1. Tap the green **"Enable Input"** button in the banner, video toolbar, or Controls section.
2. An authorization modal will prompt: *"Enable Remote Input Control? You are granting this device permission to move the mouse cursor, click, and type keystrokes."*
3. Tap **"Authorize & Enable"**.
4. The laptop terminal immediately outputs:
   ```
   ==============================================================
   [INPUT CONTROL ENABLED] Client 'PocketDesk Web Client' authorized for mouse/keyboard!
   Emergency Stop: POST http://127.0.0.1:8000/api/input/control
   ==============================================================
   ```

---

## Manual Test Checklist

- [ ] **Mouse Movement (Direct Touch):** Slide your finger across the streamed desktop video and verify the Windows mouse cursor follows your finger position accurately.
- [ ] **Left-Click:** Tap anywhere on an icon or empty desktop area and verify an immediate left click occurs at that position.
- [ ] **Right-Click:** Long-press (holding for > 350ms) or two-finger tap to verify a Windows context menu opens.
- [ ] **Click-and-Drag:** Touch and hold for 150ms then drag across the screen to select multiple files or drag a window.
- [ ] **Trackpad Mode:** Switch to the **Controls** tab and use the Virtual Trackpad surface to move the cursor relatively, use the physical **Left Click** and **Right Click** buttons, and test **Drag Lock**.
- [ ] **Vertical Scrolling:** Tap the **Scroll Up** / **Scroll Down** buttons or use the mouse scroll gesture.
- [ ] **Virtual Keyboard:** Tap the keyboard icon in the stream toolbar to expand the on-screen keyboard. Press keys like `Enter`, `Backspace`, `Esc`, `Tab`, and arrow keys.
- [ ] **Text Typing:** Type a string in the text entry field (e.g., `"PocketDesk remote typing test!"`) and tap **Send Text** into Notepad or a text editor.
- [ ] **Windows Shortcuts:** Tap `Win + D` to toggle show desktop, or `Win + E` to open File Explorer.
- [ ] **Emergency Kill Switch:** Tap the red **"Disable Input"** button and verify that remote inputs are immediately ignored and that the terminal logs `[INPUT CONTROL DISABLED]`.
- [ ] **Session Cleanup:** Tap **"Disconnect"** and verify that all remote input permissions and video tracks are cleanly terminated.

---

## Automated Tests

Run the automated test suite in `laptop-agent/`:

```powershell
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent
.\.venv\Scripts\pytest.exe -v
```

All 28 unit and integration tests verify:
- Coordinate mapping accuracy and screen boundary clamping
- Input validation (rejection of out-of-bounds coordinates, unwhitelisted keys, oversized text payloads)
- Authentication enforcement on all input endpoints (401 Unauthorized)
- Permission gating (403 Forbidden when remote input is disabled)
- Explicit input enable / disable / emergency stop lifecycle
- Automatic key and mouse button release during cleanup
- WebRTC SDP offer/answer signaling exchange (`/api/stream/offer`)
- Pairing authorization & lockout protection
