"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, BarChart3, TrendingUp, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { EvaluationSummaryResponse, EvaluationSeedsResponse } from "../../lib/types";
import { formatINR, formatPct } from "../../lib/utils";

export const EvaluationReport: React.FC = () => {
  const [summaryData, setSummaryData] = useState<EvaluationSummaryResponse | null>(null);
  const [seedsData, setSeedsData] = useState<EvaluationSeedsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveEvaluation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summary, seeds] = await Promise.all([
        api.getEvaluationSummary(),
        api.getEvaluationSeeds(),
      ]);
      setSummaryData(summary);
      setSeedsData(seeds);
    } catch (err: any) {
      setError(err.message || "Failed to load live evaluation data from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveEvaluation();
  }, []);

  const benchmark = seedsData?.multi_seed_robustness_benchmark;

  return (
    <section id="evaluation-report" className="w-full py-16 px-4 max-w-7xl mx-auto border-t border-[#2A3362]/60">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#F2F0EA] tracking-tight">
          Held-Out Evaluation & Statistical Benchmark
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#B4B9D2] font-sans">
          Rigorous performance metrics evaluated on a chronologically held-out recurring payment test split against a fixed 3-attempt blind-retry baseline.
        </p>
      </div>

      {isLoading ? (
        <div className="p-16 text-center space-y-3 bg-[#1B2140] border border-[#2A3362] rounded-lg">
          <RefreshCw className="w-6 h-6 text-[#E8A33D] animate-spin mx-auto" />
          <div className="text-xs font-mono text-[#7E85A6]">
            Fetching dynamic evaluation aggregates from backend...
          </div>
        </div>
      ) : error ? (
        <div className="p-6 rounded-lg bg-[#3A1D28]/60 border border-[#B5615A]/60 text-center space-y-3">
          <AlertCircle className="w-6 h-6 text-[#B5615A] mx-auto" />
          <div className="text-sm font-serif text-[#F5C2BF] font-semibold">
            Evaluation Data Unavailable
          </div>
          <div className="text-xs font-mono text-[#F5C2BF]/80 max-w-md mx-auto">
            {error}
          </div>
          <button
            onClick={fetchLiveEvaluation}
            className="px-3 py-1.5 rounded bg-[#1B2140] hover:bg-[#222950] text-[#F2F0EA] border border-[#2A3362] text-xs font-mono"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const primary = summaryData?.primary_benchmark_seed_42;
            const revora = primary?.revora;
            const baseline = primary?.baseline;
            const delta = primary?.comparative_delta;

            return (
              /* Executive KPI Summary Grid (4 Cards) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Recovery Rate */}
                <div className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[#7E85A6] uppercase">Recovery Rate</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-[#7BA88C] tabular-nums">
                    {revora ? formatPct(revora.revenue_recovery_rate_pct) : "—"}
                  </div>
                  <div className="text-xs font-mono text-[#E8A33D] flex flex-wrap items-center gap-1">
                    <span>+{delta?.absolute_revenue_recovery_rate_delta_pct.toFixed(1)}% pts</span>
                    <span className="text-[#7E85A6]">vs {baseline ? formatPct(baseline.revenue_recovery_rate_pct) : "—"}</span>
                  </div>
                </div>

                {/* KPI 2: Recovered Value */}
                <div className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[#7E85A6] uppercase">Recovered Revenue</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-[#F2F0EA] tabular-nums truncate" title={revora ? formatINR(revora.total_recovered_amount_inr) : undefined}>
                    {revora ? formatINR(revora.total_recovered_amount_inr) : "—"}
                  </div>
                  <div className="text-xs font-mono text-[#7BA88C] flex flex-wrap items-center gap-1">
                    <span>+{delta ? formatINR(delta.absolute_recovered_amount_delta_inr) : "—"}</span>
                    <span className="text-[#7E85A6]">net lift</span>
                  </div>
                </div>

                {/* KPI 3: Futile Retries Saved */}
                <div className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[#7E85A6] uppercase">Futile Retries Saved</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-[#E8A33D] tabular-nums">
                    {delta?.futile_retries_prevented ?? "—"}
                  </div>
                  <div className="text-xs font-mono text-[#B4B9D2] leading-snug">
                    Permanent failures stopped instantly
                  </div>
                </div>

                {/* KPI 4: Stopping Compliance */}
                <div className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[#7E85A6] uppercase">Policy Compliance</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-[#7BA88C] tabular-nums">
                    {revora ? formatPct(revora.stopping_rule_compliance_pct) : "—"}
                  </div>
                  <div className="text-xs font-mono text-[#7E85A6] flex flex-wrap items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#7BA88C] flex-shrink-0" />
                    <span>Zero policy breaches (Max 3, 24h)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 5-Seed Robustness Table */}
          {benchmark && (
            <div className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#E8A33D]" />
                  <span className="text-sm font-serif font-semibold text-[#F2F0EA]">
                    5-Seed Multi-Seed Robustness Comparison (Mean ± Std Dev)
                  </span>
                </div>
                <div className="text-xs font-mono text-[#7E85A6]">
                  Evaluated Seeds: <code className="text-[#B4B9D2]">{seedsData?.seeds_evaluated.join(", ")}</code>
                </div>
              </div>

              <div className="border border-[#2A3362] rounded-lg overflow-x-auto">
                <table className="w-full text-xs font-mono text-left border-collapse min-w-[500px]">
                  <thead className="bg-[#141930] text-[#7E85A6] text-[11px] border-b border-[#2A3362]">
                    <tr>
                      <th className="py-2.5 px-3">Performance Metric</th>
                      <th className="py-2.5 px-3 text-right text-[#7BA88C]">Revora Adaptive Engine</th>
                      <th className="py-2.5 px-3 text-right text-[#B4B9D2]">Blind-Retry Control Baseline</th>
                      <th className="py-2.5 px-3 text-right text-[#E8A33D]">Net Lift / Reduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A3362] bg-[#1B2140]">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#F2F0EA]">Revenue Recovery Rate</td>
                      <td className="py-2.5 px-3 text-right text-[#7BA88C] font-bold tabular-nums">
                        {benchmark.revora_revenue_recovery_rate.mean.toFixed(2)}% ± {benchmark.revora_revenue_recovery_rate.std.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#7E85A6] tabular-nums">
                        {benchmark.baseline_revenue_recovery_rate.mean.toFixed(2)}% ± {benchmark.baseline_revenue_recovery_rate.std.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#E8A33D] font-bold tabular-nums">
                        +{(benchmark.revora_revenue_recovery_rate.mean - benchmark.baseline_revenue_recovery_rate.mean).toFixed(2)}% pts
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#F2F0EA]">Total Recovered Amount</td>
                      <td className="py-2.5 px-3 text-right text-[#7BA88C] font-bold tabular-nums">
                        {formatINR(benchmark.revora_recovered_amount_inr.mean)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#7E85A6] tabular-nums">
                        {formatINR(benchmark.baseline_recovered_amount_inr.mean)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#E8A33D] font-bold tabular-nums">
                        +{formatINR(benchmark.recovered_amount_delta_inr.mean)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#F2F0EA]">Interventions Attempted</td>
                      <td className="py-2.5 px-3 text-right text-[#B4B9D2] tabular-nums">
                        {benchmark.revora_interventions.mean.toFixed(1)} ± {benchmark.revora_interventions.std.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#7E85A6] tabular-nums">
                        {benchmark.baseline_interventions.mean.toFixed(1)} ± {benchmark.baseline_interventions.std.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#E8A33D] font-bold tabular-nums">
                        -{benchmark.intervention_reduction_pct.mean.toFixed(1)}% reduction
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deep Console Callout Card */}
          <div className="p-6 rounded-lg bg-[#141930] border border-[#2A3362] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-base font-serif font-semibold text-[#F2F0EA]">
                Inspect the Real Operational Engine
              </div>
              <p className="text-xs text-[#B4B9D2]">
                Explore individual recurring payments, re-run policy decisions live, preview simulated outreach, and audit causal event timelines.
              </p>
            </div>

            <a
              href="/console"
              data-testid="cta-open-console"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#E8A33D] hover:bg-[#d69333] text-[#12172B] font-semibold text-xs tracking-wide shadow-md transition-all whitespace-nowrap"
            >
              <span>Explore Live Operator Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
