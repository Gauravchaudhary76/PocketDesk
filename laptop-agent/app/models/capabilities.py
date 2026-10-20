from typing import List, Literal
from pydantic import BaseModel, Field

CapabilityStatus = Literal["available", "planned", "disabled"]

class CapabilityItem(BaseModel):
    """Specification of an agent capability."""
    name: str = Field(description="Unique identifier for the capability")
    status: CapabilityStatus = Field(description="Status of the capability: 'available', 'planned', or 'disabled'")
    stage: int = Field(description="Project development stage introducing this capability")
    description: str = Field(description="Human-readable description of the capability")

class CapabilitiesResponse(BaseModel):
    """List of all PocketDesk agent capabilities and roadmap stages."""
    agent_version: str = Field(description="Current version of the agent")
    current_stage: int = Field(default=2, description="Currently active development stage")
    capabilities: List[CapabilityItem] = Field(description="Array of capabilities with their active statuses")
    timestamp: str = Field(description="Current timestamp in ISO 8601 format")
