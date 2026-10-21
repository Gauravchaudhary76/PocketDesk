import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("pocketdesk.security")


class SecurityAuditLogger:
    """
    Structured security audit logger for recording critical access events,
    authentication attempts, session lifecycle changes, and security exceptions.
    """

    @classmethod
    def log_event(
        cls,
        event_type: str,
        client_ip: str = "unknown",
        device_id: Optional[str] = None,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a structured security audit event."""
        payload = {
            "audit_event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_ip": client_ip,
            "device_id": device_id or "unspecified",
            "success": success,
            "details": details or {},
        }
        log_msg = f"[SECURITY AUDIT] {json.dumps(payload)}"
        if success:
            logger.info(log_msg)
        else:
            logger.warning(log_msg)


class ReplayProtection:
    """
    Cryptographic nonce and timestamp validator to defend against replay attacks.
    Enforces a strict ±60 second validity window and rejects reused nonces.
    """

    _seen_nonces: Dict[str, float] = {}  # nonce -> timestamp
    _MAX_AGE_SECONDS: float = 60.0
    _CLEANUP_INTERVAL: float = 300.0
    _last_cleanup: float = 0.0

    @classmethod
    def _cleanup_old_nonces(cls, now: float) -> None:
        """Prune nonces older than 2x the validity window."""
        if now - cls._last_cleanup < cls._CLEANUP_INTERVAL:
            return
        cls._last_cleanup = now
        cutoff = now - (cls._MAX_AGE_SECONDS * 2)
        cls._seen_nonces = {k: v for k, v in cls._seen_nonces.items() if v >= cutoff}

    @classmethod
    def validate_and_consume(cls, nonce: Optional[str], timestamp: Optional[float]) -> Tuple[bool, Optional[str]]:
        """
        Validate request freshness and consume nonce.
        Returns: (is_valid, error_reason)
        """
        if not nonce or timestamp is None:
            return False, "Missing cryptographic nonce or timestamp"

        now = time.time()
        cls._cleanup_old_nonces(now)

        # 1. Timestamp freshness check
        if abs(now - float(timestamp)) > cls._MAX_AGE_SECONDS:
            return False, f"Request timestamp expired (clock drift > {int(cls._MAX_AGE_SECONDS)}s)"

        # 2. Replay check
        if nonce in cls._seen_nonces:
            return False, "Replay attack detected: Nonce has already been consumed"

        # Record nonce
        cls._seen_nonces[nonce] = float(timestamp)
        return True, None

    @classmethod
    def reset(cls) -> None:
        """Reset replay cache (used in testing)."""
        cls._seen_nonces.clear()
        cls._last_cleanup = 0.0


class RateLimiter:
    """
    Sliding window rate limiter to defend authentication and pairing endpoints
    against automated brute-force attacks and denial-of-service attempts.
    """

    # key -> list of timestamps
    _records: Dict[str, List[float]] = defaultdict(list)
    _lockouts: Dict[str, float] = {}

    @classmethod
    def check_limit(
        cls,
        key: str,
        max_attempts: int = 5,
        window_seconds: float = 60.0,
        lockout_seconds: float = 300.0,
    ) -> Tuple[bool, Optional[float]]:
        """
        Check whether an action is allowed for the given key (e.g. IP or device_id).
        Returns: (is_allowed, remaining_lockout_seconds)
        """
        now = time.time()

        # Check if currently locked out
        if key in cls._lockouts:
            lockout_until = cls._lockouts[key]
            if now < lockout_until:
                return False, round(lockout_until - now, 1)
            else:
                del cls._lockouts[key]
                cls._records[key] = []

        # Filter timestamps outside window
        cutoff = now - window_seconds
        cls._records[key] = [t for t in cls._records[key] if t >= cutoff]

        if len(cls._records[key]) >= max_attempts:
            # Trigger lockout
            cls._lockouts[key] = now + lockout_seconds
            return False, round(lockout_seconds, 1)

        cls._records[key].append(now)
        return True, None

    @classmethod
    def reset_key(cls, key: str) -> None:
        """Reset failure counts for key upon successful authentication."""
        cls._records.pop(key, None)
        cls._lockouts.pop(key, None)

    @classmethod
    def reset_all(cls) -> None:
        """Reset all rate limiter state (used in testing)."""
        cls._records.clear()
        cls._lockouts.clear()
