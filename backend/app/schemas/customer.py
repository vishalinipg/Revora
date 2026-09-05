"""Customer Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.app.core.constants import CustomerLanguage


class CustomerBase(BaseModel):
    name: str
    preferred_language: CustomerLanguage = CustomerLanguage.UNKNOWN
    region: str
    subscription_plan: str
    signup_date: datetime
    customer_tenure_days: int = 0


class CustomerCreate(CustomerBase):
    customer_id: str


class CustomerRead(CustomerBase):
    customer_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
