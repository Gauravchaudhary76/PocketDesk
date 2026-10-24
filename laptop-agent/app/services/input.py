import asyncio
import ctypes
from ctypes import wintypes
import logging
import sys
import time
from typing import Dict, List, Optional, Set, Tuple

from app.services.win32_desktop import attach_to_default_desktop

logger = logging.getLogger("pocketdesk.input")

# Win32 Constants
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
INPUT_HARDWARE = 2

KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_SCANCODE = 0x0008

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000

# Virtual Keycode Mapping
VK_MAP: Dict[str, int] = {
    "enter": 0x0D,
    "return": 0x0D,
    "backspace": 0x08,
    "tab": 0x09,
    "escape": 0x1B,
    "esc": 0x1B,
    "space": 0x20,
    "left": 0x25,
    "up": 0x26,
    "right": 0x27,
    "down": 0x28,
    "delete": 0x2E,
    "del": 0x2E,
    "home": 0x24,
    "end": 0x23,
    "pageup": 0x21,
    "pagedown": 0x22,
    "insert": 0x2D,
    "control": 0x11,
    "ctrl": 0x11,
    "shift": 0x10,
    "alt": 0x12,
    "menu": 0x12,
    "win": 0x5B,
    "meta": 0x5B,
    "capslock": 0x14,
    "numlock": 0x90,
    "scrolllock": 0x91,
    "printscreen": 0x2C,
    "pause": 0x13,
}
for _i in range(1, 13):
    VK_MAP[f"f{_i}"] = 0x6F + _i

# Win32 Ctypes Structures (64-bit compatible)
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_ulonglong),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_ulonglong),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]


class INPUT_UNION(ctypes.Union):
    _fields_ = [
        ("mi", MOUSEINPUT),
        ("ki", KEYBDINPUT),
        ("hi", HARDWAREINPUT),
    ]


