# PocketDesk

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB.svg)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Streaming-333333.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)

**A secure, low-latency remote access platform designed to view, control, and manage Windows 10/11 laptops directly from a smartphone or web client.**

[Features](#key-features) • [Architecture](#architecture) • [Security Model](#security-model) • [Getting Started](#getting-started) • [Testing](#automated-tests) • [Author](#author)

</div>

---

## Overview

PocketDesk turns any authenticated phone or browser into a portable terminal for your personal Windows workstation. Engineered with a defense-in-depth security model, it delivers real-time desktop screen sharing over encrypted WebRTC peer connections, synthetic trackpad and keystroke injection via native Win32 APIs, a sandboxed file manager, allowlisted application execution, and a local rule-based desktop assistant.

Whether you are connected to the same local Wi-Fi or working remotely across different networks via NAT traversal, PocketDesk provides smooth, responsive desktop control without exposing unauthenticated desktop ports to the internet.

---

## Key Features

### 1. High-Performance Screen Streaming
- **WebRTC Pipeline:** Low-latency video streaming using `aiortc` and PyAV with H.264 / VP8 encoding over DTLS-SRTP.
- **Interactive Desktop Capture:** Resilient Win32 desktop station targeting (`WinSta0\Default`) with `mss` and `PIL.ImageGrab` fallback capture.
- **Configurable Viewport:** Dynamic frame pacing and resolution scaling (1080p native, 720p HD, 540p, 480p at 15–60 FPS).
- **Mobile-Optimized Player:** Responsive 16:9 viewport with fullscreen touch controls and letterbox/pillarbox compensation.

### 2. Remote Mouse & Keyboard Control
- **Touch Gesture Mapping:** Absolute cursor navigation, virtual trackpad gestures, two-finger scrolling, and double-click actions.
- **Win32 Input Injection:** High-precision input dispatching using `ctypes` calling `SetCursorPos`, `mouse_event`, and `SendInput`.
- **Full Unicode Keyboard:** International character typing using `KEYEVENTF_UNICODE` alongside standard Windows hotkeys (`Ctrl+C`, `Ctrl+V`, `Win`, `Alt`, `Tab`, `Esc`).
- **Emergency Safety Cutoff:** Immediate server-side release of all held keys and mouse buttons with a single-click emergency stop button.

### 3. Sandboxed File Manager
- **Approved Root Enforcement:** Restricts file operations strictly to user-designated directories (Downloads, Documents, Desktop, Pictures).
- **Path Traversal Defenses:** Canonical path resolution (`Path.resolve()`) preventing symlink escapes, relative dot-dot traversals, and null-byte injection.
- **Sensitive Path Blacklist:** Blocks access to credentials, browser profiles, SSH keys (`.ssh`), environment files (`.env`), and system roots (`AppData`, `System32`).
- **Upload & Download:** Streamlined chunked file uploads with real-time progress indicators and a strict 50 MB file size limit.

### 4. Allowlisted Application Launcher
- **Predefined Executables:** Strict allowlist (Notepad, Calculator, Paint, File Explorer, Microsoft Edge, VS Code, Task Manager, PowerShell).
- **Zero Arbitrary Execution:** Executed via `subprocess.Popen(..., shell=False)` with explicit desktop handles—rejects command-line injection and arbitrary binaries.
- **Disruptive Action Confirmation:** Requires explicit confirmation prompts before launching sensitive administrative or system inspection tools.

### 5. Local AI Command Interface
- **Rule-Based Natural Language Engine:** Maps natural-language prompts to verified desktop actions (launch app, hardware telemetry, file search, screenshot capture).
- **Zero External Paid APIs:** Completely local and deterministic—no cloud dependencies, zero external network queries, and no API keys required.
- **Execution Confirmation Gates:** Moderate and sensitive actions require explicit confirmation cards before triggering host actions.
- **Prohibited String Filter:** Hard rejection of destructive shell tokens (`rm`, `del`, `format`, `shutdown`, `reboot`, `drop`, `kill`).

### 6. Dual-Mode Network Architecture & NAT Traversal
- **Local Wi-Fi Mode:** Zero-configuration direct P2P transport on home and office LANs.
- **Remote Internet Mode:** RFC 5766 dynamic STUN / authenticated TURN relay integration with short-lived HMAC-SHA1 credentials for carrier-grade NAT traversal.
- **Replay Protection:** Timestamp-bound verification windows ($\pm 60$s) and single-use cryptographic nonces.

### 7. Dedicated Android Application
- **Native Android Client:** Built with React Native and native `react-native-webrtc` bindings.
- **Hardware-Backed Storage:** 256-bit device secrets protected with `EncryptedSharedPreferences` / Android KeyStore.
- **Lifecycle Integration:** Automatically suspends video decoding, pauses polling, and releases inputs when backgrounded.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   PocketDesk Clients                   │
│                                                        │
│   ┌────────────────────────┐  ┌────────────────────┐   │
│   │ React Web Client       │  │ Dedicated Android  │   │
│   │ (Vite + TypeScript)    │  │ (React Native)     │   │
│   └───────────┬────────────┘  └─────────┬──────────┘   │
└───────────────┼─────────────────────────┼──────────────┘
                │                         │
                ▼                         ▼
   HTTPS / WSS Signaling          Authenticated WebSockets
   (Ephemeral PIN & JWT)          (Input Dispatch & Telemetry)
                │                         │
                └───────────┬─────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Windows Laptop Agent (FastAPI)             │
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ AuthService      │  │ Win32 Desktop Attachment   │  │
│  │ (PIN & Sessions) │  │ ('WinSta0\\Default')        │  │
│  └────────┬─────────┘  └─────────────┬──────────────┘  │
│           │                          │                 │
│  ┌────────▼─────────┐  ┌─────────────▼──────────────┐  │
│  │ WebRTC Engine    │  │ Win32 Input Injection      │  │
│  │ (aiortc + av)    │  │ (SendInput / SetCursorPos) │  │
│  └────────┬─────────┘  └─────────────┬──────────────┘  │
│           │                          │                 │
│  ┌────────▼─────────┐  ┌─────────────▼──────────────┐  │
│  │ Sandboxed FS     │  │ Allowlisted App Launcher   │  │
│  │ (Path.resolve)   │  │ (subprocess / shell=False) │  │
│  └──────────────────┘  └────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Security Model

PocketDesk enforces defense-in-depth at every layer:

1. **Explicit Terminal Pairing:** To register a client, a 6-digit cryptographic PIN generated in the laptop host console must be entered manually.
2. **Short-Lived Ephemeral Sessions:** Control actions require signed Bearer tokens with strict 1-hour expiration limits.
3. **Replay & Rate Limiting:** All authentication and control payloads validate single-use nonces and client timestamps within a 60-second window, backed by sliding-window lockout rate limiting.
4. **Sandboxed Filesystem:** Access is confined to whitelisted user directories; paths are canonicalized and tested against jailbreak vectors before reading or writing.
5. **No Arbitrary Shell Execution:** The command interpreter maps strictly to predefined Python functions—no shell evaluation (`eval`, `exec`, or `cmd.exe`) is ever invoked.

---

## Project Structure

```
pocketdesk/
├── laptop-agent/             # Python FastAPI Windows Desktop Agent
│   ├── app/
│   │   ├── models/           # Pydantic schemas (auth, stream, input, files, apps, assistant)
│   │   ├── routers/          # REST & WebSocket endpoints (/health, /api/pair, /api/stream/*, /api/input/*)
│   │   ├── services/         # Win32 desktop, WebRTC, input injection, file sandboxing, app launcher
│   │   ├── dependencies/     # Session authentication & authorization guards
│   │   ├── config.py         # System settings & environment validation
│   │   ├── logger.py         # Structured security audit logging
│   │   └── main.py           # FastAPI application entry & lifecycle hooks
│   ├── tests/                # Automated pytest suite (66 unit & integration tests)
│   ├── run.py                # Command-line agent runner (--lan flag)
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # React 19 + TypeScript Web Dashboard
│   ├── src/
│   │   ├── components/       # RemoteDisplay, Header, Trackpad, Files, Apps, Assistant
│   │   ├── services/         # WebRTC client, input WebSocket dispatcher, REST clients
│   │   ├── types/            # TypeScript domain interfaces
│   │   └── App.tsx           # Main application coordinator
│   ├── package.json
│   └── vite.config.ts
│
├── android-app/              # React Native Android Mobile Application
│   ├── android/              # Native Gradle & manifest configuration
│   ├── src/
│   │   ├── screens/          # ConnectScreen, RemoteDesktopScreen, FilesScreen, AppsScreen
│   │   ├── services/         # SecureStorage (KeyStore), WebRTC, API client
│   │   └── App.tsx           # Android root application component
│   ├── tests/                # Node.js automated test suite (12 tests)
│   └── package.json
│
├── docs/                     # Technical Architecture & Deployment Documentation
│   ├── architecture.md       # Full architectural overview and data flow
│   ├── deployment_guide.md   # Production deployment (Reverse Proxy + Coturn TURN)
│   ├── security_checklist.md # Verification checklist and threat analysis
│   ├── ai_command_interface.md # Rule-based assistant specification
│   └── android_application_guide.md # Android build and KeyStore guide
│
└── README.md
```

---

## Getting Started

### Prerequisites
- **Operating System:** Windows 10 or Windows 11 (Host Agent)
- **Python:** Python 3.10 or higher
- **Node.js:** Node.js 18+ and npm

### 1. Start the Windows Laptop Agent
```powershell
# Navigate to the agent directory
cd laptop-agent

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start agent on local network
python run.py --lan
```
*Note the 6-digit **Pairing PIN** printed in your console.*

### 2. Start the Web Client
```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev -- --host
```

### 3. Connect from Your Phone
1. Connect your phone to the same Wi-Fi network as your laptop.
2. Open your phone's browser and go to `http://<LAPTOP_LOCAL_IP>:5173`.
3. Select **Local Wi-Fi Mode** and enter the 6-digit **PIN** displayed in the agent terminal.
4. Tap **Start Stream** to view your desktop, and toggle **Enable Input** to control your laptop!

---

## Automated Tests

Run the test suite for each component to verify functionality:

### Laptop Agent (Python / Pytest):
```powershell
cd laptop-agent
.\.venv\Scripts\pytest.exe -v
# 66 passed in ~1.2s
```

### Android Application:
```powershell
cd android-app
npm test
# 12 passed in ~0.3s
```

### Web Frontend (TypeScript Production Build):
```powershell
cd frontend
npm run build
# Built cleanly with 0 type errors
```

---

## Author

**Gaurav Kumar Chaudhary**
- GitHub: [@Gauravchaudhary76](https://github.com/Gauravchaudhary76)
- LinkedIn: [Gaurav Chaudhary](https://www.linkedin.com/in/gaurav-chaudhary-5bb4982b7)

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
