# PocketDesk

PocketDesk is a modern, privacy-focused remote access system designed to let you securely view and control your Windows 10/11 laptop directly from your phone through a mobile-friendly web application.

Development proceeds incrementally in stages, starting with a clean local prototype and gradually introducing backend pairing, high-performance screen capture, low-latency input controls, and encrypted NAT traversal.

---

## Technology Stack

### Frontend (Stage 1 - Current)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4
- **Iconography:** Lucide React
- **Design Philosophy:** Mobile-first, responsive dark theme, accessible semantic controls

### Backend & Agent (Upcoming Stages)
- **Backend Server:** Python 3.10+ with FastAPI and WebSockets *(Stage 2)*
- **Windows Agent:** Python with pywin32, DXGI (Desktop Duplication API), pynput, and psutil *(Stage 3 & 4)*
- **Real-time Media:** WebRTC (PeerConnection, DataChannels) and WSS *(Stage 3 & 6)*
- **Cost & Dependencies:** 100% free and open-source. Zero paid external APIs, zero third-party AI keys.

---

## Project Structure

```
pocketdesk/
├── frontend/             # React + Vite + TypeScript web dashboard (Stage 1)
│   ├── src/
│   │   ├── components/   # Reusable UI components
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
│   │   ├── types/        # TypeScript interfaces & domain models
│   │   ├── App.tsx       # Root layout & responsive multi-view shell
│   │   ├── index.css     # Base styles and dark scrollbars
│   │   └── main.tsx      # Entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/              # Python FastAPI server architecture (Stage 2)
│   └── README.md
├── laptop-agent/         # Native Windows capture & input agent (Stage 3 & 4)
│   └── README.md
├── docs/                 # Engineering architecture & roadmap
│   ├── architecture.md
│   └── roadmap.md
└── README.md             # Project overview & documentation
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

### If Any Tool is Missing:
- **Node.js & npm:** Download the LTS installer from [nodejs.org](https://nodejs.org/) or install via winget:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
- **Python:** Download from [python.org](https://www.python.org/downloads/) or install via winget (ensure "Add python.exe to PATH" is checked):
  ```powershell
  winget install Python.Python.3.12
  ```
- **Git:** Download from [git-scm.com](https://git-scm.com/) or install via winget:
  ```powershell
  winget install Git.Git
  ```

---

## Installation & Setup

1. **Clone or Navigate to the Workspace:**
   ```powershell
   cd C:\Users\gaura\.gemini\antigravity\scratch\pocketdesk
   ```

2. **Install Frontend Dependencies:**
   ```powershell
   cd frontend
   npm install
   ```

---

## Development Startup Commands

To start the local Vite development server:

```powershell
# From the frontend directory
npm run dev
```

The terminal will display the local development URL:
```
  VITE v8.3.4  ready in 200 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.145:5173/
```

### Opening on Your Mobile Phone:
1. Ensure your phone and laptop are connected to the same local Wi-Fi network.
2. In your phone's browser (Safari / Chrome), open the **Network URL** shown in the terminal (e.g. `http://192.168.1.145:5173`).
3. PocketDesk will display in full mobile-optimized ergonomics with bottom tab navigation.

---

## Building for Production

To perform a TypeScript type-check and create an optimized production build:

```powershell
cd frontend
npm run build
```

To preview the production build locally:

```powershell
npm run preview
```

---

## Current Limitations (Stage 1 Scope)

In strict accordance with the development guidelines:
- **No live video stream yet:** The remote desktop area displays an informative 16:9 placeholder. Real-time screen capture via the Windows Desktop Duplication API (DXGI) is scheduled for **Stage 3**.
- **No active remote control:** Mouse and keyboard input injection is intentionally inactive to prevent unverified execution. Input dispatching via the native Windows agent is scheduled for **Stage 4**.
- **No backend server running yet:** The `Connect` button and backend endpoints are scheduled for **Stage 2**.
- **Rule #6 Enforced:** Buttons and controls do not pretend to work. Clicking any button that relies on future stages opens an explanatory dialog detailing what will be implemented, which stage will deliver it, and how it will work.

---

## Features Planned for Future Stages

1. **Stage 2 — Backend & Pairing:**
   - Python FastAPI local server.
   - Ephemeral 6-digit PIN / QR pairing handshake.
   - WebSocket signaling hub.

2. **Stage 3 — Screen Capture & Telemetry:**
   - Low-latency GPU screen capture via DXGI.
   - WebRTC media streaming to mobile browsers.
   - Live hardware telemetry (CPU, RAM, disk, network) via `psutil`.

3. **Stage 4 — Input & Process Management:**
   - Mobile virtual trackpad with gestures (pan, tap, two-finger scroll).
   - Windows hotkey triggers (`Ctrl+Alt+Del`, `Alt+Tab`, `Win+D`, `Win+E`).
   - Task manager for inspecting and terminating processes.

4. **Stage 5 — File Transfer:**
   - Drag-and-drop file transfer between phone and laptop.
   - Chunked binary transfer with SHA-256 verification.

5. **Stage 6 — Secure Remote Internet Access:**
   - WebRTC NAT traversal / encrypted mesh tunnel.
   - End-to-end encryption for out-of-home access.
