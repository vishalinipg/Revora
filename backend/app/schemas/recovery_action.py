"""Recovery Action Pydantic schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from backend.app.core.constants import ActionType, ActionOutcome


class RecoveryActionBase(BaseModel):
    payment_id: str
    action_type: ActionType
    decided_by: str
    decision_reason: str
    is_revora_policy: bool = True
    policy_version: str = "v1.0"
    scheduled_at: datetime
    executed_at: Optional[datetime] = None
    outcome: ActionOutcome = ActionOutcome.PENDING
    recovered_amount: float = Field(default=0.0, ge=0.0)
    language_used: Optional[str] = None
    message_sent: Optional[str] = None
    fallback_template_used: bool = False


class RecoveryActionCreate(RecoveryActionBase):
    action_id: str


class RecoveryActionRead(RecoveryActionBase):
    action_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
