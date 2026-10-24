"""
Windows Desktop & Window Station Management for PocketDesk.
Ensures screen capture, input dispatching, and application spawning
always operate on the interactive Windows desktop ('WinSta0\\Default').
"""
import ctypes
from ctypes import wintypes
import logging
import os
import subprocess
import sys
from typing import Optional, Tuple
from PIL import Image, ImageGrab
import mss

logger = logging.getLogger("pocketdesk.win32_desktop")

# Access rights
WINSTA_ALL = 0x037F
DESKTOP_ALL = 0x01FF


def attach_to_default_desktop() -> bool:
    """
    Ensure the current thread is attached to the active interactive
    desktop ('WinSta0\\Default'). This is essential when the agent runs
    as a background service or within an isolated process station.
    """
    if sys.platform != "win32":
        return True

    try:
        user32 = ctypes.windll.user32
        hwinsta = user32.OpenWindowStationW("WinSta0", False, WINSTA_ALL)
        if hwinsta:
            user32.SetProcessWindowStation(hwinsta)

        hdesk = user32.OpenDesktopW("Default", 0, False, DESKTOP_ALL)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            return True
    except Exception as exc:
        logger.debug("attach_to_default_desktop notice: %s", exc)

    return False


def get_desktop_startupinfo() -> Optional[subprocess.STARTUPINFO]:
    """
    Generate STARTUPINFO pointing directly to the interactive desktop.
    """
    if sys.platform != "win32":
        return None

    attach_to_default_desktop()
    si = subprocess.STARTUPINFO()
    si.lpDesktop = r"WinSta0\Default"
    return si


def capture_desktop_frame() -> Image.Image:
    """
    Reliably capture the interactive primary display screen.
    Attempts high-performance mss capture first; falls back to PIL ImageGrab if necessary.
    """
    attach_to_default_desktop()

    try:
        with mss.MSS() as sct:
            monitors = sct.monitors
            primary = monitors[1] if len(monitors) > 1 else monitors[0]
            raw = sct.grab(primary)
            return Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
    except Exception as mss_err:
        logger.debug("mss grab failed (%s); trying PIL.ImageGrab fallback...", mss_err)

    try:
        return ImageGrab.grab()
    except Exception as grab_err:
        logger.error("Screen capture failed on all mechanisms: %s", grab_err)
        raise
