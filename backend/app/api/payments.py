"""Payment operational management and inspection endpoints.

STRICT ISOLATION GUARANTEE:
All responses strictly contain Tier 1 observed operational signals.
PaymentGroundTruth, hidden causes, and oracle regret labels are NEVER returned.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Payment, Customer, Mandate, RecoveryAction, AuditLog, OutboxMessage
from backend.app.schemas.payment import PaymentRead
from backend.app.schemas.customer import CustomerRead
from backend.app.schemas.mandate import MandateRead
from backend.app.schemas.recovery_action import RecoveryActionRead
from backend.app.schemas.api import (
    PaginatedPaymentsResponse,
    PaymentDetailResponse,
    RiskAssessmentResponse,
    FailureDiagnosisResponse,
    PaymentTimelineResponse,
    TimelineEvent,
)
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.ml.feature_extractor import FeatureExtractor
from backend.app.ml.trainer import load_trained_model

router = APIRouter(prefix="/payments", tags=["Payments"])

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = load_trained_model()
    return _MODEL


@router.get("", response_model=PaginatedPaymentsResponse)
def list_payments(
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    status: Optional[str] = Query(None, description="Filter by payment status"),
    rail: Optional[str] = Query(None, description="Filter by rail (upi_autopay / card)"),
    failure_code: Optional[str] = Query(None, description="Filter by failure code"),
    db: Session = Depends(get_db),
):
    """List operational recurring payments with optional filtering and pagination."""
    query = db.query(Payment)

    if status:
        query = query.filter(Payment.status == status)
    if rail:
        query = query.filter(Payment.payment_rail == rail)
    if failure_code:
        query = query.filter(Payment.failure_code == failure_code)

    total = query.count()
    items = query.order_by(Payment.due_date.asc()).offset(offset).limit(limit).all()

    return PaginatedPaymentsResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=[PaymentRead.model_validate(p) for p in items],
    )


@router.get("/{payment_id}", response_model=PaymentDetailResponse)
def get_payment_detail(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve detailed operational payment record with diagnosis and ML propensity score."""
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment '{payment_id}' not found.")

    customer = payment.customer
    mandate = payment.mandate

    # 1. Deterministic risk assessment (Tier 1 observed signals)
    risk = RevenueAtRiskDetector.assess_risk(
        payment_id=payment.payment_id,
        amount=payment.amount,
        payment_rail=payment.payment_rail,
        native_retry_attempt=payment.native_retry_attempt,
        days_since_last_success=payment.days_since_last_success,
        consecutive_failure_count=payment.consecutive_failure_count,
        historical_success_rate=payment.historical_success_rate,
        mandate_status=mandate.mandate_status,
        customer_tenure_days=customer.customer_tenure_days,
    )

    # 2. Deterministic failure diagnosis (Tier 1 observed signals)
    diagnosis = FailureDiagnosisEngine.diagnose(
        payment_id=payment.payment_id,
        failure_code=payment.failure_code,
        error_source=payment.error_source,
        error_step=payment.error_step,
        payment_rail=payment.payment_rail,
        mandate_status=mandate.mandate_status,
        amount=payment.amount,
        native_retry_attempt=payment.native_retry_attempt,
    )

    # 3. Interpretable ML propensity score
    model = _get_model()
    feat = FeatureExtractor.extract_from_orm(payment, customer, mandate)
    pred = model.predict(feat)

    # 4. Latest recovery action if executed
    latest_act = (
        db.query(RecoveryAction)
        .filter(RecoveryAction.payment_id == payment_id)
        .order_by(RecoveryAction.created_at.desc())
        .first()
    )
    latest_action_read = RecoveryActionRead.model_validate(latest_act) if latest_act else None

    return PaymentDetailResponse(
        payment=PaymentRead.model_validate(payment),
        customer=CustomerRead.model_validate(customer),
        mandate=MandateRead.model_validate(mandate),
        risk_assessment=RiskAssessmentResponse(
            risk_tier=risk.risk_tier.value,
            risk_score=risk.risk_score,
            is_immediate_action_needed=risk.is_immediate_action_needed,
            contributing_factors=risk.contributing_factors,
        ),
        failure_diagnosis=FailureDiagnosisResponse(
            failure_category=diagnosis.failure_category.value,
            recoverability_class=diagnosis.recoverability_class.value,
            confidence=diagnosis.confidence,
            triggering_reasons=diagnosis.triggering_reasons,
            allowed_actions=[a.value for a in diagnosis.allowed_actions],
            recommended_recovery_window_hours=diagnosis.recommended_recovery_window_hours,
        ),
        propensity_score=pred.recoverability_score,
        propensity_confidence=pred.confidence,
        explanation_summary=pred.explanation_summary,
        latest_action=latest_action_read,
    )


