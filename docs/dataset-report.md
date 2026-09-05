# Revora Synthetic Dataset Report

**Generation Timestamp**: 2026-09-05T11:20:56.504198  
**Random Seed**: 42  
**Explicitly Synthetic**: Yes (Engineered for Indian recurring payment failure recovery simulation)

---

## 1. Summary Statistics

| Metric | Value |
| :--- | :--- |
| **Total Customers** | 300 |
| **Total Mandates** | 300 |
| **Total Failed Recurring Payments** | 1,200 |
| **Total Revenue at Risk** | ₹6,753,279.55 |
| **Average Amount per Payment** | ₹5,627.73 |
| **Amount Range** | ₹474.68 – ₹14,925.50 |
| **Temporal Window** | 2026-01-01 to 2026-04-02 |

---

## 2. Operational Distributions (Tier 1 Observed Signals)

### Payment Rails
| Rail | Count | Percentage |
| :--- | :--- | :--- |
| **UPI AutoPay** | 892 | 74.3% |
| **Card** | 308 | 25.7% |

### Failure Code Distribution
| Failure Code | Category | Count | Percentage |
| :--- | :--- | :--- | :--- |
| `insufficient_funds` | Soft (Funds delay) | 485 | 40.4% |
| `bank_timeout` | Soft (Gateway timeout) | 264 | 22.0% |
| `authentication_required` | Action Required | 180 | 15.0% |
| `expired_mandate` | Action Required | 151 | 12.6% |
| `blocked_account` | Hard (Terminal) | 74 | 6.2% |
| `unknown` | Ambiguous | 46 | 3.8% |

### Customer Preferred Language
*Note: Stored strictly from explicit profile preference; never inferred from region.*

| Language | Count | Percentage |
| :--- | :--- | :--- |
| **English (`en`)** | 133 | 44.3% |
| **Tamil / Tanglish (`ta_tanglish`)** | 96 | 32.0% |
| **Hindi / Hinglish (`hi_hinglish`)** | 61 | 20.3% |
| **Unknown (Fallback to English)** | 10 | 3.3% |

---

## 3. Time-Aware Partition Splits (Zero Future Leakage)

| Split | Count | Share | Temporal Purpose |
| :--- | :--- | :--- | :--- |
| **Train** | 840 | 70% | Initial ML model training |
| **Validation** | 180 | 15% | Hyperparameter tuning & threshold calibration |
| **Held-Out Test** | 180 | 15% | Untouched out-of-sample benchmark evaluation |

---

## 4. Evaluation-Only Ground Truth (Tiers 2 & 3)

> [!WARNING]
> The statistics in this section are derived strictly from `payment_ground_truth` and are **inaccessible to the operational decision engine and ML features**.

### Latent Recovery Propensity (Oracle Distribution)
- **Mean Score**: 0.6211
- **Std Dev**: 0.3036
- **Median**: 0.7344
- **Range**: [0.0500, 0.9500]

### Latent Oracle Optimal Action Breakdown
Used exclusively for computing Decision Regret during evaluation:
- **`human_escalation`**: 6 (0.5%)
- **`retry`**: 571 (47.6%)
- **`payment_update_request`**: 564 (47.0%)
- **`stop`**: 59 (4.9%)
