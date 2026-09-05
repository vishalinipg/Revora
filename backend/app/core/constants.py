"""Revora core constants, enums, and operational policies."""
from enum import Enum


class PaymentRail(str, Enum):
    UPI_AUTOPAY = "upi_autopay"
    CARD = "card"


class PaymentStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    RECOVERED = "recovered"


class FailureCode(str, Enum):
    INSUFFICIENT_FUNDS = "insufficient_funds"
    BANK_TIMEOUT = "bank_timeout"
    AUTHENTICATION_REQUIRED = "authentication_required"
    EXPIRED_MANDATE = "expired_mandate"
    BLOCKED_ACCOUNT = "blocked_account"
    UNKNOWN = "unknown"


class FailureSource(str, Enum):
    CUSTOMER = "customer"
    GATEWAY = "gateway"
    BUSINESS = "business"
    RAZORPAY = "razorpay"


class MandateStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    REVOKED = "revoked"
    EXPIRED = "expired"


class CustomerLanguage(str, Enum):
    EN = "en"
    TA_TANGLISH = "ta_tanglish"
    HI_HINGLISH = "hi_hinglish"
    UNKNOWN = "unknown"


class ActionType(str, Enum):
    RETRY = "retry"
    PAYMENT_UPDATE_REQUEST = "payment_update_request"
    HUMAN_ESCALATION = "human_escalation"
    STOP = "stop"


class ActionOutcome(str, Enum):
    PENDING = "pending"
    RECOVERED = "recovered"
    FAILED = "failed"
    UNRESOLVED = "unresolved"


class RiskTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EvaluationSplit(str, Enum):
    TRAIN = "train"
    VALIDATION = "validation"
    TEST = "test"


# ==============================================================================
# REVORA RECOVERY POLICY (v1)
# Note: These values are explicitly REVORA RECOVERY POLICY design assumptions,
# NOT Razorpay default settings or statutory rules. See docs/design-assumptions.md.
# ==============================================================================
MAX_RECOVERY_ATTEMPTS_PER_PAYMENT = 3  # [REVORA_POLICY] Max automated attempts per billing cycle
MIN_RETRY_COOLDOWN_HOURS = 24          # [REVORA_POLICY] Minimum cooldown between retries
MAX_AUTOMATED_ESCALATIONS = 1         # [REVORA_POLICY] Max automated support tickets
MAX_FAILED_RECOVERY_CYCLES = 3        # [REVORA_POLICY] Consecutive cycles before churn stop

# STATUTORY / POLICY ASSUMPTION
# [PROJECT_POLICY_ASSUMPTION / VERIFY_RBI_CIRCULAR]
# In Revora v1, ₹15,000 is adopted as the modeled e-mandate limit threshold per RBI circular
# RBI/2019-20/54. If disputed or unverified in specific merchant categories, it is treated as a policy parameter.
MAX_UPI_AUTOPAY_WITHOUT_AFA_INR = 15000.0
