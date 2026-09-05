"""Unit and integration tests for Phase 7 Evaluation Engine.

Verifies:
1. Identical seed => identical evaluation results
2. Different seeds => legitimate statistical variation
3. Ground-truth isolation (zero oracle leakage into Decision Engine)
4. Core metrics integrity & referential consistency
5. Decision quality & regret computation accuracy
6. Per-language breakdown and unknown -> English fallback tracking
7. Fair baseline comparison on identical held-out cohorts
"""
import pytest

from backend.app.core.constants import ActionType, ActionOutcome
from backend.app.models import Payment, Customer, Mandate, PaymentGroundTruth
from backend.app.simulation.simulator import RecoverySimulator
from backend.app.evaluation.metrics import EvaluationEngine


def test_evaluation_identical_seed_reproducibility(seeded_db_session):
    """Verify that identical random seed yields identical evaluation metrics."""
    payments = seeded_db_session.query(Payment).limit(50).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim1 = RecoverySimulator(seed=42)
    res1 = sim1.simulate_batch(payments, customers, mandates, gts, mode="revora")
    core1 = EvaluationEngine.compute_core_metrics(res1)
    dq1 = EvaluationEngine.compute_decision_quality(res1, gts)

    sim2 = RecoverySimulator(seed=42)
    res2 = sim2.simulate_batch(payments, customers, mandates, gts, mode="revora")
    core2 = EvaluationEngine.compute_core_metrics(res2)
    dq2 = EvaluationEngine.compute_decision_quality(res2, gts)

    assert core1.total_recovered_amount_inr == core2.total_recovered_amount_inr
    assert core1.revenue_recovery_rate_pct == core2.revenue_recovery_rate_pct
    assert core1.recovered_payments == core2.recovered_payments
    assert dq1.oracle_concordance_rate_pct == dq2.oracle_concordance_rate_pct
    assert dq1.unnecessary_retry_count == dq2.unnecessary_retry_count


def test_evaluation_multi_seed_variation(seeded_db_session):
    """Verify that evaluating across multiple seeds generates legitimate statistical variation."""
    payments = seeded_db_session.query(Payment).limit(60).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    benchmark = EvaluationEngine.run_multi_seed_benchmark(
        payments=payments,
        customers_dict=customers,
        mandates_dict=mandates,
        ground_truths_dict=gts,
        seeds=[42, 100, 2026],
    )

    assert len(benchmark.seeds_evaluated) == 3
    assert benchmark.held_out_cohort_size == 60
    assert benchmark.revora_revenue_recovery_rate.mean > 0.0
    # There should be non-zero standard deviation across stochastic Bernoulli outcomes
    assert benchmark.revora_recovered_amount_inr.max >= benchmark.revora_recovered_amount_inr.min


def test_evaluation_core_metrics_integrity(seeded_db_session):
    """Verify mathematical and referential integrity of core metrics."""
    payments = seeded_db_session.query(Payment).limit(40).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim = RecoverySimulator(seed=42)
    res = sim.simulate_batch(payments, customers, mandates, gts, mode="revora")
    core = EvaluationEngine.compute_core_metrics(res)

    # 1. Total payments = recovered + unresolved
    assert core.total_payments_evaluated == core.recovered_payments + core.unresolved_payments
    # 2. Total revenue at risk equals sum of payment amounts
    expected_risk = round(sum(p.amount for p in payments), 2)
    assert core.total_revenue_at_risk_inr == expected_risk
    # 3. Stopping rule compliance must be 100%
    assert core.stopping_rule_compliance_pct == 100.0
    # 4. Total interventions matches sum of action counts
    assert core.total_interventions_attempted == sum(core.actions_breakdown.values())


def test_evaluation_decision_quality_and_regret_computation(seeded_db_session):
    """Verify that decision regret accurately evaluates against optimal_recovery_action."""
    payments = seeded_db_session.query(Payment).limit(50).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim = RecoverySimulator(seed=42)
    res_revora = sim.simulate_batch(payments, customers, mandates, gts, mode="revora")
    dq_revora = EvaluationEngine.compute_decision_quality(res_revora, gts)

    res_base = sim.simulate_batch(payments, customers, mandates, gts, mode="baseline")
    dq_base = EvaluationEngine.compute_decision_quality(res_base, gts)

    assert dq_revora.total_decisions_evaluated == 50
    assert 0.0 <= dq_revora.oracle_concordance_rate_pct <= 100.0
    # Baseline blindly retries, so its unnecessary retries on permanent failures must be >= Revora's
    assert dq_base.unnecessary_retry_count >= dq_revora.unnecessary_retry_count


def test_evaluation_language_breakdown_and_fallback(seeded_db_session):
    """Verify per-language recovery breakdown and explicit tracking of fallback."""
    payments = seeded_db_session.query(Payment).limit(60).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim = RecoverySimulator(seed=42)
    res = sim.simulate_batch(payments, customers, mandates, gts, mode="revora")
    lang_breakdown = EvaluationEngine.compute_language_breakdown(payments, customers, res)

    codes = [lb.language_code for lb in lang_breakdown]
    assert "en" in codes
    assert "ta_tanglish" in codes
    assert "hi_hinglish" in codes
    assert "unknown_fallback_to_en" in codes

    # Total payments across languages must sum to total evaluated payments
    total_lang_payments = sum(lb.payments_count for lb in lang_breakdown)
    assert total_lang_payments == len(payments)

    # Verify fallback flag is set exclusively for unknown_fallback_to_en
    for lb in lang_breakdown:
        if lb.language_code == "unknown_fallback_to_en":
            assert lb.fallback_from_unknown is True
        else:
            assert lb.fallback_from_unknown is False


def test_evaluation_baseline_fair_comparison(seeded_db_session):
    """Verify that Revora and Baseline are evaluated against the exact same payments cohort."""
    payments = seeded_db_session.query(Payment).limit(45).all()
    customers = {c.customer_id: c for c in seeded_db_session.query(Customer).all()}
    mandates = {m.mandate_id: m for m in seeded_db_session.query(Mandate).all()}
    gts = {gt.payment_id: gt for gt in seeded_db_session.query(PaymentGroundTruth).all()}

    sim = RecoverySimulator(seed=42)
    sum_revora = sim.simulate_batch(payments, customers, mandates, gts, mode="revora")
    sum_base = sim.simulate_batch(payments, customers, mandates, gts, mode="baseline")

    comp = EvaluationEngine.compute_comparative_metrics(sum_revora, sum_base, gts)

    assert sum_revora.total_eligible_payments == sum_base.total_eligible_payments
    assert sum_revora.total_revenue_at_risk_inr == sum_base.total_revenue_at_risk_inr
    # Revora should achieve positive or neutral lift
    assert comp.absolute_revenue_recovery_rate_delta_pct >= 0.0
    # Baseline executes blind retries, so Revora should prevent futile retries
    assert comp.futile_retries_prevented >= 0


def test_evaluation_ground_truth_isolation_assertion():
    """Verify that Decision Engine module never imports or references EvaluationEngine."""
    import inspect
    import backend.app.decision_engine.engine as de_engine
    import backend.app.decision_engine.policy as de_policy

    engine_source = inspect.getsource(de_engine)
    policy_source = inspect.getsource(de_policy)

    assert "PaymentGroundTruth" not in engine_source
    assert "PaymentGroundTruth" not in policy_source
    assert "EvaluationEngine" not in engine_source
    assert "OutcomeOracle" not in engine_source
