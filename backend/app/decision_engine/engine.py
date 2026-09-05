"""Revora Decision Engine (revora_policy_v1).

The final operational authority for automated recovery interventions.
Combines Risk Assessment, Failure Diagnosis, Propensity-to-Pay ML signals,
and strict non-negotiable safety stopping rules into bounded, auditable decisions.

Precedence Hierarchy:
1. Hard Safety Constraints (Hard blocked account -> NEVER retry)
2. Recovery Stopping Rules (3 consecutive failed cycles -> STOP)
3. Mandate State Constraints (Expired/revoked mandate -> NEVER retry; update link preferred)
4. Recovery Attempt Budget & Cooldown (Max 3 attempts, 24h cooldown)
5. Escalation Limits (Max 1 automated escalation ticket)
6. Diagnosis & Rail Compatibility Constraints
7. Propensity & Value Signals
8. Bounded Action Selection (RETRY, PAYMENT_UPDATE_REQUEST, HUMAN_ESCALATION, STOP)
"""
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.app.core.constants import ActionType, MandateStatus
from backend.app.diagnosis.taxonomy import RecoverabilityClass, FailureCategory
from backend.app.decision_engine.policy import (
    REVORA_POLICY_VERSION,
    MAX_RECOVERY_ATTEMPTS_PER_PAYMENT,
    MIN_RETRY_COOLDOWN_HOURS,
    MAX_AUTOMATED_ESCALATIONS,
    MAX_FAILED_RECOVERY_CYCLES,
    HIGH_PROPENSITY_THRESHOLD,
    MEDIUM_PROPENSITY_THRESHOLD,
    PolicyEvaluationContext,
)


