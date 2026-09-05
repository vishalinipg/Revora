"""Revora FastAPI Application Entry Point.

Target: Razorpay Buildathon 2026 · Track 03 — AI Revenue Recovery
Core Philosophy: Detect -> Diagnose -> Decide -> Recover -> Measure

Operational Boundaries:
- Decisions are 100% deterministic (RevoraDecisionEngine + LogisticRegression).
- Multilingual copy is strictly constrained (safe templates, simulated outbox).
- Hidden ground truth is evaluation-only and NEVER exposed in operational APIs.
- Baseline is designated as: 'fixed 3-attempt blind-retry control baseline'.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import init_db
from backend.app.api import api_v1_router, health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup initialization."""
    # Ensure all tables exist
    init_db()

    # Self-healing database seeder: populate records if running on a fresh/empty deployment
    try:
        from backend.app.database import SessionLocal
        from backend.app.models import Payment
        db = SessionLocal()
        try:
            if db.query(Payment).count() == 0:
                print("[REVORA STARTUP] Database empty. Auto-seeding 1,200 synthetic recurring payment records...")
                from scripts.generate_data import generate_synthetic_dataset
                generate_synthetic_dataset(num_payments=1200, seed=42, db_session=db)
                print("[REVORA STARTUP] Database auto-seeded successfully.")
        finally:
            db.close()
    except Exception as exc:
        print(f"[REVORA STARTUP WARNING] Database auto-seed check skipped or failed: {exc}")

    yield


app = FastAPI(
    title="Revora — Adaptive Revenue Recovery API",
    description=(
        "Auditable, multi-rail revenue recovery engine for recurring payments. "
        "Enforces deterministic stopping rules, causal diagnosis, interpretable ML, "
        "and multilingual outreach copy generation."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware configuration (enables Next.js console communication)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Health check at root level: GET /health
app.include_router(health_router)

# Mount operational API endpoints: /api/v1/...
app.include_router(api_v1_router)


@app.get("/", tags=["Root"])
def root():
    """Service overview and links to documentation."""
    return {
        "product": "Revora",
        "tagline": "Adaptive Revenue Recovery for Recurring Payments",
        "version": "1.0.0",
        "environment": "test_mode",
        "production_rail_target": "UPI AutoPay (NPCI e-Mandate)",
        "test_mode_adapter": "Razorpay Card Subscriptions",
        "docs_url": "/docs",
        "health_url": "/health",
        "api_v1_url": "/api/v1",
    }
