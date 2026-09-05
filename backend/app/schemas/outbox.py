"""Outbox Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class OutboxMessageBase(BaseModel):
    payment_id: str
    customer_id: str
    channel: str = "whatsapp_simulated"
    language_used: str
    message_body: str
    is_simulation: bool = True
    simulation_disclaimer: str = "SIMULATED — NO MESSAGE SENT"
    status: str = "simulated_scheduled"
    trigger_action: str
    policy_version: str = "revora_policy_v1"
    model_version: str = "revora_propensity_logreg_v1"
    fallback_template_used: bool = True
    scheduled_at: datetime

    model_config = ConfigDict(protected_namespaces=())


class OutboxMessageCreate(OutboxMessageBase):
    outbox_id: str


class OutboxMessageRead(OutboxMessageBase):
    outbox_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
