"""ML Model Training Pipeline — strictly isolated train/validation/test partitions.

Trains interpretable Propensity-to-Pay models:
1. LogisticRegression (interpretable linear log-odds coefficients)
2. DecisionTreeClassifier (interpretable partition tree)

Evaluates strictly using:
- Train Split: 70% of chronological records (used for model fitting)
- Validation Split: 15% (used for threshold selection and hyperparameter comparison)
- Held-Out Test Split: 15% (evaluated once for out-of-sample benchmark metrics)
"""
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    brier_score_loss,
)

from backend.app.config import DATA_DIR
from backend.app.core.constants import EvaluationSplit
from backend.app.database import SessionLocal
from backend.app.models import Payment, Customer, Mandate, PaymentGroundTruth
from backend.app.ml.feature_extractor import FeatureExtractor, FEATURE_NAMES
from backend.app.ml.model import PropensityModel


MODELS_DIR = DATA_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_ARTIFACT_PATH = MODELS_DIR / "revora_propensity_v1.pkl"


def load_partitioned_dataset(session) -> Tuple[Dict[str, np.ndarray], Dict[str, np.ndarray]]:
    """Load dataset strictly partitioned by chronological evaluation splits.

    Guarantees:
    - Features (X) are extracted strictly from Tier 1 observed signals (Payment, Customer, Mandate).
    - Labels (y) are binary recoverability indicators (1 if recoverability >= 0.50 else 0).
    - The target is used strictly for model fitting and evaluation; never fed back into X.
    """
    splits = [EvaluationSplit.TRAIN.value, EvaluationSplit.VALIDATION.value, EvaluationSplit.TEST.value]
    X_dict = {}
    y_dict = {}

    for split in splits:
        query = (
            session.query(Payment, Customer, Mandate, PaymentGroundTruth)
            .join(Customer, Payment.customer_id == Customer.customer_id)
            .join(Mandate, Payment.mandate_id == Mandate.mandate_id)
            .join(PaymentGroundTruth, Payment.payment_id == PaymentGroundTruth.payment_id)
            .filter(PaymentGroundTruth.evaluation_split == split)
            .order_by(Payment.due_date.asc())
            .all()
        )

        X_rows = []
        y_rows = []

        for payment, customer, mandate, gt in query:
            # Extract features strictly from observed signals
            features = FeatureExtractor.extract_from_orm(payment, customer, mandate)
            X_rows.append(features)

            # Target definition: Is the failed recurring payment recoverable? (Binary: 1 if >= 0.50 else 0)
            target = 1 if gt.ground_truth_recoverability >= 0.50 else 0
            y_rows.append(target)

        X_dict[split] = np.array(X_rows, dtype=np.float32)
        y_dict[split] = np.array(y_rows, dtype=np.int32)

    return X_dict, y_dict


def evaluate_model_performance(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.50) -> Dict[str, float]:
    """Calculate comprehensive classification and calibration metrics."""
    y_pred = (y_prob >= threshold).astype(int)
    
    roc_auc = float(roc_auc_score(y_true, y_prob))
    pr_auc = float(average_precision_score(y_true, y_prob))
    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    brier = float(brier_score_loss(y_true, y_prob))

    return {
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "brier_score": round(brier, 4),
        "threshold": round(threshold, 4),
    }


