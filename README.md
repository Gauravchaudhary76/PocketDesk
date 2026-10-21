# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing authenticated local network pairing, high-performance WebRTC screen capture, low-latency input controls, encrypted NAT traversal, and safe restricted file and application management.

---

## Technology Stack

### Frontend (Stages 1 through 8 — Current)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **AI-Assisted Command Interface (Stage 8):**
  - Natural-language instruction input bar with suggestion chips.
  - Two-stage confirmation workflow: proposed action card with intent, parameters, and risk level badges before execution.
  - Zero paid API requirement: utilizes deterministic, rule-based intent parsing on the agent.
  - Rich action result displays: base64 screenshot preview modal, telemetry cards, file search lists, app launch indicators, and command help catalogs.
- **Screen Streaming:** Standard WebRTC `RTCPeerConnection` with DTLS-SRTP encryption, HTML5 `<video>` viewport with native Fullscreen API support, and configurable resolution & FPS controls.
- **Restricted File Manager (Stage 7):**
  - Interactive approved directory browser (Downloads, Documents, Desktop, Pictures) with breadcrumbs.
  - Direct file download to mobile browser.
  - Chunked upload dropzone with real-time percentage progress bar and 50 MB limit enforcement.
  - Folder creation modal with Windows naming validation.
- **Application Launcher (Stage 7):**
  - Allowlist-restricted application grid (Notepad, Calculator, Paint, File Explorer, Microsoft Edge, VS Code, Task Manager, Terminal).
  - Explicit confirmation modal for potentially disruptive tools (Task Manager, PowerShell/Terminal).
  - Live feedback toast with host Process ID (PID).
- **Remote NAT Traversal (Stage 6):** Dynamically acquires time-limited STUN/TURN credentials from the laptop agent; supports dual-mode connection ("Local Wi-Fi Mode" vs "Remote Internet Mode").
- **Device Security & Management (Stage 6):**
  - Persistent unique client device identification (`dev_...`) stored in `localStorage`.
  - Single-use cryptographic nonces and client timestamps ($\pm 60$s) for replay protection.
  - Dedicated **Authorized Devices Modal** to inspect all paired clients and execute instant revocation.
- **Remote Input (Stage 5):**
  - Direct touch-to-screen cursor control with letterbox/pillarbox aspect-ratio compensation.
  - Dedicated virtual trackpad zone with sensitivity controls, tap-to-click, and drag lock.
  - On-screen virtual keyboard supporting special navigation keys (`Enter`, `Esc`, `Tab`, `Backspace`, arrows).
  - Safety controls: Default-disabled input with explicit consent confirmation modal and persistent Emergency Stop button.

