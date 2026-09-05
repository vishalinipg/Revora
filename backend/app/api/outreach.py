"""Multilingual outreach generation endpoint.

STRICT SAFETY BOUNDARIES:
- STOP and HUMAN_ESCALATION strictly suppress customer outreach.
- Real messages are NEVER sent; all copy is watermarked "SIMULATED — NO MESSAGE SENT".
- Safety validator rejects amount alterations and credential solicitations.
- Unknown customer languages safely fall back to English without geographic guessing.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.core.constants import ActionType
from backend.app.models import Payment, Customer, Mandate, RecoveryAction
from backend.app.schemas.api import OutreachResponse
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.ml.feature_extractor import FeatureExtractor
from backend.app.ml.trainer import load_trained_model
from backend.app.decision_engine.policy import PolicyEvaluationContext
from backend.app.decision_engine.engine import RevoraDecisionEngine
from backend.app.language.generator import MultilingualOutreachGenerator

router = APIRouter(prefix="/payments", tags=["Multilingual Outreach"])

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = load_trained_model()
    return _MODEL


@router.post("/{payment_id}/outreach", response_model=OutreachResponse)
def generate_payment_outreach(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """Generate safe, multilingual outreach copy for an approved recovery decision."""
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment '{payment_id}' not found.")

    customer = payment.customer
    mandate = payment.mandate

    # 1. Deterministic assessment & decision
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

    model = _get_model()
    feat = FeatureExtractor.extract_from_orm(payment, customer, mandate)
    pred = model.predict(feat)

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
        hours_since_last_attempt=24.0,
        prior_escalations_count=prior_escalations,
        consecutive_failed_cycles=payment.consecutive_failure_count,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    # 2. Check outreach suppression rules (Phase 5 gate)
    if decision.action in [ActionType.STOP, ActionType.HUMAN_ESCALATION]:
        return OutreachResponse(
            payment_id=payment.payment_id,
            customer_id=customer.customer_id,
            action_type=decision.action.value,
            outreach_suppressed=True,
            suppression_reason=(
                f"Outreach suppressed: policy action is '{decision.action.value}'. "
                "Customer communication is prohibited for terminal or internal escalation actions."
            ),
            channel=None,
            language_used=None,
            message_body=None,
            simulation_watermark="SIMULATED — NO MESSAGE SENT",
            is_simulation=True,
            fallback_template_used=False,
            safety_validation_passed=True,
        )

    # 3. Generate validated multilingual draft
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name=customer.name,
        customer_id=customer.customer_id,
        preferred_language=customer.preferred_language,
        amount=payment.amount,
        payment_rail=payment.payment_rail,
        subscription_plan=customer.subscription_plan,
    )

    # 4. Persist to simulated mock outbox table
    MultilingualOutreachGenerator.persist_to_mock_outbox(
        draft=draft,
        decision=decision,
        db_session=db,
    )

    return OutreachResponse(
        payment_id=payment.payment_id,
        customer_id=customer.customer_id,
        action_type=decision.action.value,
        outreach_suppressed=False,
        suppression_reason=None,
        channel=draft.channel,
        language_used=draft.language_used,
        message_body=draft.message_body,
        simulation_watermark="SIMULATED — NO MESSAGE SENT",
        is_simulation=True,
        fallback_template_used=draft.fallback_used,
        safety_validation_passed=True,
    )
