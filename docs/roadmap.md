# PocketDesk Engineering Roadmap

PocketDesk is built incrementally in accordance with strict engineering guidelines. Each stage delivers an independently testable, functional milestone.

---

## Stage Breakdown

### Stage 1: Frontend Dashboard & Component Architecture *(Completed)*
- **Objective:** Scaffold the client application, design the mobile-friendly dark UI dashboard, establish component architecture, and verify build integrity.
- **Deliverables:**
  - Modern dark React + Vite + TypeScript interface with Tailwind CSS.
  - Laptop device card, 16:9 remote display placeholder, and state simulator.
  - Feature panels for Mouse & Keyboard, File Transfer, Applications, and System Monitor.

---

### Stage 2: Local Python FastAPI Backend & Telemetry *(Completed)*
- **Objective:** Create the local agent on the Windows laptop using Python and FastAPI, report system telemetry, and bind to localhost.
- **Deliverables:**
  - FastAPI service on `127.0.0.1:8000` with `/health`, `/api/system`, and `/api/capabilities`.
  - Pydantic models, structured logging, and automated test suite.

---

### Stage 3: Local Network Device Pairing & Handshake *(Completed)*
- **Objective:** Connect phone and laptop over local Wi-Fi with PIN-based explicit authorization.
- **Deliverables:**
  - Ephemeral 6-digit terminal PIN handshake with cryptographic bearer session tokens.
  - Configurable agent connection address in frontend with CORS hardening.
  - Real-time hardware telemetry polling (CPU, RAM, battery sensors).

---

### Stage 4: Authenticated WebRTC Desktop Video Streaming *(Completed)*
- **Objective:** Capture Windows desktop frames and stream them to the phone via WebRTC.
- **Deliverables:**
  - Fast desktop frame capture via `mss` and Pillow downscaling.
  - `aiortc` WebRTC video streaming over DTLS-SRTP with configurable FPS and resolution limits.
  - On-laptop screen-sharing indicator.

---

### Stage 5: Low-Latency Remote Input Control *(Completed)*
- **Objective:** Allow remote mouse and keyboard interaction from phone touch gestures.
- **Deliverables:**
  - Win32 cursor positioning and mouse clicks via `user32.dll`.
  - Virtual on-screen keyboard with Unicode text entry and navigation hotkeys.
  - Normalized coordinate mapping accounting for aspect ratios and letterboxing.
  - Default-disabled input with explicit authorization modal and Emergency Stop button.

---

### Stage 6: Secure Internet Access & Dynamic TURN NAT Traversal *(Completed)*
- **Objective:** Secure remote access to the user's laptop across the public internet.
- **Deliverables:**
  - Device registration with 256-bit cryptographic secrets and device registry.
  - Dynamic RFC 5766 TURN credentials via HMAC-SHA1 (`TurnService`).
  - Single-use cryptographic nonces and timestamp verification ($\pm 60$s) for replay protection.
  - Sliding-window rate limiting (5 attempts = 5-minute lockout).
  - Authorized Devices management modal with instant revocation.

---

### Stage 7: Restricted File Manager & Application Launcher *(Completed)*
- **Objective:** Restricted filesystem browsing, downloading, uploading, and allowlisted application launching.
- **Deliverables:**
  - Canonical path resolution (`Path.resolve()`) strictly confined to approved roots (`Downloads`, `Documents`, `Desktop`, `Pictures`).
  - Path traversal and symlink escape defenses; sensitive credential/browser profile filtering.
  - 50 MB upload limit with automated partial-file cleanup.
  - Predefined application allowlist with zero arbitrary shell execution (`shell=False`).
  - Explicit confirmation modal for disruptive applications.

---

### Stage 8: AI-Assisted Desktop Command Interface *(Completed)*
- **Objective:** Natural-language desktop command interface mapping instructions to authorized actions without paid APIs or shell commands.
- **Deliverables:**
  - Local rule-based NLP intent classifier supporting 6 authorized actions (`launch_app`, `get_system_status`, `search_files`, `control_stream`, `capture_screenshot`, `show_help`).
  - Zero external paid AI APIs, zero cloud LLM dependencies, and zero shell execution.
  - Prohibited destructive command filter (`rm`, `format`, `shutdown`, `powershell`, `drop`, `curl`).
  - Mandatory confirmation gates for screenshot captures and disruptive applications.
  - Interactive AI Assistant frontend section with prompt suggestion chips, proposed action preview cards, and rich result views (base64 screenshot modal, telemetry cards, file lists).
  - Traceable security audit logging with audit IDs.
