"""Customer SQLAlchemy model."""
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Customer(Base):
    """Customer entity holding profile and communication preferences."""
    __tablename__ = "customers"

    customer_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    # Explicit language preference: en, ta_tanglish, hi_hinglish, unknown
    preferred_language = Column(String(32), nullable=False, default="unknown")
    # Region is metadata ONLY; never used to infer language
    region = Column(String(64), nullable=False)
    subscription_plan = Column(String(64), nullable=False)
    signup_date = Column(DateTime, nullable=False)
    customer_tenure_days = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    mandates = relationship("Mandate", back_populates="customer", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Customer(id={self.customer_id}, lang={self.preferred_language}, plan={self.subscription_plan})>"
