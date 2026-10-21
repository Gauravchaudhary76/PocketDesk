import base64
import hashlib
import hmac
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("pocketdesk.turn")


class TurnService:
    """
    Generates dynamic, time-limited TURN relay credentials conforming to RFC 5766
    for Coturn or commercial WebRTC relay services without hardcoding static credentials.
    """

    @classmethod
    def get_turn_secret(cls) -> Optional[str]:
        """Retrieve TURN secret from environment (never hardcoded)."""
        return os.getenv("POCKETDESK_TURN_SECRET")

    @classmethod
    def get_turn_urls(cls) -> List[str]:
        """Retrieve configured TURN server URLs."""
        raw = os.getenv("POCKETDESK_TURN_URL", "")
        if not raw:
            return []
        return [url.strip() for url in raw.split(",") if url.strip()]

    @classmethod
    def get_stun_urls(cls) -> List[str]:
        """Retrieve STUN server URLs for candidate gathering."""
        raw = os.getenv("POCKETDESK_STUN_URL", "stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302")
        return [url.strip() for url in raw.split(",") if url.strip()]

    @classmethod
    def generate_ephemeral_credentials(
        cls, device_id: str, ttl_seconds: int = 3600
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate time-limited username and HMAC-SHA1 credential for authenticated TURN relay.
        Formula:
          username = timestamp_expiry : device_id
          credential = base64(hmac_sha1(turn_secret, username))
        """
        secret = cls.get_turn_secret()
        if not secret:
            return None, None

        expiry = int(time.time() + ttl_seconds)
        username = f"{expiry}:{device_id}"
        mac = hmac.new(secret.encode("utf-8"), username.encode("utf-8"), hashlib.sha1)
        credential = base64.b64encode(mac.digest()).decode("utf-8")
        return username, credential

    @classmethod
    def build_ice_server_config(cls, device_id: str = "pocketdesk-client") -> Dict[str, Any]:
        """
        Build complete ICE server configuration containing STUN discovery
        and optional authenticated TURN relay credentials.
        """
        ice_servers: List[Dict[str, Any]] = []

        # 1. STUN Servers (always included for NAT type discovery)
        stun_urls = cls.get_stun_urls()
        if stun_urls:
            ice_servers.append({"urls": stun_urls})

        # 2. Authenticated TURN Relay (if configured)
        turn_urls = cls.get_turn_urls()
        turn_secret = cls.get_turn_secret()

        if turn_urls and turn_secret:
            username, credential = cls.generate_ephemeral_credentials(device_id)
            if username and credential:
                ice_servers.append(
                    {
                        "urls": turn_urls,
                        "username": username,
                        "credential": credential,
                    }
                )

        return {
            "ice_servers": ice_servers,
            "turn_configured": bool(turn_urls and turn_secret),
            "nat_traversal_mode": "turn_relay_available" if (turn_urls and turn_secret) else "stun_direct_only",
            "documentation": (
                "When direct P2P fails due to Symmetric NAT or CGNAT, an authenticated "
                "TURN relay is required. See docs/deployment_guide.md for Coturn setup."
            ),
        }
