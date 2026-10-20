from typing import Optional
from pydantic import BaseModel, Field


class PairRequest(BaseModel):
    """Request payload to authenticate and pair a new client."""
    pairing_code: str = Field(
        min_length=6,
        max_length=6,
        description="6-digit authorization PIN displayed on the Windows laptop terminal"
    )
    client_name: Optional[str] = Field(
        default="PocketDesk Mobile",
        description="Optional descriptive device name for the client"
    )


class PairResponse(BaseModel):
    """Successful pairing response containing bearer session token."""
    status: str = Field(default="paired", description="Pairing status indicator")
    session_token: str = Field(description="Opaque bearer session token for authenticated requests")
    token_type: str = Field(default="Bearer", description="HTTP authorization scheme")
    expires_in_seconds: int = Field(description="Token validity period in seconds")


class UnpairResponse(BaseModel):
    """Response confirming session revocation."""
    status: str = Field(default="unpaired", description="Unpair status indicator")
    message: str = Field(description="Confirmation message")
