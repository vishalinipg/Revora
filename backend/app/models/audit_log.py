"""Audit Log SQLAlchemy model."""
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from backend.app.database import Base


class AuditLog(Base):
    """Immutable audit trail of all lifecycle events, evaluations, and decisions."""
    __tablename__ = "audit_log"

    log_id = Column(String(64), primary_key=True, index=True)
    entity_type = Column(String(32), nullable=False, index=True)  # payment, recovery_action, etc.
    entity_id = Column(String(64), nullable=False, index=True)
    event = Column(String(64), nullable=False)  # payment_failed, risk_detected, action_decided, etc.
    payload_snapshot = Column(Text, nullable=False)  # JSON-encoded snapshot of state
    actor = Column(String(64), nullable=False)  # rule_engine, ml_model, simulator, operator
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.log_id}, entity={self.entity_type}:{self.entity_id}, event={self.event})>"
