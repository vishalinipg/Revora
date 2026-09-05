"""Taxonomy and data structures for Failure Diagnosis Engine."""
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from backend.app.core.constants import ActionType


class FailureCategory(str, Enum):
    SOFT_FUNDS = "soft_funds"                    # Temporary lack of funds, salary delay
    SOFT_NETWORK = "soft_network"                # Transient bank or gateway timeout
    CUSTOMER_ACTION_AUTH = "action_required_auth" # OTP/AFA missed or customer auth required
    CUSTOMER_ACTION_MANDATE = "action_required_mandate" # Expired or invalid mandate token
    HARD_BLOCKED = "hard_blocked"                # Frozen account, blocked account, fraud stop
    UNKNOWN_AMBIGUOUS = "unknown_ambiguous"      # Ambiguous failure requiring triage


class RecoverabilityClass(str, Enum):
    SOFT = "soft"                      # High automated retry suitability
    ACTION_REQUIRED = "action_required"# Requires customer interaction (update link, auth)
    HARD = "hard"                      # Unrecoverable via automated retry
    AMBIGUOUS = "ambiguous"            # Needs investigation or escalation


@dataclass(frozen=True)
class DiagnosisResult:
    payment_id: str
    failure_category: FailureCategory
    recoverability_class: RecoverabilityClass
    confidence: float                  # 0.0 to 1.0
    triggering_reasons: List[str]      # Exact observed fields responsible
    allowed_actions: List[ActionType]  # Actions permitted by this diagnosis and payment rail
    recommended_recovery_window_hours: Optional[int] # e.g. 24h for soft funds
