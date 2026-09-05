"""Revora Synthetic Data Generator.

Generates realistic recurring payment records for testing, ML training, and evaluation
with strict 4-way ground-truth separation:
- Tier 1: Observed Provider Signals (Payment, Customer, Mandate)
- Tier 2: Hidden True Failure Cause (PaymentGroundTruth)
- Tier 3: Hidden Recovery Likelihood & Latent Oracle Action (PaymentGroundTruth)
- Tier 4: Realized Simulated Recovery Outcome (Empty at generation; populated at simulation)

Time-aware split: 70% Train, 15% Validation, 15% Held-Out Test.
Zero Data Leakage: Hidden fields are stored strictly in `payment_ground_truth`.
"""
import argparse
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np

# Ensure backend can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config import DATA_DIR, DOCS_DIR
from backend.app.core.constants import (
    PaymentRail,
    PaymentStatus,
    FailureCode,
    FailureSource,
    MandateStatus,
    CustomerLanguage,
    ActionType,
    EvaluationSplit,
)
from backend.app.database import SessionLocal, init_db
from backend.app.models import Customer, Mandate, Payment, PaymentGroundTruth


INDIAN_NAMES = [
    "Aarav Sharma", "Priya Nair", "Karthik Subramanian", "Ananya Iyer",
    "Rahul Verma", "Deepa Sundaram", "Aditya Patel", "Divya Menon",
    "Siddharth Rao", "Meera Krishnan", "Vikram Malhotra", "Sneha Joshi",
    "Arjun Nambiar", "Pooja Venkatesh", "Rohan Kulkarni", "Lakshmi Pillai",
    "Varun Deshmukh", "Swati Chawla", "Harish Natarajan", "Bhavna Gupta",
    "Gautam Banerjee", "Kavita Reddy", "Naveen Balaji", "Ritu Sengupta",
    "Sanjay Narayanan", "Anand Swaminathan", "Neha Agarwal", "Manoj Tiwari",
    "Keerthi Rajan", "Abhishek Das", "Sandhya Murthy", "Pranav Hegde",
    "Aishwarya Ramaswamy", "Tarun Saxena", "Preeti Bhatt", "Kishore Kumar",
    "Shalini Srinivasan", "Rajesh Pillai", "Tanvi Mukhopadhyay", "Alok Mishra"
]

REGIONS = [
    "Tamil Nadu", "Maharashtra", "Karnataka", "Delhi NCR",
    "Telangana", "Kerala", "Gujarat", "West Bengal"
]

PLANS = [
    {"name": "starter_monthly", "amount": 499.0},
    {"name": "pro_monthly", "amount": 1499.0},
    {"name": "business_monthly", "amount": 4999.0},
    {"name": "enterprise_monthly", "amount": 12999.0},
]