@dataclass(frozen=True)
class PolicyDecision:
    """Immutable, serializable decision result produced by RevoraDecisionEngine."""
    payment_id: str
    action: ActionType
    decision_reason: str
    policy_version: str
    diagnosis_category: str
    recoverability_class: str
    propensity_score: float
    propensity_confidence: float
    risk_tier: str
    policy_checks: Dict[str, bool]
    violated_constraints: List[str]
    decision_trace: List[str]
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for persistence in recovery_actions and audit_log."""
        data = asdict(self)
        data["action"] = self.action.value
        return data


class RevoraDecisionEngine:
    """Deterministic, policy-driven decision engine enforcing strict Revora recovery bounds."""

    @classmethod
    def evaluate(cls, ctx: PolicyEvaluationContext) -> PolicyDecision:
        """Evaluate context through the strict Revora precedence hierarchy."""
        trace: List[str] = []
        violated: List[str] = []
        checks: Dict[str, bool] = {
            "hard_failure": False,
            "mandate_valid": True,
            "failed_cycle_limit_reached": False,
            "retry_cap_reached": False,
            "cooldown_satisfied": True,
            "escalation_cap_reached": False,
        }

        total_attempts = ctx.native_retry_attempt + ctx.revora_recovery_attempts
        now_iso = datetime.utcnow().isoformat()

        trace.append(f"Initiating evaluation under {REVORA_POLICY_VERSION} for payment {ctx.payment_id}")
        trace.append(
            f"Input signals: rail={ctx.payment_rail}, diag={ctx.failure_category} ({ctx.recoverability_class}), "
            f"propensity={ctx.propensity_score:.2f}, risk={ctx.risk_tier}, "
            f"attempts={total_attempts}/{MAX_RECOVERY_ATTEMPTS_PER_PAYMENT}, "
            f"hours_since_last={ctx.hours_since_last_attempt:.1f}h"
        )

        # ======================================================================
        # PRECEDENCE 1: Hard Safety Constraints (Hard blocked account)
        # ======================================================================
        if (
            ctx.recoverability_class == RecoverabilityClass.HARD.value
            or ctx.failure_category == FailureCategory.HARD_BLOCKED.value
        ):
            checks["hard_failure"] = True
            violated.append("HARD_FAILURE_BLOCKED: Automated retry prohibited by payment network rules")
            trace.append("Precedence 1 triggered: Hard failure detected. RETRY is strictly prohibited.")

            if ctx.prior_escalations_count < MAX_AUTOMATED_ESCALATIONS:
                action = ActionType.HUMAN_ESCALATION
                reason = "Hard account block detected; automated retry prohibited; created human support ticket for manual compliance review."
            else:
                checks["escalation_cap_reached"] = True
                action = ActionType.STOP
                reason = "Hard account block detected; automated retry prohibited; escalation budget already exhausted; terminating automated recovery."

            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # ======================================================================
        # PRECEDENCE 2: Failed-Cycle Stopping Rule (Permanent Churn Rule)
        # ======================================================================
        if ctx.consecutive_failed_cycles >= MAX_FAILED_RECOVERY_CYCLES:
            checks["failed_cycle_limit_reached"] = True
            violated.append(f"CONSECUTIVE_CYCLE_LIMIT: {ctx.consecutive_failed_cycles} consecutive failed billing cycles")
            trace.append(f"Precedence 2 triggered: Consecutive failed cycle limit ({MAX_FAILED_RECOVERY_CYCLES}) reached.")
            action = ActionType.STOP
            reason = f"Account reached permanent churn stopping rule ({ctx.consecutive_failed_cycles} consecutive unrecovered billing cycles)."
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # ======================================================================
        # PRECEDENCE 3: Mandate State Constraints
        # ======================================================================
        if ctx.mandate_status in [MandateStatus.EXPIRED.value, MandateStatus.REVOKED.value]:
            checks["mandate_valid"] = False
            violated.append(f"MANDATE_INVALID: Mandate is in '{ctx.mandate_status}' status")
            trace.append("Precedence 3 triggered: Mandate invalid/expired. Automated retry prohibited.")

            if total_attempts >= MAX_RECOVERY_ATTEMPTS_PER_PAYMENT:
                checks["retry_cap_reached"] = True
                action = ActionType.STOP
                reason = f"Mandate is {ctx.mandate_status} and maximum recovery attempt budget is exhausted."
            else:
                action = ActionType.PAYMENT_UPDATE_REQUEST
                reason = f"Mandate is {ctx.mandate_status}; customer must re-authorize or provide an updated payment method."
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # ======================================================================
        # PRECEDENCE 4: Recovery Attempt Cap Check
        # ======================================================================
        if total_attempts >= MAX_RECOVERY_ATTEMPTS_PER_PAYMENT:
            checks["retry_cap_reached"] = True
            violated.append(f"RETRY_CAP_EXHAUSTED: Reached {total_attempts}/{MAX_RECOVERY_ATTEMPTS_PER_PAYMENT} total attempts")
            trace.append("Precedence 4 triggered: Automated retry cap exhausted. Further retries prohibited.")

            # Can we escalate or request payment update?
            if ctx.prior_escalations_count < MAX_AUTOMATED_ESCALATIONS and ctx.amount >= 3000.0:
                action = ActionType.HUMAN_ESCALATION
                reason = f"Automated retry budget exhausted ({total_attempts} attempts) on high-value payment (₹{ctx.amount:,.2f}); escalating to human operations."
            elif ctx.failure_category in [FailureCategory.CUSTOMER_ACTION_AUTH.value, FailureCategory.SOFT_FUNDS.value]:
                action = ActionType.PAYMENT_UPDATE_REQUEST
                reason = f"Automated retry budget exhausted ({total_attempts} attempts); requesting customer payment method update."
            else:
                action = ActionType.STOP
                reason = f"Automated retry budget exhausted ({total_attempts} attempts) without recovery; stopping recovery workflow."

            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # ======================================================================
        # PRECEDENCE 5: Cooldown Verification for Candidate Retries
        # ======================================================================
        cooldown_met = ctx.hours_since_last_attempt >= MIN_RETRY_COOLDOWN_HOURS
        if not cooldown_met and ctx.revora_recovery_attempts > 0:
            checks["cooldown_satisfied"] = False
            violated.append(f"COOLDOWN_ACTIVE: {ctx.hours_since_last_attempt:.1f}h elapsed since prior attempt < {MIN_RETRY_COOLDOWN_HOURS}h required")
            trace.append(f"Precedence 5 triggered: Mandatory 24h retry cooldown active ({ctx.hours_since_last_attempt:.1f}h elapsed).")

            # While cooldown is active, automated retry cannot proceed immediately
            if ctx.failure_category == FailureCategory.CUSTOMER_ACTION_AUTH.value:
                action = ActionType.PAYMENT_UPDATE_REQUEST
                reason = "Retry cooldown active; customer action request sent to authorize pending payment."
            else:
                action = ActionType.STOP
                reason = f"Automated retry paused: mandatory Revora cooldown active ({ctx.hours_since_last_attempt:.1f}h elapsed, 24h required)."
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # ======================================================================
        # PRECEDENCE 6 & 7: Diagnosis Taxonomy, Rail Capabilities & Propensity Signals
        # ======================================================================
        trace.append("Precedence 6 & 7: Evaluating diagnosis taxonomy against rail capabilities and ML propensity.")

        # Case A: Soft Funds Failure (insufficient_funds)
        if ctx.failure_category == FailureCategory.SOFT_FUNDS.value:
            if ctx.propensity_score >= HIGH_PROPENSITY_THRESHOLD:
                action = ActionType.RETRY
                reason = (
                    f"Soft funds failure + active mandate + high recovery propensity ({ctx.propensity_score:.2f}); "
                    f"scheduling smart retry with 24h cooldown under Revora Policy."
                )
            elif ctx.propensity_score >= MEDIUM_PROPENSITY_THRESHOLD:
                if ctx.amount > 5000.0:
                    action = ActionType.PAYMENT_UPDATE_REQUEST
                    reason = (
                        f"Soft funds failure with moderate propensity ({ctx.propensity_score:.2f}) on elevated amount "
                        f"(₹{ctx.amount:,.2f}); requesting customer method update or balance top-up."
                    )
                else:
                    action = ActionType.RETRY
                    reason = (
                        f"Soft funds failure with moderate propensity ({ctx.propensity_score:.2f}) on moderate amount; "
                        f"scheduling smart retry."
                    )
            else:
                # Low propensity (< 0.35) despite soft code
                action = ActionType.PAYMENT_UPDATE_REQUEST
                reason = (
                    f"Soft failure code reported, but ML propensity is low ({ctx.propensity_score:.2f}) due to "
                    f"degraded historical payment record; requesting payment method update rather than blind retry."
                )
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # Case B: Soft Network / Gateway Timeout
        if ctx.failure_category == FailureCategory.SOFT_NETWORK.value:
            action = ActionType.RETRY
            reason = (
                f"Transient bank/gateway timeout + active mandate on {ctx.payment_rail}; "
                f"scheduling retry after gateway recovery window."
            )
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # Case C: Customer Action Required (Authentication / OTP)
        if ctx.failure_category == FailureCategory.CUSTOMER_ACTION_AUTH.value:
            action = ActionType.PAYMENT_UPDATE_REQUEST
            reason = (
                "Customer authentication / AFA required; dispatching payment authorization link to customer."
            )
            return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

        # Case D: Ambiguous / Unknown Failure
        if ctx.prior_escalations_count < MAX_AUTOMATED_ESCALATIONS and ctx.amount >= 3000.0:
            action = ActionType.HUMAN_ESCALATION
            reason = f"Ambiguous failure code on elevated amount (₹{ctx.amount:,.2f}); routing to human operations for triage."
        else:
            action = ActionType.PAYMENT_UPDATE_REQUEST
            reason = "Ambiguous failure telemetry; requesting customer verify and update recurring payment method."

        return cls._build_decision(ctx, action, reason, checks, violated, trace, now_iso)

    @staticmethod
    def _build_decision(
        ctx: PolicyEvaluationContext,
        action: ActionType,
        reason: str,
        checks: Dict[str, bool],
        violated: List[str],
        trace: List[str],
        created_at: str,
    ) -> PolicyDecision:
        """Construct the standardized PolicyDecision object."""
        trace.append(f"Final bounded action selected: {action.value}")
        return PolicyDecision(
            payment_id=ctx.payment_id,
            action=action,
            decision_reason=reason,
            policy_version=REVORA_POLICY_VERSION,
            diagnosis_category=ctx.failure_category,
            recoverability_class=ctx.recoverability_class,
            propensity_score=ctx.propensity_score,
            propensity_confidence=ctx.propensity_confidence,
            risk_tier=ctx.risk_tier,
            policy_checks=checks,
            violated_constraints=violated,
            decision_trace=trace,
            created_at=created_at,
        )
