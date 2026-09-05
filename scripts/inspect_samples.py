"""Inspect sample predictions and diagnoses across diverse payment failures."""
import sys
from pathlib import Path

# Force UTF-8 stdout for Windows terminals
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database import SessionLocal
from backend.app.models import Payment
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.ml.feature_extractor import FeatureExtractor
from backend.app.ml.trainer import load_trained_model


def main():
    session = SessionLocal()
    model = load_trained_model()

    p_soft = session.query(Payment).filter(Payment.failure_code == 'insufficient_funds').first()
    p_auth = session.query(Payment).filter(Payment.failure_code == 'authentication_required').first()
    p_hard = session.query(Payment).filter(Payment.failure_code == 'blocked_account').first()

    samples = [
        ('SOFT FAILURE (INSUFFICIENT FUNDS)', p_soft),
        ('ACTION REQUIRED (AUTH)', p_auth),
        ('HARD FAILURE (BLOCKED)', p_hard)
    ]

    for label, p in samples:
        cust = p.customer
        mand = p.mandate
        risk = RevenueAtRiskDetector.assess_risk(
            payment_id=p.payment_id,
            amount=p.amount,
            payment_rail=p.payment_rail,
            native_retry_attempt=p.native_retry_attempt,
            days_since_last_success=p.days_since_last_success,
            consecutive_failure_count=p.consecutive_failure_count,
            historical_success_rate=p.historical_success_rate,
            mandate_status=mand.mandate_status,
            customer_tenure_days=cust.customer_tenure_days
        )
        diag = FailureDiagnosisEngine.diagnose(
            payment_id=p.payment_id,
            failure_code=p.failure_code,
            error_source=p.error_source,
            error_step=p.error_step,
            payment_rail=p.payment_rail,
            mandate_status=mand.mandate_status,
            amount=p.amount,
            native_retry_attempt=p.native_retry_attempt
        )
        feat = FeatureExtractor.extract_from_orm(p, cust, mand)
        pred = model.predict(feat)

        print(f"=== {label} ===")
        print(f"Payment ID: {p.payment_id} | Amount: INR {p.amount:,.2f} | Rail: {p.payment_rail}")
        print(f"Risk Assessment: Tier={risk.risk_tier.value}, Score={risk.risk_score}, ImmediateAction={risk.is_immediate_action_needed}")
        print(f"  Risk Factors: {risk.contributing_factors}")
        print(f"Diagnosis: Category={diag.failure_category.value}, Class={diag.recoverability_class.value}, Conf={diag.confidence}")
        print(f"  Triggering Reasons: {diag.triggering_reasons}")
        print(f"  Allowed Actions: {[a.value for a in diag.allowed_actions]}")
        print(f"ML Propensity: Score={pred.recoverability_score}, Conf={pred.confidence}, Model={pred.model_version}")
        print("  Top Features:")
        for item in pred.important_features[:3]:
            print(f"    * {item['feature']}: impact={item['impact']}, raw={item['raw_value']}")
        print(f"  Explanation Summary:\n{pred.explanation_summary}\n")

    session.close()


if __name__ == "__main__":
    main()
