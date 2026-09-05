"""Recovery Action SQLAlchemy model — TIER 4 (Decisions & Realized Outcomes)."""
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class RecoveryAction(Base):
    """Intervention decision and realized outcome (Tier 4)."""
    __tablename__ = "recovery_actions"

    action_id = Column(String(64), primary_key=True, index=True)
    payment_id = Column(String(64), ForeignKey("payments.payment_id"), nullable=False, index=True)
    
    # Decision details
    action_type = Column(String(32), nullable=False)  # retry, payment_update_request, human_escalation, stop
    decided_by = Column(String(64), nullable=False)   # e.g., "revora_policy_v1", "fixed_baseline"
    decision_reason = Column(String(256), nullable=False)
    is_revora_policy = Column(Boolean, nullable=False, default=True)
    policy_version = Column(String(32), nullable=False, default="v1.0")
    
    # Timestamps
    scheduled_at = Column(DateTime, nullable=False)
    executed_at = Column(DateTime, nullable=True)
    
    # Tier 4 Realized Simulated Outcome
    outcome = Column(String(32), nullable=False, default="pending")  # pending, recovered, failed, unresolved
    recovered_amount = Column(Float, nullable=False, default=0.0)
    
    # Communication details (simulated)
    language_used = Column(String(32), nullable=True)
    message_sent = Column(String(1024), nullable=True)
    fallback_template_used = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    payment = relationship("Payment", back_populates="recovery_actions")

    def __repr__(self) -> str:
        return f"<RecoveryAction(id={self.action_id}, type={self.action_type}, outcome={self.outcome})>"
