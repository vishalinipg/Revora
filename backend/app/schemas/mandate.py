"""Mandate Pydantic schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from backend.app.core.constants import PaymentRail, MandateStatus


class MandateBase(BaseModel):
    customer_id: str
    payment_method: PaymentRail
    mandate_status: MandateStatus = MandateStatus.ACTIVE
    last_successful_charge_date: Optional[datetime] = None
    max_amount_per_debit: float = 15000.0
    authentication_required: bool = False
    mandate_age_days: int = 0


class MandateCreate(MandateBase):
    mandate_id: str


class MandateRead(MandateBase):
    mandate_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
