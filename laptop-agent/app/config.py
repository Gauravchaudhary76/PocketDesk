import os
import socket
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger("pocketdesk.config")


class Settings:
    """Application configuration for PocketDesk Laptop Agent."""

    APP_NAME: str = "PocketDesk Laptop Agent"
    APP_VERSION: str = "0.8.0"
    STAGE: int = 8

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

    # Stage 7: File Management Configuration
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("POCKETDESK_MAX_UPLOAD_SIZE_BYTES", str(50 * 1024 * 1024)))  # 50 MB
    ENABLE_FOLDER_CREATION: bool = os.getenv("POCKETDESK_ENABLE_MKDIR", "true").lower() in ("true", "1", "yes")

    # Patterns, filenames, and extensions that are never exposed or downloadable
    SENSITIVE_PATTERNS: List[str] = [
        ".ssh",
        ".gnupg",
        ".aws",
        ".azure",
        ".gcloud",
        ".kube",
        ".docker",
        ".env",
        "appdata",
        "local settings",
        "cookies",
        "ntuser.dat",
        "desktop.ini",
        "thumbs.db",
        "id_rsa",
        "id_ed25519",
        "id_ecdsa",
        "id_dsa",
        "known_hosts",
        "authorized_keys",
    ]

    # Sensitive file extensions that cannot be downloaded or uploaded
    SENSITIVE_EXTENSIONS: List[str] = [
        ".key",
        ".pem",
        ".pfx",
        ".p12",
        ".kdbx",
        ".vault",
        ".credentials",
        ".exe",
        ".bat",
        ".cmd",
        ".vbs",
        ".ps1",
        ".msi",
        ".reg",
    ]

    @classmethod
    def get_approved_roots(cls) -> Dict[str, Dict[str, str]]:
        """
        Return the dictionary of explicitly approved filesystem roots.
        Only directories within these canonical roots can ever be listed, read, or modified.
        """
        home = Path.home()
        custom_roots_env = os.getenv("POCKETDESK_ALLOWED_ROOTS")

        roots: Dict[str, Dict[str, str]] = {}

        if custom_roots_env:
            # Custom root format: id:name:path,id:name:path
            for entry in custom_roots_env.split(","):
                parts = entry.strip().split(":")
                if len(parts) >= 3:
                    root_id, root_name, root_path = parts[0], parts[1], ":".join(parts[2:])
                    resolved = Path(root_path).resolve()
                    if resolved.exists() and resolved.is_dir():
                        roots[root_id] = {
                            "name": root_name,
                            "path": str(resolved),
                            "display": str(resolved),
                        }
        else:
            # Standard safe Windows user directories
            candidates = [
                ("downloads", "Downloads", home / "Downloads"),
                ("documents", "Documents", home / "Documents"),
                ("desktop", "Desktop", home / "Desktop"),
                ("pictures", "Pictures", home / "Pictures"),
            ]
            for root_id, root_name, root_path in candidates:
                try:
                    resolved = root_path.resolve()
                    if resolved.exists() and resolved.is_dir():
                        roots[root_id] = {
                            "name": root_name,
                            "path": str(resolved),
                            "display": f"~/{root_name}",
                        }
                except Exception:
                    pass

        # If none of the standard home subfolders exist (e.g. in some CI / virtualenv test environments),
        # create a sandbox folder under user's home or storage
        if not roots:
            sandbox = Path("storage/sandbox").resolve()
            sandbox.mkdir(parents=True, exist_ok=True)
            roots["sandbox"] = {
                "name": "Sandbox Files",
                "path": str(sandbox),
                "display": "Sandbox",
            }

        return roots

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
