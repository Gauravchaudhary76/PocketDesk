from typing import Optional
from pydantic import BaseModel, Field

class OSInfo(BaseModel):
    """Operating system details."""
    system: str = Field(description="Operating system family (e.g., 'Windows')")
    release: str = Field(description="OS release version (e.g., '10', '11')")
    version: str = Field(description="OS build version string")
    architecture: str = Field(description="Machine architecture (e.g., 'AMD64', 'x86_64')")
    hostname: str = Field(description="Local computer hostname")

class CPUInfo(BaseModel):
    """Processor telemetry and specifications."""
    model: Optional[str] = Field(default=None, description="CPU model name or identifier")
    cores_physical: Optional[int] = Field(default=None, description="Physical core count")
    cores_logical: int = Field(description="Logical/hyperthreaded CPU thread count")
    usage_percent: float = Field(ge=0.0, le=100.0, description="Overall CPU utilization percentage")
    frequency_mhz: Optional[float] = Field(default=None, description="Current CPU frequency in MHz")

class MemoryInfo(BaseModel):
    """System memory (RAM) telemetry."""
    total_bytes: int = Field(ge=0, description="Total physical RAM in bytes")
    available_bytes: int = Field(ge=0, description="Available RAM for allocation in bytes")
    used_bytes: int = Field(ge=0, description="Currently utilized RAM in bytes")
    usage_percent: float = Field(ge=0.0, le=100.0, description="Memory utilization percentage")

class BatteryInfo(BaseModel):
    """Battery and power state telemetry."""
    present: bool = Field(description="Whether a physical battery is detected on the host")
    percent: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Battery charge percentage")
    is_charging: Optional[bool] = Field(default=None, description="Whether the battery is currently charging")
    power_plugged: Optional[bool] = Field(default=None, description="Whether the device is connected to AC power")
    seconds_left: Optional[int] = Field(default=None, description="Estimated remaining battery runtime in seconds")

class SystemInfoResponse(BaseModel):
    """System hardware and resource information response model."""
    os: OSInfo = Field(description="Operating system details")
    cpu: CPUInfo = Field(description="CPU telemetry and specifications")
    memory: MemoryInfo = Field(description="RAM telemetry")
    battery: Optional[BatteryInfo] = Field(default=None, description="Battery status (None if no battery hardware)")
    timestamp: str = Field(description="Timestamp of the telemetry reading in ISO 8601 format")
