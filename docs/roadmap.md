# PocketDesk Engineering Roadmap

PocketDesk is built incrementally in accordance with strict engineering guidelines. Each stage delivers an independently testable, functional milestone.

---

## Stage Breakdown

### Stage 1: Frontend Dashboard & Component Architecture *(Completed)*
- **Objective:** Scaffold the client application, design the mobile-friendly dark UI dashboard, establish component architecture, and verify build integrity.
- **Deliverables:**
  - Modern dark React + Vite + TypeScript interface with Tailwind CSS.
  - Laptop device card, 16:9 remote display placeholder, and state simulator (Disconnected, Connecting, Error).
  - Feature panels for Mouse & Keyboard, File Transfer, Applications, and System Monitor.
  - Informative explanatory dialogs on buttons planned for future stages (Rule #6).
  - Multi-tier folder structure (`frontend`, `backend`, `laptop-agent`, `docs`).
  - Comprehensive documentation and environment inspection.

---

### Stage 2: Local Python FastAPI Backend & Pairing Handshake *(Next)*
- **Objective:** Create the local server on the Windows laptop, establish LAN discovery, and implement secure device pairing.
- **Deliverables:**
  - FastAPI server listening on `127.0.0.1:8080` / local LAN.
  - Ephemeral 6-digit PIN / QR pairing handshake mechanism.
  - WebSocket signaling hub for client-host communication.
  - Automatic reconnection handling for transient Wi-Fi drops.

---

### Stage 3: Windows Screen Capture & Live Video Stream
- **Objective:** Capture Windows desktop frames and stream them to the mobile browser.
- **Deliverables:**
  - Native Windows screen capture using DirectX Desktop Duplication API (DXGI) or `mss`.
  - WebRTC video stream encoding (H.264 / VP9).
  - Mobile HTML5 canvas / WebGL video rendering with pinch-to-zoom support.
  - Live system resource telemetry (CPU, RAM, disk, network) streamed via `psutil`.

---

### Stage 4: Input Injection & Process Management
- **Objective:** Provide full control of the Windows cursor, keyboard, and running tasks from the phone.
- **Deliverables:**
  - Mobile virtual trackpad: single tap (left click), two-finger tap (right click), two-finger scroll.
  - Windows virtual hotkey triggers (`Ctrl+Alt+Del`, `Alt+Tab`, `Win+D`, `Win+E`).
  - Remote text input dispatcher with clipboard synchronization.
  - Task manager listing running processes with CPU/RAM metrics and termination capability.

---

### Stage 5: File Transfer & Security Hardening
- **Objective:** Enable seamless, secure file exchange between phone and laptop storage.
- **Deliverables:**
  - Drag-and-drop file upload to Windows `Downloads` directory.
  - Chunked binary transfer protocol with SHA-256 integrity checks.
  - File browser interface for downloading documents from the laptop to the phone.
  - Comprehensive security audit of local API endpoints.

---

### Stage 6: Secure Internet Access & NAT Traversal
- **Objective:** Allow secure remote access when away from home Wi-Fi.
- **Deliverables:**
  - Self-hostable STUN/TURN server integration or encrypted WireGuard/Tailscale mesh tunnel.
  - End-to-end encryption (E2EE) ensuring zero data leakage through intermediate relays.
  - Remote wake-on-LAN and sleep prevention management.