def generate_synthetic_dataset(
    num_payments: int = 1200,
    seed: int = 42,
    db_session = None
) -> dict:
    """Generate synthetic recurring payment dataset with strict 4-way separation."""
    random.seed(seed)
    np.random.seed(seed)
    
    num_customers = max(200, num_payments // 4)
    base_date = datetime(2026, 1, 1, 9, 0, 0)
    
    customers = []
    mandates = []
    payments = []
    ground_truths = []
    
    # 1. Generate Customers
    for i in range(num_customers):
        cust_id = f"cust_rev_{i+1:04d}"
        name = random.choice(INDIAN_NAMES)
        region = random.choice(REGIONS)
        
        # Explicit customer language preference (NEVER inferred from region)
        lang_choice = random.choices(
            [CustomerLanguage.EN, CustomerLanguage.TA_TANGLISH, CustomerLanguage.HI_HINGLISH, CustomerLanguage.UNKNOWN],
            weights=[0.45, 0.25, 0.25, 0.05]
        )[0]
        
        plan = random.choice(PLANS)
        tenure_days = random.randint(30, 720)
        signup_dt = base_date - timedelta(days=tenure_days)
        
        cust = Customer(
            customer_id=cust_id,
            name=name,
            preferred_language=lang_choice.value,
            region=region,
            subscription_plan=plan["name"],
            signup_date=signup_dt,
            customer_tenure_days=tenure_days,
            created_at=signup_dt,
        )
        customers.append(cust)
        
        # 2. Generate Mandate for Customer
        # 70% UPI AutoPay (primary production rail), 30% Card
        rail = random.choices(
            [PaymentRail.UPI_AUTOPAY, PaymentRail.CARD],
            weights=[0.70, 0.30]
        )[0]
        
        # Mandate status: mostly active, small fraction expired or revoked
        mandate_status = random.choices(
            [MandateStatus.ACTIVE, MandateStatus.PENDING, MandateStatus.EXPIRED, MandateStatus.REVOKED],
            weights=[0.82, 0.06, 0.07, 0.05]
        )[0]
        
        mandate_id = f"man_rev_{i+1:04d}"
        mandate_age = min(tenure_days, random.randint(15, tenure_days))
        
        mandate = Mandate(
            mandate_id=mandate_id,
            customer_id=cust_id,
            payment_method=rail.value,
            mandate_status=mandate_status.value,
            last_successful_charge_date=base_date - timedelta(days=random.randint(1, 35)),
            max_amount_per_debit=15000.0,
            authentication_required=False,
            mandate_age_days=mandate_age,
            created_at=signup_dt + timedelta(days=1),
        )
        mandates.append(mandate)

    # 3. Generate Payments with Realistic Historical Correlations & Latent Causes
    raw_payment_records = []
    
    # We distribute payments across customers
    for p_idx in range(num_payments):
        cust = random.choice(customers)
        # Find customer's mandate
        mandate = next(m for m in mandates if m.customer_id == cust.customer_id)
        
        # Match plan base amount with slight tier variation
        plan_meta = next(p for p in PLANS if p["name"] == cust.subscription_plan)
        base_amt = plan_meta["amount"]
        # Slight jitter or usage add-on
        amount = round(base_amt * random.uniform(0.95, 1.15), 2)
        
        # Payment timeline: spread over the last 90 days
        day_offset = random.randint(0, 90)
        due_dt = base_date + timedelta(days=day_offset, hours=random.randint(8, 20), minutes=random.randint(0, 59))
        attempt_dt = due_dt + timedelta(minutes=random.randint(2, 45))
        
        # Customer behavioral features
        historical_cycles = max(1, cust.customer_tenure_days // 30)
        
        # True underlying latent cause (Tier 2 Hidden Ground Truth)
        true_cause = random.choices(
            [
                "temporary_salary_delay",     # soft funds delay
                "temporary_bank_outage",      # transient gateway downtime
                "auth_otp_missed",            # conditional customer auth issue
                "mandate_token_expired",      # payment method expired
                "permanent_account_closure",  # hard closure / fraud block
                "voluntary_churn_intent"      # intentional stop by customer
            ],
            weights=[0.38, 0.22, 0.15, 0.12, 0.05, 0.08]
        )[0]
        
        # Map true cause to Observed Provider Failure Code & Source (Tier 1)
        if true_cause == "temporary_salary_delay":
            failure_code = FailureCode.INSUFFICIENT_FUNDS
            error_source = FailureSource.CUSTOMER
            error_step = "payment_authorization"
        elif true_cause == "temporary_bank_outage":
            failure_code = FailureCode.BANK_TIMEOUT
            error_source = FailureSource.GATEWAY
            error_step = "payment_authorization"
        elif true_cause == "auth_otp_missed":
            failure_code = FailureCode.AUTHENTICATION_REQUIRED
            error_source = FailureSource.CUSTOMER
            error_step = "payment_authentication"
        elif true_cause == "mandate_token_expired":
            failure_code = FailureCode.EXPIRED_MANDATE
            error_source = FailureSource.BUSINESS
            error_step = "payment_authorization"
        elif true_cause == "permanent_account_closure":
            failure_code = FailureCode.BLOCKED_ACCOUNT
            error_source = FailureSource.GATEWAY
            error_step = "payment_authorization"
        else: # voluntary_churn_intent
            failure_code = random.choice([FailureCode.INSUFFICIENT_FUNDS, FailureCode.UNKNOWN])
            error_source = FailureSource.CUSTOMER
            error_step = "payment_authorization"
            
        # Attempt tracking
        native_retry = random.choices([0, 1, 2], weights=[0.60, 0.25, 0.15])[0]
        consecutive_failures = min(3, native_retry + 1)
        days_since_last_success = random.randint(15, 60) if historical_cycles > 1 else 0
        
        # Historical success rate influenced by customer tenure and reliability
        if true_cause == "voluntary_churn_intent":
            hist_success_rate = round(random.uniform(0.35, 0.70), 2)
        else:
            hist_success_rate = round(random.uniform(0.75, 1.0), 2)
            
        # Calculate Hidden Recovery Likelihood / Propensity (Tier 3)
        # Latent causal function + Gaussian noise
        base_propensity = {
            "temporary_salary_delay": 0.82,
            "temporary_bank_outage": 0.88,
            "auth_otp_missed": 0.65,
            "mandate_token_expired": 0.35,
            "permanent_account_closure": 0.04,
            "voluntary_churn_intent": 0.15,
        }[true_cause]
        
        # Modulate by customer history
        history_mod = (hist_success_rate - 0.75) * 0.25
        attempt_penalty = -0.08 * native_retry
        mandate_penalty = -0.45 if mandate.mandate_status in ["expired", "revoked"] else 0.0
        tenure_bonus = min(0.08, (cust.customer_tenure_days / 720.0) * 0.08)
        
        # Stochastic noise N(0, 0.06^2)
        noise = float(np.random.normal(0, 0.06))
        
        latent_recoverability = base_propensity + history_mod + attempt_penalty + mandate_penalty + tenure_bonus + noise
        latent_recoverability = round(float(np.clip(latent_recoverability, 0.05, 0.95)), 4)
        
        # Determine Latent Oracle Action (optimal under ground truth)
        if true_cause in ["temporary_salary_delay", "temporary_bank_outage"]:
            if mandate.mandate_status == "active" and native_retry < 3:
                optimal_action = ActionType.RETRY
            else:
                optimal_action = ActionType.PAYMENT_UPDATE_REQUEST
        elif true_cause in ["auth_otp_missed", "mandate_token_expired"] or mandate.mandate_status in ["expired", "revoked"]:
            optimal_action = ActionType.PAYMENT_UPDATE_REQUEST
        elif true_cause == "permanent_account_closure" or native_retry >= 3:
            optimal_action = ActionType.STOP
        else: # voluntary churn or high value friction
            if amount > 4000.0 and latent_recoverability > 0.25:
                optimal_action = ActionType.HUMAN_ESCALATION
            else:
                optimal_action = ActionType.PAYMENT_UPDATE_REQUEST
                
        raw_payment_records.append({
            "p_idx": p_idx + 1,
            "cust_id": cust.customer_id,
            "mandate_id": mandate.mandate_id,
            "amount": amount,
            "rail": mandate.payment_method,
            "due_dt": due_dt,
            "attempt_dt": attempt_dt,
            "failure_code": failure_code.value,
            "error_source": error_source.value,
            "error_step": error_step,
            "native_retry": native_retry,
            "days_since_last_success": days_since_last_success,
            "hist_cycles": historical_cycles,
            "hist_success_rate": hist_success_rate,
            "consecutive_failures": consecutive_failures,
            # Ground truth fields
            "true_cause": true_cause,
            "ground_truth_recoverability": latent_recoverability,
            "optimal_action": optimal_action.value,
        })

    # 4. Time-Aware Split (70% Train, 15% Validation, 15% Held-Out Test)
    # Sort chronologically by due_date to guarantee zero temporal leakage
    raw_payment_records.sort(key=lambda x: x["due_dt"])
    
    n_total = len(raw_payment_records)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)
    
    for idx, rec in enumerate(raw_payment_records):
        if idx < n_train:
            split = EvaluationSplit.TRAIN.value
        elif idx < n_train + n_val:
            split = EvaluationSplit.VALIDATION.value
        else:
            split = EvaluationSplit.TEST.value
            
        pid = f"pay_rev_{rec['p_idx']:05d}"
        
        # Tier 1 Payment Entity
        payment = Payment(
            payment_id=pid,
            customer_id=rec["cust_id"],
            mandate_id=rec["mandate_id"],
            amount=rec["amount"],
            currency="INR",
            due_date=rec["due_dt"],
            payment_attempt_date=rec["attempt_dt"],
            status=PaymentStatus.FAILED.value,
            failure_code=rec["failure_code"],
            error_source=rec["error_source"],
            error_step=rec["error_step"],
            payment_rail=rec["rail"],
            native_retry_attempt=rec["native_retry"],
            days_since_last_success=rec["days_since_last_success"],
            historical_cycle_count=rec["hist_cycles"],
            historical_success_rate=rec["hist_success_rate"],
            consecutive_failure_count=rec["consecutive_failures"],
            created_at=rec["attempt_dt"],
        )
        payments.append(payment)
        
        # Tier 2 & 3 Ground Truth Entity (Evaluation Only)
        gt = PaymentGroundTruth(
            payment_id=pid,
            true_failure_cause=rec["true_cause"],
            ground_truth_recoverability=rec["ground_truth_recoverability"],
            optimal_recovery_action=rec["optimal_action"],
            evaluation_split=split,
            created_at=rec["attempt_dt"],
        )
        ground_truths.append(gt)

    # 5. Commit to Database if session provided
    if db_session:
        db_session.query(PaymentGroundTruth).delete()
        db_session.query(Payment).delete()
        db_session.query(Mandate).delete()
        db_session.query(Customer).delete()
        db_session.commit()
        
        db_session.add_all(customers)
        db_session.add_all(mandates)
        db_session.add_all(payments)
        db_session.add_all(ground_truths)
        db_session.commit()

    # 6. Compute Dataset Metrics for Quality Report
    total_revenue_at_risk = sum(p.amount for p in payments)
    rail_counts = {}
    for p in payments:
        rail_counts[p.payment_rail] = rail_counts.get(p.payment_rail, 0) + 1
        
    failure_counts = {}
    for p in payments:
        failure_counts[p.failure_code] = failure_counts.get(p.failure_code, 0) + 1
        
    lang_counts = {}
    for c in customers:
        lang_counts[c.preferred_language] = lang_counts.get(c.preferred_language, 0) + 1
        
    mandate_counts = {}
    for m in mandates:
        mandate_counts[m.mandate_status] = mandate_counts.get(m.mandate_status, 0) + 1
        
    split_counts = {}
    for g in ground_truths:
        split_counts[g.evaluation_split] = split_counts.get(g.evaluation_split, 0) + 1
        
    gt_scores = [g.ground_truth_recoverability for g in ground_truths]
    
    summary = {
        "metadata": {
            "generator": "Revora Synthetic Data Generator v1.0",
            "generation_timestamp": datetime.utcnow().isoformat(),
            "random_seed": seed,
            "temporal_window_start": min(p.due_date for p in payments).isoformat(),
            "temporal_window_end": max(p.due_date for p in payments).isoformat(),
            "explicitly_synthetic": True,
        },
        "volume": {
            "total_customers": len(customers),
            "total_mandates": len(mandates),
            "total_failed_payments": len(payments),
            "total_revenue_at_risk_inr": round(total_revenue_at_risk, 2),
            "average_payment_amount_inr": round(total_revenue_at_risk / len(payments), 2),
            "min_payment_amount_inr": min(p.amount for p in payments),
            "max_payment_amount_inr": max(p.amount for p in payments),
        },
        "distributions": {
            "payment_rails": rail_counts,
            "failure_codes": failure_counts,
            "customer_preferred_languages": lang_counts,
            "mandate_statuses": mandate_counts,
            "evaluation_splits": split_counts,
        },
        "ground_truth_evaluation_only": {
            "mean_recoverability": round(float(np.mean(gt_scores)), 4),
            "std_recoverability": round(float(np.std(gt_scores)), 4),
            "min_recoverability": round(float(np.min(gt_scores)), 4),
            "max_recoverability": round(float(np.max(gt_scores)), 4),
            "median_recoverability": round(float(np.median(gt_scores)), 4),
            "true_failure_causes": {
                cause: sum(1 for g in ground_truths if g.true_failure_cause == cause)
                for cause in set(g.true_failure_cause for g in ground_truths)
            },
            "latent_optimal_actions": {
                act: sum(1 for g in ground_truths if g.optimal_recovery_action == act)
                for act in set(g.optimal_recovery_action for g in ground_truths)
            }
        }
    }
    
    return summary


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic recurring payment dataset for Revora")
    parser.add_argument("--count", type=int, default=1200, help="Number of payment records to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--save-db", action="store_true", default=True, help="Save to SQLite database")
    args = parser.parse_args()

    print(f"[Revora Data Generator] Initializing database and generating {args.count} records (seed={args.seed})...")
    init_db()
    
    session = SessionLocal() if args.save_db else None
    try:
        summary = generate_synthetic_dataset(num_payments=args.count, seed=args.seed, db_session=session)
    finally:
        if session:
            session.close()

    # Save JSON report
    report_json_path = DATA_DIR / "dataset_report.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"[Revora Data Generator] JSON report saved to {report_json_path}")

    # Generate Markdown report
    report_md_path = DOCS_DIR / "dataset-report.md"
    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(f"""# Revora Synthetic Dataset Report

**Generation Timestamp**: {summary['metadata']['generation_timestamp']}  
**Random Seed**: {summary['metadata']['random_seed']}  
**Explicitly Synthetic**: Yes (Engineered for Indian recurring payment failure recovery simulation)

---

## 1. Summary Statistics

| Metric | Value |
| :--- | :--- |
| **Total Customers** | {summary['volume']['total_customers']:,} |
| **Total Mandates** | {summary['volume']['total_mandates']:,} |
| **Total Failed Recurring Payments** | {summary['volume']['total_failed_payments']:,} |
| **Total Revenue at Risk** | ₹{summary['volume']['total_revenue_at_risk_inr']:,.2f} |
| **Average Amount per Payment** | ₹{summary['volume']['average_payment_amount_inr']:,.2f} |
| **Amount Range** | ₹{summary['volume']['min_payment_amount_inr']:,.2f} – ₹{summary['volume']['max_payment_amount_inr']:,.2f} |
| **Temporal Window** | {summary['metadata']['temporal_window_start'][:10]} to {summary['metadata']['temporal_window_end'][:10]} |

---

## 2. Operational Distributions (Tier 1 Observed Signals)

### Payment Rails
| Rail | Count | Percentage |
| :--- | :--- | :--- |
| **UPI AutoPay** | {summary['distributions']['payment_rails'].get('upi_autopay', 0)} | {summary['distributions']['payment_rails'].get('upi_autopay', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| **Card** | {summary['distributions']['payment_rails'].get('card', 0)} | {summary['distributions']['payment_rails'].get('card', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |

### Failure Code Distribution
| Failure Code | Category | Count | Percentage |
| :--- | :--- | :--- | :--- |
| `insufficient_funds` | Soft (Funds delay) | {summary['distributions']['failure_codes'].get('insufficient_funds', 0)} | {summary['distributions']['failure_codes'].get('insufficient_funds', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| `bank_timeout` | Soft (Gateway timeout) | {summary['distributions']['failure_codes'].get('bank_timeout', 0)} | {summary['distributions']['failure_codes'].get('bank_timeout', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| `authentication_required` | Action Required | {summary['distributions']['failure_codes'].get('authentication_required', 0)} | {summary['distributions']['failure_codes'].get('authentication_required', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| `expired_mandate` | Action Required | {summary['distributions']['failure_codes'].get('expired_mandate', 0)} | {summary['distributions']['failure_codes'].get('expired_mandate', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| `blocked_account` | Hard (Terminal) | {summary['distributions']['failure_codes'].get('blocked_account', 0)} | {summary['distributions']['failure_codes'].get('blocked_account', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |
| `unknown` | Ambiguous | {summary['distributions']['failure_codes'].get('unknown', 0)} | {summary['distributions']['failure_codes'].get('unknown', 0) / summary['volume']['total_failed_payments'] * 100:.1f}% |

### Customer Preferred Language
*Note: Stored strictly from explicit profile preference; never inferred from region.*

| Language | Count | Percentage |
| :--- | :--- | :--- |
| **English (`en`)** | {summary['distributions']['customer_preferred_languages'].get('en', 0)} | {summary['distributions']['customer_preferred_languages'].get('en', 0) / summary['volume']['total_customers'] * 100:.1f}% |
| **Tamil / Tanglish (`ta_tanglish`)** | {summary['distributions']['customer_preferred_languages'].get('ta_tanglish', 0)} | {summary['distributions']['customer_preferred_languages'].get('ta_tanglish', 0) / summary['volume']['total_customers'] * 100:.1f}% |
| **Hindi / Hinglish (`hi_hinglish`)** | {summary['distributions']['customer_preferred_languages'].get('hi_hinglish', 0)} | {summary['distributions']['customer_preferred_languages'].get('hi_hinglish', 0) / summary['volume']['total_customers'] * 100:.1f}% |
| **Unknown (Fallback to English)** | {summary['distributions']['customer_preferred_languages'].get('unknown', 0)} | {summary['distributions']['customer_preferred_languages'].get('unknown', 0) / summary['volume']['total_customers'] * 100:.1f}% |

---

## 3. Time-Aware Partition Splits (Zero Future Leakage)

| Split | Count | Share | Temporal Purpose |
| :--- | :--- | :--- | :--- |
| **Train** | {summary['distributions']['evaluation_splits'].get('train', 0)} | 70% | Initial ML model training |
| **Validation** | {summary['distributions']['evaluation_splits'].get('validation', 0)} | 15% | Hyperparameter tuning & threshold calibration |
| **Held-Out Test** | {summary['distributions']['evaluation_splits'].get('test', 0)} | 15% | Untouched out-of-sample benchmark evaluation |

---

## 4. Evaluation-Only Ground Truth (Tiers 2 & 3)

> [!WARNING]
> The statistics in this section are derived strictly from `payment_ground_truth` and are **inaccessible to the operational decision engine and ML features**.

### Latent Recovery Propensity (Oracle Distribution)
- **Mean Score**: {summary['ground_truth_evaluation_only']['mean_recoverability']:.4f}
- **Std Dev**: {summary['ground_truth_evaluation_only']['std_recoverability']:.4f}
- **Median**: {summary['ground_truth_evaluation_only']['median_recoverability']:.4f}
- **Range**: [{summary['ground_truth_evaluation_only']['min_recoverability']:.4f}, {summary['ground_truth_evaluation_only']['max_recoverability']:.4f}]

### Latent Oracle Optimal Action Breakdown
Used exclusively for computing Decision Regret during evaluation:
{chr(10).join([f"- **`{k}`**: {v} ({v/summary['volume']['total_failed_payments']*100:.1f}%)" for k, v in summary['ground_truth_evaluation_only']['latent_optimal_actions'].items()])}
""")
    print(f"[Revora Data Generator] Markdown report saved to {report_md_path}")
    print("[Revora Data Generator] Synthetic generation completed successfully.")


if __name__ == "__main__":
    main()
