import os
import socket
import logging
from typing import List

logger = logging.getLogger("pocketdesk.config")


class Settings:
    """Application configuration for PocketDesk Laptop Agent."""

    APP_NAME: str = "PocketDesk Laptop Agent"
    APP_VERSION: str = "0.6.0"
    STAGE: int = 6

    # Storage Directory for Persistent Authorized Devices
    STORAGE_DIR: str = os.getenv("POCKETDESK_STORAGE_DIR", "storage")

    # Session Lifetime
    SESSION_TTL_SECONDS: int = int(os.getenv("POCKETDESK_SESSION_TTL_SECONDS", "3600"))

    # WebRTC NAT Traversal & Relay Configuration (NEVER hardcoded in source)
    TURN_URL: str = os.getenv("POCKETDESK_TURN_URL", "")
    TURN_SECRET: str = os.getenv("POCKETDESK_TURN_SECRET", "")
    STUN_URL: str = os.getenv("POCKETDESK_STUN_URL", "stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302")

    # Binding Configuration (Default: 127.0.0.1; use 0.0.0.0 or --lan for Wi-Fi access)
    HOST: str = os.getenv("POCKETDESK_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("POCKETDESK_PORT", "8000"))
    RELOAD: bool = os.getenv("POCKETDESK_RELOAD", "false").lower() in ("true", "1", "yes")

    # Logging
    LOG_LEVEL: str = os.getenv("POCKETDESK_LOG_LEVEL", "INFO").upper()

    @classmethod
    def get_local_lan_ips(cls) -> List[str]:
        """Detect local IPv4 addresses assigned to this Windows machine."""
        ips = []
        try:
            hostname = socket.gethostname()
            for ip in socket.gethostbyname_ex(hostname)[2]:
                if not ip.startswith("127.") and not ip.startswith("169.254."):
                    ips.append(ip)
        except Exception as exc:
            logger.debug("Failed to enumerate network interfaces: %s", exc)
        return ips

    @classmethod
    def validate_security(cls) -> None:
        """Validate binding address and report network endpoints."""
        if cls.HOST == "0.0.0.0":
            lan_ips = cls.get_local_lan_ips()
            logger.info("Agent listening on all network interfaces (0.0.0.0:%s).", cls.PORT)
            if lan_ips:
                logger.info("Local Wi-Fi / LAN IP addresses detected:")
                for ip in lan_ips:
                    logger.info("  -> http://%s:%s", ip, cls.PORT)
            else:
                logger.info("  (Could not detect primary LAN IP; check 'ipconfig' in PowerShell)")
            logger.info("Notice: Local prototype operates over HTTP. Keep on a trusted private Wi-Fi network.")
        elif cls.HOST in ("127.0.0.1", "localhost", "::1"):
            logger.info("Agent bound strictly to loopback (http://127.0.0.1:%s).", cls.PORT)
            logger.info("To allow phone connections over your Wi-Fi network, start with: python run.py --lan")
        else:
            logger.info("Agent bound to custom interface: http://%s:%s", cls.HOST, cls.PORT)


settings = Settings()
