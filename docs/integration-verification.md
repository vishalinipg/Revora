# Razorpay Integration Verification & Rail Strategy

**Project**: Revora — Adaptive Revenue Recovery for Recurring Payments  
**Target**: Razorpay Buildathon 2026 · Track 03 — AI Revenue Recovery  
**Phase**: Phase 0 Integration Verification Gate  
**Date**: September 2026  
**Status**: Completed & Verified

---

## Executive Summary

Before implementing Revora's data models and recovery pipelines, this verification audit examines Razorpay's official API specifications, webhook delivery schemas, subscription lifecycle models, and test-mode capabilities for both **UPI AutoPay** and **Card Subscriptions**.

The audit establishes a strict distinction between what is confirmed from official documentation, what is physically verifiable in Razorpay's test environment, what cannot be tested without live banking rails, and what constitutes a Revora design assumption.

---

## 1. Verified from Official Documentation

The following capabilities, endpoints, and schemas are confirmed directly from official Razorpay documentation ([Razorpay Subscriptions Documentation](https://razorpay.com/docs/payments/subscriptions/), [Razorpay Webhooks](https://razorpay.com/docs/webhooks/), [Razorpay Error Codes](https://razorpay.com/docs/api/errors/)):

### 1.1 Webhook Lifecycle Events
Razorpay provides asynchronous webhook events for subscription and payment state changes:

| Event Name | Official Description | Diagnostic / Recovery Utility in Revora |
| :--- | :--- | :--- |
| **`payment.failed`** | Triggered whenever a recurring charge attempt fails. | Primary detection trigger. Initiates Revora's failure diagnosis and recoverability scoring. |
| **`subscription.charged`** | Triggered every time a cycle is successfully debited. | Confirmation of recovery success (or normal recurring cycle). |
| **`subscription.halted`** | Triggered when Razorpay's native automated retry attempts are completely exhausted. | Escalation signal; indicates native retries failed and requires payment-method update or manual intervention. |
| **`subscription.cancelled`** | Triggered when a subscription is cancelled by customer, merchant, or bank. | Hard terminal state; mandate is invalidated, automated retries must immediately cease. |
| **`subscription.paused`** | Triggered when a subscription is temporarily paused. | Cooldown/pause indicator; prevents unauthorized recovery actions. |

### 1.2 Webhook Signature & Security
- Webhook payloads include an `X-Razorpay-Signature` header computed as `HMAC-SHA256(webhook_body, webhook_secret)`.
- Replay prevention and payload integrity are confirmed as standard Razorpay integration practices.

### 1.3 `payment.failed` Error Payload Schema
When a payment fails, the `payload.payment.entity` object contains granular diagnostic error fields:

```json
{
  "entity": "payment",
  "id": "pay_xxxxxxxxxxxxxx",
  "amount": 149900,
  "currency": "INR",
  "status": "failed",
  "order_id": "order_xxxxxxxxxxxxxx",
  "method": "upi",
  "error_code": "BAD_REQUEST_ERROR",
  "error_description": "Payment was declined due to insufficient funds.",
  "error_source": "customer",
  "error_step": "payment_authorization",
  "error_reason": "insufficient_funds"
}
```

Confirmed error diagnostic fields:
- **`error_code`**: High-level classification (`BAD_REQUEST_ERROR`, `GATEWAY_ERROR`, `SERVER_ERROR`).
- **`error_source`**: Identifies failure origin (`customer`, `gateway`, `business`, `razorpay`).
- **`error_step`**: Stage of transaction failure (`payment_authorization`, `payment_authentication`).
- **`error_reason`**: Specific machine-readable reason string (e.g., `insufficient_funds`, `payment_timed_out`, `authentication_failed`, `card_declined`, `bank_declined`).

### 1.4 UPI AutoPay Mandate Specifications
- Mandates are created via Razorpay Subscriptions / Orders API with the `recurrence` and `upi_mandate` objects.
- Max limit per debit without additional factor of authentication (AFA) is ₹15,000 (per NPCI/RBI guidelines).
- Mandate parameters include `max_amount`, `frequency` (e.g. `monthly`, `as_presented`), `start_at`, and `expire_by`.

---

## 2. Verified Through Test Mode

The following behaviors were verified using Razorpay's Test Mode environment (`rzp_test_...`):

### 2.1 Virtual UPI Test VPAs
- **`success@razorpay`**: Successfully simulates an approved mandate authorization.
- **`failure@razorpay`**: Successfully simulates a rejected mandate authorization.
- **Limitation**: In test mode, cancelling a simulated UPI checkout frequently resolves to "Success" or immediate mock completion rather than triggering asynchronous bank rejection events.

### 2.2 Card Subscription Test Tokens
- Test cards allow reliable simulation of tokenization, mandate registration, and recurring invoice issuance:
  - Visa Domestic: `4111 1111 1111 1111`
  - Mastercard Domestic: `5267 3181 8797 5449`
- In test mode, Razorpay replaces the production "Charge This Now" button on halted subscriptions with an **"Issue Invoice"** action, allowing manual simulation of invoice issuance without charging physical cards.
- Webhook endpoints receive synthetic `payment.failed`, `subscription.charged`, and `subscription.halted` events when triggered via test checkouts or Dashboard simulator actions.

---

## 3. Not Available / Not Confirmed in Test Mode

The following real-world payment rail mechanisms **cannot** be reliably exercised or tested in Razorpay's standard test mode:

### 3.1 RBI 24-Hour Pre-Debit Notification on UPI AutoPay
- **Regulatory Rule**: Reserve Bank of India (RBI) circular on e-mandates mandates that a pre-debit notification must be sent to the customer at least 24 hours prior to debiting recurring payments via UPI AutoPay.
- **Test Mode Reality**: Razorpay's test mode has no mechanism to dispatch real SMS/push pre-debit notifications or enforce a 24-hour waiting period before triggering test recurring debits.

### 3.2 Asynchronous Multi-Day NPCI Clearing & Timed Execution
- In production, UPI AutoPay debits are batched and processed through NPCI switches (ACH / AutoPay clearing) during designated banking settlement windows.
- In test mode, there is no automated banking switch to execute scheduled debits across multi-day lifecycles without manual developer triggers.

### 3.3 Dynamic Gateway / Bank Downtime Errors
- Gateway-specific downtime responses (e.g. NPCI switch timeout, specific PSU bank server downtime) cannot be generated deterministically on demand in test mode without mock interception.

---

## 4. Revora Simulation Assumptions & Design Constants

Because certain live banking dynamics are inaccessible in test mode, Revora clearly labels the following operational parameters as **Revora Policy / Simulation Assumptions** (and NOT Razorpay native defaults):

| Parameter | Revora Value | Distinction from Razorpay | Rationale / Documentation Link |
| :--- | :--- | :--- | :--- |
| **`MAX_RECOVERY_ATTEMPTS_PER_PAYMENT`** | 3 attempts | Razorpay native retry operates on a vendor-fixed schedule; Revora caps total recovery interventions across all channels to 3 to prevent customer harassment. | See `docs/design-assumptions.md` |
| **`MIN_RETRY_COOLDOWN_HOURS`** | 24 hours | Prevents immediate back-to-back retries on soft failures (aligns with salary deposit cycles and UPI debit windows). | See `docs/design-assumptions.md` |
| **`MAX_AUTOMATED_ESCALATIONS`** | 1 escalation | Hard cap on automated human escalation tickets per billing cycle. | See `docs/design-assumptions.md` |
| **`MAX_FAILED_RECOVERY_CYCLES`** | 3 cycles | After 3 consecutive billing cycles with unrecovered failures, the account transitions to permanent churn/stop. | See `docs/design-assumptions.md` |
| **Synthetic Dataset Size** | 1,000+ records | Simulates realistic Indian recurring merchant portfolio with multi-cycle payment history. | See `docs/design-assumptions.md` |

---

## 5. Selected Payment Rail Strategy

To ensure zero fabrication while delivering a fully verifiable system, Revora adopts the following two-tier rail architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Revora Core Engine                              │
│  (Rail-Agnostic: Evaluates Risk, Diagnoses Failure, Decides Action)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     Target Production Rail    │       │   Executable Test Adapter     │
│        **UPI AutoPay**        │       │  **Razorpay Card Subscriptions│
│                               │       │       & Webhook Mock**        │
│ • Intended production rail    │       │ • Executable in test mode     │
│ • Primary synthetic data model│       │ • Official test card tokens   │
│ • Tailored to NPCI/UPI limits │       │ • Verified webhook ingestion  │
│ • Soft/Hard UPI failure codes │       │ • Demonstrates full pipeline  │
└───────────────────────────────┘       └───────────────────────────────┘
```

### Formal Statement
> *"UPI AutoPay is Revora's intended primary production rail, and its error codes, mandate constraints, and soft/hard failure modes form the core of our diagnostic model.  
> The executable live test-mode integration layer utilizes Razorpay Card Subscriptions and test tokens (`4111 1111 1111 1111`) because Razorpay's test sandbox cannot simulate RBI-mandated 24-hour NPCI pre-debit notifications or multi-day asynchronous UPI AutoPay settlement schedules without live banking rails.  
> Revora's diagnostic engine, ML feature pipeline, decision matrix, and stopping rules remain completely rail-agnostic."*

---

## 6. Official Source Links & References

1. **Razorpay Subscriptions Overview**:  
   https://razorpay.com/docs/payments/subscriptions/
2. **UPI AutoPay Mandates on Razorpay**:  
   https://razorpay.com/docs/payments/subscriptions/upi-autopay/
3. **Razorpay Webhooks & Signature Verification**:  
   https://razorpay.com/docs/webhooks/
4. **Razorpay Error Codes & Reasons**:  
   https://razorpay.com/docs/api/errors/
5. **NPCI UPI AutoPay Guidelines & RBI E-Mandate Circulars**:  
   RBI Circular RBI/2019-20/54 DPSS.CO.PD.No.447/02.14.003/2019-20 (Framework for processing of e-mandates on recurring transactions).

---

## 7. Phase 0 Sign-Off Gate

- [x] Webhook events and failure payload schemas verified from official documentation.
- [x] UPI AutoPay test-mode limitations documented with technical justification.
- [x] Card subscription test adapter confirmed as the executable test-mode driver.
- [x] Revora policy constants strictly demarcated from Razorpay native behavior.
- [x] Rail-agnostic architectural separation established.

**Status**: Ready for user review. No Phase 1 code has been written.
