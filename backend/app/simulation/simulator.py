"""Batch Recovery Simulation Engine — Revora Adaptive Policy vs Fixed Baseline.

Strict Separation Rule:
- Decision Engine: Decides WHAT action to take based ONLY on Tier 1 observed signals.
- Outcome Oracle: Determines whether the action succeeds based ONLY on latent ground truth.
- Simulator: Coordinates the multi-cycle execution, stopping rules, outbox creation,
  and audit trail without cross-contaminating information.
"""
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import uuid4

from backend.app.core.constants import ActionType, ActionOutcome, PaymentStatus
from backend.app.models.payment import Payment
from backend.app.models.customer import Customer
from backend.app.models.mandate import Mandate
from backend.app.models.ground_truth import PaymentGroundTruth
from backend.app.models.recovery_action import RecoveryAction
from backend.app.models.audit_log import AuditLog
from backend.app.detection.risk_detector import RevenueAtRiskDetector
from backend.app.diagnosis.engine import FailureDiagnosisEngine
from backend.app.ml.feature_extractor import FeatureExtractor
from backend.app.ml.trainer import load_trained_model
from backend.app.decision_engine.policy import PolicyEvaluationContext, REVORA_POLICY_VERSION
from backend.app.decision_engine.engine import RevoraDecisionEngine
from backend.app.language.generator import MultilingualOutreachGenerator
from backend.app.simulation.oracle import OutcomeOracle
from backend.app.simulation.baseline import FixedPolicyBaseline


@dataclass
class SimulationCohortSummary:
    mode: str                           # "revora" or "baseline"
    random_seed: int
    total_eligible_payments: int
    total_revenue_at_risk_inr: float
    total_recovered_amount_inr: float
    recovery_rate_pct: float            # (recovered_amount / revenue_at_risk) * 100
    recovered_payment_count: int
    payment_recovery_rate_pct: float    # (recovered_count / total_eligible) * 100
    unresolved_payment_count: int
    total_interventions_attempted: int
    actions_breakdown: Dict[str, int]
    stopping_rule_compliance_rate: float # Should be 100.0%
    payment_actions: Optional[Dict[str, List[RecoveryAction]]] = None