def find_optimal_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Find decision threshold that maximizes F1 score on validation set."""
    best_thresh = 0.50
    best_f1 = 0.0
    for t in np.linspace(0.20, 0.80, 61):
        preds = (y_prob >= t).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_thresh = float(t)
    return round(best_thresh, 4)


def train_and_evaluate_pipeline(session = None) -> Tuple[PropensityModel, Dict[str, Any]]:
    """Execute end-to-end training and held-out evaluation."""
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True

    try:
        X_dict, y_dict = load_partitioned_dataset(session)
    finally:
        if close_session:
            session.close()

    X_train, y_train = X_dict["train"], y_dict["train"]
    X_val, y_val = X_dict["validation"], y_dict["validation"]
    X_test, y_test = X_dict["test"], y_dict["test"]

    # Fit scaler strictly on training split
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # 1. Train Interpretable Logistic Regression
    logreg = LogisticRegression(
        penalty="l2",
        C=1.0,
        solver="lbfgs",
        max_iter=1000,
        class_weight="balanced",
        random_state=42,
    )
    logreg.fit(X_train_scaled, y_train)

    val_probs_logreg = logreg.predict_proba(X_val_scaled)[:, 1]
    opt_threshold_logreg = find_optimal_threshold(y_val, val_probs_logreg)
    val_metrics_logreg = evaluate_model_performance(y_val, val_probs_logreg, opt_threshold_logreg)

    # 2. Train Decision Tree Classifier for comparison
    dtree = DecisionTreeClassifier(
        max_depth=4,
        min_samples_leaf=15,
        class_weight="balanced",
        random_state=42,
    )
    dtree.fit(X_train, y_train)
    val_probs_dtree = dtree.predict_proba(X_val)[:, 1]
    val_metrics_dtree = evaluate_model_performance(y_val, val_probs_dtree, 0.50)

    # Model Selection: Logistic Regression chosen for superior calibration and linear feature contribution proofs
    train_probs = logreg.predict_proba(X_train_scaled)[:, 1]
    train_metrics = evaluate_model_performance(y_train, train_probs, opt_threshold_logreg)

    # Final Single Evaluation on Untouched Held-Out Test Set
    test_probs = logreg.predict_proba(X_test_scaled)[:, 1]
    test_metrics = evaluate_model_performance(y_test, test_probs, opt_threshold_logreg)

    metadata = {
        "model_architecture": "LogisticRegression(C=1.0, penalty='l2', class_weight='balanced')",
        "baseline_comparison": "DecisionTreeClassifier(max_depth=4)",
        "training_timestamp": datetime.utcnow().isoformat(),
        "feature_names": FEATURE_NAMES,
        "optimal_threshold": opt_threshold_logreg,
        "sample_counts": {
            "train": len(y_train),
            "validation": len(y_val),
            "test": len(y_test),
        },
        "train_metrics": train_metrics,
        "validation_metrics": val_metrics_logreg,
        "dtree_validation_metrics": val_metrics_dtree,
        "held_out_test_metrics": test_metrics,
        "coefficients": {
            feat: round(float(coef), 4)
            for feat, coef in zip(FEATURE_NAMES, logreg.coef_[0])
        }
    }

    model = PropensityModel(
        classifier=logreg,
        scaler=scaler,
        feature_names=FEATURE_NAMES,
        model_version="revora_propensity_logreg_v1",
        metadata=metadata,
    )

    # Save artifact
    with open(MODEL_ARTIFACT_PATH, "wb") as f:
        pickle.dump(model, f)

    return model, metadata


def load_trained_model() -> PropensityModel:
    """Load persisted model artifact from disk or train if missing."""
    if not MODEL_ARTIFACT_PATH.exists():
        model, _ = train_and_evaluate_pipeline()
        return model

    with open(MODEL_ARTIFACT_PATH, "rb") as f:
        model = pickle.load(f)
    return model


if __name__ == "__main__":
    print("[Revora ML Trainer] Training Propensity-to-Pay model with held-out evaluation...")
    model, metadata = train_and_evaluate_pipeline()
    print("[Revora ML Trainer] Training complete. Model saved to:", MODEL_ARTIFACT_PATH)
    print("\n--- Model Coefficients (Log-Odds Impact) ---")
    for feat, coef in metadata["coefficients"].items():
        print(f"  {feat:30s}: {coef:+.4f}")
    print("\n--- Validation Metrics ---")
    for k, v in metadata["validation_metrics"].items():
        print(f"  {k:20s}: {v}")
    print("\n--- Held-Out Test Metrics ---")
    for k, v in metadata["held_out_test_metrics"].items():
        print(f"  {k:20s}: {v}")
