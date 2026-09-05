"use client";

import React, { useState } from "react";
import {
  Shield,
  Activity,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  MessageSquare,
  History,
  FileCheck,
  Zap,
  Info,
  ExternalLink,
  Lock,
} from "lucide-react";
import { PaymentDetailResponse, DecisionResponse } from "../lib/types";
import { formatINR, formatPct, formatDateTime, getActionBadge, getRiskTierBadge, getRailLabel } from "../lib/utils";
import { GroundTruthBadge } from "./GroundTruthBadge";

interface DecisionInspectorProps {
  paymentDetail: PaymentDetailResponse | null;
  isLoading: boolean;
  error: string | null;
  onRerunDecision: () => Promise<DecisionResponse | null>;
  isExecutingDecision: boolean;
  onOpenOutreach: () => void;
  onOpenTimeline: () => void;
  lastDecisionResult: DecisionResponse | null;
}

export const DecisionInspector: React.FC<DecisionInspectorProps> = ({
  paymentDetail,
  isLoading,
  error,
  onRerunDecision,
  isExecutingDecision,
  onOpenOutreach,
  onOpenTimeline,
  lastDecisionResult,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center bg-[#0d1424] border border-[#1c2742] rounded-lg h-full flex flex-col items-center justify-center space-y-3">
        <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
        <div className="text-xs font-mono text-slate-300">
          Loading payment signals & diagnostics...
        </div>
      </div>
    );
  }

  if (error || !paymentDetail) {
    return (
      <div className="p-8 text-center bg-[#0d1424] border border-[#1c2742] rounded-lg h-full flex flex-col items-center justify-center space-y-3">
        <Info className="w-8 h-8 text-slate-500" />
        <div className="text-sm font-medium text-slate-300">
          Select a payment from the queue to inspect operational signals and policy decisions.
        </div>
        {error && <div className="text-xs text-rose-400 font-mono">{error}</div>}
      </div>
    );
  }

  const { payment, customer, mandate, risk_assessment, failure_diagnosis, propensity_score, propensity_confidence, explanation_summary, latest_action } = paymentDetail;

  // Active decision: prefer newly re-evaluated decision result, fallback to latest action in DB
  const activeAction = lastDecisionResult?.action || latest_action?.action_type || failure_diagnosis.allowed_actions[0] || "EVALUATE_REQUIRED";
  const actionBadge = getActionBadge(activeAction);
  const riskBadge = getRiskTierBadge(risk_assessment.risk_tier);

  // Active policy checks if evaluated
  const policyChecks = lastDecisionResult?.policy_checks || null;
  const importantFeatures = lastDecisionResult?.important_features || [];

  return (
    <div className="flex flex-col h-full bg-[#1B2140] border border-[#2A3362] rounded-xl overflow-hidden shadow-sm">
      {/* Top Inspector Header */}
      <div className="p-5 border-b border-[#2A3362] bg-[#171D36] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#7E85A6]">INSPECTING PAYMENT</span>
            <span className="text-sm font-mono font-bold text-[#F2F0EA] px-2.5 py-0.5 rounded-md bg-[#222950] border border-[#2A3362]">
              {payment.payment_id}
            </span>
            <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold ${riskBadge.className}`}>
              RISK: {riskBadge.label} ({risk_assessment.risk_score.toFixed(2)})
            </span>
          </div>
          <div className="text-xs text-[#B4B9D2] flex flex-wrap items-center gap-3">
            <span>Customer: <strong className="text-[#F2F0EA]">{customer.name}</strong> <span className="text-[#7E85A6] font-mono">({customer.customer_id})</span></span>
            <span className="text-[#7E85A6]">·</span>
            <span>Plan: <strong className="text-[#F2F0EA]">{customer.subscription_plan}</strong></span>
            <span className="text-[#7E85A6]">·</span>
            <span>Language: <strong className="text-[#E8A33D] font-mono">{customer.preferred_language}</strong></span>
          </div>
        </div>

        {/* Isolation Verification Badge */}
        <GroundTruthBadge payload={paymentDetail} />
      </div>

      {/* Main Inspection Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Row 1: Decision Banner & Execution Controls */}
        <div className="p-5 rounded-xl bg-[#222950] border border-[#2A3362] relative overflow-hidden shadow-sm space-y-4">
          {/* Top Row: Engine Identity & Operator Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-3.5 border-b border-[#2A3362]/70">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1B2140] border border-[#2A3362] text-[#E8A33D] flex items-center justify-center flex-shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <span className="font-semibold text-xs font-mono text-[#F2F0EA] tracking-wide uppercase whitespace-nowrap">
                  Deterministic Revora Decision Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1B2140] text-[#B4B9D2] border border-[#2A3362] whitespace-nowrap">
                  {lastDecisionResult?.policy_version || "REVORA_POLICY_V1"}
                </span>
              </div>
            </div>

            {/* Operator Actions in a clean, unified button group */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button
                data-testid="rerun-decision-btn"
                onClick={onRerunDecision}
                disabled={isExecutingDecision}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E8A33D] hover:bg-[#E8A33D]/90 text-[#12172B] shadow-sm transition-all disabled:opacity-50 font-mono cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isExecutingDecision ? "animate-spin" : ""}`} />
                <span>{isExecutingDecision ? "Executing..." : "Re-run Engine"}</span>
              </button>

              <button
                data-testid="preview-outreach-btn"
                onClick={onOpenOutreach}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1B2140] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#E8A33D]" />
                <span>Preview Outreach</span>
              </button>

              <button
                data-testid="timeline-btn"
                onClick={onOpenTimeline}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1B2140] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <History className="w-3.5 h-3.5 text-[#B4B9D2]" />
                <span>Timeline</span>
              </button>
            </div>
          </div>

          {/* Dedicated Decision Callout Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-[#171D36] p-3.5 rounded-lg border border-[#2A3362]/80">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono text-[#7E85A6] uppercase tracking-wider whitespace-nowrap">
                Action:
              </span>
              <span className={`inline-block px-3.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase shadow-sm whitespace-nowrap ${actionBadge.className}`}>
                {actionBadge.label}
              </span>
            </div>
            <div className="text-xs text-[#B4B9D2] leading-relaxed sm:text-right flex-1 sm:max-w-xl">
              {lastDecisionResult?.decision_reason || latest_action?.decision_reason || "Deterministic policy evaluation ready."}
            </div>
          </div>

          {/* Audit Confirmation if Executed Live */}
          {lastDecisionResult && (
            <div className="mt-3.5 pt-3.5 border-t border-[#2A3362] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#B4B9D2]">
              <div className="flex items-center gap-2 text-[#7BA88C]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Live Decision Logged: <strong className="font-semibold">{lastDecisionResult.decision_id}</strong> (Audit log recorded to database)</span>
              </div>
              <span className="text-[#7E85A6]">Actor: revora_decision_engine</span>
            </div>
          )}
        </div>

        {/* Row 2: Diagnostics & Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Observed Provider Signals (Tier 1) */}
          <div className="p-4.5 rounded-xl bg-[#171D36] border border-[#2A3362] space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2A3362] pb-2.5">
              <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#E8A33D]" />
                <span>Observed Provider Signals</span>
              </div>
              <span className="text-[10px] font-mono text-[#7BA88C] bg-[#7BA88C]/10 px-2 py-0.5 rounded-md border border-[#7BA88C]/30">
                Tier 1 Operational
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Amount Due</div>
                <div className="text-sm font-bold font-mono text-[#F2F0EA] tabular-nums mt-0.5">
                  {formatINR(payment.amount)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Failure Code</div>
                <div className="text-xs font-mono text-[#E8A33D] font-semibold truncate mt-0.5" title={payment.failure_code || "None"}>
                  {payment.failure_code || "None"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Payment Rail</div>
                <div className="text-xs font-mono text-[#B4B9D2] mt-0.5">
                  {getRailLabel(payment.payment_rail)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Mandate Status</div>
                <div className="text-xs font-mono text-[#B4B9D2] mt-0.5">
                  {mandate.mandate_status}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Native Retries</div>
                <div className="text-xs font-mono text-[#B4B9D2] mt-0.5">
                  {payment.native_retry_attempt} / 3 attempted
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <div className="text-[10px] text-[#7E85A6] uppercase font-mono">Hist. Success Rate</div>
                <div className="text-xs font-mono text-[#B4B9D2] mt-0.5">
                  {formatPct(payment.historical_success_rate * 100)} ({payment.historical_cycle_count} cycles)
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Deterministic Failure Diagnosis */}
          <div className="p-4.5 rounded-xl bg-[#171D36] border border-[#2A3362] space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2A3362] pb-2.5">
              <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-[#E8A33D]" />
                <span>Deterministic Diagnosis</span>
              </div>
              <span className="text-[10px] font-mono text-[#E8A33D] bg-[#E8A33D]/10 px-2 py-0.5 rounded-md border border-[#E8A33D]/30 font-semibold">
                Confidence: {(failure_diagnosis.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <span className="text-[#7E85A6]">Diagnosis Category:</span>
                <span className="font-mono font-bold text-[#F2F0EA]">
                  {failure_diagnosis.failure_category}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                <span className="text-[#7E85A6]">Recoverability Class:</span>
                <span className="font-mono font-bold text-[#F2F0EA]">
                  {failure_diagnosis.recoverability_class}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#222950] border border-[#2A3362] space-y-1.5">
                <span className="text-[10px] text-[#7E85A6] uppercase font-mono">Allowed Actions by Rail & Category:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {failure_diagnosis.allowed_actions.map((act) => (
                    <span
                      key={act}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#1B2140] text-[#E8A33D] border border-[#2A3362]"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>

              {failure_diagnosis.recommended_recovery_window_hours && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#222950] border border-[#2A3362]">
                  <span className="text-[#7E85A6]">Recommended Cooldown:</span>
                  <span className="font-mono font-bold text-[#E8A33D]">
                    {failure_diagnosis.recommended_recovery_window_hours} hours
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Interpretable ML Propensity Signal */}
        <div className="p-5 rounded-xl bg-[#171D36] border border-[#2A3362] space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#2A3362] pb-2.5">
            <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#E8A33D]" />
              <span>Interpretable ML Propensity Model (Signal Only · Not Authority)</span>
            </div>
            <span className="text-[10px] font-mono text-[#7E85A6] bg-[#222950] px-2 py-0.5 rounded border border-[#2A3362]">
              LogisticRegression Calibrated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Propensity Gauge */}
            <div className="p-4 rounded-xl bg-[#222950] border border-[#2A3362] flex flex-col justify-center items-center text-center space-y-1.5">
              <div className="text-xs text-[#7E85A6] font-mono">Propensity-to-Pay Score</div>
              <div className="text-3xl font-bold font-mono text-[#E8A33D] tabular-nums my-1">
                {propensity_score.toFixed(3)}
              </div>
              <div className="w-full bg-[#1B2140] h-2.5 rounded-full overflow-hidden mt-1 border border-[#2A3362]">
                <div
                  className="h-full bg-gradient-to-r from-[#E8A33D] to-[#7BA88C]"
                  style={{ width: `${Math.min(100, Math.max(0, propensity_score * 100))}%` }}
                />
              </div>
              <div className="text-[10px] text-[#7E85A6] mt-1 font-mono">
                Confidence: {(propensity_confidence * 100).toFixed(1)}%
              </div>
            </div>

            {/* Explanation Summary */}
            <div className="md:col-span-2 p-4 rounded-xl bg-[#222950] border border-[#2A3362] flex flex-col justify-center space-y-2">
              <div className="text-xs font-mono text-[#7E85A6] font-medium">Structured Factor Analysis</div>
              <div className="text-xs text-[#F2F0EA] font-mono whitespace-pre-line leading-relaxed bg-[#1B2140] p-3 rounded-lg border border-[#2A3362]">
                {explanation_summary}
              </div>
            </div>
          </div>

          {/* Natural-scale Feature Contributions Waterfall */}
          {importantFeatures.length > 0 && (
            <div className="p-3 rounded bg-[#222950] border border-[#2A3362] space-y-2">
              <div className="text-xs font-mono text-[#7E85A6]">
                Top Active Feature Contributions (Log-Odds Impact on Recoverability)
              </div>
              <div className="space-y-1.5">
                {importantFeatures.map((feat) => {
                  const isPositive = feat.direction === "positive";
                  const pctWidth = Math.min(100, Math.abs(feat.impact) * 50);

                  return (
                    <div key={feat.feature} className="flex items-center gap-2 text-xs font-mono">
                      <div className="w-44 text-[#B4B9D2] truncate" title={feat.feature}>
                        {feat.feature}
                      </div>
                      <div className="w-16 text-right text-[#7E85A6]">
                        {feat.raw_value}
                      </div>
                      <div className="flex-1 flex items-center gap-1.5">
                        <div className="w-24 bg-[#1B2140] h-2 rounded-full overflow-hidden border border-[#2A3362]">
                          <div
                            className={`h-full ${isPositive ? "bg-[#7BA88C]" : "bg-[#B5615A]"}`}
                            style={{ width: `${pctWidth}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold ${isPositive ? "text-[#7BA88C]" : "text-[#B5615A]"}`}>
                          {isPositive ? `+${feat.impact.toFixed(2)}` : feat.impact.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Revora Stopping Rules Proof */}
        {policyChecks && (
          <div className="p-4 rounded-lg bg-[#171D36] border border-[#2A3362] space-y-2.5">
            <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#E8A33D]" />
              <span>Revora Policy Rule Evaluation Checklist (100% Deterministic)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
              {Object.entries(policyChecks).map(([checkName, isPassed]) => (
                <div
                  key={checkName}
                  className="p-2 rounded bg-[#222950] border border-[#2A3362] flex items-center justify-between"
                >
                  <span className="text-[#B4B9D2] truncate" title={checkName}>
                    {checkName.replace(/_/g, " ")}
                  </span>
                  {isPassed ? (
                    <span className="inline-flex items-center gap-1 text-[#7BA88C] text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>PASS</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#B5615A] text-[11px] font-bold">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>FAIL / STOP</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
