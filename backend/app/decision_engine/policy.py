"""Revora Recovery Policy Definitions & Constants (revora_policy_v1).

Note on Ownership & Semantics:
All constants in this file represent REVORA RECOVERY POLICY rules.
They are NOT Razorpay default settings and NOT statutory mandates.
They govern Revora's bounded, automated recovery intelligence.
"""
from dataclasses import dataclass
from typing import Dict, Any


REVORA_POLICY_VERSION = "revora_policy_v1"

# Operational bounds (Revora Recovery Policy v1)
MAX_RECOVERY_ATTEMPTS_PER_PAYMENT: int = 3   # [REVORA_POLICY] Hard cap on automated retries per payment cycle
MIN_RETRY_COOLDOWN_HOURS: int = 24           # [REVORA_POLICY] Mandatory cooldown between automated retries
MAX_AUTOMATED_ESCALATIONS: int = 1          # [REVORA_POLICY] Hard cap on human escalation tickets per cycle
MAX_FAILED_RECOVERY_CYCLES: int = 3         # [REVORA_POLICY] Consecutive failed cycles before permanent churn stop

# Propensity interpretation thresholds (derived from validation split calibration)
HIGH_PROPENSITY_THRESHOLD: float = 0.65     # Favorable recovery likelihood under appropriate intervention
MEDIUM_PROPENSITY_THRESHOLD: float = 0.35   # Indeterminate / moderate likelihood requiring conservative action

# Statutory / Policy Assumption
# [PROJECT_POLICY_ASSUMPTION / VERIFY_RBI_CIRCULAR]
MAX_UPI_AUTOPAY_WITHOUT_AFA_INR: float = 15000.0


@dataclass(frozen=True)
class PolicyEvaluationContext:
    """Inputs required for a deterministic policy decision."""
    payment_id: str
    amount: float
    payment_rail: str
    mandate_status: str
    failure_category: str
    recoverability_class: str
    propensity_score: float
    propensity_confidence: float
    risk_tier: str
    native_retry_attempt: int
    revora_recovery_attempts: int
    hours_since_last_attempt: float
    prior_escalations_count: int
    consecutive_failed_cycles: int
