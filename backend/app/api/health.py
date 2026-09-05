"""Health check endpoint."""
from fastapi import APIRouter
from backend.app.schemas.api import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    """System health and operational status."""
    return HealthResponse()
