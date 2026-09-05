"""Revora Decision Engine operational endpoint.

CRITICAL ARCHITECTURAL BOUNDARY:
- Actions are determined 100% deterministically by RevoraDecisionEngine.
- LLMs are NEVER invoked here.
- Hidden ground truth (Tier 2/3) is NEVER accessed.
"""
from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.core.constants import ActionType
from backend.app.models import Payment, Customer, Mandate, RecoveryAction, AuditLog
from backend.app.schemas.api import DecisionResponse
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.ml.feature_extractor import FeatureExtractor
from backend.app.ml.trainer import load_trained_model
from backend.app.decision_engine.policy import PolicyEvaluationContext, REVORA_POLICY_VERSION
from backend.app.decision_engine.engine import RevoraDecisionEngine

router = APIRouter(prefix="/payments", tags=["Decision Engine"])

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = load_trained_model()
    return _MODEL


@router.post("/{payment_id}/decision", response_model=DecisionResponse)
def evaluate_decision(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """Execute Revora Decision Engine for a payment to determine optimal recovery action."""
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment '{payment_id}' not found.")

    customer = payment.customer
    mandate = payment.mandate

    # 1. Deterministic risk assessment (Tier 1 signals only)
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

    # 2. Deterministic failure diagnosis (Tier 1 signals only)
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

    # 4. Count prior recovery attempts
    prior_attempts = (
        db.query(RecoveryAction)
        .filter(RecoveryAction.payment_id == payment_id)
        .count()
    )
    prior_escalations = (
        db.query(RecoveryAction)
        .filter(
            RecoveryAction.payment_id == payment_id,
            RecoveryAction.action_type == ActionType.HUMAN_ESCALATION.value,
        )
        .count()
    )

    # 5. Build policy evaluation context
    ctx = PolicyEvaluationContext(
        payment_id=payment.payment_id,
        amount=payment.amount,
        payment_rail=payment.payment_rail,
        mandate_status=mandate.mandate_status,
        failure_category=diagnosis.failure_category.value,
        recoverability_class=diagnosis.recoverability_class.value,
        propensity_score=pred.recoverability_score,
        propensity_confidence=pred.confidence,
        risk_tier=risk.risk_tier.value,
        native_retry_attempt=payment.native_retry_attempt,
        revora_recovery_attempts=prior_attempts,
        hours_since_last_attempt=24.0,  # Standard cooldown check
        prior_escalations_count=prior_escalations,
        consecutive_failed_cycles=payment.consecutive_failure_count,
    )

    # 6. Execute deterministic Revora Decision Engine
    decision = RevoraDecisionEngine.evaluate(ctx)

    # 7. Persist audit log entry
    decision_id = f"dec_{uuid4().hex[:12]}"
    audit = AuditLog(
        log_id=f"log_dec_{uuid4().hex[:12]}",
        entity_type="payment_decision",
        entity_id=decision_id,
        event="recovery_decision_evaluated",
        payload_snapshot=(
            f'{{"payment_id": "{payment_id}", "action": "{decision.action.value}", '
            f'"propensity": {decision.propensity_score:.4f}, "policy": "{decision.policy_version}"}}'
        ),
        actor="revora_decision_engine",
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return DecisionResponse(
        decision_id=decision_id,
        payment_id=decision.payment_id,
        action=decision.action.value,
        decision_reason=decision.decision_reason,
        reason=decision.decision_reason,
        policy_version=decision.policy_version,
        risk_tier=decision.risk_tier,
        diagnosis_category=decision.diagnosis_category,
        recoverability_class=decision.recoverability_class,
        propensity_score=decision.propensity_score,
        propensity_confidence=decision.propensity_confidence,
        explanation_summary=pred.explanation_summary,
        important_features=pred.important_features,
        policy_checks=decision.policy_checks,
        audit_logged=True,
        is_simulation=True,
    )
