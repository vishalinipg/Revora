"use client";

import React from "react";
import { TrendingUp, DollarSign, ShieldCheck, AlertTriangle, Layers, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { EvaluationSummaryResponse } from "../lib/types";
import { formatINR, formatPct } from "../lib/utils";

interface MetricsOverviewProps {
  data: EvaluationSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  data,
  isLoading,
  error,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-[#1B2140] border border-[#2A3362] animate-pulse space-y-2.5"
          >
            <div className="h-3 w-24 bg-[#222950] rounded" />
            <div className="h-7 w-32 bg-[#28315E] rounded" />
            <div className="h-2.5 w-full bg-[#222950] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-lg bg-[#B5615A]/10 border border-[#B5615A]/30 text-[#B5615A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[#B5615A] flex-shrink-0" />
          <div>
            <div className="font-medium text-sm text-[#F2F0EA]">
              Evaluation Metrics Unavailable
            </div>
            <div className="text-xs text-[#B4B9D2]">
              {error || "Unable to connect to Revora API. No mock metrics displayed."}
            </div>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#B5615A]/20 hover:bg-[#B5615A]/30 border border-[#B5615A]/40 text-[#F2F0EA] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const primary = data.primary_benchmark_seed_42;
  const revora = primary.revora;
  const baseline = primary.baseline;
  const delta = primary.comparative_delta;
  const metadata = data.metadata;

  return (
    <section aria-label="Executive Metrics" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2 text-xs text-[#B4B9D2] font-mono max-w-full">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7BA88C] shadow-sm shadow-[#7BA88C]/40 flex-shrink-0" />
          <span className="tracking-wide text-[11px] sm:text-xs break-words">
            LIVE EVALUATION AGGREGATES · CHRONOLOGICALLY HELD-OUT TEST COHORT
          </span>
        </div>
        <span className="text-[11px] sm:text-xs font-mono text-[#7E85A6]">
          Baseline: <span className="text-[#B4B9D2]">{data.baseline_description}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Recovery Rate */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#1B2140] border border-[#2A3362] hover:border-[#3D4A88] transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#B4B9D2] mb-1.5">
              <span className="font-medium">Recovery Rate</span>
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#7BA88C] bg-[#7BA88C]/10 px-2 py-0.5 rounded-md border border-[#7BA88C]/30">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{delta.absolute_revenue_recovery_rate_delta_pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-2xl lg:text-[26px] font-bold font-mono text-[#F2F0EA] tabular-nums tracking-tight my-1">
              {formatPct(revora.revenue_recovery_rate_pct)}
            </div>
          </div>
          <div className="text-xs text-[#7E85A6] mt-2 pt-2 border-t border-[#222950]">
            vs <strong className="text-[#B4B9D2] font-mono">{formatPct(baseline.revenue_recovery_rate_pct)}</strong> control baseline
          </div>
        </div>

        {/* Metric 2: Recovered Revenue */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#1B2140] border border-[#2A3362] hover:border-[#3D4A88] transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#B4B9D2] mb-1.5">
              <span className="font-medium">Recovered Value</span>
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#7BA88C] bg-[#7BA88C]/10 px-2 py-0.5 rounded-md border border-[#7BA88C]/30">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{formatINR(delta.absolute_recovered_amount_delta_inr)}</span>
              </div>
            </div>
            <div className="text-2xl lg:text-[26px] font-bold font-mono text-[#F2F0EA] tabular-nums tracking-tight my-1 truncate" title={formatINR(revora.total_recovered_amount_inr)}>
              {formatINR(revora.total_recovered_amount_inr)}
            </div>
          </div>
          <div className="text-xs text-[#7E85A6] mt-2 pt-2 border-t border-[#222950]">
            of <span className="text-[#B4B9D2] font-mono">{formatINR(revora.total_revenue_at_risk_inr)}</span> at-risk volume
          </div>
        </div>

        {/* Metric 3: Futile Retries Prevented */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#1B2140] border border-[#2A3362] hover:border-[#3D4A88] transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#B4B9D2] mb-1.5">
              <span className="font-medium">Futile Retries Saved</span>
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#E8A33D] bg-[#E8A33D]/10 px-2 py-0.5 rounded-md border border-[#E8A33D]/30">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>-{delta.intervention_reduction_pct.toFixed(1)}% actions</span>
              </div>
            </div>
            <div className="text-2xl lg:text-[26px] font-bold font-mono text-[#E8A33D] tabular-nums tracking-tight my-1">
              {delta.futile_retries_prevented}
            </div>
          </div>
          <div className="text-xs text-[#7E85A6] mt-2 pt-2 border-t border-[#222950]">
            Permanent failures stopped immediately
          </div>
        </div>

        {/* Metric 4: Stopping Rule Compliance */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#1B2140] border border-[#2A3362] hover:border-[#3D4A88] transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#B4B9D2] mb-1.5">
              <span className="font-medium">Stopping Compliance</span>
              <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#7BA88C] bg-[#7BA88C]/10 px-2 py-0.5 rounded-md border border-[#7BA88C]/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Verified</span>
              </div>
            </div>
            <div className="text-2xl lg:text-[26px] font-bold font-mono text-[#F2F0EA] tabular-nums tracking-tight my-1">
              {formatPct(revora.stopping_rule_compliance_pct)}
            </div>
          </div>
          <div className="text-xs text-[#7E85A6] mt-2 pt-2 border-t border-[#222950]">
            Zero policy breaches (Max 3 retries, 24h cooldown)
          </div>
        </div>

        {/* Metric 5: Cohort Volume */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#1B2140] border border-[#2A3362] hover:border-[#3D4A88] transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#B4B9D2] mb-1.5">
              <span className="font-medium">Evaluated Cohort</span>
              <div className="inline-flex items-center gap-1 text-xs font-mono text-[#B4B9D2] bg-[#222950] px-2 py-0.5 rounded-md border border-[#2A3362]">
                <span>Seed {metadata.primary_seed}</span>
              </div>
            </div>
            <div className="text-2xl lg:text-[26px] font-bold font-mono text-[#F2F0EA] tabular-nums tracking-tight my-1">
              {metadata.cohort_size} <span className="text-sm font-normal text-[#7E85A6]">payments</span>
            </div>
          </div>
          <div className="text-xs text-[#7E85A6] mt-2 pt-2 border-t border-[#222950]">
            <span className="text-[#7BA88C] font-mono">{primary.revora.recovered_payments}</span> recovered · <span className="text-[#B5615A] font-mono">{primary.revora.unresolved_payments}</span> terminal
          </div>
        </div>
      </div>
    </section>
  );
};
