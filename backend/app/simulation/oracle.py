"""Outcome Oracle — Driven strictly by Hidden Ground Truth.

CRITICAL ARCHITECTURAL ISOLATION:
This module has access to `PaymentGroundTruth` (Tier 2 latent cause & Tier 3 propensity)
to simulate what physically happens when an action is executed.
The Decision Engine MUST NEVER have access to this module or its latent causal distributions.
"""
import random
from dataclasses import dataclass
from typing import Tuple

from backend.app.core.constants import ActionType, ActionOutcome, MandateStatus
from backend.app.models.ground_truth import PaymentGroundTruth


@dataclass(frozen=True)
class SimulatedOutcomeResult:
    is_recovered: bool
    outcome: ActionOutcome
    effective_recovery_probability: float
    simulated_reason: str


class OutcomeOracle:
    """Simulates real-world payment recovery outcomes based on latent ground-truth dynamics."""

    @staticmethod
    def simulate_action_outcome(
        action: ActionType,
        ground_truth: PaymentGroundTruth,
        mandate_status: str,
        attempt_number: int = 1,
        rng: random.Random = None,
    ) -> SimulatedOutcomeResult:
        """Evaluate action efficacy against the hidden ground truth using seeded RNG."""
        if rng is None:
            rng = random.Random()

        true_cause = ground_truth.true_failure_cause
        latent_propensity = ground_truth.ground_truth_recoverability

        # ======================================================================
        # 1. Action: STOP
        # Automated recovery ceased. Funds remain unrecovered.
        # ======================================================================
        if action == ActionType.STOP:
            return SimulatedOutcomeResult(
                is_recovered=False,
                outcome=ActionOutcome.UNRESOLVED,
                effective_recovery_probability=0.0,
                simulated_reason="Recovery stopped by policy; zero automated recovery attempted.",
            )

        # ======================================================================
        # 2. Action: RETRY
        # Automated retry executed against banking switch / mandate.
        # ======================================================================
        if action == ActionType.RETRY:
            # Cannot debit an expired or revoked mandate
            if mandate_status in [MandateStatus.EXPIRED.value, MandateStatus.REVOKED.value]:
                return SimulatedOutcomeResult(
                    is_recovered=False,
                    outcome=ActionOutcome.FAILED,
                    effective_recovery_probability=0.0,
                    simulated_reason=f"Retry rejected: Mandate status is '{mandate_status}'.",
                )

            # Permanent account closure will reject retry
            if true_cause == "permanent_account_closure":
                prob = 0.02
                sim_reason = "Retry failed: Account permanently closed or frozen by bank."
            # Mandate expired in backend token store
            elif true_cause == "mandate_token_expired":
                prob = 0.05
                sim_reason = "Retry failed: Token expired at bank gateway."
            # Transient soft failure: high success rate
            elif true_cause in ["temporary_salary_delay", "temporary_bank_outage"]:
                # Success rate decays slightly with attempt number
                decay = 0.05 * (attempt_number - 1)
                prob = min(0.95, max(0.10, latent_propensity * 1.05 - decay))
                sim_reason = f"Soft failure retry: probability {prob:.2f} based on recovered banking state."
            # Customer intentional churn or auth issue
            else:
                decay = 0.08 * (attempt_number - 1)
                prob = max(0.05, latent_propensity * 0.65 - decay)
                sim_reason = f"Retry on customer-side issue: probability {prob:.2f}."

            recovered = rng.random() < prob
            outcome = ActionOutcome.RECOVERED if recovered else ActionOutcome.FAILED
            return SimulatedOutcomeResult(
                is_recovered=recovered,
                outcome=outcome,
                effective_recovery_probability=round(prob, 4),
                simulated_reason=sim_reason if not recovered else "Payment successfully charged on retry.",
            )

        # ======================================================================
        # 3. Action: PAYMENT_UPDATE_REQUEST
        # Customer receives simulated notification and update link.
        # ======================================================================
        if action == ActionType.PAYMENT_UPDATE_REQUEST:
            # Mandate expired or auth required: update link directly solves the problem!
            if true_cause in ["mandate_token_expired", "auth_otp_missed"]:
                prob = min(0.88, max(0.20, latent_propensity * 1.15))
                sim_reason = "Customer updated mandate / authorized payment via secure link."
            elif true_cause == "voluntary_churn_intent":
                # Customer intentionally disengaged; low update rate
                prob = max(0.08, latent_propensity * 0.40)
                sim_reason = "Customer ignored payment update request due to voluntary churn."
            elif true_cause == "permanent_account_closure":
                # Customer may provide a new bank account or card
                prob = max(0.10, latent_propensity * 0.50)
                sim_reason = "Customer provided alternate payment method."
            else:
                # Soft failure: sending an update link adds friction compared to automatic retry
                prob = max(0.15, latent_propensity * 0.75)
                sim_reason = "Customer updated payment method following outreach."

            recovered = rng.random() < prob
            outcome = ActionOutcome.RECOVERED if recovered else ActionOutcome.FAILED
            return SimulatedOutcomeResult(
                is_recovered=recovered,
                outcome=outcome,
                effective_recovery_probability=round(prob, 4),
                simulated_reason=sim_reason if not recovered else "Customer completed payment method update; payment charged.",
            )

        # ======================================================================
        # 4. Action: HUMAN_ESCALATION
        # Manual outreach by support operations agent.
        # ======================================================================
        if action == ActionType.HUMAN_ESCALATION:
            if true_cause == "permanent_account_closure":
                prob = 0.15  # Agent might obtain alternative billing details
            else:
                prob = min(0.80, max(0.25, 0.35 + 0.45 * latent_propensity))

            recovered = rng.random() < prob
            outcome = ActionOutcome.RECOVERED if recovered else ActionOutcome.FAILED
            return SimulatedOutcomeResult(
                is_recovered=recovered,
                outcome=outcome,
                effective_recovery_probability=round(prob, 4),
                simulated_reason="Manual operations outreach conducted." if not recovered else "Operations resolved payment issue; charge completed.",
            )

        return SimulatedOutcomeResult(
            is_recovered=False,
            outcome=ActionOutcome.UNRESOLVED,
            effective_recovery_probability=0.0,
            simulated_reason="Unrecognized action.",
        )
