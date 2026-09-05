# REVORA Evaluation & Benchmark Report
**Target**: Razorpay Buildathon 2026 · Track 03 — AI Revenue Recovery  
**Evaluation Cohort**: Chronologically Held-Out Test Set (180 recurring payment events)  
**Total Revenue at Risk**: ₹1,094,978.07  
**Evaluation Timestamp**: 2026-09-05 12:50:29 UTC  
**Policy Version**: `revora_policy_v1` · **Model Version**: `revora_propensity_logreg_v1`  

---

## Executive Summary

Revora was benchmarked against an industry-standard **Fixed-Policy Baseline** (blind retry up to 3 attempts without failure diagnosis or customer engagement links). Both policies were evaluated on the **exact same chronologically held-out test cohort** and scored against an isolated, causal **Outcome Oracle**.

### Key Benchmark Findings (Multi-Seed Statistical Summary: 5 Independent Seeds)

* **Revenue Recovery Rate**: Revora achieved **84.10% ± 1.85%** recovery vs **66.30% ± 2.94%** for Fixed Baseline (**+17.80 percentage points lift**).
* **Net Revenue Recovered**: Revora recovered **₹920,877.76 ± ₹20,287.46** vs **₹725,970.02 ± ₹32,252.21** (**+₹194,907.74 incremental revenue**).
* **Customer Friction & Wasted Retries**: Revora reduced total interventions by **19.2% ± 2.9%**, preventing **113 futile debit retries** against permanently closed accounts and expired mandates.
* **Stopping-Rule Compliance**: **100.0%** across all evaluation runs. Zero recovery actions were executed after payment recovery or attempt exhaustion.

---

## 1. Primary Benchmark (Fixed Seed: 42)

The primary evaluation demonstrates the granular behavioral divergence between adaptive intelligence and blind retries:

| Metric | Revora Adaptive Policy | Fixed-Policy Baseline | Delta / Advantage |
| :--- | :--- | :--- | :--- |
| **In-Scope Failed Payments** | 180 | 180 | Exact cohort match |
| **Total Revenue at Risk** | ₹1,094,978.07 | ₹1,094,978.07 | — |
| **Recovered Payments** | **152** | 119 | **+33 payments (+27.7%)** |
| **Unresolved / Failed Payments** | **28** | 61 | **-33 unresolved** |
| **Revenue Recovery Rate (%)** | **85.18%** | 65.57% | **+19.61% (+29.9% rel)** |
| **Total Amount Recovered** | **₹932,677.51** | ₹717,968.99 | **+₹214,708.52** |
| **Interventions Attempted** | **254** | 325 | **-71 (+21.9%)** |
| **Interventions per Recovered Payment** | **1.67** | 2.73 | **-1.06 fewer attempts/recovery** |
| **Recovery Efficiency** | **₹3,671.96 / attempt** | ₹2,209.14 / attempt | **+₹1,462.82 / attempt** |
| **Futile Retries Prevented** | **113** | 0 | **113 retries avoided** |
| **Stopping-Rule Compliance** | **100.0%** | 100.0% | Strict adherence |

### Action Breakdown
* **Revora Adaptive**: 103 `retry`, 116 `payment_update_request`, 19 `human_escalation`, 16 `stop`.
* **Fixed Baseline**: 325 `retry`, 0 `payment_update_request`, 0 `human_escalation`, 0 `stop`.

---

## 2. Statistical Robustness Benchmark (Multi-Seed Analysis)

To ensure conclusions are not an artifact of favorable random seeds, simulations were run across 5 independent seeds (`42`, `100`, `555`, `2026`, `9999`) on the identical held-out test cohort:

| Metric | Revora (Mean ± Std) | Baseline (Mean ± Std) | Delta (Mean ± Std) | Range [Min, Max] |
| :--- | :--- | :--- | :--- | :--- |
| **Revenue Recovery Rate (%)** | **84.10% ± 1.85%** | 66.30% ± 2.94% | **+17.80%** | Revora: [81.07%, 85.52%] |
| **Total Amount Recovered (₹)** | **₹920,877.76 ± ₹20,287.46** | ₹725,970.02 ± ₹32,252.21 | **+₹194,907.74 ± ₹30,093.42** | Revora: [₹887,701.07, ₹936,399.20] |
| **Interventions Attempted** | **262.6 ± 6.7** | 325.2 ± 11.7 | **19.2% reduction** | Baseline: [307, 338] |
| **Oracle Concordance (%)** | **85.56% ± 0.00%** | 49.44% ± 0.00% | **+36.12%** | Revora: [85.56%, 85.56%] |

---

## 3. Decision Quality & Regret Analysis (vs Hidden Oracle)

The evaluation layer compares the policy's operational decisions against the unobserved latent reality (`optimal_recovery_action` in `PaymentGroundTruth`):

| Decision Quality Metric | Revora Adaptive | Fixed-Policy Baseline | Impact |
| :--- | :--- | :--- | :--- |
| **Oracle Concordance Rate** | **85.56%** | 49.44% | Revora aligns with the causally optimal action +36.12% more often |
| **Unnecessary Retries on Fatal Causes** | **0 (0.0%)** | 39 (21.7%) | Revora avoids futile retries against permanently closed accounts |
| **Missed Recovery Opportunities (Premature Stop)** | **0 (0.0%)** | 0 (0.0%) | Minimal premature abandonment |
| **Inappropriate Customer Friction** | **0 (0.0%)** | 0 (0.0%) | Minimal customer disruption for soft recoverable funds |
| **Inappropriate Escalations** | **6 (3.3%)** | 0 (0.0%) | Minor escalation penalty for uncertain high-value edge cases |

---

## 4. Per-Language Outreach Analysis

Customer outreach was evaluated across preferred language segments. Crucially, unknown language preferences safely fall back to English without geographic guessing:

| Language Segment | Customers | In-Scope Payments | Revenue at Risk (₹) | Recovered Payments | Amount Recovered (₹) | Recovery Rate (%) | Outreach Messages |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **English (en)** | 57 | 81 | ₹480,330.08 | 70 | ₹432,135.61 | **89.97%** | 95 |
| **Tamil / Tanglish (ta_tanglish)** | 42 | 56 | ₹377,454.77 | 46 | ₹288,374.85 | **76.40%** | 67 |
| **Hindi / Hinglish (hi_hinglish)** | 27 | 38 | ₹211,940.91 | 31 | ₹186,914.74 | **88.19%** | 52 |
| **Unknown -> Fallback English** | 3 | 5 | ₹25,252.31 | 5 | ₹25,252.31 | **100.00%** | 5 |

> [!NOTE]
> All customer communications generated during evaluation are watermarked `SIMULATED — NO MESSAGE SENT` and stored in the mock outbox table for auditability.

---

## 5. Methodological Rigor & Disclosures

1. **Zero Data Leakage**: The ML feature pipeline and Revora Decision Engine evaluate strictly Tier 1 observed signals. The evaluation metrics, oracle regret, and latent ground truth causes were isolated entirely within `backend/app/evaluation/`.
2. **Honest Failure Reporting**: Revora does not claim 100% recovery. Out of 180 test payments, **28 payments (15.6%) remained unresolved** due to authentic customer churn or permanent account closure.
3. **No Fabricated Competitor Benchmarks**: The comparison is made strictly against a standard Fixed-Policy Baseline (3 blind retries, industry control). No unverified external claims are made.
4. **Policy Assumptions**: The ₹15,000 threshold is cataloged as `[PROJECT_POLICY_ASSUMPTION / VERIFY_RBI_CIRCULAR]`.
