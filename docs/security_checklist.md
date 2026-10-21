# PocketDesk Security Checklist & Threat Model (Stage 6)

> [!WARNING]
> **CRITICAL SECURITY NOTICE:**
> Enabling HTTPS/WSS does **NOT** make a system inherently secure for public internet exposure. HTTPS only protects data in transit between the client and server from eavesdropping and tampering. It does **not** protect against unauthenticated desktop control, weak credentials, replay attacks, brute-force guessing, endpoint malware, or privilege escalation.
> 
> Never expose the PocketDesk agent to the public internet until every requirement on this checklist has been verified.

---

## 1. Threat Model & Security Architecture

PocketDesk provides access to high-value host assets:
- **Desktop Visual Display:** Private documents, passwords, communications, and photos.
- **Host Input Subsystem:** Ability to type text, execute shortcuts, launch applications, and click buttons.
- **System Telemetry & Metadata:** OS version, active processes, hardware utilization.

### Threat Actors & Mitigations

| Threat | Attack Vector | PocketDesk Stage 6 Mitigation |
| :--- | :--- | :--- |
| **Public Port Scanners & Bots** | Scanning exposed IP:port combinations for unauthenticated endpoints. | Every remote route requires valid Bearer authentication. Pairing requires explicit 5-minute terminal PIN. Zero unauthenticated control endpoints. |
| **Brute-Force PIN Attacks** | Rapidly guessing the 6-digit numeric pairing PIN. | Sliding-window `RateLimiter` enforces a 5-minute lockout after 5 consecutive failed attempts per client IP. |
| **Replay Attacks** | Capturing a valid pairing or session request and re-submitting it. | `ReplayProtection` validates timestamps within a strict $\pm 60$-second window and maintains an in-memory cache of consumed nonces. Replayed nonces are rejected with HTTP 400. |
| **Session Hijacking / Theft** | Stealing long-lived tokens from browser storage or memory. | Remote session tokens are short-lived (1-hour TTL). Pairing generates a 256-bit persistent device secret; session tokens are issued dynamically and stored only in memory / `sessionStorage`. |
| **Relay Bandwidth Theft** | Unauthorized third parties using the TURN server as a free proxy. | TurnService generates time-limited RFC 5766 ephemeral credentials (`timestamp:username` with HMAC-SHA1 signature). Stale or unauthenticated TURN requests are rejected by Coturn. |
| **Malicious Client Reconnection** | Stolen client phone attempting to access laptop after theft. | Laptop operator or authorized client can instantly revoke any device via `POST /api/remote/devices/{id}/revoke`, immediately terminating active WebRTC streams and input rights. |
| **Host Privilege Escalation** | Remote code execution via injected keystrokes or buffer overflow. | PocketDesk runs with least privilege (standard user account). Input is dispatched via native Win32 `SendInput` APIs without invoking command shells (`cmd.exe` / `powershell.exe`). UIPI prevents tampering with elevated processes. |

---

## 2. Pre-Deployment Security Checklist

Before exposing PocketDesk to the internet or untrusted networks, verify each item:

### A. Host System & Process Isolation
- [ ] **Non-Elevated Execution:** The laptop agent runs under a standard, non-administrator Windows user account.
- [ ] **No Administrator Bypass:** The agent executable is **never** granted "Run as Administrator" privileges.
- [ ] **UIPI Enforcement:** Verify that when Windows User Account Control (UAC) prompts or Ctrl+Alt+Del appear, remote input is blocked by Windows UIPI (by design).
- [ ] **Local Binding:** In reverse proxy setups, `POCKETDESK_HOST` is explicitly set to `127.0.0.1` so the agent cannot be contacted directly via LAN without going through the proxy.

### B. Transport & Edge Hardening
- [ ] **TLS 1.2 / 1.3 Only:** Reverse proxy (Caddy / Nginx) rejects SSLv3, TLS 1.0, and TLS 1.1.
- [ ] **Valid Certificate:** A trusted TLS certificate (e.g. Let's Encrypt) is configured; self-signed certificates in production are avoided.
- [ ] **HSTS Enabled:** `Strict-Transport-Security` header is sent with a minimum `max-age` of 1 year.
- [ ] **Request Size Caps:** Maximum client body size capped at 5 MB to prevent memory exhaustion attacks.

### C. Authentication & Credential Management
- [ ] **Zero Hardcoded Secrets:** Neither `POCKETDESK_TURN_SECRET` nor any device secret is committed to version control.
- [ ] **Strong TURN Secret:** If using a TURN relay, `POCKETDESK_TURN_SECRET` is generated via a cryptographically secure random generator (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`).
- [ ] **Ephemeral Sessions:** Verify `POCKETDESK_REMOTE_SESSION_TTL_SECONDS` is set to 3600 (1 hour) or less.
- [ ] **One-Time Pairing PINs:** Pairing PIN is generated dynamically on laptop agent launch, expires in 5 minutes, and is invalidated immediately after use.

### D. Session & Input Safety
- [ ] **Emergency Disable Button:** Tested and confirmed that clicking "Disable Input" immediately releases all held keys and mouse buttons.
- [ ] **Session Expiry Cleanup:** When a session token expires, active WebRTC video stream and input dispatch are immediately closed on both host and client.
- [ ] **Tab Close / Refresh Cleanup:** Closing the client browser tab or refreshing the page immediately terminates the WebRTC peer connection and dispatches unpair signals.

---

## 3. Manual Security Verification Procedure

Perform these tests on your setup to verify security mitigations:

### Test 1: Verify Brute-Force Rate Limiting
1. Attempt 5 consecutive invalid pairing requests with wrong PINs:
   ```bash
   for i in {1..5}; do
     curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/remote/devices/pair \
       -H "Content-Type: application/json" \
       -d '{"device_id":"test","device_name":"test","pairing_pin":"000000","timestamp":'$(date +%s)',"nonce":"'$(uuidgen)'"}'
   done
   ```
2. On the 6th attempt, verify that the server returns **HTTP 429 Too Many Requests**:
   ```json
   {"detail": "Too many failed authentication attempts. Access locked for 300 seconds."}
   ```

### Test 2: Verify Replay Attack Prevention
1. Capture a valid request body with a timestamp and nonce.
2. Submit the identical request a second time.
3. Verify that the agent returns **HTTP 400 Bad Request**:
   ```json
   {"detail": "Replay attack detected: nonce has already been consumed."}
   ```
4. Submit a request with a timestamp older than 60 seconds.
5. Verify that the agent returns **HTTP 400 Bad Request**:
   ```json
   {"detail": "Request timestamp is outside the allowed 60-second window."}
   ```

### Test 3: Verify Device Revocation
1. Pair your phone device and confirm live streaming works.
2. In the PocketDesk web client, open **Devices** modal (or issue `POST /api/remote/devices/{device_id}/revoke`).
3. Click **Revoke Access** for the client device.
4. Verify that:
   - The device secret is purged from the host registry.
   - Any active WebRTC video stream terminates immediately.
   - Remote input is disabled immediately.
   - Subsequent requests from that device return **HTTP 401 Unauthorized**.
