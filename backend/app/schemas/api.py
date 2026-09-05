"""Operational API schemas for FastAPI endpoints.

STRICT ISOLATION GUARANTEE:
These schemas model operational requests and responses for the Operator Console.
They strictly exclude any hidden ground truth (Tier 2/3), oracle regret labels,
or unobserved failure causes.
"""
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

from backend.app.schemas.payment import PaymentRead
from backend.app.schemas.customer import CustomerRead
from backend.app.schemas.mandate import MandateRead
from backend.app.schemas.recovery_action import RecoveryActionRead


class HealthResponse(BaseModel):
    """System health status."""
    status: str = "healthy"
    service: str = "revora-api"
    version: str = "1.0.0"
    environment: str = "test_mode"
    production_rail_target: str = "UPI AutoPay (NPCI e-Mandate)"
    test_mode_adapter: str = "Razorpay Card Subscriptions"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RiskAssessmentResponse(BaseModel):
    """Operational revenue-at-risk evaluation."""
    risk_tier: str
    risk_score: float
    is_immediate_action_needed: bool
    contributing_factors: List[str]


class FailureDiagnosisResponse(BaseModel):
    """Deterministic failure diagnosis."""
    failure_category: str
    recoverability_class: str
    confidence: float
    triggering_reasons: List[str]
    allowed_actions: List[str]
    recommended_recovery_window_hours: Optional[int] = None


class PaymentDetailResponse(BaseModel):
    """Detailed operational payment record with diagnosis and ML propensity."""
    payment: PaymentRead
    customer: CustomerRead
    mandate: MandateRead
    risk_assessment: RiskAssessmentResponse
    failure_diagnosis: FailureDiagnosisResponse
    propensity_score: float
    propensity_confidence: float
    explanation_summary: str
    latest_action: Optional[RecoveryActionRead] = None
    disclaimer: str = "SIMULATED — SYNTHETIC / TEST DATA ONLY"


class PaginatedPaymentsResponse(BaseModel):
    """Paginated list of operational recurring payments."""
    total: int
    limit: int
    offset: int
    items: List[PaymentRead]
    disclaimer: str = "SIMULATED — SYNTHETIC / TEST DATA ONLY"


class DecisionResponse(BaseModel):
    """Revora Decision Engine evaluation output."""
    decision_id: str
    payment_id: str
    action: str
    decision_reason: str
    reason: Optional[str] = None
    policy_version: str
    risk_tier: str
    diagnosis_category: str
    recoverability_class: str
    propensity_score: float
    propensity_confidence: float
    explanation_summary: str
    important_features: List[Dict[str, Any]]
    policy_checks: Dict[str, bool]
    audit_logged: bool = True
    is_simulation: bool = True


class OutreachResponse(BaseModel):
    """Multilingual outreach draft generation response."""
    payment_id: str
    customer_id: str
    action_type: str
    outreach_suppressed: bool
    suppression_reason: Optional[str] = None
    channel: Optional[str] = None
    language_used: Optional[str] = None
    message_body: Optional[str] = None
    simulation_watermark: str = "SIMULATED — NO MESSAGE SENT"
    is_simulation: bool = True
    fallback_template_used: bool = True
    safety_validation_passed: bool = True


class TimelineEvent(BaseModel):
    """A single chronological lifecycle event for a payment."""
    event_id: str
    event_type: str
    actor: str
    timestamp: datetime
    details: Dict[str, Any]


class PaymentTimelineResponse(BaseModel):
    """Chronological event history for a payment."""
    payment_id: str
    events: List[TimelineEvent]


class EvaluationSummaryResponse(BaseModel):
    """Evaluation aggregates from held-out benchmark."""
    metadata: Dict[str, Any]
    baseline_description: str = "fixed 3-attempt blind-retry control baseline"
    primary_benchmark_seed_42: Dict[str, Any]
    language_breakdown: List[Dict[str, Any]]
    metric_definitions: Dict[str, str]


class EvaluationSeedsResponse(BaseModel):
    """Multi-seed statistical evaluation benchmark."""
    seeds_evaluated: List[int]
    baseline_description: str = "fixed 3-attempt blind-retry control baseline"
    cohort_size: int
    total_revenue_at_risk_inr: float
    multi_seed_robustness_benchmark: Dict[str, Any]
