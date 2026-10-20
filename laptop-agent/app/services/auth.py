import logging
import secrets
import time
from typing import Dict, Optional, Tuple

logger = logging.getLogger("pocketdesk.auth")


class AuthService:
    """Manages pairing codes, session tokens, and local authentication."""

    # Active 6-digit pairing code shown on laptop terminal
    _active_code: str = ""
    _code_created_at: float = 0.0

    # Active sessions: token -> metadata
    _sessions: Dict[str, dict] = {}

    # Brute-force protection
    _failed_attempts: int = 0
    _lockout_until: float = 0.0
    _MAX_FAILED_ATTEMPTS: int = 5
    _LOCKOUT_SECONDS: int = 30
    _SESSION_TTL_SECONDS: int = 4 * 3600  # 4 hours

    @classmethod
    def initialize_pairing_code(cls) -> str:
        """Generate and log a new random 6-digit pairing code on laptop terminal."""
        # Use secrets for cryptographically secure random generation
        cls._active_code = f"{secrets.randbelow(1000000):06d}"
        cls._code_created_at = time.time()
        cls._failed_attempts = 0
        cls._lockout_until = 0.0

        logger.info("==================================================")
        logger.info(" [SECURITY] PocketDesk Local Network Pairing Code")
        logger.info(" Enter this 6-digit code on your phone: %s", cls._active_code)
        logger.info(" Code is valid for the lifetime of this agent process.")
        logger.info("==================================================")
        return cls._active_code

    @classmethod
    def get_active_code(cls) -> str:
        """Get the current pairing code, generating one if not yet created."""
        if not cls._active_code:
            return cls.initialize_pairing_code()
        return cls._active_code

    @classmethod
    def verify_and_create_session(
        cls, submitted_code: str, client_name: str = "PocketDesk Mobile"
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verify submitted pairing code.
        Returns: (success, session_token_or_none, error_message_or_none)
        """
        now = time.time()

        # Check lockout
        if now < cls._lockout_until:
            wait_seconds = int(cls._lockout_until - now)
            logger.warning(
                "Pairing attempt rejected: locked out due to excessive failed attempts (%ss remaining)",
                wait_seconds,
            )
            return (
                False,
                None,
                f"Locked out due to too many failed attempts. Try again in {wait_seconds} seconds.",
            )

        # Constant-time comparison to prevent timing attacks
        clean_code = submitted_code.strip()
        if secrets.compare_digest(clean_code, cls.get_active_code()):
            # Reset failed attempts
            cls._failed_attempts = 0

            # Issue 256-bit cryptographically secure session token
            session_token = secrets.token_hex(32)
            cls._sessions[session_token] = {
                "created_at": now,
                "expires_at": now + cls._SESSION_TTL_SECONDS,
                "client_name": client_name,
            }

            logger.info(
                "Pairing SUCCESSFUL for client '%s'. Session token issued (TTL: %sh).",
                client_name,
                cls._SESSION_TTL_SECONDS // 3600,
            )
            return True, session_token, None
        else:
            cls._failed_attempts += 1
            logger.warning(
                "Pairing FAILED: invalid code submitted (%s/%s attempts)",
                cls._failed_attempts,
                cls._MAX_FAILED_ATTEMPTS,
            )

            if cls._failed_attempts >= cls._MAX_FAILED_ATTEMPTS:
                cls._lockout_until = now + cls._LOCKOUT_SECONDS
                logger.error(
                    "Pairing lockout triggered for %s seconds due to multiple incorrect attempts.",
                    cls._LOCKOUT_SECONDS,
                )
                return (
                    False,
                    None,
                    f"Too many failed attempts. Locked out for {cls._LOCKOUT_SECONDS} seconds.",
                )

            return False, None, "Invalid pairing code. Please check the code shown in the laptop terminal."

    @classmethod
    def validate_session(cls, token: Optional[str]) -> bool:
        """Validate if provided session token exists and has not expired."""
        if not token:
            return False

        session = cls._sessions.get(token)
        if not session:
            return False

        if time.time() > session["expires_at"]:
            logger.info("Session token expired for client '%s'", session.get("client_name"))
            cls._sessions.pop(token, None)
            return False

        return True

    @classmethod
    def get_session_info(cls, token: Optional[str]) -> Optional[dict]:
        """Return session metadata if token is valid."""
        if not cls.validate_session(token):
            return None
        return cls._sessions.get(token)

    @classmethod
    def revoke_session(cls, token: Optional[str]) -> bool:
        """Revoke a session upon client disconnect."""
        if token and token in cls._sessions:
            session = cls._sessions.pop(token)
            logger.info("Session revoked for client '%s'", session.get("client_name"))
            return True
        return False

    @classmethod
    def clear_all_sessions(cls) -> None:
        """Reset sessions (e.g. for testing)."""
        cls._sessions.clear()
        cls._failed_attempts = 0
        cls._lockout_until = 0.0
