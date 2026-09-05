/**
 * Operational API TypeScript Interfaces.
 * 
 * STRICT ISOLATION GUARANTEE:
 * These types map directly to the FastAPI Pydantic schemas.
 * Under no circumstances do they declare or expect hidden ground-truth fields
 * (e.g. PaymentGroundTruth, true_failure_cause, ground_truth_recoverability).
 */

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  production_rail_target: string;
  test_mode_adapter: string;
  timestamp: string;
}

export interface PaymentRead {
  payment_id: string;
  customer_id: string;
  mandate_id: string;
  amount: number;
  currency: string;
  due_date: string;
  payment_attempt_date: string;
  status: string;
  failure_code: string | null;
  error_source: string | null;
  error_step: string | null;
  payment_rail: string;
  native_retry_attempt: number;
  days_since_last_success: number;
  historical_cycle_count: number;
  historical_success_rate: number;
  consecutive_failure_count: number;
  created_at: string;
}

export interface PaginatedPaymentsResponse {
  total: number;
  limit: number;
  offset: number;
  items: PaymentRead[];
  disclaimer: string;
}

export interface CustomerRead {
  customer_id: string;
  name: string;
  preferred_language: string;
  region: string;
  subscription_plan: string;
  signup_date: string;
  customer_tenure_days: number;
  created_at: string;
}

export interface MandateRead {
  mandate_id: string;
  customer_id: string;
  payment_method: string;
  mandate_status: string;
  last_successful_charge_date: string | null;
  max_amount_per_debit: number;
  authentication_required: boolean;
  mandate_age_days: number;
  created_at: string;
}

export interface RiskAssessmentResponse {
  risk_tier: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  risk_score: number;
  is_immediate_action_needed: boolean;
  contributing_factors: string[];
}

export interface FailureDiagnosisResponse {
  failure_category: string;
  recoverability_class: string;
  confidence: number;
  triggering_reasons: string[];
  allowed_actions: string[];
  recommended_recovery_window_hours: number | null;
}

export interface RecoveryActionRead {
  action_id: string;
  payment_id: string;
  action_type: string;
  decided_by: string;
  decision_reason: string;
  is_revora_policy: boolean;
  policy_version: string;
  scheduled_at: string;
  executed_at: string | null;
  outcome: string;
  recovered_amount: number;
  language_used: string | null;
  message_sent: string | null;
  fallback_template_used: boolean;
  created_at: string;
}

export interface PaymentDetailResponse {
  payment: PaymentRead;
  customer: CustomerRead;
  mandate: MandateRead;
  risk_assessment: RiskAssessmentResponse;
  failure_diagnosis: FailureDiagnosisResponse;
  propensity_score: number;
  propensity_confidence: number;
  explanation_summary: string;
  latest_action: RecoveryActionRead | null;
  disclaimer: string;
}

export interface ImportantFeatureContribution {
  feature: string;
  impact: number;
  raw_value: number;
  direction: "positive" | "negative";
}

export interface DecisionResponse {
  decision_id: string;
  payment_id: string;
  action: string;
  decision_reason: string;
  reason: string | null;
  policy_version: string;
  risk_tier: string;
  diagnosis_category: string;
  recoverability_class: string;
  propensity_score: number;
  propensity_confidence: number;
  explanation_summary: string;
  important_features: ImportantFeatureContribution[];
  policy_checks: Record<string, boolean>;
  audit_logged: boolean;
  is_simulation: boolean;
}

export interface OutreachResponse {
  payment_id: string;
  customer_id: string;
  action_type: string;
  outreach_suppressed: boolean;
  suppression_reason: string | null;
  channel: string | null;
  language_used: string | null;
  message_body: string | null;
  simulation_watermark: string;
  is_simulation: boolean;
  fallback_template_used: boolean;
  safety_validation_passed: boolean;
}

export interface TimelineEvent {
  event_id: string;
  event_type: string;
  actor: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface PaymentTimelineResponse {
  payment_id: string;
  events: TimelineEvent[];
}

export interface PrimaryBenchmarkPolicyMetrics {
  policy_name: string;
  random_seed: number;
  total_payments_evaluated: number;
  total_revenue_at_risk_inr: number;
  recovered_payments: number;
  unresolved_payments: number;
  payment_recovery_rate_pct: number;
  total_recovered_amount_inr: number;
  revenue_recovery_rate_pct: number;
  total_interventions_attempted: number;
  interventions_per_recovered_payment: number;
  recovery_efficiency_inr_per_intervention: number;
  stopping_rule_compliance_pct: number;
  actions_breakdown: Record<string, number>;
}

export interface ComparativeDeltaMetrics {
  random_seed: number;
  absolute_revenue_recovery_rate_delta_pct: number;
  relative_revenue_recovery_rate_improvement_pct: number;
  absolute_recovered_amount_delta_inr: number;
  intervention_delta_count: number;
  intervention_reduction_pct: number;
  recovery_efficiency_delta_inr: number;
  futile_retries_prevented: number;
}

export interface DecisionQualityMetrics {
  total_decisions_evaluated: number;
  oracle_concordant_decisions: number;
  oracle_concordance_rate_pct: number;
  unnecessary_retry_count: number;
  unnecessary_retry_rate_pct: number;
  missed_recovery_opportunity_count: number;
  missed_recovery_opportunity_rate_pct: number;
  inappropriate_customer_friction_count: number;
  inappropriate_customer_friction_rate_pct: number;
  inappropriate_escalation_count: number;
  inappropriate_escalation_rate_pct: number;
  optimal_action_count: number;
}

export interface LanguageBreakdownItem {
  language_code: string;
  display_name: string;
  customer_count: number;
  payments_count: number;
  revenue_at_risk_inr: number;
  recovered_payments: number;
  recovered_amount_inr: number;
  recovery_rate_pct: number;
  messages_dispatched: number;
  fallback_from_unknown: boolean;
}

export interface EvaluationSummaryResponse {
  metadata: {
    generated_at: string;
    cohort_split: string;
    cohort_size: number;
    total_revenue_at_risk_inr: number;
    primary_seed: number;
    seeds_evaluated: number[];
    policy_version: string;
    model_version: string;
    production_rail_target: string;
    test_mode_adapter: string;
    policy_threshold_assumption: string;
  };
  baseline_description: string;
  primary_benchmark_seed_42: {
    revora: PrimaryBenchmarkPolicyMetrics;
    baseline: PrimaryBenchmarkPolicyMetrics;
    comparative_delta: ComparativeDeltaMetrics;
    decision_quality_revora: DecisionQualityMetrics;
    decision_quality_baseline: DecisionQualityMetrics;
  };
  language_breakdown: LanguageBreakdownItem[];
  metric_definitions: Record<string, string>;
}

export interface RobustnessStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface EvaluationSeedsResponse {
  seeds_evaluated: number[];
  baseline_description: string;
  cohort_size: number;
  total_revenue_at_risk_inr: number;
  multi_seed_robustness_benchmark: {
    seeds_evaluated: number[];
    held_out_cohort_size: number;
    total_revenue_at_risk_inr: number;
    revora_revenue_recovery_rate: RobustnessStat;
    baseline_revenue_recovery_rate: RobustnessStat;
    revora_recovered_amount_inr: RobustnessStat;
    baseline_recovered_amount_inr: RobustnessStat;
    recovered_amount_delta_inr: RobustnessStat;
    revora_interventions: RobustnessStat;
    baseline_interventions: RobustnessStat;
    intervention_reduction_pct: RobustnessStat;
    revora_oracle_concordance_rate: RobustnessStat;
    baseline_oracle_concordance_rate: RobustnessStat;
  };
}
