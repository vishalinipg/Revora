"""Revenue-at-Risk Detector.

Evaluates observed Tier 1 provider and customer signals to assign an operational
Risk Score (0–100) and actionable Risk Tier (LOW, MEDIUM, HIGH, CRITICAL).
Provides an auditable trace of exact signals contributing to the risk level.
"""
from dataclasses import dataclass
from typing import List
from backend.app.core.constants import RiskTier, MandateStatus, PaymentRail


@dataclass(frozen=True)
class RiskAssessment:
    payment_id: str
    risk_score: float               # 0.0 to 100.0
    risk_tier: RiskTier            # LOW, MEDIUM, HIGH, CRITICAL
    contributing_factors: List[str] # Auditable trace of signals
    is_immediate_action_needed: bool


class RevenueAtRiskDetector:
    """Deterministic Revenue-at-Risk Detector operating strictly on Tier 1 signals."""

    @staticmethod
    def assess_risk(
        payment_id: str,
        amount: float,
        payment_rail: str,
        native_retry_attempt: int,
        days_since_last_success: int,
        consecutive_failure_count: int,
        historical_success_rate: float,
        mandate_status: str,
        customer_tenure_days: int,
    ) -> RiskAssessment:
        """Compute auditable risk assessment based strictly on observed signals.

        Base scale:
        0-29: LOW (minor glitch, high customer equity)
        30-59: MEDIUM (concerning signal, active mandate)
        60-79: HIGH (degraded history, multiple failures)
        80-100: CRITICAL (exhausted retries, revoked mandate, large financial exposure)
        """
        score = 0.0
        factors: List[str] = []

        # 1. Consecutive Failures Impact
        if consecutive_failure_count >= 3:
            score += 35.0
            factors.append(f"Severe failure streak: {consecutive_failure_count} consecutive failed cycles (+35)")
        elif consecutive_failure_count == 2:
            score += 20.0
            factors.append("Repeat failure: 2 consecutive failed cycles (+20)")
        elif consecutive_failure_count == 1:
            score += 5.0
            factors.append("First observed failure cycle (+5)")

        # 2. Native Retry Attempt Exhaustion
        if native_retry_attempt >= 2:
            score += 25.0
            factors.append(f"Native gateway retry budget exhausted: attempt {native_retry_attempt} (+25)")
        elif native_retry_attempt == 1:
            score += 10.0
            factors.append("Gateway native retry already attempted once (+10)")

        # 3. Mandate State Impairment
        if mandate_status == MandateStatus.REVOKED.value:
            score += 35.0
            factors.append("Mandate revoked by customer or bank (+35)")
        elif mandate_status == MandateStatus.EXPIRED.value:
            score += 25.0
            factors.append("Mandate or token expired (+25)")
        elif mandate_status == MandateStatus.PENDING.value:
            score += 15.0
            factors.append("Mandate in pending activation state (+15)")
        elif mandate_status == MandateStatus.ACTIVE.value:
            score -= 10.0
            factors.append("Mandate remains fully active (-10)")

        # 4. Historical Customer Reliability
        if historical_success_rate < 0.60:
            score += 20.0
            factors.append(f"Low historical payment success rate: {historical_success_rate:.1%} (+20)")
        elif historical_success_rate > 0.90:
            score -= 15.0
            factors.append(f"Strong historical reliability: {historical_success_rate:.1%} (-15)")

        # 5. Financial Exposure & Stale Relationship
        if amount >= 5000.0:
            score += 15.0
            factors.append(f"Elevated ticket size exposure: ₹{amount:,.2f} (+15)")
        
        if days_since_last_success > 45:
            score += 10.0
            factors.append(f"Extended dormancy: {days_since_last_success} days since last successful charge (+10)")
        elif days_since_last_success <= 30:
            score -= 5.0
            factors.append("Recent successful payment within last 30 days (-5)")

        # Clamp score between 0.0 and 100.0
        final_score = round(max(0.0, min(100.0, score)), 2)

        # Map to Risk Tier
        if final_score >= 80.0:
            tier = RiskTier.CRITICAL
            immediate_action = True
        elif final_score >= 60.0:
            tier = RiskTier.HIGH
            immediate_action = True
        elif final_score >= 30.0:
            tier = RiskTier.MEDIUM
            immediate_action = False
        else:
            tier = RiskTier.LOW
            immediate_action = False

        return RiskAssessment(
            payment_id=payment_id,
            risk_score=final_score,
            risk_tier=tier,
            contributing_factors=factors,
            is_immediate_action_needed=immediate_action,
        )
