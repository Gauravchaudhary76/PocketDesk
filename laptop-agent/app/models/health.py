from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    """Health check response model."""
    status: str = Field(default="ok", description="Status indicator of the agent ('ok')")
    version: str = Field(description="Agent semantic version")
    agent_name: str = Field(description="Descriptive name of the agent")
    stage: int = Field(default=2, description="Active development stage number")
    uptime_seconds: float = Field(ge=0.0, description="Uptime of the agent process in seconds")
    timestamp: str = Field(description="Current server timestamp in ISO 8601 format")
