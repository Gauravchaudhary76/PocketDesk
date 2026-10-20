import logging
import platform
from datetime import datetime, timezone
from typing import Optional

import psutil

from app.models.system import (
    BatteryInfo,
    CPUInfo,
    MemoryInfo,
    OSInfo,
    SystemInfoResponse,
)

logger = logging.getLogger("pocketdesk.system_info")


class SystemInfoService:
    """Service responsible for querying Windows host telemetry via psutil and platform."""

    @staticmethod
    def get_os_info() -> OSInfo:
        """Inspect and return host operating system metadata."""
        try:
            return OSInfo(
                system=platform.system() or "Windows",
                release=platform.release() or "11",
                version=platform.version() or "",
                architecture=platform.machine() or "x86_64",
                hostname=platform.node() or "localhost",
            )
        except Exception as exc:
            logger.error("Failed to query OS information: %s", exc)
            return OSInfo(
                system="Windows",
                release="Unknown",
                version="Unknown",
                architecture="Unknown",
                hostname="localhost",
            )

    @staticmethod
    def get_cpu_info() -> CPUInfo:
        """Inspect and return CPU specifications and utilization."""
        try:
            model = platform.processor() or None
            cores_physical = psutil.cpu_count(logical=False)
            cores_logical = psutil.cpu_count(logical=True) or 1
            usage_percent = float(psutil.cpu_percent(interval=None))
            
            freq_mhz: Optional[float] = None
            try:
                freq = psutil.cpu_freq()
                if freq and freq.current:
                    freq_mhz = round(float(freq.current), 2)
            except Exception as freq_err:
                logger.debug("CPU frequency unavailable: %s", freq_err)

            return CPUInfo(
                model=model,
                cores_physical=cores_physical,
                cores_logical=cores_logical,
                usage_percent=usage_percent,
                frequency_mhz=freq_mhz,
            )
        except Exception as exc:
            logger.error("Failed to query CPU telemetry: %s", exc)
            return CPUInfo(
                model=None,
                cores_physical=None,
                cores_logical=1,
                usage_percent=0.0,
                frequency_mhz=None,
            )

    @staticmethod
    def get_memory_info() -> MemoryInfo:
        """Inspect and return virtual memory (RAM) allocation and usage."""
        try:
            vm = psutil.virtual_memory()
            return MemoryInfo(
                total_bytes=int(vm.total),
                available_bytes=int(vm.available),
                used_bytes=int(vm.used),
                usage_percent=float(vm.percent),
            )
        except Exception as exc:
            logger.error("Failed to query Memory telemetry: %s", exc)
            return MemoryInfo(
                total_bytes=0,
                available_bytes=0,
                used_bytes=0,
                usage_percent=0.0,
            )

    @staticmethod
    def get_battery_info() -> Optional[BatteryInfo]:
        """Inspect and return battery telemetry if present."""
        try:
            battery = psutil.sensors_battery()
            if battery is None:
                # No battery present (e.g. Desktop PC or VM)
                return BatteryInfo(
                    present=False,
                    percent=None,
                    is_charging=None,
                    power_plugged=None,
                    seconds_left=None,
                )

            # Determine charging state
            power_plugged = battery.power_plugged
            is_charging = bool(power_plugged and battery.percent < 100)
            
            # seconds_left is -1 or -2 if infinite / calculating
            secs_left: Optional[int] = None
            if battery.secsleft is not None and battery.secsleft >= 0:
                secs_left = int(battery.secsleft)

            return BatteryInfo(
                present=True,
                percent=round(float(battery.percent), 1),
                is_charging=is_charging,
                power_plugged=power_plugged,
                seconds_left=secs_left,
            )
        except Exception as exc:
            logger.debug("Battery telemetry query failed or unavailable: %s", exc)
            return BatteryInfo(
                present=False,
                percent=None,
                is_charging=None,
                power_plugged=None,
                seconds_left=None,
            )

    @classmethod
    def get_system_info(cls) -> SystemInfoResponse:
        """Collect and assemble comprehensive system telemetry."""
        return SystemInfoResponse(
            os=cls.get_os_info(),
            cpu=cls.get_cpu_info(),
            memory=cls.get_memory_info(),
            battery=cls.get_battery_info(),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
