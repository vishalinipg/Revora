"""Tests for Revora Decision Engine and Stopping Rules (revora_policy_v1).

Validates:
1. Hard Safety Constraints: Hard blocked accounts NEVER trigger RETRY.
2. Mandate State Rules: Expired or revoked mandates NEVER trigger RETRY.
3. Stopping Rules: Max 3 recovery attempts, 24h cooldown, max 1 escalation, 3-cycle churn stop.
4. Diagnosis Integration: Soft vs action-required vs hard vs ambiguous.
5. ML Interaction: Propensity cannot override hard safety constraints.
6. Determinism: Identical inputs yield identical decisions.
7. Auditability & Serialization: Full decision trace and policy version in every output.
"""
import pytest
from backend.app.core.constants import ActionType, MandateStatus, PaymentRail
from backend.app.diagnosis.taxonomy import FailureCategory, RecoverabilityClass
from backend.app.decision_engine.policy import (
    REVORA_POLICY_VERSION,
    MAX_RECOVERY_ATTEMPTS_PER_PAYMENT,
    MIN_RETRY_COOLDOWN_HOURS,
    MAX_AUTOMATED_ESCALATIONS,
    MAX_FAILED_RECOVERY_CYCLES,
    PolicyEvaluationContext,
)
from backend.app.decision_engine.engine import RevoraDecisionEngine


def _create_base_context(**kwargs) -> PolicyEvaluationContext:
    """Helper to create a valid default PolicyEvaluationContext."""
    defaults = {
        "payment_id": "pay_test_dec_001",
        "amount": 1499.0,
        "payment_rail": PaymentRail.UPI_AUTOPAY.value,
        "mandate_status": MandateStatus.ACTIVE.value,
        "failure_category": FailureCategory.SOFT_FUNDS.value,
        "recoverability_class": RecoverabilityClass.SOFT.value,
        "propensity_score": 0.85,
        "propensity_confidence": 0.85,
        "risk_tier": "LOW",
        "native_retry_attempt": 0,
        "revora_recovery_attempts": 0,
        "hours_since_last_attempt": 48.0,
        "prior_escalations_count": 0,
        "consecutive_failed_cycles": 1,
    }
    defaults.update(kwargs)
    return PolicyEvaluationContext(**defaults)


# ==============================================================================
# 1. HARD SAFETY CONSTRAINTS TESTS
# ==============================================================================

