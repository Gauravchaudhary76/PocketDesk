# PocketDesk Windows Agent (Stage 3 & Stage 4)

> **Status:** Architecture definition only. Implementation begins in **Stage 3**.

The Windows Agent runs natively on Windows 10/11 laptops. It interfaces directly with Windows system APIs to perform hardware-accelerated screen capture, input injection, process management, and telemetry gathering.

---

## Planned Modules

### 1. Screen Capture Engine (`capture/`) — Stage 3
- Utilizes the **Desktop Duplication API (DXGI)** for ultra-low latency, zero-copy GPU frame capture.
- Falls back to `mss` / GDI screen capture on older graphics hardware.
- Real-time video compression via H.264 / VP9 hardware encoder (NVENC / QuickSync / AMD AMF) or optimized software encoder.

### 2. Input Injection Engine (`input/`) — Stage 4
- Dispatches synthetic keyboard strokes and mouse events via the native Win32 `SendInput` API or Python `pynput`.
- Translates mobile touch gestures (pan, tap, scroll, pinch) into smooth Windows cursor deltas.
- Enforces Windows security boundaries (UAC prompt safeguards and non-elevated user privilege execution).

### 3. System Telemetry (`telemetry/`) — Stage 3
- Utilizes Python `psutil` to sample CPU usage (per core), memory utilization, NVMe/SSD drive capacity, and network bandwidth at 1-second intervals.
- Battery and thermal sensors via Windows Management Instrumentation (WMI).

### 4. Process & File Manager (`system/`) — Stages 4 & 5
- Lists running tasks and processes with PID, memory footprint, and CPU utilization.
- Supports launching common user applications (`explorer.exe`, `wt.exe`, browsers).
- Streams files to and from safe user directory paths (e.g., `Downloads`).
