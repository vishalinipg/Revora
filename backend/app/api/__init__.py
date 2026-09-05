"""Revora API Router assembly."""
from fastapi import APIRouter

from backend.app.api.health import router as health_router
from backend.app.api.payments import router as payments_router
from backend.app.api.decision import router as decision_router
from backend.app.api.outreach import router as outreach_router
from backend.app.api.evaluation import router as evaluation_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount endpoints under /api/v1
api_v1_router.include_router(payments_router)
api_v1_router.include_router(decision_router)
api_v1_router.include_router(outreach_router)
api_v1_router.include_router(evaluation_router)

__all__ = ["api_v1_router", "health_router"]
