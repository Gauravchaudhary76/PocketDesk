from typing import Optional
from fastapi import Header, HTTPException, status
from app.services.auth import AuthService


def get_current_token(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """Extract bearer token from Authorization header if present."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def require_auth(authorization: Optional[str] = Header(default=None)) -> str:
    """Dependency that enforces a valid, active session token."""
    token = get_current_token(authorization)
    if not token or not AuthService.validate_session(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing, invalid or expired session token. Please pair with the laptop agent.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token
