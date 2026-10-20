import os
import logging

logger = logging.getLogger("pocketdesk.config")

class Settings:
    """Application configuration for PocketDesk Laptop Agent."""
    
    APP_NAME: str = "PocketDesk Laptop Agent"
    APP_VERSION: str = "0.2.0"
    STAGE: int = 2
    
    # Binding Configuration (Default to 127.0.0.1 - Localhost only!)
    # Requirement 3: Never expose the agent to the LAN or internet by default.
    HOST: str = os.getenv("POCKETDESK_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("POCKETDESK_PORT", "8000"))
    RELOAD: bool = os.getenv("POCKETDESK_RELOAD", "false").lower() in ("true", "1", "yes")
    
    # Logging
    LOG_LEVEL: str = os.getenv("POCKETDESK_LOG_LEVEL", "INFO").upper()

    @classmethod
    def validate_security(cls) -> None:
        """Validate binding address to warn if not bound to loopback."""
        loopback_hosts = {"127.0.0.1", "localhost", "::1"}
        if cls.HOST not in loopback_hosts:
            logger.warning(
                "SECURITY WARNING: PocketDesk agent is configured to bind to '%s' instead of 127.0.0.1! "
                "In Stage 2, the agent lacks remote encryption/token security and should only run on localhost.",
                cls.HOST
            )

settings = Settings()
