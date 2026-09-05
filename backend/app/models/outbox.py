"""Outbox Message SQLAlchemy model — SIMULATED RECOVERY COMMUNICATIONS.

MOCK OUTBOX WATERMARK:
All messages stored in this entity are explicitly simulated.
Under NO circumstances does Revora send real WhatsApp, SMS, or Voice communications.
"""
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class OutboxMessage(Base):
    """Simulated customer outreach message."""
    __tablename__ = "outbox_messages"

    outbox_id = Column(String(64), primary_key=True, index=True)
    payment_id = Column(String(64), ForeignKey("payments.payment_id"), nullable=False, index=True)
    customer_id = Column(String(64), ForeignKey("customers.customer_id"), nullable=False, index=True)
    
    # Communication metadata
    channel = Column(String(32), nullable=False, default="whatsapp_simulated")  # whatsapp_simulated, sms_simulated
    language_used = Column(String(32), nullable=False)                         # en, ta_tanglish, hi_hinglish
    message_body = Column(Text, nullable=False)
    
    # Simulation flags & watermark
    is_simulation = Column(Boolean, nullable=False, default=True)
    simulation_disclaimer = Column(String(128), nullable=False, default="SIMULATED — NO MESSAGE SENT")
    
    # Status tracking (simulated lifecycle)
    status = Column(String(32), nullable=False, default="simulated_scheduled")  # simulated_scheduled, simulated_sent, simulated_delivered, simulated_failed
    trigger_action = Column(String(32), nullable=False)                         # retry, payment_update_request
    
    # Originating audit linkage
    policy_version = Column(String(32), nullable=False, default="revora_policy_v1")
    model_version = Column(String(64), nullable=False, default="revora_propensity_logreg_v1")
    fallback_template_used = Column(Boolean, nullable=False, default=True)
    
    scheduled_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    payment = relationship("Payment")
    customer = relationship("Customer")

    def __repr__(self) -> str:
        return f"<OutboxMessage(id={self.outbox_id}, lang={self.language_used}, action={self.trigger_action}, status={self.status})>"
