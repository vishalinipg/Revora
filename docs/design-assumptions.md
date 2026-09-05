# Revora Design Assumptions & Operational Policies

**Target**: Razorpay Buildathon 2026 · Track 03 — AI Revenue Recovery  
**Version**: Policy v1.0  
**Status**: Active Operational Policy

---

## Important Regulatory & Architecture Disclaimer

> [!IMPORTANT]
> The thresholds, retry limits, and cooldown intervals documented below are **Revora's internal recovery policy assumptions**. They are **NOT** Razorpay default settings, nor are they NPCI/RBI statutory mandates. They represent Revora's engineering design choices to maximize recovery yield while strictly preventing customer harassment, spamming, and payment-network penalties.

---

## 1. Core Operational Thresholds

| Parameter | Policy Value | Scope / Actor | Rationale & Trade-off Analysis |
| :--- | :--- | :--- | :--- |
| **`MAX_RECOVERY_ATTEMPTS_PER_PAYMENT`** | **3 attempts** | Revora Policy | After 3 failed recovery attempts on a single billing cycle, automated retries permanently halt. Multiple retries beyond 3 yield steeply diminishing returns and risk bank account flagging or customer churn. |
| **`MIN_RETRY_COOLDOWN_HOURS`** | **24 hours** | Revora Policy | An automated retry must not execute sooner than 24 hours following a prior failure. Immediate retries on soft failures (e.g. `insufficient_funds`) almost always fail before salary or funds arrive. |
| **`MAX_AUTOMATED_ESCALATIONS`** | **1 ticket** | Revora Policy | A single payment cycle may only trigger one human escalation to avoid flooding support operations. |
| **`MAX_FAILED_RECOVERY_CYCLES`** | **3 cycles** | Revora Policy | If a customer's recurring payment fails across 3 consecutive monthly billing cycles without recovery, the subscription is classified as permanent churn / unrecoverable. |
| **`MAX_UPI_AUTOPAY_DEBIT_WITHOUT_AFA`**| **₹15,000** | Statutory / NPCI | Per RBI/NPCI e-mandate rules, recurring transactions up to ₹15,000 do not require Additional Factor of Authentication (AFA/OTP/UPI PIN) once mandate registration is complete. Transactions exceeding this limit require customer authentication. |

---

## 2. Distinction Between Revora Policy and Vendor/Provider Behaviors

### 2.1 Razorpay Native Retry Engine vs. Revora Recovery Policy
- **Razorpay Native Retries**: Razorpay offers an internal subscription retry scheduler that attempts charges on vendor-configured intervals. Once native retries are exhausted, the subscription transitions to `subscription.halted`.
- **Revora Recovery Policy**: Revora acts as the adaptive intelligence layer. Rather than blind retries, Revora:
  1. Diagnoses the error (`soft` vs `hard` vs `auth_required`).
  2. Evaluates historical recoverability propensity (0.0–1.0).
  3. Chooses between smart timed retry, payment method update link, human escalation, or immediate stopping.
  4. Bounds total interventions by `MAX_RECOVERY_ATTEMPTS_PER_PAYMENT`.

### 2.2 Payment Rail Specificity
- **UPI AutoPay**:
  - Requires active mandate (`mandate_status = 'active'`).
  - Debits must observe NPCI settlement windows.
  - Soft failures (`insufficient_funds`, `bank_timeout`) qualify for timed retries with 24h cooldown.
  - Hard failures (`blocked_account`, `mandate_revoked`) disqualify the payment from further automated debits.
- **Card Subscriptions**:
  - Operates on card tokenization frameworks.
  - Expired cards require a payment-method update link rather than automated retry.

---

## 3. Multilingual Outreach Policy

- **Language Hierarchy**:
  1. Explicit customer `preferred_language` (`en`, `ta_tanglish`, `hi_hinglish`).
  2. Fallback: English (`en`).
  3. **Strict Prohibition**: Revora *never* infers preferred language from geographic region or IP address.
- **Safety Boundaries**:
  - Messages must never disclose internal recoverability scores or risk tiers.
  - Messages must never solicit passwords, OTPs, CVVs, or UPI PINs.
  - Messages must never fabricate false discounts, deceptive deadlines, or legal threats.
  - All communications in mock outboxes are watermarked `SIMULATED — NO MESSAGE SENT`.

---

## 4. Evaluation Assumptions

- **Fixed-Policy Baseline**: A static strategy that blindly retries every failed recurring payment up to 3 times at fixed 24h intervals, without soft/hard failure categorization, risk scoring, or alternative intervention channels.
- **Evaluation Robustness**: Evaluation metrics must be reported with multiple seeds (mean ± standard deviation) to prove that Revora's recovery lift is consistent and not an artifact of a single lucky seed.
- **No Optimality Claims**: Observed clustering or timing patterns in synthetic datasets are strictly characterized as dataset properties, not universal statistical laws.