def test_hard_blocked_never_retries_even_with_high_propensity():
    """CRITICAL SAFETY TEST: Even with 0.99 propensity, hard failure CANNOT retry."""
    ctx = _create_base_context(
        failure_category=FailureCategory.HARD_BLOCKED.value,
        recoverability_class=RecoverabilityClass.HARD.value,
        propensity_score=0.99,  # Artificially high ML score
        propensity_confidence=0.99,
        prior_escalations_count=0,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action != ActionType.RETRY, "CRITICAL BUG: RETRY selected on hard blocked failure!"
    assert decision.action == ActionType.HUMAN_ESCALATION
    assert decision.policy_checks["hard_failure"] is True
    assert "HARD_FAILURE_BLOCKED" in decision.violated_constraints[0]
    assert "prohibited" in decision.decision_reason.lower() or "blocked" in decision.decision_reason.lower()


def test_hard_blocked_stops_if_escalation_cap_reached():
    """Hard failure with escalation cap reached must STOP."""
    ctx = _create_base_context(
        failure_category=FailureCategory.HARD_BLOCKED.value,
        recoverability_class=RecoverabilityClass.HARD.value,
        prior_escalations_count=MAX_AUTOMATED_ESCALATIONS,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action == ActionType.STOP
    assert decision.policy_checks["escalation_cap_reached"] is True


def test_expired_and_revoked_mandate_never_retries():
    """Mandates that are expired or revoked must NEVER trigger automated retry."""
    for status in [MandateStatus.EXPIRED.value, MandateStatus.REVOKED.value]:
        ctx = _create_base_context(
            mandate_status=status,
            failure_category=FailureCategory.CUSTOMER_ACTION_MANDATE.value,
            recoverability_class=RecoverabilityClass.ACTION_REQUIRED.value,
            propensity_score=0.88,
        )
        decision = RevoraDecisionEngine.evaluate(ctx)

        assert decision.action != ActionType.RETRY, f"CRITICAL: RETRY selected for {status} mandate!"
        assert decision.action == ActionType.PAYMENT_UPDATE_REQUEST
        assert decision.policy_checks["mandate_valid"] is False


# ==============================================================================
# 2. STOPPING RULES TESTS
# ==============================================================================

def test_failed_cycle_limit_triggers_stop():
    """Account with 3 consecutive unrecovered billing cycles must STOP permanently."""
    ctx = _create_base_context(
        consecutive_failed_cycles=MAX_FAILED_RECOVERY_CYCLES,
        propensity_score=0.90,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action == ActionType.STOP
    assert decision.policy_checks["failed_cycle_limit_reached"] is True
    assert "permanent churn" in decision.decision_reason.lower()


def test_retry_cap_exhaustion():
    """Exhausting total attempts (native + revora >= 3) prohibits further retries."""
    ctx = _create_base_context(
        native_retry_attempt=1,
        revora_recovery_attempts=2,  # 1 + 2 = 3 attempts
        failure_category=FailureCategory.SOFT_FUNDS.value,
        propensity_score=0.95,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action != ActionType.RETRY
    assert decision.policy_checks["retry_cap_reached"] is True
    assert "RETRY_CAP_EXHAUSTED" in decision.violated_constraints[0]


def test_retry_cooldown_enforcement():
    """Attempting a retry within 24 hours of prior Revora retry violates cooldown."""
    ctx = _create_base_context(
        revora_recovery_attempts=1,
        hours_since_last_attempt=12.0,  # Only 12 hours elapsed (< 24h)
        failure_category=FailureCategory.SOFT_FUNDS.value,
        propensity_score=0.90,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action != ActionType.RETRY, "Retry executed before 24h cooldown!"
    assert decision.policy_checks["cooldown_satisfied"] is False
    assert "COOLDOWN_ACTIVE" in decision.violated_constraints[0]


def test_cooldown_satisfied_allows_retry():
    """Attempting a retry after >= 24 hours satisfies cooldown."""
    ctx = _create_base_context(
        revora_recovery_attempts=1,
        hours_since_last_attempt=26.0,  # 26h elapsed (>= 24h)
        failure_category=FailureCategory.SOFT_FUNDS.value,
        propensity_score=0.90,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.action == ActionType.RETRY
    assert decision.policy_checks["cooldown_satisfied"] is True


# ==============================================================================
# 3. DIAGNOSIS TAXONOMY & PROPENSITY INTEGRATION TESTS
# ==============================================================================

def test_soft_funds_high_propensity_selects_retry():
    """Soft funds with high propensity and active mandate selects RETRY."""
    ctx = _create_base_context(
        failure_category=FailureCategory.SOFT_FUNDS.value,
        propensity_score=0.82,
        amount=999.0,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)
    assert decision.action == ActionType.RETRY
    assert "smart retry" in decision.decision_reason.lower()


def test_soft_funds_low_propensity_selects_update_request():
    """Soft funds with low propensity (< 0.35) prompts PAYMENT_UPDATE_REQUEST."""
    ctx = _create_base_context(
        failure_category=FailureCategory.SOFT_FUNDS.value,
        propensity_score=0.22,  # Low propensity despite soft code
    )
    decision = RevoraDecisionEngine.evaluate(ctx)
    assert decision.action == ActionType.PAYMENT_UPDATE_REQUEST
    assert "low" in decision.decision_reason.lower()


def test_customer_action_auth_selects_payment_update_request():
    """Authentication required failure selects PAYMENT_UPDATE_REQUEST."""
    ctx = _create_base_context(
        failure_category=FailureCategory.CUSTOMER_ACTION_AUTH.value,
        recoverability_class=RecoverabilityClass.ACTION_REQUIRED.value,
        propensity_score=0.75,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)
    assert decision.action == ActionType.PAYMENT_UPDATE_REQUEST


def test_unknown_ambiguous_failure_conservative_handling():
    """Unknown ambiguous failure on high amount routes to HUMAN_ESCALATION."""
    ctx = _create_base_context(
        failure_category=FailureCategory.UNKNOWN_AMBIGUOUS.value,
        recoverability_class=RecoverabilityClass.AMBIGUOUS.value,
        amount=4999.0,
        prior_escalations_count=0,
    )
    decision = RevoraDecisionEngine.evaluate(ctx)
    assert decision.action == ActionType.HUMAN_ESCALATION


# ==============================================================================
# 4. DETERMINISM, AUDITABILITY & SERIALIZATION TESTS
# ==============================================================================

def test_decision_determinism():
    """Verifies that identical inputs yield byte-for-byte identical decisions."""
    ctx = _create_base_context()
    d1 = RevoraDecisionEngine.evaluate(ctx)
    d2 = RevoraDecisionEngine.evaluate(ctx)

    assert d1.action == d2.action
    assert d1.decision_reason == d2.decision_reason
    assert d1.policy_version == d2.policy_version
    assert d1.policy_checks == d2.policy_checks
    assert d1.violated_constraints == d2.violated_constraints


def test_decision_serialization_and_auditability():
    """Verifies that decision results contain policy version, trace, and are serializable."""
    ctx = _create_base_context()
    decision = RevoraDecisionEngine.evaluate(ctx)

    assert decision.policy_version == REVORA_POLICY_VERSION
    assert len(decision.decision_trace) >= 3
    assert len(decision.policy_checks) == 6

    # Test serialization to dict
    d_dict = decision.to_dict()
    assert isinstance(d_dict, dict)
    assert d_dict["action"] in [a.value for a in ActionType]
    assert d_dict["policy_version"] == REVORA_POLICY_VERSION
