"""Inspect real end-to-end decisions produced by RevoraDecisionEngine."""
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
from backend.app.decision_engine.policy import PolicyEvaluationContext
from backend.app.decision_engine.engine import RevoraDecisionEngine


def main():
    session = SessionLocal()
    model = load_trained_model()

    p_soft = session.query(Payment).filter(Payment.failure_code == 'insufficient_funds').first()
    p_auth = session.query(Payment).filter(Payment.failure_code == 'authentication_required').first()
    p_hard = session.query(Payment).filter(Payment.failure_code == 'blocked_account').first()
    p_expired = session.query(Payment).filter(Payment.failure_code == 'expired_mandate').first()

    samples = [
        ('1. SOFT RECOVERABLE CASE (INSUFFICIENT FUNDS)', p_soft, 48.0, 0),
        ('2. CUSTOMER ACTION REQUIRED (AUTHENTICATION / AFA)', p_auth, 48.0, 0),
        ('3. HARD FAILURE CASE (BLOCKED ACCOUNT)', p_hard, 48.0, 0),
        ('4. STOPPING RULE: COOLDOWN ACTIVE (PREV ATTEMPT 6H AGO)', p_soft, 6.0, 1),
    ]

    for label, p, hours_since, prev_attempts in samples:
        cust = p.customer
        mand = p.mandate

        # Step 1: Risk Assessment
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

        # Step 2: Diagnosis
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

        # Step 3: ML Propensity
        feat = FeatureExtractor.extract_from_orm(p, cust, mand)
        pred = model.predict(feat)

        # Step 4: Revora Decision Engine Policy Evaluation
        ctx = PolicyEvaluationContext(
            payment_id=p.payment_id,
            amount=p.amount,
            payment_rail=p.payment_rail,
            mandate_status=mand.mandate_status,
            failure_category=diag.failure_category.value,
            recoverability_class=diag.recoverability_class.value,
            propensity_score=pred.recoverability_score,
            propensity_confidence=pred.confidence,
            risk_tier=risk.risk_tier.value,
            native_retry_attempt=p.native_retry_attempt,
            revora_recovery_attempts=prev_attempts,
            hours_since_last_attempt=hours_since,
            prior_escalations_count=0,
            consecutive_failed_cycles=1,
        )
        decision = RevoraDecisionEngine.evaluate(ctx)

        print(f"================================================================================")
        print(f"SCENARIO: {label}")
        print(f"Payment ID: {p.payment_id} | Amount: INR {p.amount:,.2f} | Rail: {p.payment_rail} | Mandate: {mand.mandate_status}")
        print(f"Risk Tier: {risk.risk_tier.value} (Score: {risk.risk_score}/100)")
        print(f"Diagnosis: Category={diag.failure_category.value}, Class={diag.recoverability_class.value} (Confidence: {diag.confidence:.2f})")
        print(f"ML Propensity: {pred.recoverability_score:.4f} (Confidence: {pred.confidence:.4f})")
        print(f"--------------------------------------------------------------------------------")
        print(f"DECISION: {decision.action.value.upper()}")
        print(f"Reason:   {decision.decision_reason}")
        print(f"Policy:   {decision.policy_version}")
        print(f"Policy Checks: {decision.policy_checks}")
        if decision.violated_constraints:
            print(f"Violated/Protective Constraints: {decision.violated_constraints}")
        print(f"Decision Trace:")
        for t in decision.decision_trace:
            print(f"  -> {t}")
        print()

    session.close()


if __name__ == "__main__":
    main()