class INPUT(ctypes.Structure):
    _fields_ = [
        ("type", wintypes.DWORD),
        ("union", INPUT_UNION),
    ]


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class InputService:
    """
    Manages synthetic mouse and keyboard event dispatch on Windows 10/11.
    Maintains security invariants, tracks held keys/buttons for cleanup,
    and converts normalized coordinates into primary display coordinates.
    """

    _is_enabled: bool = False
    _authorized_client: Optional[str] = None
    _held_keys: Set[int] = set()
    _held_buttons: Set[str] = set()
    _mock_mode: bool = False  # Enabled in tests to avoid moving developer's cursor

    # Rate limiting: max events per sliding window
    _last_event_timestamps: List[float] = []
    _MAX_EVENTS_PER_SECOND: int = 150

    @classmethod
    def set_mock_mode(cls, enabled: bool) -> None:
        """Enable or disable mock mode (used for automated tests)."""
        cls._mock_mode = enabled

    @classmethod
    def is_enabled(cls) -> bool:
        """Check if remote input has been explicitly authorized."""
        return cls._is_enabled

    @classmethod
    def enable_input(cls, client_name: str = "PocketDesk Web Client") -> None:
        """Explicitly enable remote input for an authenticated session."""
        cls._is_enabled = True
        cls._authorized_client = client_name
        logger.info("==============================================================")
        logger.info(" [INPUT CONTROL ENABLED] Client '%s' authorized for mouse/keyboard!", client_name)
        logger.info(" Emergency Stop: POST http://127.0.0.1:8000/api/input/control")
        logger.info("==============================================================")

    @classmethod
    def disable_input(cls) -> None:
        """Disable remote input and immediately release all held keys and mouse buttons."""
        cls.emergency_cleanup()
        cls._is_enabled = False
        cls._authorized_client = None
        logger.info("==============================================================")
        logger.info(" [INPUT CONTROL DISABLED] Remote mouse & keyboard control stopped.")
        logger.info("==============================================================")

    @classmethod
    def _ensure_desktop(cls) -> None:
        """Ensure thread is attached to the interactive WinSta0\\Default desktop."""
        if not cls._mock_mode and sys.platform == "win32":
            attach_to_default_desktop()

    @classmethod
    def emergency_cleanup(cls) -> None:
        """Safely release any stuck keys or held mouse buttons."""
        cls._ensure_desktop()
        if cls._mock_mode or sys.platform != "win32":
            cls._held_keys.clear()
            cls._held_buttons.clear()
            return

        user32 = ctypes.windll.user32

        # Release held mouse buttons
        for btn in list(cls._held_buttons):
            if btn == "left":
                user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            elif btn == "right":
                user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            elif btn == "middle":
                user32.mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
        cls._held_buttons.clear()

        # Release held virtual keys
        for vk in list(cls._held_keys):
            cls._send_vk(vk, action="up")
        cls._held_keys.clear()

    @classmethod
    def get_screen_dimensions(cls) -> Tuple[int, int]:
        """Return width and height of the primary display."""
        cls._ensure_desktop()
        if cls._mock_mode or sys.platform != "win32":
            return (1920, 1080)
        user32 = ctypes.windll.user32
        w = user32.GetSystemMetrics(0)
        h = user32.GetSystemMetrics(1)
        return (max(w, 800), max(h, 600))

    @classmethod
    def map_normalized_to_screen(cls, norm_x: float, norm_y: float) -> Tuple[int, int]:
        """
        Map resolution-independent normalized coordinates [0.0, 1.0]
        to pixel coordinates on the active primary display.
        """
        w, h = cls.get_screen_dimensions()
        clamped_x = max(0.0, min(norm_x, 1.0))
        clamped_y = max(0.0, min(norm_y, 1.0))
        target_x = int(round(clamped_x * (w - 1)))
        target_y = int(round(clamped_y * (h - 1)))
        return (max(0, min(target_x, w - 1)), max(0, min(target_y, h - 1)))

    @classmethod
    def _check_rate_limit(cls) -> bool:
        """Drop excessive input bursts to prevent denial of service."""
        now = time.time()
        cls._last_event_timestamps = [t for t in cls._last_event_timestamps if now - t < 1.0]
        if len(cls._last_event_timestamps) >= cls._MAX_EVENTS_PER_SECOND:
            logger.warning("Input rate limit reached (%s events/sec). Dropping event.", cls._MAX_EVENTS_PER_SECOND)
            return False
        cls._last_event_timestamps.append(now)
        return True

    @classmethod
    def move_mouse_absolute(cls, norm_x: float, norm_y: float) -> Tuple[int, int]:
        """Move Windows mouse cursor to normalized (x, y) coordinates."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return cls.get_cursor_position()

        cls._ensure_desktop()
        target_x, target_y = cls.map_normalized_to_screen(norm_x, norm_y)

        if not cls._mock_mode and sys.platform == "win32":
            ctypes.windll.user32.SetCursorPos(target_x, target_y)

        return (target_x, target_y)

    @classmethod
    def move_mouse_relative(cls, dx: float, dy: float) -> Tuple[int, int]:
        """Move Windows mouse cursor relative to current position (touchpad delta)."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return cls.get_cursor_position()

        cls._ensure_desktop()
        curr_x, curr_y = cls.get_cursor_position()
        w, h = cls.get_screen_dimensions()

        target_x = max(0, min(int(round(curr_x + dx)), w - 1))
        target_y = max(0, min(int(round(curr_y + dy)), h - 1))

        if not cls._mock_mode and sys.platform == "win32":
            ctypes.windll.user32.SetCursorPos(target_x, target_y)

        return (target_x, target_y)

    @classmethod
    def get_cursor_position(cls) -> Tuple[int, int]:
        """Get current cursor position."""
        cls._ensure_desktop()
        if cls._mock_mode or sys.platform != "win32":
            return (960, 540)
        pt = POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
        return (pt.x, pt.y)

    @classmethod
    def click_mouse(
        cls,
        button: str = "left",
        action: str = "click",
        norm_x: Optional[float] = None,
        norm_y: Optional[float] = None,
    ) -> None:
        """Dispatch mouse button events (click, double_click, down, up)."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return

        cls._ensure_desktop()

        if norm_x is not None and norm_y is not None:
            cls.move_mouse_absolute(norm_x, norm_y)

        if cls._mock_mode or sys.platform != "win32":
            if action in ("down", "click", "double_click"):
                cls._held_buttons.add(button)
            if action in ("up", "click", "double_click"):
                cls._held_buttons.discard(button)
            return

        user32 = ctypes.windll.user32

        if button == "left":
            down_flag, up_flag = MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP
        elif button == "right":
            down_flag, up_flag = MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP
        elif button == "middle":
            down_flag, up_flag = MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP
        else:
            return

        if action == "down":
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            cls._held_buttons.add(button)
        elif action == "up":
            user32.mouse_event(up_flag, 0, 0, 0, 0)
            cls._held_buttons.discard(button)
        elif action == "click":
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            user32.mouse_event(up_flag, 0, 0, 0, 0)
            cls._held_buttons.discard(button)
        elif action == "double_click":
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            user32.mouse_event(up_flag, 0, 0, 0, 0)
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            user32.mouse_event(up_flag, 0, 0, 0, 0)
            cls._held_buttons.discard(button)

    @classmethod
    def scroll_mouse(cls, delta_y: int) -> None:
        """Scroll vertical mouse wheel."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return

        cls._ensure_desktop()
        if not cls._mock_mode and sys.platform == "win32":
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta_y, 0)

    @classmethod
    def _send_vk(cls, vk_code: int, action: str = "press") -> None:
        """Send virtual key down/up event via SendInput."""
        cls._ensure_desktop()
        if cls._mock_mode or sys.platform != "win32":
            if action in ("down", "press"):
                cls._held_keys.add(vk_code)
            if action in ("up", "press"):
                cls._held_keys.discard(vk_code)
            return

        user32 = ctypes.windll.user32

        if action == "down":
            inp = INPUT(type=INPUT_KEYBOARD)
            inp.union.ki = KEYBDINPUT(wVk=vk_code, wScan=0, dwFlags=0, time=0, dwExtraInfo=0)
            user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
            cls._held_keys.add(vk_code)

        elif action == "up":
            inp = INPUT(type=INPUT_KEYBOARD)
            inp.union.ki = KEYBDINPUT(wVk=vk_code, wScan=0, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
            user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
            cls._held_keys.discard(vk_code)

        elif action == "press":
            inp_down = INPUT(type=INPUT_KEYBOARD)
            inp_down.union.ki = KEYBDINPUT(wVk=vk_code, wScan=0, dwFlags=0, time=0, dwExtraInfo=0)

            inp_up = INPUT(type=INPUT_KEYBOARD)
            inp_up.union.ki = KEYBDINPUT(wVk=vk_code, wScan=0, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)

            inputs = (INPUT * 2)(inp_down, inp_up)
            user32.SendInput(2, inputs, ctypes.sizeof(INPUT))
            cls._held_keys.discard(vk_code)

    @classmethod
    def send_key(cls, key_name: str, action: str = "press") -> None:
        """Process special key press or down/up event."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return

        clean = key_name.strip().lower()
        if clean in VK_MAP:
            cls._send_vk(VK_MAP[clean], action=action)
        elif len(clean) == 1:
            cls.type_text(clean)
        else:
            logger.warning("Unrecognized key name: %s", key_name)

    @classmethod
    def type_text(cls, text: str) -> None:
        """Type Unicode string using SendInput with KEYEVENTF_UNICODE."""
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")
        if not cls._check_rate_limit():
            return

        cls._ensure_desktop()
        if cls._mock_mode or sys.platform != "win32":
            return

        user32 = ctypes.windll.user32
        inputs = []

        for ch in text:
            code = ord(ch)
            # Key down
            inp_down = INPUT(type=INPUT_KEYBOARD)
            inp_down.union.ki = KEYBDINPUT(
                wVk=0, wScan=code, dwFlags=KEYEVENTF_UNICODE, time=0, dwExtraInfo=0
            )
            # Key up
            inp_up = INPUT(type=INPUT_KEYBOARD)
            inp_up.union.ki = KEYBDINPUT(
                wVk=0, wScan=code, dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time=0, dwExtraInfo=0
            )
            inputs.extend([inp_down, inp_up])

        if inputs:
            array_type = INPUT * len(inputs)
            c_inputs = array_type(*inputs)
            user32.SendInput(len(inputs), c_inputs, ctypes.sizeof(INPUT))

    @classmethod
    def execute_shortcut(cls, keys: List[str]) -> None:
        """
        Execute key combination (e.g. ['ctrl', 'c']) safely,
        guaranteeing all modifier keys are released even if an error occurs.
        """
        if not cls._is_enabled:
            raise PermissionError("Remote input is disabled.")

        vk_codes: List[int] = []
        for k in keys:
            clean = k.strip().lower()
            if clean in VK_MAP:
                vk_codes.append(VK_MAP[clean])
            elif len(clean) == 1:
                # Alphanumeric virtual keycode is ASCII uppercase
                vk_codes.append(ord(clean.upper()))

        if not vk_codes:
            return

        try:
            # Press down in order
            for vk in vk_codes:
                cls._send_vk(vk, action="down")
        finally:
            # Release in reverse order to ensure clean key states
            for vk in reversed(vk_codes):
                cls._send_vk(vk, action="up")

    @classmethod
    def get_status(cls) -> dict:
        """Return input manager status."""
        w, h = cls.get_screen_dimensions()
        return {
            "enabled": cls._is_enabled,
            "authorized_client": cls._authorized_client if cls._is_enabled else None,
            "held_keys_count": len(cls._held_keys),
            "held_buttons_count": len(cls._held_buttons),
            "screen_width": w,
            "screen_height": h,
        }
