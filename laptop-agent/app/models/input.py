import time
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_KEYS = {
    "enter", "return", "backspace", "tab", "escape", "esc", "space",
    "up", "down", "left", "right", "delete", "del", "home", "end",
    "pageup", "pagedown", "insert", "control", "ctrl", "shift",
    "alt", "menu", "win", "meta", "capslock", "numlock", "scrolllock",
    "printscreen", "pause",
    "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
}


class ScreenInfoResponse(BaseModel):
    """Host display dimensions and active input status."""
    width: int
    height: int
    aspect_ratio: float
    input_enabled: bool


class InputControlRequest(BaseModel):
    """Enable, disable, or emergency stop remote input."""
    action: Literal["enable", "disable", "emergency_stop", "status"]


class InputStatusResponse(BaseModel):
    """Current remote input permission status."""
    enabled: bool
    authorized_client: Optional[str] = None
    held_keys_count: int = 0
    held_buttons_count: int = 0
    screen_width: int
    screen_height: int


class MouseMoveRequest(BaseModel):
    """Absolute normalized mouse move within [0.0, 1.0]."""
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized X coordinate (0.0=left, 1.0=right)")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized Y coordinate (0.0=top, 1.0=bottom)")
    timestamp: Optional[float] = Field(default_factory=time.time)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (time.time() - v > 3.0):
            # Ignore/stale timestamp warning handled in service
            pass
        return v


class MouseRelativeMoveRequest(BaseModel):
    """Relative mouse movement (touchpad delta)."""
    dx: float = Field(..., ge=-2000.0, le=2000.0, description="Delta X in pixels")
    dy: float = Field(..., ge=-2000.0, le=2000.0, description="Delta Y in pixels")
    timestamp: Optional[float] = Field(default_factory=time.time)


class MouseClickRequest(BaseModel):
    """Mouse button click, press down, or release."""
    button: Literal["left", "right", "middle"] = "left"
    action: Literal["click", "double_click", "down", "up"] = "click"
    x: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional normalized X coordinate to position before click")
    y: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional normalized Y coordinate to position before click")
    timestamp: Optional[float] = Field(default_factory=time.time)


class MouseScrollRequest(BaseModel):
    """Vertical wheel scroll (positive=up, negative=down)."""
    delta_y: int = Field(..., ge=-5000, le=5000, description="Wheel delta (typically multiples of 120)")
    timestamp: Optional[float] = Field(default_factory=time.time)


class KeyRequest(BaseModel):
    """Special key press, down, or up event."""
    key: str = Field(..., min_length=1, max_length=30)
    action: Literal["press", "down", "up"] = "press"
    timestamp: Optional[float] = Field(default_factory=time.time)

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ALLOWED_KEYS and len(clean) != 1:
            raise ValueError(f"Key '{v}' is not in the allowed keys list.")
        return clean


class TextTypeRequest(BaseModel):
    """Arbitrary Unicode text entry sent to active window."""
    text: str = Field(..., min_length=1, max_length=500, description="Unicode string to type into active window")
    timestamp: Optional[float] = Field(default_factory=time.time)


class ShortcutRequest(BaseModel):
    """Execute standard multi-key combination (e.g. ['ctrl', 'c'])."""
    keys: List[str] = Field(..., min_length=1, max_length=5)
    timestamp: Optional[float] = Field(default_factory=time.time)

    @field_validator("keys")
    @classmethod
    def validate_keys(cls, keys: List[str]) -> List[str]:
        clean_keys = []
        for k in keys:
            clean = k.strip().lower()
            if clean not in ALLOWED_KEYS and len(clean) != 1:
                raise ValueError(f"Key '{k}' in shortcut is not recognized.")
            clean_keys.append(clean)
        return clean_keys


class InputOperationResponse(BaseModel):
    """Standard response for input dispatch."""
    success: bool
    action: str
    message: Optional[str] = None