@router.get("/{payment_id}/timeline", response_model=PaymentTimelineResponse)
def get_payment_timeline(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """Expose chronological lifecycle events for a recurring payment."""
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment '{payment_id}' not found.")

    events: List[TimelineEvent] = []

    # 1. Initial Attempt / Failure Observed
    events.append(
        TimelineEvent(
            event_id=f"evt_fail_{payment.payment_id}",
            event_type="payment_attempt_failed",
            actor="payment_rail",
            timestamp=payment.payment_attempt_date,
            details={
                "amount_inr": payment.amount,
                "rail": payment.payment_rail,
                "failure_code": payment.failure_code,
                "error_source": payment.error_source,
                "error_step": payment.error_step,
            },
        )
    )

    # 2. Risk Detected
    risk = RevenueAtRiskDetector.assess_risk(
        payment_id=payment.payment_id,
        amount=payment.amount,
        payment_rail=payment.payment_rail,
        native_retry_attempt=payment.native_retry_attempt,
        days_since_last_success=payment.days_since_last_success,
        consecutive_failure_count=payment.consecutive_failure_count,
        historical_success_rate=payment.historical_success_rate,
        mandate_status=payment.mandate.mandate_status,
        customer_tenure_days=payment.customer.customer_tenure_days,
    )
    events.append(
        TimelineEvent(
            event_id=f"evt_risk_{payment.payment_id}",
            event_type="revenue_at_risk_detected",
            actor="revora_risk_detector",
            timestamp=payment.created_at,
            details={
                "risk_tier": risk.risk_tier.value,
                "risk_score": risk.risk_score,
                "contributing_factors": risk.contributing_factors,
            },
        )
    )

    # 3. Failure Diagnosed
    diag = FailureDiagnosisEngine.diagnose(
        payment_id=payment.payment_id,
        failure_code=payment.failure_code,
        error_source=payment.error_source,
        error_step=payment.error_step,
        payment_rail=payment.payment_rail,
        mandate_status=payment.mandate.mandate_status,
        amount=payment.amount,
        native_retry_attempt=payment.native_retry_attempt,
    )
    events.append(
        TimelineEvent(
            event_id=f"evt_diag_{payment.payment_id}",
            event_type="failure_diagnosed",
            actor="revora_diagnosis_engine",
            timestamp=payment.created_at,
            details={
                "category": diag.failure_category.value,
                "recoverability_class": diag.recoverability_class.value,
                "allowed_actions": [a.value for a in diag.allowed_actions],
                "triggering_reasons": diag.triggering_reasons,
            },
        )
    )

    # 4. Recovery Actions Executed
    actions = (
        db.query(RecoveryAction)
        .filter(RecoveryAction.payment_id == payment_id)
        .order_by(RecoveryAction.created_at.asc())
        .all()
    )
    for act in actions:
        events.append(
            TimelineEvent(
                event_id=f"evt_act_{act.action_id}",
                event_type="recovery_action_executed",
                actor=act.decided_by,
                timestamp=act.created_at,
                details={
                    "action_id": act.action_id,
                    "action_type": act.action_type,
                    "decision_reason": act.decision_reason,
                    "outcome": act.outcome,
                    "recovered_amount_inr": act.recovered_amount,
                    "policy_version": act.policy_version,
                },
            )
        )

    # 5. Outbox Messages Created
    outbox_msgs = (
        db.query(OutboxMessage)
        .filter(OutboxMessage.payment_id == payment_id)
        .order_by(OutboxMessage.created_at.asc())
        .all()
    )
    for msg in outbox_msgs:
        events.append(
            TimelineEvent(
                event_id=f"evt_outbox_{msg.outbox_id}",
                event_type="outreach_message_generated",
                actor="multilingual_outreach_generator",
                timestamp=msg.created_at,
                details={
                    "channel": msg.channel,
                    "language_used": msg.language_used,
                    "trigger_action": msg.trigger_action,
                    "simulation_disclaimer": msg.simulation_disclaimer,
                    "message_preview": (msg.message_body[:80] + "...") if len(msg.message_body) > 80 else msg.message_body,
                },
            )
        )

    # 6. Audit Log Records
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.payload_snapshot.contains(payment_id))
        .order_by(AuditLog.timestamp.asc())
        .all()
    )
    for log in audit_logs:
        events.append(
            TimelineEvent(
                event_id=f"evt_log_{log.log_id}",
                event_type=log.event,
                actor=log.actor,
                timestamp=log.timestamp,
                details={
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                },
            )
        )

    # Sort all events chronologically
    events.sort(key=lambda e: e.timestamp)

    return PaymentTimelineResponse(
        payment_id=payment_id,
        events=events,
    )
