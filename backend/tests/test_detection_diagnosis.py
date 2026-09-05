"""Tests for Revenue-at-Risk Detection and Failure Diagnosis Engine."""
import pytest
from backend.app.core.constants import RiskTier, FailureCode, MandateStatus, PaymentRail, ActionType
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.diagnosis.taxonomy import FailureCategory, RecoverabilityClass


def test_revenue_at_risk_detection_deterministic():
    """Verify that identical inputs produce identical risk assessments."""
    assessment1 = RevenueAtRiskDetector.assess_risk(
        payment_id="pay_test_001",
        amount=1499.0,
        payment_rail=PaymentRail.UPI_AUTOPAY.value,
        native_retry_attempt=0,
        days_since_last_success=10,
        consecutive_failure_count=1,
        historical_success_rate=0.95,
        mandate_status=MandateStatus.ACTIVE.value,
        customer_tenure_days=180,
    )
    assessment2 = RevenueAtRiskDetector.assess_risk(
        payment_id="pay_test_001",
        amount=1499.0,
        payment_rail=PaymentRail.UPI_AUTOPAY.value,
        native_retry_attempt=0,
        days_since_last_success=10,
        consecutive_failure_count=1,
        historical_success_rate=0.95,
        mandate_status=MandateStatus.ACTIVE.value,
        customer_tenure_days=180,
    )

    assert assessment1.risk_score == assessment2.risk_score
    assert assessment1.risk_tier == assessment2.risk_tier
    assert assessment1.contributing_factors == assessment2.contributing_factors
    assert assessment1.risk_tier == RiskTier.LOW
    assert len(assessment1.contributing_factors) > 0


def test_revenue_at_risk_critical_tier():
    """Verify that severe failure indicators escalate risk to CRITICAL."""
    assessment = RevenueAtRiskDetector.assess_risk(
        payment_id="pay_test_critical",
        amount=12999.0,
        payment_rail=PaymentRail.UPI_AUTOPAY.value,
        native_retry_attempt=2,
        days_since_last_success=65,
        consecutive_failure_count=3,
        historical_success_rate=0.45,
        mandate_status=MandateStatus.REVOKED.value,
        customer_tenure_days=45,
    )

    assert assessment.risk_tier == RiskTier.CRITICAL
    assert assessment.risk_score >= 80.0
    assert assessment.is_immediate_action_needed is True
    # Verify auditable factors are present
    factor_text = " ".join(assessment.contributing_factors)
    assert "revoked" in factor_text.lower()
    assert "consecutive" in factor_text.lower()


def test_failure_diagnosis_insufficient_funds():
    """Verify soft funds error diagnosis."""
    res = FailureDiagnosisEngine.diagnose(
        payment_id="pay_soft_01",
        failure_code=FailureCode.INSUFFICIENT_FUNDS.value,
        error_source="customer",
        error_step="payment_authorization",
        payment_rail=PaymentRail.UPI_AUTOPAY.value,
        mandate_status=MandateStatus.ACTIVE.value,
        amount=999.0,
        native_retry_attempt=0,
    )

    assert res.failure_category == FailureCategory.SOFT_FUNDS
    assert res.recoverability_class == RecoverabilityClass.SOFT
    assert res.confidence >= 0.90
    assert ActionType.RETRY in res.allowed_actions
    assert res.recommended_recovery_window_hours == 24
    assert len(res.triggering_reasons) >= 2


def test_failure_diagnosis_hard_blocked_account():
    """Verify hard blocked account prevents automated retries."""
    res = FailureDiagnosisEngine.diagnose(
        payment_id="pay_hard_01",
        failure_code=FailureCode.BLOCKED_ACCOUNT.value,
        error_source="gateway",
        error_step="payment_authorization",
        payment_rail=PaymentRail.UPI_AUTOPAY.value,
        mandate_status=MandateStatus.ACTIVE.value,
        amount=4999.0,
        native_retry_attempt=0,
    )

    assert res.failure_category == FailureCategory.HARD_BLOCKED
    assert res.recoverability_class == RecoverabilityClass.HARD
    assert res.confidence >= 0.95
    # Strict rule: retry is strictly prohibited on blocked accounts
    assert ActionType.RETRY not in res.allowed_actions
    assert ActionType.HUMAN_ESCALATION in res.allowed_actions
    assert ActionType.STOP in res.allowed_actions


def test_failure_diagnosis_expired_mandate():
    """Verify expired mandate requires payment update request."""
    res = FailureDiagnosisEngine.diagnose(
        payment_id="pay_exp_01",
        failure_code=FailureCode.EXPIRED_MANDATE.value,
        error_source="business",
        error_step="payment_authorization",
        payment_rail=PaymentRail.CARD.value,
        mandate_status=MandateStatus.EXPIRED.value,
        amount=1499.0,
        native_retry_attempt=0,
    )

    assert res.failure_category == FailureCategory.CUSTOMER_ACTION_MANDATE
    assert res.recoverability_class == RecoverabilityClass.ACTION_REQUIRED
    assert ActionType.PAYMENT_UPDATE_REQUEST in res.allowed_actions
    assert ActionType.RETRY not in res.allowed_actions
