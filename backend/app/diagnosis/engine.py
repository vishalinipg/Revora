"""Deterministic Failure Diagnosis Engine.

Maps observed Razorpay/provider signals into structured failure categories,
recoverability classes, and rail-compatible allowed actions.
Architectural Guarantee: 100% deterministic code. Zero LLM involvement.
Every diagnosis returns an auditable evidence list of triggering reasons.
"""
from typing import Optional
from backend.app.core.constants import FailureCode, FailureSource, MandateStatus, PaymentRail, ActionType
from backend.app.diagnosis.taxonomy import FailureCategory, RecoverabilityClass, DiagnosisResult


class FailureDiagnosisEngine:
    """Deterministic rule-based diagnosis engine evaluating Tier 1 observed signals."""

    @classmethod
    def diagnose(
        cls,
        payment_id: str,
        failure_code: Optional[str],
        error_source: Optional[str],
        error_step: Optional[str],
        payment_rail: str,
        mandate_status: str,
        amount: float,
        native_retry_attempt: int = 0,
    ) -> DiagnosisResult:
        """Diagnose failure cause and assign rail-compatible allowed actions."""
        reasons = []

        # 1. Check for Mandate Invalidation first (overrides transient codes)
        if mandate_status in [MandateStatus.EXPIRED.value, MandateStatus.REVOKED.value]:
            reasons.append(f"Mandate status is '{mandate_status}' on rail '{payment_rail}'")
            if failure_code:
                reasons.append(f"Provider reported failure code '{failure_code}'")
            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.CUSTOMER_ACTION_MANDATE,
                recoverability_class=RecoverabilityClass.ACTION_REQUIRED,
                confidence=0.98,
                triggering_reasons=reasons,
                allowed_actions=[ActionType.PAYMENT_UPDATE_REQUEST, ActionType.STOP],
                recommended_recovery_window_hours=None,
            )

        # 2. Hard Failure: Blocked Account
        if failure_code == FailureCode.BLOCKED_ACCOUNT.value:
            reasons.append("Provider error code is 'blocked_account'")
            reasons.append(f"Error source is '{error_source or 'gateway'}' (bank-level account lock)")
            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.HARD_BLOCKED,
                recoverability_class=RecoverabilityClass.HARD,
                confidence=0.99,
                triggering_reasons=reasons,
                # Retrying a blocked account is prohibited by payment network rules
                allowed_actions=[ActionType.HUMAN_ESCALATION, ActionType.STOP],
                recommended_recovery_window_hours=None,
            )

        # 3. Soft Failure: Insufficient Funds
        if failure_code == FailureCode.INSUFFICIENT_FUNDS.value:
            reasons.append("Provider error code is 'insufficient_funds'")
            reasons.append(f"Error source is '{error_source or 'customer'}'")
            reasons.append(f"Mandate status is active on '{payment_rail}'")
            
            # Allowed actions depend on retry exhaustion
            if native_retry_attempt >= 3:
                allowed = [ActionType.PAYMENT_UPDATE_REQUEST, ActionType.STOP]
                reasons.append(f"Retry budget exhausted ({native_retry_attempt} attempts)")
            else:
                allowed = [ActionType.RETRY, ActionType.PAYMENT_UPDATE_REQUEST, ActionType.STOP]
                
            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.SOFT_FUNDS,
                recoverability_class=RecoverabilityClass.SOFT,
                confidence=0.94,
                triggering_reasons=reasons,
                allowed_actions=allowed,
                recommended_recovery_window_hours=24,  # Standard Revora 24h cooldown policy
            )

        # 4. Soft Failure: Bank / Gateway Timeout
        if failure_code == FailureCode.BANK_TIMEOUT.value or error_source == FailureSource.GATEWAY.value:
            reasons.append("Provider error code is 'bank_timeout' or gateway downtime")
            reasons.append(f"Error source reported as '{error_source}'")
            reasons.append(f"Mandate status is '{mandate_status}' on '{payment_rail}'")
            
            if native_retry_attempt >= 3:
                allowed = [ActionType.HUMAN_ESCALATION, ActionType.STOP]
            else:
                allowed = [ActionType.RETRY, ActionType.STOP]

            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.SOFT_NETWORK,
                recoverability_class=RecoverabilityClass.SOFT,
                confidence=0.92,
                triggering_reasons=reasons,
                allowed_actions=allowed,
                recommended_recovery_window_hours=24,
            )

        # 5. Customer Action: Authentication / OTP Required
        if failure_code == FailureCode.AUTHENTICATION_REQUIRED.value or error_step == "payment_authentication":
            reasons.append("Provider error code is 'authentication_required' or authentication step failed")
            reasons.append("Customer missed AFA (OTP or UPI PIN authorization)")
            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.CUSTOMER_ACTION_AUTH,
                recoverability_class=RecoverabilityClass.ACTION_REQUIRED,
                confidence=0.91,
                triggering_reasons=reasons,
                allowed_actions=[ActionType.PAYMENT_UPDATE_REQUEST, ActionType.RETRY, ActionType.STOP],
                recommended_recovery_window_hours=12,
            )

        # 6. Customer Action: Expired Mandate
        if failure_code == FailureCode.EXPIRED_MANDATE.value:
            reasons.append("Provider error code is 'expired_mandate'")
            return DiagnosisResult(
                payment_id=payment_id,
                failure_category=FailureCategory.CUSTOMER_ACTION_MANDATE,
                recoverability_class=RecoverabilityClass.ACTION_REQUIRED,
                confidence=0.96,
                triggering_reasons=reasons,
                allowed_actions=[ActionType.PAYMENT_UPDATE_REQUEST, ActionType.STOP],
                recommended_recovery_window_hours=None,
            )

        # 7. Fallback: Unknown or Ambiguous Failure
        reasons.append(f"Provider reported unclassified code '{failure_code or 'UNKNOWN'}'")
        reasons.append(f"Error step: '{error_step or 'unknown'}', source: '{error_source or 'unknown'}'")
        return DiagnosisResult(
            payment_id=payment_id,
            failure_category=FailureCategory.UNKNOWN_AMBIGUOUS,
            recoverability_class=RecoverabilityClass.AMBIGUOUS,
            confidence=0.65,
            triggering_reasons=reasons,
            allowed_actions=[ActionType.HUMAN_ESCALATION, ActionType.PAYMENT_UPDATE_REQUEST, ActionType.STOP],
            recommended_recovery_window_hours=None,
        )
