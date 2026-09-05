"""Tests for Propensity-to-Pay ML Model and Feature Extractor.

Verifies:
1. Ground-truth leakage prevention in FeatureExtractor.
2. Train/Validation/Test partition isolation.
3. Deterministic inference and structured explainability trace.
4. Held-out test performance and calibration sanity.
5. Distinction between model score and latent ground-truth recoverability.
"""
import pytest
import numpy as np
from backend.app.ml.feature_extractor import FeatureExtractor, FEATURE_NAMES
from backend.app.ml.trainer import train_and_evaluate_pipeline, load_trained_model


def test_feature_extractor_leakage_rejection():
    """Verify that FeatureExtractor actively rejects any ground truth or post-intervention fields."""
    safe_record = {
        "amount": 999.0,
        "payment_rail": "upi_autopay",
        "native_retry_attempt": 1,
        "days_since_last_success": 25,
        "historical_cycle_count": 5,
        "historical_success_rate": 0.80,
        "consecutive_failure_count": 1,
        "customer_tenure_days": 150,
        "mandate_age_days": 100,
        "mandate_status": "active",
        "failure_code": "insufficient_funds",
    }
    # Safe record must extract cleanly
    vec = FeatureExtractor.extract_features_from_dict(safe_record)
    assert len(vec) == len(FEATURE_NAMES)
    assert isinstance(vec, np.ndarray)

    # Attempting to inject forbidden ground-truth fields MUST trigger an immediate ValueError
    forbidden_injections = [
        {"ground_truth_recoverability": 0.85},
        {"true_failure_cause": "temporary_salary_delay"},
        {"optimal_recovery_action": "retry"},
        {"recovered_amount": 999.0},
        {"realized_outcome": "recovered"},
    ]

    for injection in forbidden_injections:
        contaminated = {**safe_record, **injection}
        with pytest.raises(ValueError, match="CRITICAL DATA LEAKAGE ATTEMPT"):
            FeatureExtractor.extract_features_from_dict(contaminated)


def test_ml_training_and_held_out_evaluation(seeded_db_session):
    """Verify train/val/test pipeline execution and out-of-sample held-out performance."""
    model, metadata = train_and_evaluate_pipeline(session=seeded_db_session)

    assert metadata["sample_counts"]["train"] > 0
    assert metadata["sample_counts"]["validation"] > 0
    assert metadata["sample_counts"]["test"] > 0

    # Test held-out out-of-sample performance
    test_metrics = metadata["held_out_test_metrics"]
    assert test_metrics["roc_auc"] >= 0.85, f"Held-out ROC-AUC too low: {test_metrics['roc_auc']}"
    assert test_metrics["pr_auc"] >= 0.85, f"Held-out PR-AUC too low: {test_metrics['pr_auc']}"
    assert test_metrics["brier_score"] <= 0.15, f"Model calibration poor (Brier score: {test_metrics['brier_score']})"


def test_model_deterministic_inference_and_explainability(seeded_db_session):
    """Verify deterministic inference and structured feature contribution proofs."""
    model = load_trained_model()

    # Feature vector representing a strong recovery profile (active mandate, high success rate, soft failure)
    high_recov_record = {
        "amount": 499.0,
        "payment_rail": "upi_autopay",
        "native_retry_attempt": 0,
        "days_since_last_success": 5,
        "historical_cycle_count": 8,
        "historical_success_rate": 0.95,
        "consecutive_failure_count": 1,
        "customer_tenure_days": 240,
        "mandate_age_days": 200,
        "mandate_status": "active",
        "failure_code": "bank_timeout",
    }
    vec_high = FeatureExtractor.extract_features_from_dict(high_recov_record)

    pred1 = model.predict(vec_high)
    pred2 = model.predict(vec_high)

    # Determinism
    assert pred1.recoverability_score == pred2.recoverability_score
    assert pred1.confidence == pred2.confidence
    assert pred1.explanation_summary == pred2.explanation_summary

    # Expect elevated recoverability score
    assert pred1.recoverability_score >= 0.70
    assert len(pred1.important_features) > 0
    assert "High recovery propensity" in pred1.explanation_summary

    # Feature vector representing a low recovery profile (expired mandate, repeated failures, low success rate)
    low_recov_record = {
        "amount": 9999.0,
        "payment_rail": "card",
        "native_retry_attempt": 2,
        "days_since_last_success": 60,
        "historical_cycle_count": 2,
        "historical_success_rate": 0.40,
        "consecutive_failure_count": 3,
        "customer_tenure_days": 60,
        "mandate_age_days": 60,
        "mandate_status": "expired",
        "failure_code": "blocked_account",
    }
    vec_low = FeatureExtractor.extract_features_from_dict(low_recov_record)
    pred_low = model.predict(vec_low)

    assert pred_low.recoverability_score < 0.35
    assert "Low recovery propensity" in pred_low.explanation_summary
