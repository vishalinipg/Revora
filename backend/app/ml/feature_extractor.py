"""ML Feature Extractor — STRICTLY TIER 1 OBSERVED SIGNALS.

Extracts operational feature vectors from Payment, Customer, and Mandate entities.
Architectural Guarantee: Ingests ONLY observed provider signals. Rejects any attempt
to feed ground truth or post-intervention outcome variables.
"""
from typing import Dict, Any, List, Tuple
import numpy as np


FEATURE_NAMES = [
    "amount",                      # Payment amount in INR
    "is_upi_autopay",              # 1 if upi_autopay else 0 (card)
    "native_retry_attempt",        # Count of provider retries already attempted (0, 1, 2)
    "days_since_last_success",     # Stale relationship indicator
    "historical_cycle_count",      # Number of past billing cycles
    "historical_success_rate",     # Ratio of successful past payments [0.0, 1.0]
    "consecutive_failure_count",   # Consecutive failures leading to this event
    "customer_tenure_days",        # Customer account age in days
    "mandate_age_days",            # Mandate registration age in days
    "mandate_is_active",           # 1 if mandate_status == 'active' else 0
    "mandate_is_expired_or_revoked", # 1 if expired/revoked else 0
    "failure_is_soft_funds",       # 1 if failure_code == 'insufficient_funds' else 0
    "failure_is_soft_timeout",     # 1 if failure_code == 'bank_timeout' else 0
    "failure_is_auth_required",    # 1 if failure_code == 'authentication_required' else 0
    "failure_is_hard_blocked",     # 1 if failure_code == 'blocked_account' else 0
]


class FeatureExtractor:
    """Extracts standardized feature vectors from Tier 1 observed records."""

    FORBIDDEN_KEYS = {
        "true_failure_cause",
        "ground_truth_recoverability",
        "optimal_recovery_action",
        "recovered_amount",
        "realized_outcome",
    }

    @classmethod
    def extract_features_from_dict(cls, record: Dict[str, Any]) -> np.ndarray:
        """Extract features from dictionary representation with leakage check."""
        # Active runtime assertion against data leakage
        for forbidden in cls.FORBIDDEN_KEYS:
            if forbidden in record and record[forbidden] is not None:
                raise ValueError(
                    f"CRITICAL DATA LEAKAGE ATTEMPT: Ground-truth field '{forbidden}' "
                    f"was present in feature extraction input!"
                )

        features = [
            float(record.get("amount", 0.0)),
            1.0 if record.get("payment_rail") == "upi_autopay" else 0.0,
            float(record.get("native_retry_attempt", 0)),
            float(record.get("days_since_last_success", 0)),
            float(record.get("historical_cycle_count", 1)),
            float(record.get("historical_success_rate", 1.0)),
            float(record.get("consecutive_failure_count", 1)),
            float(record.get("customer_tenure_days", 0)),
            float(record.get("mandate_age_days", 0)),
            1.0 if record.get("mandate_status") == "active" else 0.0,
            1.0 if record.get("mandate_status") in ["expired", "revoked"] else 0.0,
            1.0 if record.get("failure_code") == "insufficient_funds" else 0.0,
            1.0 if record.get("failure_code") == "bank_timeout" else 0.0,
            1.0 if record.get("failure_code") == "authentication_required" else 0.0,
            1.0 if record.get("failure_code") == "blocked_account" else 0.0,
        ]
        return np.array(features, dtype=np.float32)

    @classmethod
    def extract_from_orm(cls, payment, customer=None, mandate=None) -> np.ndarray:
        """Extract features from SQLAlchemy ORM entities."""
        cust = customer or payment.customer
        mand = mandate or payment.mandate

        record = {
            "amount": payment.amount,
            "payment_rail": payment.payment_rail,
            "native_retry_attempt": payment.native_retry_attempt,
            "days_since_last_success": payment.days_since_last_success,
            "historical_cycle_count": payment.historical_cycle_count,
            "historical_success_rate": payment.historical_success_rate,
            "consecutive_failure_count": payment.consecutive_failure_count,
            "customer_tenure_days": cust.customer_tenure_days if cust else 0,
            "mandate_age_days": mand.mandate_age_days if mand else 0,
            "mandate_status": mand.mandate_status if mand else "active",
            "failure_code": payment.failure_code,
        }
        return cls.extract_features_from_dict(record)
