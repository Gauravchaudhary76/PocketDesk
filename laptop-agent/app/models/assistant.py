from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ParseCommandRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Natural language instruction from the user"
    )


class InterpretedCommandResponse(BaseModel):
    command_id: str = Field(..., description="Unique tracking identifier for this command proposal")
    raw_prompt: str = Field(..., description="Original user prompt")
    intent: str = Field(..., description="Classified intent identifier (e.g. open_app, system_status)")
    action_type: str = Field(..., description="Approved action enum (launch_app, get_system_status, etc.)")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Extracted and validated action parameters")
    summary: str = Field(..., description="Clear human-readable description of the proposed action")
    requires_confirmation: bool = Field(False, description="Whether explicit user confirmation is mandatory")
    is_supported: bool = Field(True, description="Whether the command matches an approved action")
    risk_level: str = Field("safe", description="Risk assessment: safe, moderate, disruptive, or prohibited")
    rejection_reason: Optional[str] = Field(None, description="Explanation if command cannot be executed")


class ExecuteCommandRequest(BaseModel):
    command_id: str = Field(..., description="Tracking identifier from parse step")
    action_type: str = Field(..., description="Action to execute")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters to pass to action executor")
    confirmed: bool = Field(False, description="Must be True if action requires confirmation")


class ExecuteCommandResponse(BaseModel):
    success: bool = Field(..., description="Execution outcome")
    action_type: str = Field(..., description="Executed action type")
    message: str = Field(..., description="Status summary or human-readable outcome")
    result_data: Optional[Dict[str, Any]] = Field(None, description="Structured output payload (e.g. telemetry, search results)")
    audit_id: str = Field(..., description="Security audit log identifier")
    timestamp: str = Field(..., description="ISO 8601 execution timestamp")


class IntentCatalogItem(BaseModel):
    intent: str = Field(..., description="Intent identifier")
    action_type: str = Field(..., description="Target action")
    description: str = Field(..., description="What this intent accomplishes")
    example_phrases: List[str] = Field(..., description="Sample user instructions")
    requires_confirmation: bool = Field(..., description="Whether confirmation is required")


class IntentCatalogResponse(BaseModel):
    intents: List[IntentCatalogItem] = Field(..., description="List of supported AI desktop command intents")
