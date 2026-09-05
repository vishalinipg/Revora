"""Payment Pydantic schemas — STRICTLY OPERATIONAL / TIER 1 OBSERVED SIGNALS.

Notice: This schema strictly excludes any ground-truth fields, hidden recovery likelihood,
or post-intervention outcomes to prevent data leakage in production APIs.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from backend.app.core.constants import PaymentStatus, FailureCode, FailureSource, PaymentRail


class PaymentBase(BaseModel):
    customer_id: str
    mandate_id: str
    amount: float = Field(..., gt=0.0, description="Payment amount in INR (must be positive)")
    currency: str = Field(default="INR", max_length=8)
    due_date: datetime
    payment_attempt_date: datetime
    status: PaymentStatus
    failure_code: Optional[FailureCode] = None
    error_source: Optional[FailureSource] = None
    error_step: Optional[str] = None
    payment_rail: PaymentRail
    native_retry_attempt: int = Field(default=0, ge=0)
    days_since_last_success: int = Field(default=0, ge=0)
    historical_cycle_count: int = Field(default=1, ge=1)
    historical_success_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    consecutive_failure_count: int = Field(default=1, ge=0)


class PaymentCreate(PaymentBase):
    payment_id: str


class PaymentRead(PaymentBase):
    payment_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