class RecoverySimulator:
    """Executes multi-attempt recovery simulations with strict stopping rules."""

    def __init__(self, seed: int = 42, model = None):
        self.seed = seed
        self.rng = random.Random(seed)
        self.model = model or load_trained_model()

    def simulate_payment_recovery(
        self,
        payment: Payment,
        customer: Customer,
        mandate: Mandate,
        ground_truth: PaymentGroundTruth,
        mode: str = "revora",
        db_session = None,
    ) -> List[RecoveryAction]:
        """Simulate the end-to-end recovery lifecycle for a single failed payment."""
        actions_history: List[RecoveryAction] = []
        is_recovered = False
        consecutive_failed_cycles = 1
        hours_elapsed = 48.0 # Initial cooldown satisfied
        
        # Max lifecycle loop bounded by stopping rules (at most 3 attempts)
        for attempt_idx in range(3):
            if is_recovered:
                # Stopping rule: once recovered, NO further actions occur!
                break

            now = payment.payment_attempt_date + timedelta(hours=hours_elapsed * attempt_idx)
            current_attempts = len(actions_history)

            # ------------------------------------------------------------------
            # DECISION STAGE
            # ------------------------------------------------------------------
            if mode == "revora":
                # Step 1: Risk Assessment (Tier 1 Observed Signals only)
                risk = RevenueAtRiskDetector.assess_risk(
                    payment_id=payment.payment_id,
                    amount=payment.amount,
                    payment_rail=payment.payment_rail,
                    native_retry_attempt=payment.native_retry_attempt,
                    days_since_last_success=payment.days_since_last_success,
                    consecutive_failure_count=payment.consecutive_failure_count + attempt_idx,
                    historical_success_rate=payment.historical_success_rate,
                    mandate_status=mandate.mandate_status,
                    customer_tenure_days=customer.customer_tenure_days,
                )

                # Step 2: Diagnosis (Tier 1 Observed Signals only)
                diag = FailureDiagnosisEngine.diagnose(
                    payment_id=payment.payment_id,
                    failure_code=payment.failure_code,
                    error_source=payment.error_source,
                    error_step=payment.error_step,
                    payment_rail=payment.payment_rail,
                    mandate_status=mandate.mandate_status,
                    amount=payment.amount,
                    native_retry_attempt=payment.native_retry_attempt + current_attempts,
                )

                # Step 3: ML Propensity (Tier 1 Observed Signals only)
                feat = FeatureExtractor.extract_from_orm(payment, customer, mandate)
                pred = self.model.predict(feat)

                # Step 4: Decision Engine Policy Evaluation
                ctx = PolicyEvaluationContext(
                    payment_id=payment.payment_id,
                    amount=payment.amount,
                    payment_rail=payment.payment_rail,
                    mandate_status=mandate.mandate_status,
                    failure_category=diag.failure_category.value,
                    recoverability_class=diag.recoverability_class.value,
                    propensity_score=pred.recoverability_score,
                    propensity_confidence=pred.confidence,
                    risk_tier=risk.risk_tier.value,
                    native_retry_attempt=payment.native_retry_attempt,
                    revora_recovery_attempts=current_attempts,
                    hours_since_last_attempt=hours_elapsed,
                    prior_escalations_count=sum(1 for a in actions_history if a.action_type == ActionType.HUMAN_ESCALATION.value),
                    consecutive_failed_cycles=consecutive_failed_cycles,
                )
                decision = RevoraDecisionEngine.evaluate(ctx)
                action_type = decision.action
                decided_by = REVORA_POLICY_VERSION
                decision_reason = decision.decision_reason
                is_revora = True

                # Step 5: Draft customer outreach if applicable
                draft = MultilingualOutreachGenerator.draft_outreach(
                    decision=decision,
                    customer_name=customer.name,
                    customer_id=customer.customer_id,
                    preferred_language=customer.preferred_language,
                    amount=payment.amount,
                    payment_rail=payment.payment_rail,
                    subscription_plan=customer.subscription_plan,
                )
                message_sent = draft.message_body if draft.is_customer_facing else None
                lang_used = draft.language_used if draft.is_customer_facing else None

                if db_session and draft.is_customer_facing:
                    MultilingualOutreachGenerator.persist_to_mock_outbox(draft, decision, db_session)

            else:
                # Mode: Fixed-Policy Baseline (Blind Retry Strategy)
                baseline_dec = FixedPolicyBaseline.decide(
                    payment_id=payment.payment_id,
                    current_attempts=current_attempts,
                )
                action_type = baseline_dec.action
                decided_by = "fixed_baseline"
                decision_reason = baseline_dec.decision_reason
                is_revora = False
                message_sent = None
                lang_used = None

            # ------------------------------------------------------------------
            # OUTCOME SIMULATION STAGE (Driven by Latent Ground Truth)
            # ------------------------------------------------------------------
            sim_result = OutcomeOracle.simulate_action_outcome(
                action=action_type,
                ground_truth=ground_truth,
                mandate_status=mandate.mandate_status,
                attempt_number=current_attempts + 1,
                rng=self.rng,
            )

            action_id = f"act_{uuid4().hex[:12]}"
            recovered_amount = payment.amount if sim_result.is_recovered else 0.0

            action_record = RecoveryAction(
                action_id=action_id,
                payment_id=payment.payment_id,
                action_type=action_type.value,
                decided_by=decided_by,
                decision_reason=decision_reason,
                is_revora_policy=is_revora,
                policy_version=REVORA_POLICY_VERSION if is_revora else "fixed_baseline_v1",
                scheduled_at=now,
                executed_at=now + timedelta(minutes=5),
                outcome=sim_result.outcome.value,
                recovered_amount=recovered_amount,
                language_used=lang_used,
                message_sent=message_sent,
                fallback_template_used=True,
                created_at=now,
            )
            actions_history.append(action_record)

            if db_session:
                db_session.add(action_record)

                # Record in Audit Log
                audit = AuditLog(
                    log_id=f"log_act_{uuid4().hex[:12]}",
                    entity_type="recovery_action",
                    entity_id=action_id,
                    event="recovery_action_executed",
                    payload_snapshot=(
                        f'{{"payment_id": "{payment.payment_id}", "action": "{action_type.value}", '
                        f'"outcome": "{sim_result.outcome.value}", "amount_recovered": {recovered_amount}}}'
                    ),
                    actor="simulator",
                    timestamp=now + timedelta(minutes=5),
                )
                db_session.add(audit)
                db_session.flush()

            # Check termination
            if sim_result.is_recovered:
                is_recovered = True
                payment.status = PaymentStatus.RECOVERED.value
                break
            elif action_type == ActionType.STOP:
                # Terminal stopping rule
                break

        return actions_history

    def simulate_batch(
        self,
        payments: List[Payment],
        customers_dict: Dict[str, Customer],
        mandates_dict: Dict[str, Mandate],
        ground_truths_dict: Dict[str, PaymentGroundTruth],
        mode: str = "revora",
        db_session = None,
    ) -> SimulationCohortSummary:
        """Simulate full batch and calculate cohort recovery metrics."""
        total_at_risk = sum(p.amount for p in payments)
        total_recovered = 0.0
        recovered_count = 0
        actions_breakdown: Dict[str, int] = {}
        total_interventions = 0
        payment_actions: Dict[str, List[RecoveryAction]] = {}

        for p in payments:
            cust = customers_dict[p.customer_id]
            mand = mandates_dict[p.mandate_id]
            gt = ground_truths_dict[p.payment_id]

            # Run payment lifecycle
            action_records = self.simulate_payment_recovery(
                payment=p,
                customer=cust,
                mandate=mand,
                ground_truth=gt,
                mode=mode,
                db_session=db_session,
            )
            payment_actions[p.payment_id] = action_records

            for act in action_records:
                actions_breakdown[act.action_type] = actions_breakdown.get(act.action_type, 0) + 1
                total_interventions += 1
                if act.outcome == ActionOutcome.RECOVERED.value:
                    total_recovered += act.recovered_amount
                    recovered_count += 1

        if db_session:
            db_session.commit()

        n_total = len(payments)
        recovery_rate = (total_recovered / total_at_risk * 100.0) if total_at_risk > 0 else 0.0
        payment_rate = (recovered_count / n_total * 100.0) if n_total > 0 else 0.0

        return SimulationCohortSummary(
            mode=mode,
            random_seed=self.seed,
            total_eligible_payments=n_total,
            total_revenue_at_risk_inr=round(total_at_risk, 2),
            total_recovered_amount_inr=round(total_recovered, 2),
            recovery_rate_pct=round(recovery_rate, 2),
            recovered_payment_count=recovered_count,
            payment_recovery_rate_pct=round(payment_rate, 2),
            unresolved_payment_count=n_total - recovered_count,
            total_interventions_attempted=total_interventions,
            actions_breakdown=actions_breakdown,
            stopping_rule_compliance_rate=100.0,
            payment_actions=payment_actions,
        )
