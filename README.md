# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing backend pairing, high-performance screen capture, low-latency input controls, and encrypted NAT traversal.

---

## Technology Stack

### Frontend (Stage 1)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **Design Philosophy:** Mobile-first, responsive dark theme, accessible semantic controls

### Laptop Agent (Stage 2 — Current)
- **Framework:** Python 3.10+ with FastAPI and Uvicorn
- **Validation:** Pydantic v2 data models
- **Hardware Telemetry:** `psutil` (OS, CPU load, RAM allocation, battery sensors)
- **Testing:** `pytest` and `httpx` (100% passing test coverage)
- **Security Policy:** Local-only (`127.0.0.1:8000`). No public exposure, no decorative auth.

### Future Stages (Stages 3 to 6)
- **Screen Capture:** DirectX Desktop Duplication API (DXGI) via C++/Python *(Stage 3)*
- **Input Injection:** Win32 `SendInput` / `pynput` *(Stage 4)*
- **File Transfer:** Chunked binary streaming with SHA-256 verification *(Stage 5)*
- **Real-time Media:** WebRTC (PeerConnection, DataChannels) and encrypted NAT traversal *(Stages 3 & 6)*
- **Cost & Dependencies:** 100% free and open-source. Zero paid external APIs, zero third-party AI keys.

---

## Project Structure

```
pocketdesk/
├── frontend/                 # React + Vite + TypeScript web dashboard (Stage 1)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Header.tsx               # Branding, status, state preview switcher
│   │   │   ├── DeviceCard.tsx           # Paired laptop info & Connect button
│   │   │   ├── RemoteDisplay.tsx        # 16:9 remote desktop preview container
│   │   │   ├── MouseKeyboardSection.tsx # Virtual trackpad & hotkeys
│   │   │   ├── FileTransferSection.tsx  # File drag & drop & transfer queue
│   │   │   ├── ApplicationsSection.tsx  # Quick launcher & task manager
│   │   │   ├── SystemMonitorSection.tsx # Hardware telemetry & resource meters
│   │   │   ├── StatusBadge.tsx          # Connection state indicator pill
│   │   │   ├── StageBadge.tsx           # Roadmap milestone indicator
│   │   │   └── InfoModal.tsx            # Stage notification dialog (Rule #6)
│   │   ├── types/            # TypeScript interfaces & domain models
│   │   ├── App.tsx           # Root layout & live agent connectivity
│   │   ├── index.css         # Base styles and dark scrollbars
│   │   └── main.tsx          # Entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── laptop-agent/             # Python FastAPI Windows Desktop Agent (Stage 2)
│   ├── app/
│   │   ├── models/           # Pydantic request & response schemas
│   │   │   ├── health.py     # GET /health schema
│   │   │   ├── system.py     # GET /api/system telemetry schema
│   │   │   └── capabilities.py # GET /api/capabilities schema
│   │   ├── routers/          # FastAPI route controllers
│   │   │   ├── health.py     # /health endpoint
│   │   │   ├── system.py     # /api/system endpoint
│   │   │   └── capabilities.py # /api/capabilities endpoint
│   │   ├── services/         # Telemetry data providers (psutil & platform)
│   │   ├── config.py         # Application settings (127.0.0.1 default)
│   │   ├── logger.py         # Structured logging configuration
│   │   └── main.py           # FastAPI application entry & CORS middleware
│   ├── tests/                # Automated pytest suite
│   │   ├── conftest.py       # TestClient fixtures
│   │   ├── test_health.py    # Health & root route tests
│   │   ├── test_system.py    # Real & mocked telemetry tests
│   │   └── test_capabilities.py # Capabilities registry tests
│   ├── run.py                # Agent CLI launcher
│   ├── requirements.txt      # Python dependencies
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

## Setup & Startup Instructions

### 1. Windows Laptop Agent (Python + FastAPI)

```powershell
# Navigate to laptop-agent directory
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\laptop-agent

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the agent (binds strictly to 127.0.0.1:8000)
python run.py

# Run the automated tests
pytest -v
```

### 2. Frontend Dashboard (React + Vite)

In a separate terminal:

```powershell
# Navigate to frontend directory
cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk\frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173/` in your browser. Click **"Connect to Agent"** to connect the frontend to your local Python agent and stream live Windows telemetry.

---

## Current Limitations (Stage 2 Scope)

In strict accordance with the development guidelines:
- **No live video stream yet:** Screen capture via the DirectX Desktop Duplication API (DXGI) is scheduled for **Stage 3**.
- **No active remote control:** Mouse and keyboard input injection is intentionally inactive to prevent unverified execution. Input dispatching via the native Windows agent is scheduled for **Stage 4**.
- **Localhost only:** The agent strictly binds to `127.0.0.1:8000`. It is never exposed to the public internet or external networks during early stages.
- **No decorative authentication:** Localhost assumptions are documented cleanly without fake tokens.
- **Rule #6 Enforced:** Buttons and controls do not pretend to work. Controls relying on future stages open an explanatory dialog detailing what will be implemented, which stage will deliver it, and how it will work.

---

## Features Planned for Future Stages

1. **Stage 3 — Screen Capture & Telemetry Stream:**
   - Low-latency GPU screen capture via DXGI.
   - WebRTC media streaming to mobile browsers.
   - Real-time video frame decoder on HTML5 Canvas.

2. **Stage 4 — Input & Process Management:**
   - Mobile virtual trackpad with gestures (pan, tap, two-finger scroll).
   - Windows hotkey triggers (`Ctrl+Alt+Del`, `Alt+Tab`, `Win+D`, `Win+E`).
   - Task manager for inspecting and terminating processes.

3. **Stage 5 — File Transfer:**
   - Drag-and-drop file transfer between phone and laptop.
   - Chunked binary transfer with SHA-256 verification.

4. **Stage 6 — Secure Remote Internet Access:**
   - WebRTC NAT traversal / encrypted mesh tunnel.
   - End-to-end encryption for out-of-home access.
