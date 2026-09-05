"""Payment SQLAlchemy model — STRICTLY TIER 1 (Observed Provider Signals).

This entity contains ONLY observed operational payment signals from Razorpay webhooks
or synthetic provider inputs. It strictly excludes hidden ground truth, latent
recovery probability, or future post-intervention outcomes.
"""
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Payment(Base):
    """Operational recurring payment event (Tier 1 Observed Signals)."""
    __tablename__ = "payments"

    payment_id = Column(String(64), primary_key=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.customer_id"), nullable=False, index=True)
    mandate_id = Column(String(64), ForeignKey("mandates.mandate_id"), nullable=False, index=True)
    
    # Financial fields
    amount = Column(Float, nullable=False)  # Stored in INR; must be > 0
    currency = Column(String(8), nullable=False, default="INR")
    
    # Temporal fields
    due_date = Column(DateTime, nullable=False)
    payment_attempt_date = Column(DateTime, nullable=False)
    
    # Lifecycle & status
    status = Column(String(32), nullable=False, index=True)  # failed, success, pending, recovered
    failure_code = Column(String(64), nullable=True, index=True)  # insufficient_funds, bank_timeout, etc.
    error_source = Column(String(32), nullable=True)  # customer, gateway, business, razorpay
    error_step = Column(String(64), nullable=True)    # payment_authorization, etc.
    payment_rail = Column(String(32), nullable=False, index=True)  # upi_autopay or card
    
    # Behavioral & attempt tracking (observed prior to recovery intervention)
    native_retry_attempt = Column(Integer, nullable=False, default=0)
    days_since_last_success = Column(Integer, nullable=False, default=0)
    historical_cycle_count = Column(Integer, nullable=False, default=1)
    historical_success_rate = Column(Float, nullable=False, default=1.0)
    consecutive_failure_count = Column(Integer, nullable=False, default=1)
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="payments")
    mandate = relationship("Mandate", back_populates="payments")
    recovery_actions = relationship("RecoveryAction", back_populates="payment", cascade="all, delete-orphan")
    
    # Hidden ground-truth is accessible strictly through the evaluation entity
    ground_truth = relationship("PaymentGroundTruth", back_populates="payment", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Payment(id={self.payment_id}, amount={self.amount}, status={self.status}, rail={self.payment_rail})>"
