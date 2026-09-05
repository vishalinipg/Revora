"""Fixed-Policy Baseline Strategy.

A static, non-adaptive retry benchmark simulating standard recurring billing vendor defaults.
Policy Rules:
- Blindly retries every failed recurring payment.
- Ignores failure diagnosis (treats soft, hard, and action-required identically).
- Ignores ML propensity scores.
- Re-attempts up to 3 times at 24h intervals.
- If all 3 retries fail, permanently stops.
- Never initiates payment-method update links or human escalations.
"""
from dataclasses import dataclass
from backend.app.core.constants import ActionType


@dataclass(frozen=True)
class BaselineDecision:
    payment_id: str
    action: ActionType
    decision_reason: str
    attempt_number: int


class FixedPolicyBaseline:
    """Non-adaptive fixed-policy benchmark for recurring payment recovery."""

    MAX_BASELINE_RETRIES = 3

    @classmethod
    def decide(cls, payment_id: str, current_attempts: int) -> BaselineDecision:
        """Determine next action under static fixed-retry policy."""
        if current_attempts < cls.MAX_BASELINE_RETRIES:
            return BaselineDecision(
                payment_id=payment_id,
                action=ActionType.RETRY,
                decision_reason=f"Fixed-policy: standard blind retry attempt {current_attempts + 1}/{cls.MAX_BASELINE_RETRIES}.",
                attempt_number=current_attempts + 1,
            )
        else:
            return BaselineDecision(
                payment_id=payment_id,
                action=ActionType.STOP,
                decision_reason=f"Fixed-policy: all {cls.MAX_BASELINE_RETRIES} blind retry attempts exhausted.",
                attempt_number=current_attempts,
            )
