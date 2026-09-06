export interface TourStep {
  id: string;
  route: string;
  targetSelector: string;
  mobileTargetSelector?: string;
  title: string;
  explanation: string;
  badge?: {
    text: string;
    className: string;
  };
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  nextButtonLabel?: string;
  actionBefore?: "scrollTo" | "openModal";
  modalToOpen?: "timeline" | "outbox" | "benchmark";
  closeModalBeforeNext?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  // -------------------------------------------------------------
  // PHASE 1: Public Landing Page (/)
  // -------------------------------------------------------------
  {
    id: "landing-hero",
    route: "/",
    targetSelector: '[data-testid="hero-particle-container"]',
    title: "Adaptive Revenue Recovery",
    explanation:
      "Revora monitors recurring subscription revenue across UPI AutoPay and Indian card mandates. Instead of triggering blind retries that cause bank penalties and mandate cancellations, Revora uses deterministic diagnosis and interpretable ML.",
    badge: {
      text: "[OBSERVED]",
      className: "bg-[#B5615A]/15 text-[#B5615A] border-[#B5615A]/40",
    },
    placement: "bottom",
  },
  {
    id: "landing-mechanism-cta",
    route: "/",
    targetSelector: '[data-testid="cta-see-how-it-works"]',
    title: "Six-Stage Recovery Pipeline",
    explanation:
      "Follow the recovery lifecycle from observed payment failure events to safe simulated resolution under deterministic policy rules.",
    placement: "bottom",
  },
  {
    id: "landing-mechanism",
    route: "/",
    targetSelector: "#mechanism",
    title: "Pipeline Architecture",
    explanation:
      "1. Revenue-at-Risk Detection -> 2. Failure Diagnosis -> 3. ML Propensity Signal -> 4. Decision Engine -> 5. Multilingual Outreach -> 6. Simulation & Audit. Every stage strictly enforces provenance.",
    badge: {
      text: "[DECISION]",
      className: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/40",
    },
    placement: "top",
    actionBefore: "scrollTo",
  },
  {
    id: "landing-language",
    route: "/",
    targetSelector: "#language-proof",
    title: "Safe Multilingual Outreach",
    explanation:
      "Localized communications across English, Hindi (Hinglish), and Tamil (Tanglish). Deterministic AST and regex safety validators guarantee zero credential solicitation (no OTPs, PINs, or CVVs).",
    badge: {
      text: "[DECISION]",
      className: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/40",
    },
    placement: "top",
    actionBefore: "scrollTo",
  },
  {
    id: "landing-evaluation",
    route: "/",
    targetSelector: "#evaluation-report",
    title: "Empirical Held-Out Benchmark",
    explanation:
      "Empirical evaluation on held-out test cohorts across 5 distinct random seeds, proving ~85% revenue recovery and 100% stopping rule compliance against standard merchant baselines.",
    badge: {
      text: "[SIMULATION ONLY]",
      className: "bg-[#64B5F6]/15 text-[#64B5F6] border-[#64B5F6]/40",
    },
    placement: "top",
    actionBefore: "scrollTo",
  },
  {
    id: "landing-enter-console",
    route: "/",
    targetSelector: '[data-testid="header-console-link"]',
    mobileTargetSelector: '[data-testid="header-console-link-mobile"]',
    title: "Enter the Operator Console",
    explanation:
      "Next, let's step inside the live operational workspace to inspect real recurring payments, policy rules, and customer recovery journeys.",
    nextButtonLabel: "Open Console →",
    placement: "bottom",
  },

  // -------------------------------------------------------------
  // PHASE 2: Operator Console (/console)
  // -------------------------------------------------------------
  {
    id: "console-overview",
    route: "/console",
    targetSelector: "header",
    title: "Operator Console Workspace",
    explanation:
      "This is the Revora operator workspace. It provides real-time visibility into revenue at risk, automated recovery decisions, outreach dispatches, and multi-seed benchmarks.",
    badge: {
      text: "[SIMULATION ONLY]",
      className: "bg-[#64B5F6]/15 text-[#64B5F6] border-[#64B5F6]/40",
    },
    placement: "bottom",
  },
  {
    id: "console-metrics",
    route: "/console",
    targetSelector: 'section[aria-label="Executive Metrics"]',
    title: "Live Aggregate Metrics",
    explanation:
      "Executive aggregates computed directly from live evaluation data: Recovery Rate, Recovered Rupee Value, Futile Retries Saved, and 100% Verified Policy Compliance.",
    badge: {
      text: "[OBSERVED]",
      className: "bg-[#B5615A]/15 text-[#B5615A] border-[#B5615A]/40",
    },
    placement: "bottom",
  },
  {
    id: "console-queue",
    route: "/console",
    targetSelector: '[data-testid="desktop-payment-queue-table"] tbody tr:first-child',
    mobileTargetSelector: '[data-testid="mobile-payment-cards-container"] > div:first-child',
    title: "Payment Operations Queue",
    explanation:
      "Each entry represents a recurring payment failure captured from banking webhooks—showing amount, customer ID, rail (UPI AutoPay or Card), error code, and retry count.",
    badge: {
      text: "[OBSERVED]",
      className: "bg-[#B5615A]/15 text-[#B5615A] border-[#B5615A]/40",
    },
    placement: "bottom",
  },
  {
    id: "console-inspect-action",
    route: "/console",
    targetSelector: '[data-testid="desktop-payment-queue-table"] tbody tr:first-child [data-testid^="inspect-btn-"]',
    mobileTargetSelector: '[data-testid="mobile-payment-cards-container"] > div:first-child [data-testid^="mobile-inspect-btn-"]',
    title: "Inspect Payment Diagnostics",
    explanation:
      "Click Inspect to examine the customer's payment history, failure taxonomy, ML propensity signal, and deterministic decision rules.",
    nextButtonLabel: "Inspect Payment →",
    placement: "bottom",
  },

  // -------------------------------------------------------------
  // PHASE 3: Payment Decision Inspector (/console/inspect/[id])
  // -------------------------------------------------------------
  {
    id: "inspect-context",
    route: "/console/inspect",
    targetSelector: '[data-testid="decision-inspector-header"]',
    title: "Payment Telemetry & Isolation",
    explanation:
      "Examine live payment telemetry alongside verified ground-truth isolation—guaranteeing zero future data leakage into decision signals.",
    badge: {
      text: "[OBSERVED]",
      className: "bg-[#B5615A]/15 text-[#B5615A] border-[#B5615A]/40",
    },
    placement: "bottom",
  },
  {
    id: "inspect-decision-engine",
    route: "/console/inspect",
    targetSelector: '[data-testid="decision-engine-card"]',
    title: "Authoritative Decision Engine",
    explanation:
      "Deterministic policy enforcement: maximum limit of 3 native retries, 24-hour cooldown windows, RBI ₹15,000 mandate step-up compliance, and immediate stopping rules on hard-blocked accounts.",
    badge: {
      text: "[DECISION]",
      className: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/40",
    },
    placement: "bottom",
  },
  {
    id: "inspect-diagnosis",
    route: "/console/inspect",
    targetSelector: '[data-testid="failure-diagnosis-card"]',
    title: "Deterministic Failure Diagnosis",
    explanation:
      "Failures are classified deterministically into Transient, Customer-Actionable, or Hard-Blocked, defining permissible recovery actions without speculative extrapolation.",
    badge: {
      text: "[DECISION]",
      className: "bg-[#E8A33D]/15 text-[#E8A33D] border-[#E8A33D]/40",
    },
    placement: "top",
  },
  {
    id: "inspect-ml-propensity",
    route: "/console/inspect",
    targetSelector: '[data-testid="ml-propensity-card"]',
    title: "ML Propensity Signal",
    explanation:
      "A calibrated logistic regression model estimates customer responsiveness probability. This is strictly an advisory signal—ML cannot authorize retries or override safety guardrails.",
    badge: {
      text: "[SIGNAL ONLY]",
      className: "bg-[#7BA88C]/15 text-[#7BA88C] border-[#7BA88C]/40",
    },
    placement: "top",
  },
  {
    id: "inspect-rerun-btn",
    route: "/console/inspect",
    targetSelector: '[data-testid="rerun-decision-btn"]',
    title: "Live Engine Execution",
    explanation:
      "Operators can trigger live re-runs of the Decision Engine against the payment's current state. Results and audit trails are recorded immutably to SQLite.",
    placement: "bottom",
  },
  {
    id: "inspect-timeline-btn",
    route: "/console/inspect",
    targetSelector: '[data-testid="timeline-btn"]',
    title: "Customer Audit Timeline",
    explanation:
      "Inspect the chronological audit trail of all webhook events, decisions, retry attempts, and simulated communications for this customer.",
    nextButtonLabel: "Open Timeline →",
    placement: "bottom",
    modalToOpen: "timeline",
  },
  {
    id: "inspect-outreach-btn",
    route: "/console/inspect",
    targetSelector: '[data-testid="preview-outreach-btn"]',
    title: "Simulated Multilingual Outreach",
    explanation:
      "Preview customer outreach in English, Hinglish, or Tanglish with rigid safety guardrails: zero OTP requests, locked payment amounts, and deterministic template fallback.",
    nextButtonLabel: "Preview Outreach →",
    placement: "bottom",
    modalToOpen: "outbox",
    closeModalBeforeNext: true,
  },

  // -------------------------------------------------------------
  // PHASE 4: Multi-Seed Robustness Benchmark (/console)
  // -------------------------------------------------------------
  {
    id: "console-benchmark-btn",
    route: "/console",
    targetSelector: '[data-testid="open-benchmark-btn"]',
    title: "Multi-Seed Evaluation Benchmark",
    explanation:
      "Explore comprehensive evaluation across 5 random seeds comparing Revora against standard merchant retry rules.",
    nextButtonLabel: "View Benchmark →",
    placement: "bottom",
    modalToOpen: "benchmark",
  },
  {
    id: "walkthrough-complete",
    route: "/console",
    targetSelector: "header",
    title: "Walkthrough Complete!",
    explanation:
      "You have completed the Revora product walkthrough. You can restart this tour anytime by clicking 'Product tour' in the navigation bar.",
    badge: {
      text: "[VERIFIED]",
      className: "bg-[#7BA88C]/15 text-[#7BA88C] border-[#7BA88C]/40",
    },
    nextButtonLabel: "Finish Walkthrough",
    placement: "bottom",
    closeModalBeforeNext: true,
  },
];
