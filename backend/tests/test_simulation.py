"""Tests for Outcome Simulation Engine (Phase 6).

Validates:
1. Ground-Truth Isolation: OutcomeOracle uses latent ground truth; DecisionEngine does not.
2. Outcome Determinism: Fixed seed produces 100% reproducible outcomes.
3. Multi-Seed Robustness: Different seeds produce meaningful, non-identical variation.
4. Recovery Attribution: Action links to payment, outcome, decision reason, and audit trail.
5. Stopping Rule Compliance: Zero post-recovery actions once recovered; attempts capped at 3.
6. Baseline Simulation: FixedPolicyBaseline executes blind retry benchmark cleanly.
"""
import random
import pytest
from backend.app.core.constants import ActionType, ActionOutcome, PaymentRail, MandateStatus
from backend.app.models.payment import Payment
from backend.app.models.customer import Customer
from backend.app.models.mandate import Mandate
from backend.app.models.ground_truth import PaymentGroundTruth
from backend.app.models.recovery_action import RecoveryAction
from backend.app.models.audit_log import AuditLog
from backend.app.simulation.oracle import OutcomeOracle
from backend.app.simulation.baseline import FixedPolicyBaseline
from backend.app.simulation.simulator import RecoverySimulator


def test_oracle_causal_soundness_retry_on_blocked_fails():
    """Verify that OutcomeOracle rejects retries on blocked accounts."""
    gt = PaymentGroundTruth(
        payment_id="pay_test_oracle_01",
        true_failure_cause="permanent_account_closure",
        ground_truth_recoverability=0.05,
        optimal_recovery_action="stop",
        evaluation_split="test",
    )
    res = OutcomeOracle.simulate_action_outcome(
        action=ActionType.RETRY,
        ground_truth=gt,
        mandate_status="active",
        rng=random.Random(42),
    )
    # Even if an action tried to retry, the probability is near zero
    assert res.effective_recovery_probability <= 0.05
    assert "permanently closed" in res.simulated_reason.lower() or "rejected" in res.simulated_reason.lower()


def test_oracle_update_request_resolves_expired_mandate():
    """Verify that PAYMENT_UPDATE_REQUEST has elevated success on expired mandates."""
    gt = PaymentGroundTruth(
        payment_id="pay_test_oracle_02",
        true_failure_cause="mandate_token_expired",
        ground_truth_recoverability=0.75,
        optimal_recovery_action="payment_update_request",
        evaluation_split="test",
    )
    res_update = OutcomeOracle.simulate_action_outcome(
        action=ActionType.PAYMENT_UPDATE_REQUEST,
        ground_truth=gt,
        mandate_status="expired",
    )
    res_retry = OutcomeOracle.simulate_action_outcome(
        action=ActionType.RETRY,
        ground_truth=gt,
        mandate_status="expired",
    )

    # Update request should have high efficacy, retry should have zero efficacy on expired mandate
    assert res_update.effective_recovery_probability >= 0.70
    assert res_retry.effective_recovery_probability == 0.0


def test_simulation_stopping_rule_zero_actions_after_recovery(seeded_db_session):
    """Verify that once a payment recovers, NO further recovery actions are attempted."""
    payment = seeded_db_session.query(Payment).first()
    customer = payment.customer
    mandate = payment.mandate
    gt = seeded_db_session.query(PaymentGroundTruth).filter(PaymentGroundTruth.payment_id == payment.payment_id).first()

    simulator = RecoverySimulator(seed=42)
    actions = simulator.simulate_payment_recovery(
        payment=payment,
        customer=customer,
        mandate=mandate,
        ground_truth=gt,
        mode="revora",
    )

    assert len(actions) >= 1
    assert len(actions) <= 3

    # Check if payment was recovered
    recovered_indices = [i for i, a in enumerate(actions) if a.outcome == ActionOutcome.RECOVERED.value]
    if recovered_indices:
        first_recovered_idx = recovered_indices[0]
        # Must be the final action in the sequence!
        assert first_recovered_idx == len(actions) - 1, "Violation: Action occurred after recovery was achieved!"


def test_simulation_determinism_with_same_seed(seeded_db_session):
    """Verify that running batch simulation twice with identical seed produces identical results."""
    payments = seeded_db_session.query(Payment).limit(50).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim1 = RecoverySimulator(seed=123)
    res1 = sim1.simulate_batch(payments, customers, mandates, gts, mode="revora")

    sim2 = RecoverySimulator(seed=123)
    res2 = sim2.simulate_batch(payments, customers, mandates, gts, mode="revora")

    assert res1.total_recovered_amount_inr == res2.total_recovered_amount_inr
    assert res1.recovered_payment_count == res2.recovered_payment_count
    assert res1.actions_breakdown == res2.actions_breakdown


def test_simulation_seed_variation(seeded_db_session):
    """Verify that different random seeds produce meaningful stochastic variation."""
    payments = seeded_db_session.query(Payment).limit(100).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim1 = RecoverySimulator(seed=42)
    res1 = sim1.simulate_batch(payments, customers, mandates, gts, mode="revora")

    sim2 = RecoverySimulator(seed=9999)
    res2 = sim2.simulate_batch(payments, customers, mandates, gts, mode="revora")

    # Due to stochastic Bernoulli draws, total recovered amounts should vary
    assert res1.total_recovered_amount_inr != res2.total_recovered_amount_inr


def test_recovery_attribution_and_audit_linkage(seeded_db_session):
    """Verify full recovery attribution: action links to payment, outcome, and audit log."""
    payment = seeded_db_session.query(Payment).filter(Payment.failure_code == "insufficient_funds").first()
    customer = payment.customer
    mandate = payment.mandate
    gt = seeded_db_session.query(PaymentGroundTruth).filter(PaymentGroundTruth.payment_id == payment.payment_id).first()

    simulator = RecoverySimulator(seed=42)
    actions = simulator.simulate_payment_recovery(
        payment=payment,
        customer=customer,
        mandate=mandate,
        ground_truth=gt,
        mode="revora",
        db_session=seeded_db_session,
    )

    assert len(actions) > 0
    for act in actions:
        assert act.payment_id == payment.payment_id
        assert act.policy_version == "revora_policy_v1"
        assert act.action_type in [a.value for a in ActionType]
        assert act.outcome in [o.value for o in ActionOutcome]
        if act.outcome == ActionOutcome.RECOVERED.value:
            assert act.recovered_amount == payment.amount
        else:
            assert act.recovered_amount == 0.0

        # Check audit trail entry
        audit = seeded_db_session.query(AuditLog).filter(AuditLog.entity_id == act.action_id).first()
        assert audit is not None
        assert audit.event == "recovery_action_executed"


def test_baseline_simulation_executes_blind_retry(seeded_db_session):
    """Verify that FixedPolicyBaseline strictly retries without adaptive intelligence."""
    payments = seeded_db_session.query(Payment).limit(30).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    simulator = RecoverySimulator(seed=42)
    baseline_res = simulator.simulate_batch(payments, customers, mandates, gts, mode="baseline")

    assert baseline_res.mode == "baseline"
    # Baseline only takes RETRY (and STOP when exhausted); never PAYMENT_UPDATE_REQUEST or HUMAN_ESCALATION
    assert ActionType.PAYMENT_UPDATE_REQUEST.value not in baseline_res.actions_breakdown
    assert ActionType.HUMAN_ESCALATION.value not in baseline_res.actions_breakdown
    assert ActionType.RETRY.value in baseline_res.actions_breakdown
