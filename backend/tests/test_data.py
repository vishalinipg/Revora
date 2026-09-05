"""Phase 1 Data Model & Synthetic Dataset Tests.

Validates:
1. Referential integrity across Customer, Mandate, Payment, PaymentGroundTruth.
2. Required fields, non-null constraints, and data types.
3. Enum validity for rails, statuses, failure codes, and languages.
4. Financial and temporal validity (non-negative amounts, chronologically valid dates).
5. Generator reproducibility with identical seed.
6. Generator variation with distinct seeds.
7. Ground truth isolation & zero data leakage from PaymentRead operational schema.
8. No impossible combinations (e.g. UPI payments exceeding statutory limits without AFA, temporal split order).
"""
import pytest
from datetime import datetime
from backend.app.core.constants import (
    PaymentRail,
    PaymentStatus,
    FailureCode,
    FailureSource,
    MandateStatus,
    CustomerLanguage,
    EvaluationSplit,
)
from backend.app.models import Customer, Mandate, Payment, PaymentGroundTruth
from backend.app.schemas import PaymentRead
from scripts.generate_data import generate_synthetic_dataset


def test_referential_integrity(seeded_db_session):
    """Verify foreign key integrity across all generated tables."""
    payments = seeded_db_session.query(Payment).all()
    assert len(payments) == 500, "Expected exactly 500 generated payment records"

    customer_ids = {c.customer_id for c in seeded_db_session.query(Customer).all()}
    mandate_ids = {m.mandate_id for m in seeded_db_session.query(Mandate).all()}
    gt_payment_ids = {gt.payment_id for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    for p in payments:
        assert p.customer_id in customer_ids, f"Payment {p.payment_id} references non-existent customer {p.customer_id}"
        assert p.mandate_id in mandate_ids, f"Payment {p.payment_id} references non-existent mandate {p.mandate_id}"
        assert p.payment_id in gt_payment_ids, f"Payment {p.payment_id} has no corresponding ground truth record"

    for m in seeded_db_session.query(Mandate).all():
        assert m.customer_id in customer_ids, f"Mandate {m.mandate_id} references non-existent customer {m.customer_id}"


def test_required_fields_and_types(seeded_db_session):
    """Verify that all mandatory fields are populated and non-null."""
    for p in seeded_db_session.query(Payment).all():
        assert p.payment_id is not None and len(p.payment_id) > 0
        assert p.amount is not None and isinstance(p.amount, float)
        assert p.due_date is not None and isinstance(p.due_date, datetime)
        assert p.payment_attempt_date is not None and isinstance(p.payment_attempt_date, datetime)
        assert p.status is not None
        assert p.payment_rail is not None


def test_valid_enum_values(seeded_db_session):
    """Verify that enums conform strictly to defined domain sets."""
    valid_rails = {r.value for r in PaymentRail}
    valid_statuses = {s.value for s in PaymentStatus}
    valid_failures = {f.value for f in FailureCode}
    valid_sources = {s.value for s in FailureSource}
    valid_mandate_statuses = {m.value for m in MandateStatus}
    valid_languages = {l.value for l in CustomerLanguage}
    valid_splits = {s.value for s in EvaluationSplit}

    for p in seeded_db_session.query(Payment).all():
        assert p.payment_rail in valid_rails
        assert p.status in valid_statuses
        if p.failure_code:
            assert p.failure_code in valid_failures
        if p.error_source:
            assert p.error_source in valid_sources

    for m in seeded_db_session.query(Mandate).all():
        assert m.payment_method in valid_rails
        assert m.mandate_status in valid_mandate_statuses

    for c in seeded_db_session.query(Customer).all():
        assert c.preferred_language in valid_languages

    for gt in seeded_db_session.query(PaymentGroundTruth).all():
        assert gt.evaluation_split in valid_splits


def test_amount_and_date_validity(seeded_db_session):
    """Verify financial non-negativity and temporal sanity."""
    for p in seeded_db_session.query(Payment).all():
        assert p.amount > 0.0, f"Amount must be positive, found {p.amount}"
        assert p.amount <= 15000.0, f"Payment amount {p.amount} exceeded expected maximum"
        # Payment attempt must be at or after the due date
        assert p.payment_attempt_date >= p.due_date, (
            f"Attempt date {p.payment_attempt_date} cannot be before due date {p.due_date}"
        )
        # Customer tenure must be positive
        assert p.customer.customer_tenure_days >= 0
        # Customer signup date must precede payment due date
        assert p.customer.signup_date <= p.due_date, (
            f"Customer signup {p.customer.signup_date} cannot be after payment due date {p.due_date}"
        )


def test_reproducibility_with_same_seed(test_db_session):
    """Verify that generating with the same seed produces byte-for-byte identical data."""
    summary_1 = generate_synthetic_dataset(num_payments=100, seed=123, db_session=test_db_session)
    payments_run1 = [(p.payment_id, p.amount, p.due_date.isoformat()) for p in test_db_session.query(Payment).all()]
    gt_run1 = [(gt.payment_id, gt.ground_truth_recoverability) for gt in test_db_session.query(PaymentGroundTruth).all()]

    # Re-run with same seed
    summary_2 = generate_synthetic_dataset(num_payments=100, seed=123, db_session=test_db_session)
    payments_run2 = [(p.payment_id, p.amount, p.due_date.isoformat()) for p in test_db_session.query(Payment).all()]
    gt_run2 = [(gt.payment_id, gt.ground_truth_recoverability) for gt in test_db_session.query(PaymentGroundTruth).all()]

    assert summary_1["volume"]["total_revenue_at_risk_inr"] == summary_2["volume"]["total_revenue_at_risk_inr"]
    assert payments_run1 == payments_run2
    assert gt_run1 == gt_run2


def test_variation_with_different_seeds(test_db_session):
    """Verify that different seeds produce different randomized synthetic datasets."""
    summary_1 = generate_synthetic_dataset(num_payments=100, seed=42, db_session=test_db_session)
    amt_1 = summary_1["volume"]["total_revenue_at_risk_inr"]

    summary_2 = generate_synthetic_dataset(num_payments=100, seed=999, db_session=test_db_session)
    amt_2 = summary_2["volume"]["total_revenue_at_risk_inr"]

    assert amt_1 != amt_2, "Different seeds should produce different payment amounts"


def test_ground_truth_isolation_and_no_leakage(seeded_db_session):
    """Verify that operational Payment model and PaymentRead schema NEVER expose ground truth.

    Critical Data Leakage Test:
    Operational entities and schemas must not contain:
    - true_failure_cause
    - ground_truth_recoverability
    - optimal_recovery_action
    """
    payment = seeded_db_session.query(Payment).first()
    assert payment is not None

    # Verify Payment attributes directly
    payment_cols = {col.name for col in payment.__table__.columns}
    forbidden_fields = {"true_failure_cause", "ground_truth_recoverability", "optimal_recovery_action"}
    for field in forbidden_fields:
        assert field not in payment_cols, f"Forbidden ground truth field '{field}' leaked into payments table!"

    # Verify Pydantic operational PaymentRead schema
    pydantic_payment = PaymentRead.model_validate(payment)
    dumped_dict = pydantic_payment.model_dump()
    for field in forbidden_fields:
        assert field not in dumped_dict, f"Forbidden ground truth field '{field}' leaked into PaymentRead schema!"


def test_no_impossible_combinations(seeded_db_session):
    """Verify business domain constraints and time-aware split ordering."""
    # 1. UPI AutoPay statutory limit verification: all UPI debits must be <= 15000.0 without AFA
    upi_payments = seeded_db_session.query(Payment).filter(Payment.payment_rail == PaymentRail.UPI_AUTOPAY.value).all()
    for up in upi_payments:
        assert up.amount <= 15000.0, f"UPI AutoPay debit of {up.amount} exceeds statutory 15,000 INR limit"

    # 2. Time-aware split ordering: Max(train.due_date) <= Min(val.due_date) <= Max(val.due_date) <= Min(test.due_date)
    train_dates = [
        p.due_date for p in seeded_db_session.query(Payment).join(PaymentGroundTruth).filter(
            PaymentGroundTruth.evaluation_split == EvaluationSplit.TRAIN.value
        ).all()
    ]
    val_dates = [
        p.due_date for p in seeded_db_session.query(Payment).join(PaymentGroundTruth).filter(
            PaymentGroundTruth.evaluation_split == EvaluationSplit.VALIDATION.value
        ).all()
    ]
    test_dates = [
        p.due_date for p in seeded_db_session.query(Payment).join(PaymentGroundTruth).filter(
            PaymentGroundTruth.evaluation_split == EvaluationSplit.TEST.value
        ).all()
    ]

    assert len(train_dates) > 0 and len(val_dates) > 0 and len(test_dates) > 0
    assert max(train_dates) <= min(val_dates), "Temporal leakage: train due_date exceeds validation due_date"
    assert max(val_dates) <= min(test_dates), "Temporal leakage: validation due_date exceeds test due_date"
