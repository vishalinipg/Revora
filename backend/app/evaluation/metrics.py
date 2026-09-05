"""Revora Evaluation Metrics Engine — Phase 7.

Computes comprehensive financial, operational, decision-quality (regret),
and per-language recovery metrics comparing Revora Adaptive Policy
against the Fixed-Policy Baseline across single and multiple seeds.

CRITICAL ARCHITECTURAL BOUNDARY:
- Evaluates operational outcomes against latent ground truth (Tier 2 & 3).
- The metrics, regret scores, and oracle comparisons computed here MUST NEVER
  be imported or used by the operational Decision Engine, Propensity ML Model,
  or Failure Diagnosis Engine.
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
import statistics

from backend.app.core.constants import ActionType, ActionOutcome
from backend.app.models.payment import Payment
from backend.app.models.customer import Customer
from backend.app.models.mandate import Mandate
from backend.app.models.ground_truth import PaymentGroundTruth
from backend.app.simulation.simulator import RecoverySimulator, SimulationCohortSummary


@dataclass
class CoreCohortMetrics:
    """Core financial and operational recovery metrics for a single simulation run."""
    policy_name: str
    random_seed: int
    total_payments_evaluated: int
    total_revenue_at_risk_inr: float
    recovered_payments: int
    unresolved_payments: int
    payment_recovery_rate_pct: float
    total_recovered_amount_inr: float
    revenue_recovery_rate_pct: float
    total_interventions_attempted: int
    interventions_per_recovered_payment: float
    recovery_efficiency_inr_per_intervention: float
    stopping_rule_compliance_pct: float
    actions_breakdown: Dict[str, int]


@dataclass
class DecisionQualityMetrics:
    """Decision regret and causal alignment measured against hidden ground truth oracle."""
    total_decisions_evaluated: int
    oracle_concordant_decisions: int
    oracle_concordance_rate_pct: float
    # Regret breakdown
    unnecessary_retry_count: int            # Retrying when true cause is permanent or non-recoverable
    unnecessary_retry_rate_pct: float
    missed_recovery_opportunity_count: int  # Stopping when payment was recoverable via update
    missed_recovery_opportunity_rate_pct: float
    inappropriate_customer_friction_count: int # Sending update link when soft retry was sufficient
    inappropriate_customer_friction_rate_pct: float
    inappropriate_escalation_count: int     # Escalating simple soft/transient failures
    inappropriate_escalation_rate_pct: float
    optimal_action_count: int


@dataclass
class LanguageBreakdownMetrics:
    """Outreach and recovery metrics broken down by customer language."""
    language_code: str
    display_name: str
    customer_count: int
    payments_count: int
    revenue_at_risk_inr: float
    recovered_payments: int
    recovered_amount_inr: float
    recovery_rate_pct: float
    messages_dispatched: int
    fallback_from_unknown: bool = False


@dataclass
class ComparativeMetrics:
    """Head-to-head comparison between Revora Adaptive Policy and Fixed Baseline."""
    random_seed: int
    absolute_revenue_recovery_rate_delta_pct: float    # Revora % - Baseline %
    relative_revenue_recovery_rate_improvement_pct: float # (Revora - Baseline) / Baseline * 100
    absolute_recovered_amount_delta_inr: float         # Revora ₹ - Baseline ₹
    intervention_delta_count: int                      # Revora interventions - Baseline interventions
    intervention_reduction_pct: float                  # (Baseline - Revora) / Baseline * 100
    recovery_efficiency_delta_inr: float               # Revora efficiency - Baseline efficiency
    futile_retries_prevented: int                      # Baseline futile retries avoided by Revora


@dataclass
class StatisticalSummary:
    """Summary statistics (mean, std, min, max) across multiple seeds."""
    mean: float
    std: float
    min: float
    max: float


@dataclass
class MultiSeedBenchmarkResult:
    """Statistical evaluation across multiple independent seeds."""
    seeds_evaluated: List[int]
    held_out_cohort_size: int
    total_revenue_at_risk_inr: float
    revora_revenue_recovery_rate: StatisticalSummary
    baseline_revenue_recovery_rate: StatisticalSummary
    revora_recovered_amount_inr: StatisticalSummary
    baseline_recovered_amount_inr: StatisticalSummary
    recovered_amount_delta_inr: StatisticalSummary
    revora_interventions: StatisticalSummary
    baseline_interventions: StatisticalSummary
    intervention_reduction_pct: StatisticalSummary
    revora_oracle_concordance_rate: StatisticalSummary
    baseline_oracle_concordance_rate: StatisticalSummary


class EvaluationEngine:
    """Computes rigorous, leakage-free evaluation metrics."""

    @staticmethod
    def compute_core_metrics(summary: SimulationCohortSummary) -> CoreCohortMetrics:
        """Derives core cohort metrics from simulation summary."""
        n_rec = summary.recovered_payment_count
        interventions = summary.total_interventions_attempted
        interv_per_rec = (interventions / n_rec) if n_rec > 0 else 0.0
        efficiency = (summary.total_recovered_amount_inr / interventions) if interventions > 0 else 0.0

        return CoreCohortMetrics(
            policy_name=summary.mode,
            random_seed=summary.random_seed,
            total_payments_evaluated=summary.total_eligible_payments,
            total_revenue_at_risk_inr=summary.total_revenue_at_risk_inr,
            recovered_payments=summary.recovered_payment_count,
            unresolved_payments=summary.unresolved_payment_count,
            payment_recovery_rate_pct=summary.payment_recovery_rate_pct,
            total_recovered_amount_inr=summary.total_recovered_amount_inr,
            revenue_recovery_rate_pct=summary.recovery_rate_pct,
            total_interventions_attempted=interventions,
            interventions_per_recovered_payment=round(interv_per_rec, 2),
            recovery_efficiency_inr_per_intervention=round(efficiency, 2),
            stopping_rule_compliance_pct=summary.stopping_rule_compliance_rate,
            actions_breakdown=summary.actions_breakdown,
        )

    @staticmethod
    def compute_decision_quality(
        summary: SimulationCohortSummary,
        ground_truths_dict: Dict[str, PaymentGroundTruth],
    ) -> DecisionQualityMetrics:
        """Evaluates causal regret of the policy's first action against the latent oracle."""
        payment_actions = summary.payment_actions or {}
        n_total = len(payment_actions)
        if n_total == 0:
            return DecisionQualityMetrics(
                total_decisions_evaluated=0,
                oracle_concordant_decisions=0,
                oracle_concordance_rate_pct=0.0,
                unnecessary_retry_count=0,
                unnecessary_retry_rate_pct=0.0,
                missed_recovery_opportunity_count=0,
                missed_recovery_opportunity_rate_pct=0.0,
                inappropriate_customer_friction_count=0,
                inappropriate_customer_friction_rate_pct=0.0,
                inappropriate_escalation_count=0,
                inappropriate_escalation_rate_pct=0.0,
                optimal_action_count=0,
            )

        concordant = 0
        unnecessary_retries = 0
        missed_opportunities = 0
        inappropriate_friction = 0
        inappropriate_escalations = 0

        fatal_causes = {
            "permanent_account_closure",
            "mandate_token_expired",
            "voluntary_churn_intent",
        }

        for pid, actions in payment_actions.items():
            if not actions:
                continue
            first_action = actions[0].action_type
            gt = ground_truths_dict.get(pid)
            if not gt:
                continue

            optimal_action = gt.optimal_recovery_action

            if first_action == optimal_action:
                concordant += 1
            else:
                # Classify regret type
                if first_action == ActionType.RETRY.value and gt.true_failure_cause in fatal_causes:
                    unnecessary_retries += 1
                elif first_action == ActionType.STOP.value and gt.ground_truth_recoverability > 0.3:
                    missed_opportunities += 1
                elif first_action == ActionType.PAYMENT_UPDATE_REQUEST.value and optimal_action == ActionType.RETRY.value:
                    inappropriate_friction += 1
                elif first_action == ActionType.HUMAN_ESCALATION.value and optimal_action in [ActionType.RETRY.value, ActionType.STOP.value]:
                    inappropriate_escalations += 1

        concordance_pct = round((concordant / n_total) * 100.0, 2)
        unnecessary_retry_pct = round((unnecessary_retries / n_total) * 100.0, 2)
        missed_opp_pct = round((missed_opportunities / n_total) * 100.0, 2)
        inappr_friction_pct = round((inappropriate_friction / n_total) * 100.0, 2)
        inappr_esc_pct = round((inappropriate_escalations / n_total) * 100.0, 2)

        return DecisionQualityMetrics(
            total_decisions_evaluated=n_total,
            oracle_concordant_decisions=concordant,
            oracle_concordance_rate_pct=concordance_pct,
            unnecessary_retry_count=unnecessary_retries,
            unnecessary_retry_rate_pct=unnecessary_retry_pct,
            missed_recovery_opportunity_count=missed_opportunities,
            missed_recovery_opportunity_rate_pct=missed_opp_pct,
            inappropriate_customer_friction_count=inappropriate_friction,
            inappropriate_customer_friction_rate_pct=inappr_friction_pct,
            inappropriate_escalation_count=inappropriate_escalations,
            inappropriate_escalation_rate_pct=inappr_esc_pct,
            optimal_action_count=concordant,
        )

    @staticmethod
    def compute_comparative_metrics(
        revora_summary: SimulationCohortSummary,
        baseline_summary: SimulationCohortSummary,
        ground_truths_dict: Dict[str, PaymentGroundTruth],
    ) -> ComparativeMetrics:
        """Computes comparative lift, intervention delta, and futile retry reduction."""
        rate_delta = revora_summary.recovery_rate_pct - baseline_summary.recovery_rate_pct
        base_rate = baseline_summary.recovery_rate_pct
        rel_improvement = ((rate_delta / base_rate) * 100.0) if base_rate > 0 else 0.0

        amount_delta = revora_summary.total_recovered_amount_inr - baseline_summary.total_recovered_amount_inr
        interv_delta = revora_summary.total_interventions_attempted - baseline_summary.total_interventions_attempted
        interv_reduction_pct = (
            (-interv_delta / baseline_summary.total_interventions_attempted * 100.0)
            if baseline_summary.total_interventions_attempted > 0
            else 0.0
        )

        rev_eff = (
            revora_summary.total_recovered_amount_inr / revora_summary.total_interventions_attempted
            if revora_summary.total_interventions_attempted > 0
            else 0.0
        )
        base_eff = (
            baseline_summary.total_recovered_amount_inr / baseline_summary.total_interventions_attempted
            if baseline_summary.total_interventions_attempted > 0
            else 0.0
        )

        # Count futile retries executed by baseline on permanent causes
        fatal_causes = {"permanent_account_closure", "mandate_token_expired", "voluntary_churn_intent"}
        base_futile_retries = 0
        base_actions = baseline_summary.payment_actions or {}
        for pid, acts in base_actions.items():
            gt = ground_truths_dict.get(pid)
            if gt and gt.true_failure_cause in fatal_causes:
                base_futile_retries += sum(1 for a in acts if a.action_type == ActionType.RETRY.value)

        rev_futile_retries = 0
        rev_actions = revora_summary.payment_actions or {}
        for pid, acts in rev_actions.items():
            gt = ground_truths_dict.get(pid)
            if gt and gt.true_failure_cause in fatal_causes:
                rev_futile_retries += sum(1 for a in acts if a.action_type == ActionType.RETRY.value)

        futile_prevented = max(0, base_futile_retries - rev_futile_retries)

        return ComparativeMetrics(
            random_seed=revora_summary.random_seed,
            absolute_revenue_recovery_rate_delta_pct=round(rate_delta, 2),
            relative_revenue_recovery_rate_improvement_pct=round(rel_improvement, 2),
            absolute_recovered_amount_delta_inr=round(amount_delta, 2),
            intervention_delta_count=interv_delta,
            intervention_reduction_pct=round(interv_reduction_pct, 2),
            recovery_efficiency_delta_inr=round(rev_eff - base_eff, 2),
            futile_retries_prevented=futile_prevented,
        )

    @staticmethod
    def compute_language_breakdown(
        payments: List[Payment],
        customers_dict: Dict[str, Customer],
        revora_summary: SimulationCohortSummary,
    ) -> List[LanguageBreakdownMetrics]:
        """Breaks down outreach and recovery by customer preferred language."""
        groups: Dict[str, Dict[str, Any]] = {
            "en": {
                "display_name": "English (en)",
                "cust_ids": set(),
                "payment_ids": [],
                "at_risk": 0.0,
                "recovered_cnt": 0,
                "recovered_amt": 0.0,
                "outreach_msgs": 0,
                "is_fallback": False,
            },
            "ta_tanglish": {
                "display_name": "Tamil / Tanglish (ta_tanglish)",
                "cust_ids": set(),
                "payment_ids": [],
                "at_risk": 0.0,
                "recovered_cnt": 0,
                "recovered_amt": 0.0,
                "outreach_msgs": 0,
                "is_fallback": False,
            },
            "hi_hinglish": {
                "display_name": "Hindi / Hinglish (hi_hinglish)",
                "cust_ids": set(),
                "payment_ids": [],
                "at_risk": 0.0,
                "recovered_cnt": 0,
                "recovered_amt": 0.0,
                "outreach_msgs": 0,
                "is_fallback": False,
            },
            "unknown_fallback_to_en": {
                "display_name": "Unknown -> Fallback English",
                "cust_ids": set(),
                "payment_ids": [],
                "at_risk": 0.0,
                "recovered_cnt": 0,
                "recovered_amt": 0.0,
                "outreach_msgs": 0,
                "is_fallback": True,
            },
        }

        payment_actions = revora_summary.payment_actions or {}

        for p in payments:
            cust = customers_dict.get(p.customer_id)
            pref = cust.preferred_language if cust else None

            if pref in ["ta", "ta_tanglish"]:
                grp_key = "ta_tanglish"
            elif pref in ["hi", "hi_hinglish"]:
                grp_key = "hi_hinglish"
            elif pref in ["en", "english"]:
                grp_key = "en"
            else:
                grp_key = "unknown_fallback_to_en"

            grp = groups[grp_key]
            if cust:
                grp["cust_ids"].add(cust.customer_id)
            grp["payment_ids"].append(p.payment_id)
            grp["at_risk"] += p.amount

            # Inspect realized outcome
            acts = payment_actions.get(p.payment_id, [])
            for act in acts:
                if act.message_sent:
                    grp["outreach_msgs"] += 1
                if act.outcome == ActionOutcome.RECOVERED.value:
                    grp["recovered_cnt"] += 1
                    grp["recovered_amt"] += act.recovered_amount

        result = []
        for key, g in groups.items():
            at_risk = g["at_risk"]
            rec_amt = g["recovered_amt"]
            rec_rate = (rec_amt / at_risk * 100.0) if at_risk > 0 else 0.0

            result.append(
                LanguageBreakdownMetrics(
                    language_code=key,
                    display_name=g["display_name"],
                    customer_count=len(g["cust_ids"]),
                    payments_count=len(g["payment_ids"]),
                    revenue_at_risk_inr=round(at_risk, 2),
                    recovered_payments=g["recovered_cnt"],
                    recovered_amount_inr=round(rec_amt, 2),
                    recovery_rate_pct=round(rec_rate, 2),
                    messages_dispatched=g["outreach_msgs"],
                    fallback_from_unknown=g["is_fallback"],
                )
            )

        return result

    @staticmethod
    def run_multi_seed_benchmark(
        payments: List[Payment],
        customers_dict: Dict[str, Customer],
        mandates_dict: Dict[str, Mandate],
        ground_truths_dict: Dict[str, PaymentGroundTruth],
        seeds: Optional[List[int]] = None,
    ) -> MultiSeedBenchmarkResult:
        """Runs identical-cohort multi-seed simulations and computes mean ± std."""
        if seeds is None:
            seeds = [42, 100, 555, 2026, 9999]

        rev_rates = []
        base_rates = []
        rev_amts = []
        base_amts = []
        deltas_amt = []
        rev_intervs = []
        base_intervs = []
        interv_reductions = []
        rev_concordances = []
        base_concordances = []

        total_risk = sum(p.amount for p in payments)

        for s in seeds:
            sim_rev = RecoverySimulator(seed=s)
            sum_rev = sim_rev.simulate_batch(payments, customers_dict, mandates_dict, ground_truths_dict, mode="revora")

            sim_base = RecoverySimulator(seed=s)
            sum_base = sim_base.simulate_batch(payments, customers_dict, mandates_dict, ground_truths_dict, mode="baseline")

            comp = EvaluationEngine.compute_comparative_metrics(sum_rev, sum_base, ground_truths_dict)
            rev_dq = EvaluationEngine.compute_decision_quality(sum_rev, ground_truths_dict)
            base_dq = EvaluationEngine.compute_decision_quality(sum_base, ground_truths_dict)

            rev_rates.append(sum_rev.recovery_rate_pct)
            base_rates.append(sum_base.recovery_rate_pct)
            rev_amts.append(sum_rev.total_recovered_amount_inr)
            base_amts.append(sum_base.total_recovered_amount_inr)
            deltas_amt.append(comp.absolute_recovered_amount_delta_inr)
            rev_intervs.append(sum_rev.total_interventions_attempted)
            base_intervs.append(sum_base.total_interventions_attempted)
            interv_reductions.append(comp.intervention_reduction_pct)
            rev_concordances.append(rev_dq.oracle_concordance_rate_pct)
            base_concordances.append(base_dq.oracle_concordance_rate_pct)

        def _stats(arr: List[float]) -> StatisticalSummary:
            m = statistics.mean(arr)
            st = statistics.stdev(arr) if len(arr) > 1 else 0.0
            return StatisticalSummary(
                mean=round(m, 2),
                std=round(st, 2),
                min=round(min(arr), 2),
                max=round(max(arr), 2),
            )

        return MultiSeedBenchmarkResult(
            seeds_evaluated=seeds,
            held_out_cohort_size=len(payments),
            total_revenue_at_risk_inr=round(total_risk, 2),
            revora_revenue_recovery_rate=_stats(rev_rates),
            baseline_revenue_recovery_rate=_stats(base_rates),
            revora_recovered_amount_inr=_stats(rev_amts),
            baseline_recovered_amount_inr=_stats(base_amts),
            recovered_amount_delta_inr=_stats(deltas_amt),
            revora_interventions=_stats(rev_intervs),
            baseline_interventions=_stats(base_intervs),
            intervention_reduction_pct=_stats(interv_reductions),
            revora_oracle_concordance_rate=_stats(rev_concordances),
            baseline_oracle_concordance_rate=_stats(base_concordances),
        )
