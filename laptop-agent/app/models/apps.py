from typing import List, Optional
from pydantic import BaseModel, Field


class AllowlistedAppItem(BaseModel):
    app_id: str = Field(..., description="Unique immutable identifier for approved application")
    name: str = Field(..., description="Human-readable application display name")
    description: str = Field(..., description="Brief summary of application purpose")
    icon_name: str = Field("terminal", description="Icon hint for UI display")
    is_disruptive: bool = Field(False, description="Whether launching requires explicit user confirmation")
    is_installed: bool = Field(True, description="Whether the executable exists on this host")


class AppAllowlistResponse(BaseModel):
    apps: List[AllowlistedAppItem] = Field(..., description="List of allowlisted installed applications")


class LaunchAppRequest(BaseModel):
    app_id: str = Field(..., description="Allowlisted application identifier to launch")
    confirmed: bool = Field(
        False,
        description="Must be True if the target application is designated as potentially disruptive"
    )


class LaunchAppResponse(BaseModel):
    success: bool = Field(..., description="Whether application was successfully launched")
    message: str = Field(..., description="Status description or error details")
    app_id: str = Field(..., description="Target application identifier")
    pid: Optional[int] = Field(None, description="Process ID of spawned application")
