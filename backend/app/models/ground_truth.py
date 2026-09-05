"""Payment Ground Truth model — TIER 2 (Hidden Cause) & TIER 3 (Hidden Oracle).

CRITICAL ARCHITECTURAL BOUNDARY:
This table is strictly isolated from the operational decision pipeline.
The ML model, detection engine, decision policy, and language layer MUST NEVER
read or depend on fields in this table. It is accessed strictly by:
1. The outcome simulator to determine whether a simulated action recovers funds.
2. The evaluation engine to compute decision regret against the latent oracle.
"""
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class PaymentGroundTruth(Base):
    """Hidden ground-truth table for evaluation and simulation oracle."""
    __tablename__ = "payment_ground_truth"

    payment_id = Column(String(64), ForeignKey("payments.payment_id"), primary_key=True, index=True)
    
    # Tier 2: Hidden True Failure Cause (unobserved latent reality)
    # Examples: temporary_salary_delay, temporary_bank_outage, auth_otp_missed,
    # mandate_token_expired, permanent_account_closure, voluntary_churn_intent
    true_failure_cause = Column(String(64), nullable=False)
    
    # Tier 3: Hidden Recovery Likelihood / Latent Propensity (0.0 to 1.0)
    # Latent probability that an optimal intervention will recover the payment.
    # Subject to stochastic noise so it cannot be memorized as a deterministic function.
    ground_truth_recoverability = Column(Float, nullable=False)
    
    # Latent Oracle: The statistically optimal action under ground truth
    # Used solely to compute decision regret during evaluation.
    optimal_recovery_action = Column(String(32), nullable=False)
    
    # Partition split for train/validation/held-out test
    evaluation_split = Column(String(16), nullable=False, index=True)  # train, validation, test
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationship back to payment
    payment = relationship("Payment", back_populates="ground_truth")

    def __repr__(self) -> str:
        return f"<PaymentGroundTruth(payment_id={self.payment_id}, true_cause={self.true_failure_cause}, oracle={self.optimal_recovery_action})>"
