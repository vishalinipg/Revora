"""Mandate SQLAlchemy model."""
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Mandate(Base):
    """Recurring payment mandate entity (UPI AutoPay or Card)."""
    __tablename__ = "mandates"

    mandate_id = Column(String(64), primary_key=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.customer_id"), nullable=False, index=True)
    # Payment rail: upi_autopay or card
    payment_method = Column(String(32), nullable=False)
    # Status: active, pending, revoked, expired
    mandate_status = Column(String(32), nullable=False, default="active")
    last_successful_charge_date = Column(DateTime, nullable=True)
    max_amount_per_debit = Column(Float, nullable=False, default=15000.0)
    authentication_required = Column(Boolean, nullable=False, default=False)
    mandate_age_days = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="mandates")
    payments = relationship("Payment", back_populates="mandate")

    def __repr__(self) -> str:
        return f"<Mandate(id={self.mandate_id}, method={self.payment_method}, status={self.mandate_status})>"