### Android Application (Stage 9 — Current)
- **Framework:** Dedicated React Native + TypeScript application (`android-app/`).
- **WebRTC Transport:** Android native `react-native-webrtc` binding with hardware-accelerated H.264/VP8 video decoding.
- **Security & Storage:** Hardware-backed `EncryptedSharedPreferences` / Android KeyStore for 256-bit device secrets (`SecureStorageService`). Memory-isolated short-lived session tokens (1-hour TTL).
- **App Lifecycle & Backgrounding:** Android `AppState` event handling that automatically pauses video streams, suspends polling, and emergency-stops active inputs upon app backgrounding.
- **Permissions:** Strictly minimal Android permissions (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`). Zero camera/mic and zero broad storage permissions.
- **Features:** Registered laptop profile manager, WebRTC screen streaming, touch gesture mouse mapping, on-screen keyboard with Windows hotkeys, restricted file manager, allowlisted app launcher, hardware telemetry, and AI command interface.

### Laptop Agent (Stages 2 through 8 — Current)
- **Framework:** Python 3.10+ with FastAPI, Uvicorn, and `python-multipart`
- **Validation:** Pydantic v2 data models with strict input bounds
- **Authentication:** Ephemeral 6-digit terminal PIN authorization with Bearer session tokens (1-hour TTL)
- **AI-Assisted Desktop Command Interface (Stage 8):**
  - Deterministic rule-based intent parser mapping natural-language instructions to 6 authorized actions.
  - Zero external paid AI APIs, zero external network queries, and zero shell execution.
  - Prohibited pattern filter rejecting destructive strings (`rm`, `del`, `format`, `shutdown`, `reboot`, `powershell`, `cmd`, `drop`, `curl`).
  - Mandatory confirmation gates for desktop screenshot captures and disruptive applications.
  - Traceable security audit logging on every command parse and execute event.
- **Restricted File Service (Stage 7):**
  - Canonical path resolution (`Path.resolve()`) strictly confined to approved roots (`POCKETDESK_ALLOWED_ROOTS`).
  - Path traversal and symlink escape defenses (rejects `../`, absolute paths, null bytes).
  - Blacklist filtering of sensitive files, browser profiles, and credentials (`.ssh`, `.env`, `AppData`, `id_rsa`).
  - 50 MB upload limit with automated partial-file cleanup on limit violation.
- **Allowlisted Application Launcher (Stage 7):**
  - Predefined mapping of immutable application IDs to fixed host executable paths.
  - Zero arbitrary shell execution: processes spawned via `subprocess.Popen(..., shell=False)`.
  - Confirmation requirement for disruptive tools.
- **Remote NAT Traversal (Stage 6):** Dynamic RFC 5766 TURN ephemeral credentials (`TurnService`) with HMAC-SHA1 signature and STUN server discovery.
- **Device Management & Replay Protection (Stage 6):**
  - Persistent `DeviceRegistry` (`data/devices.json`) managing 256-bit cryptographic device secrets.
  - `ReplayProtection` service validating timestamp windows ($\pm 60$s) and caching consumed nonces.
  - `RateLimiter` sliding-window lockout enforcing a 5-minute lockout after 5 consecutive failed attempts.
- **Desktop Capture (Stage 4):** Fast Windows desktop frame capture via `mss` with Pillow bilinear downscaling
- **WebRTC Video Engine (Stage 4 & 6):** `aiortc` and PyAV (`av`) generating paced H.264 / VP8 video streams over DTLS-SRTP
- **Win32 Input Injection (Stage 5):**
  - Native `ctypes.windll.user32` interface calling `SetCursorPos`, `mouse_event`, and `SendInput`.
  - Unicode character typing via `KEYEVENTF_UNICODE` (independent of host keyboard layout).
  - In-memory tracking of all held keys and mouse buttons with automatic emergency release upon disconnect.
- **Hardware Telemetry:** `psutil` (OS, CPU load, RAM allocation, battery sensors)
- **Testing:** `pytest` and `httpx` (66 passing automated unit & integration tests)

---

## Project Structure

```
pocketdesk/
├── android-app/              # Dedicated Android React Native Application (Stage 9)
│   ├── android/              # Native Android configuration (Gradle, Manifest, Kotlin)
│   │   ├── app/src/main/     # AndroidManifest.xml, MainActivity.kt, MainApplication.kt
│   │   └── build.gradle      # Native dependencies (libwebrtc, security-crypto)
│   ├── src/
│   │   ├── components/       # Header.tsx (Android status, mode & emergency stop)
│   │   ├── screens/          # ConnectScreen, RemoteDesktopScreen, FilesScreen, AppsScreen, SystemScreen, AssistantScreen
│   │   ├── services/         # secureStorage, auth, webrtc, input, files, apps, assistant
│   │   ├── types/            # TypeScript domain models
│   │   └── App.tsx           # Android root application component & AppState listener
│   ├── tests/                # Automated unit tests (12 tests)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React + Vite + TypeScript web dashboard (Stages 1 - 8)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.tsx                 # Branding, status, mode badge & Devices modal trigger
│   │   │   ├── DeviceCard.tsx             # Paired laptop info, address config & Connect button
│   │   │   ├── ConnectModal.tsx           # Dual-mode (Local Wi-Fi vs Remote Internet) pairing dialog
│   │   │   ├── DeviceManagementModal.tsx  # Stage 6 authorized paired devices & revocation manager
│   │   │   ├── RemoteDisplay.tsx          # WebRTC video stream viewport, touch controls & Emergency Stop
│   │   │   ├── VirtualKeyboard.tsx        # On-screen keyboard with special keys & shortcuts
│   │   │   ├── MouseKeyboardSection.tsx   # Virtual trackpad, tactile click buttons & hotkeys
│   │   │   ├── AssistantSection.tsx       # Stage 8 AI command interface with confirmation gates
│   │   │   ├── FileTransferSection.tsx    # Stage 7 restricted file manager & uploader
│   │   │   ├── ApplicationsSection.tsx    # Stage 7 allowlisted application launcher
│   │   │   ├── SystemMonitorSection.tsx   # Live hardware telemetry & resource meters
│   │   │   ├── StatusBadge.tsx            # Connection state indicator pill
│   │   │   ├── StageBadge.tsx             # Roadmap milestone indicator
│   │   │   └── InfoModal.tsx              # Stage notification dialog
│   │   ├── services/
│   │   │   ├── assistant.ts               # Stage 8 AI assistant client (intents, parse, execute)
│   │   │   ├── files.ts                   # Stage 7 file operations & upload tracking
│   │   │   ├── apps.ts                    # Stage 7 application launcher client
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
├── laptop-agent/             # Python FastAPI Windows Desktop Agent (Stages 2 - 8)
│   ├── app/
│   │   ├── models/           # Pydantic schemas (auth, health, system, stream, input, remote, files, apps, assistant)
│   │   ├── routers/          # FastAPI routes (/health, /api/pair, /api/stream/*, /api/input/*, /api/remote/*, /api/files/*, /api/apps/*, /api/assistant/*)
│   │   ├── services/         # Telemetry, TurnService, DeviceRegistry, ReplayProtection, FileManager, AppLauncher, AssistantService
│   │   ├── dependencies/     # Bearer token validation dependencies
│   │   ├── config.py         # App settings & environment discovery
│   │   ├── logger.py         # Structured logging configuration
│   │   └── main.py           # FastAPI entry & WebRTC/Input lifespan cleanup
│   ├── tests/                # Automated pytest suite (66 unit/integration tests)
│   ├── run.py                # Agent CLI launcher with --lan support
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Virtual environment setup & usage guide
├── docs/                     # Engineering architecture, deployment & security guides
│   ├── architecture.md       # High-level component interactions & data flow
│   ├── android_application_guide.md # Stage 9 Android architecture, KeyStore security & build guide
│   ├── deployment_guide.md   # Production deployment options (Mesh overlay vs Reverse Proxy + Coturn)
│   ├── security_checklist.md # Threat model, HTTPS warning, and verification procedures
│   ├── ai_command_interface.md # Stage 8 AI command interface, rule parser & confirmation gates
│   ├── file_management_and_app_launcher.md # Stage 7 file security & application allowlist specifications
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

## Documentation

- **Android Application Guide (Stage 9):** [`docs/android_application_guide.md`](docs/android_application_guide.md)
- **AI Desktop Interface (Stage 8):** [`docs/ai_command_interface.md`](docs/ai_command_interface.md)
- **File Manager & App Launcher (Stage 7):** [`docs/file_management_and_app_launcher.md`](docs/file_management_and_app_launcher.md)
- **Deployment Guide:** [`docs/deployment_guide.md`](docs/deployment_guide.md)
- **Security Checklist:** [`docs/security_checklist.md`](docs/security_checklist.md)

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
3. **Start Web Frontend (or launch Android app):**
   ```powershell
   cd frontend
   npm run dev -- --host
   ```
4. On your phone (via browser or dedicated Android app), select **"Local Wi-Fi Mode"**, enter the 6-digit PIN, and connect.

### 2. Testing Stage 9 Features (Dedicated Android App)
1. **Registered Laptops:**
   - In `android-app`, open the **Connect** tab.
   - Pair with your laptop using the terminal PIN.
   - Verify that your laptop profile appears in the **Registered Laptops** list.
   - Switch between saved laptops or remove a profile.
2. **Remote Desktop & Touch Gestures:**
   - Go to the **Screen** tab and tap **Start Stream**.
   - Tap **Enable Input** and confirm the authorization prompt.
   - Tap to click, double tap to double click, and drag to move the Windows cursor.
   - Tap **Disable Input** or the top red **STOP INPUT** button to verify immediate emergency input cessation.
3. **Files, Apps, System & AI Command Interface:**
   - Browse approved files in the **Files** tab.
   - Launch Notepad or Calculator in the **Apps** tab.
   - Inspect live CPU, RAM, and battery metrics in the **System** tab.
   - Submit natural language instructions in the **AI** tab (e.g. `"take screenshot"`, `"battery status"`).
4. **App Backgrounding Lifecycle:**
   - Background the app (or switch to another app).
   - Verify that streaming pauses, remote input is disabled, and any held modifiers are released.

---

## Automated Test Verification

Run the automated test suite in `laptop-agent/`:
```powershell
cd laptop-agent
.\.venv\Scripts\pytest.exe -v
```

Run the automated test suite in `android-app/`:
```powershell
cd android-app
npm test
```

Run the frontend TypeScript & Vite production build:
```powershell
cd frontend
npm run build
```

All test suites pass with **100% success** (66 Python tests + 12 Android unit tests + clean Vite build).
