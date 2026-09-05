"""Evaluation-Only Pydantic schemas — GROUND TRUTH & ORACLE ACCESS.

WARNING / ARCHITECTURAL INTEGRITY:
These schemas are strictly for offline simulation, model training evaluation,
and metric calculation. They must never be returned from customer or operator
operational endpoints to prevent circular reasoning and data leakage.
"""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from backend.app.core.constants import ActionType, EvaluationSplit


class PaymentGroundTruthRead(BaseModel):
    payment_id: str
    true_failure_cause: str
    ground_truth_recoverability: float = Field(..., ge=0.0, le=1.0)
    optimal_recovery_action: ActionType
    evaluation_split: EvaluationSplit
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationDatasetRecord(BaseModel):
    """Combined view used exclusively by the simulation and evaluation harness."""
    payment_id: str
    customer_id: str
    mandate_id: str
    amount: float
    payment_rail: str
    due_date: datetime
    payment_attempt_date: datetime
    status: str
    failure_code: str
    error_source: str
    native_retry_attempt: int
    days_since_last_success: int
    historical_success_rate: float
    historical_cycle_count: int
    consecutive_failure_count: int
    customer_preferred_language: str
    mandate_status: str
    
    # Ground Truth fields (EVALUATION ONLY)
    true_failure_cause: str
    ground_truth_recoverability: float
    optimal_recovery_action: str
    evaluation_split: str
