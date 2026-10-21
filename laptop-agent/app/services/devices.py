import json
import logging
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.services.security import SecurityAuditLogger

logger = logging.getLogger("pocketdesk.devices")


class DeviceRegistry:
    """
    Manages persistent authorized device registration, cryptographic device secrets,
    and device-scoped session lifecycle for secure remote internet access.
    """

    _devices: Dict[str, dict] = {}  # device_id -> device_dict
    _storage_path: Optional[Path] = None
    _active_pairing_pin: str = ""
    _pairing_pin_expiry: float = 0.0
    _PIN_TTL_SECONDS: float = 300.0  # 5 minutes expiration

    @classmethod
    def initialize(cls, storage_dir: Optional[str] = None) -> None:
        """Initialize registry and load existing authorized devices from disk."""
        if storage_dir:
            dir_path = Path(storage_dir)
            dir_path.mkdir(parents=True, exist_ok=True)
            cls._storage_path = dir_path / "authorized_devices.json"
        else:
            cls._storage_path = None

        cls._load_from_disk()

    @classmethod
    def _load_from_disk(cls) -> None:
        """Load paired devices from secure JSON store."""
        if not cls._storage_path or not cls._storage_path.exists():
            return

        try:
            with open(cls._storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    cls._devices = data
                    logger.info("Loaded %d authorized device(s) from persistent storage.", len(cls._devices))
        except Exception as exc:
            logger.warning("Failed to load authorized devices from disk: %s", exc)

    @classmethod
    def _save_to_disk(cls) -> None:
        """Persist paired devices to disk."""
        if not cls._storage_path:
            return

        try:
            with open(cls._storage_path, "w", encoding="utf-8") as f:
                json.dump(cls._devices, f, indent=2)
        except Exception as exc:
            logger.warning("Failed to save authorized devices to disk: %s", exc)

    @classmethod
    def generate_pairing_pin(cls) -> str:
        """
        Generate an ephemeral cryptographically random 6-digit pairing PIN with a 5-minute expiry.
        Displayed strictly on the laptop terminal.
        """
        cls._active_pairing_pin = f"{secrets.randbelow(1000000):06d}"
        cls._pairing_pin_expiry = time.time() + cls._PIN_TTL_SECONDS

        logger.info("==============================================================")
        logger.info(" [SECURITY] PocketDesk Remote Internet Device Pairing PIN")
        logger.info(" Enter this 6-digit PIN on your phone to register your device:")
        logger.info(" >> %s <<", cls._active_pairing_pin)
        logger.info(" Code expires in 5 minutes (%s seconds).", int(cls._PIN_TTL_SECONDS))
        logger.info("==============================================================")
        return cls._active_pairing_pin

    @classmethod
    def get_active_pin(cls) -> str:
        """Get or generate active pairing PIN."""
        if not cls._active_pairing_pin or time.time() > cls._pairing_pin_expiry:
            return cls.generate_pairing_pin()
        return cls._active_pairing_pin

    @classmethod
    def register_device_with_pin(
        cls,
        device_id: str,
        device_name: str,
        pairing_pin: str,
        client_ip: str = "unknown",
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verify the 6-digit terminal PIN and register a new trusted client device.
        Returns: (success, device_secret, error_message)
        """
        now = time.time()

        # Check PIN expiration
        if not cls._active_pairing_pin or now > cls._pairing_pin_expiry:
            SecurityAuditLogger.log_event(
                "DEVICE_PAIR_FAILURE",
                client_ip=client_ip,
                device_id=device_id,
                success=False,
                details={"reason": "Pairing PIN expired"},
            )
            return False, None, "Pairing PIN has expired. Check laptop terminal for a new code."

        # Constant-time comparison
        clean_pin = pairing_pin.strip()
        if not secrets.compare_digest(clean_pin, cls._active_pairing_pin):
            SecurityAuditLogger.log_event(
                "DEVICE_PAIR_FAILURE",
                client_ip=client_ip,
                device_id=device_id,
                success=False,
                details={"reason": "Incorrect pairing PIN"},
            )
            return False, None, "Invalid pairing PIN."

        # Expire PIN after single successful use
        cls._active_pairing_pin = ""
        cls._pairing_pin_expiry = 0.0

        # Generate 256-bit cryptographically secure persistent device secret
        device_secret = secrets.token_hex(32)
        now_iso = datetime.now(timezone.utc).isoformat()

        cls._devices[device_id] = {
            "device_id": device_id,
            "device_name": device_name.strip()[:64] or "Remote Device",
            "device_secret": device_secret,
            "paired_at": now_iso,
            "last_seen": now_iso,
            "revoked": False,
            "role": "controller",
            "last_ip": client_ip,
        }
        cls._save_to_disk()

        SecurityAuditLogger.log_event(
            "DEVICE_PAIR_SUCCESS",
            client_ip=client_ip,
            device_id=device_id,
            success=True,
            details={"device_name": device_name},
        )

        return True, device_secret, None

    @classmethod
    def verify_device_credentials(cls, device_id: str, device_secret: str) -> bool:
        """Verify device credentials using constant-time string comparison."""
        device = cls._devices.get(device_id)
        if not device or device.get("revoked", False):
            return False

        stored_secret = device.get("device_secret", "")
        if secrets.compare_digest(device_secret, stored_secret):
            device["last_seen"] = datetime.now(timezone.utc).isoformat()
            cls._save_to_disk()
            return True

        return False

    @classmethod
    def is_device_authorized(cls, device_id: str) -> bool:
        """Check if device is registered and not revoked."""
        device = cls._devices.get(device_id)
        return bool(device and not device.get("revoked", False))

    @classmethod
    def get_device(cls, device_id: str) -> Optional[dict]:
        """Get device metadata omitting sensitive secret."""
        device = cls._devices.get(device_id)
        if not device:
            return None
        return {
            "device_id": device["device_id"],
            "device_name": device["device_name"],
            "paired_at": device["paired_at"],
            "last_seen": device["last_seen"],
            "revoked": device.get("revoked", False),
            "role": device.get("role", "controller"),
            "last_ip": device.get("last_ip", "unknown"),
        }

    @classmethod
    def list_authorized_devices(cls) -> List[dict]:
        """List all paired devices without leaking device secrets."""
        return [
            {
                "device_id": d["device_id"],
                "device_name": d["device_name"],
                "paired_at": d["paired_at"],
                "last_seen": d["last_seen"],
                "revoked": d.get("revoked", False),
                "role": d.get("role", "controller"),
                "last_ip": d.get("last_ip", "unknown"),
            }
            for d in cls._devices.values()
        ]

    @classmethod
    def revoke_device(cls, device_id: str, revoked_by: str = "laptop_user") -> bool:
        """Revoke device authorization immediately."""
        if device_id not in cls._devices:
            return False

        cls._devices[device_id]["revoked"] = True
        cls._save_to_disk()

        SecurityAuditLogger.log_event(
            "DEVICE_REVOKED",
            device_id=device_id,
            success=True,
            details={"revoked_by": revoked_by},
        )
        return True

    @classmethod
    def clear_all(cls) -> None:
        """Clear all registered devices (used in testing)."""
        cls._devices.clear()
        cls._active_pairing_pin = ""
        cls._pairing_pin_expiry = 0.0
        if cls._storage_path and cls._storage_path.exists():
            try:
                cls._storage_path.unlink()
            except Exception:
                pass
