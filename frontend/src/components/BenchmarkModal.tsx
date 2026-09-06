"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, X, ShieldAlert, TrendingUp, RefreshCw, Layers, CheckCircle2, ArrowUpRight } from "lucide-react";
import { EvaluationSeedsResponse, EvaluationSummaryResponse } from "../lib/types";
import { api } from "../lib/api";
import { formatINR, formatPct } from "../lib/utils";

interface BenchmarkModalProps {
  onClose: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ onClose }) => {
  const [seedsData, setSeedsData] = useState<EvaluationSeedsResponse | null>(null);
  const [summaryData, setSummaryData] = useState<EvaluationSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmarks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [seeds, summary] = await Promise.all([
        api.getEvaluationSeeds(),
        api.getEvaluationSummary(),
      ]);
      setSeedsData(seeds);
      setSummaryData(summary);
    } catch (err: any) {
      setError(err.message || "Failed to load benchmark evaluations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  const benchmark = seedsData?.multi_seed_robustness_benchmark;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0a0d18]/80 backdrop-blur-sm">
      <div
        data-testid="benchmark-modal"
        className="bg-[#1B2140] border border-[#2A3362] rounded-lg w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#2A3362] bg-[#171D36] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[#E8A33D] flex-shrink-0" />
            <div>
              <div className="text-sm sm:text-base font-serif font-semibold text-[#F2F0EA] flex items-center gap-2 flex-wrap">
                <span>Multi-Seed Evaluation Benchmark</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#12172B] text-[#B4B9D2] border border-[#2A3362]">
                  Seeds: {seedsData?.seeds_evaluated ? seedsData.seeds_evaluated.join(", ") : "—"}
                </span>
              </div>
              <div className="text-[11px] text-[#7E85A6] font-sans">
                Statistical stability & lift measured against the held-out test cohort
              </div>
            </div>
          </div>

          <button
            data-testid="close-benchmark-btn"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-[#7E85A6] hover:text-[#F2F0EA] bg-[#12172B] hover:bg-[#222950] border border-[#2A3362] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Baseline Banner */}
        <div className="px-3.5 sm:px-4 py-2 bg-[#141930] border-b border-[#2A3362] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[#7E85A6]">Control Comparison Baseline:</span>
            <span className="font-semibold text-[#E8A33D]">
              {seedsData?.baseline_description || "—"}
            </span>
          </div>
          <div className="text-[#B4B9D2]">
            Cohort: <strong className="text-[#F2F0EA]">{seedsData ? `${seedsData.cohort_size} payments` : "—"}</strong> {seedsData ? `(${formatINR(seedsData.total_revenue_at_risk_inr)} at risk)` : ""}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#171D36]">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-[#E8A33D] animate-spin mx-auto" />
              <div className="text-xs font-mono text-[#7E85A6]">
                Loading multi-seed statistical benchmarks from evaluation engine...
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded bg-[#3A1D28]/60 border border-[#B5615A]/60 text-[#F5C2BF] text-xs font-mono">
              {error}
            </div>
          ) : !benchmark ? null : (
            <>
              {/* Section 1: Multi-Seed Robustness Table */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#7BA88C]" />
                  <span>5-Seed Robustness Comparison (Mean ± Standard Deviation)</span>
                </div>

                <div className="border border-[#2A3362] rounded-lg overflow-x-auto max-w-full">
                  <table className="w-full text-xs font-mono text-left border-collapse min-w-[520px]">
                    <thead className="bg-[#141930] text-[#7E85A6] text-[11px] border-b border-[#2A3362]">
                      <tr>
                        <th className="py-2.5 px-3">Metric</th>
                        <th className="py-2.5 px-3 text-right text-[#7BA88C]">Revora Adaptive Engine</th>
                        <th className="py-2.5 px-3 text-right text-[#B4B9D2]">Blind-Retry Control Baseline</th>
                        <th className="py-2.5 px-3 text-right text-[#E8A33D]">Net Delta / Lift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3362] bg-[#1B2140]">
                      {/* Row 1: Recovery Rate */}
                      <tr className="hover:bg-[#222950] transition-colors">
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

                      {/* Row 2: Recovered Amount */}
                      <tr className="hover:bg-[#222950] transition-colors">
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

                      {/* Row 3: Interventions Attempted */}
                      <tr className="hover:bg-[#222950] transition-colors">
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

                      {/* Row 4: Oracle Concordance */}
                      <tr className="hover:bg-[#222950] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#F2F0EA]">Oracle Action Concordance</td>
                        <td className="py-2.5 px-3 text-right text-[#7BA88C] font-bold tabular-nums">
                          {benchmark.revora_oracle_concordance_rate.mean.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#7E85A6] tabular-nums">
                          {benchmark.baseline_oracle_concordance_rate.mean.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#E8A33D] font-bold tabular-nums">
                          +{(benchmark.revora_oracle_concordance_rate.mean - benchmark.baseline_oracle_concordance_rate.mean).toFixed(2)}% pts
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Multilingual Breakdown */}
              {summaryData?.language_breakdown && (
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-[#B4B9D2] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#E8A33D]" />
                    <span>Multilingual Outreach Breakdown (Localized Performance)</span>
                  </div>

                  <div className="border border-[#2A3362] rounded-lg overflow-x-auto max-w-full">
                    <table className="w-full text-xs font-mono text-left border-collapse min-w-[560px]">
                      <thead className="bg-[#141930] text-[#7E85A6] text-[11px] border-b border-[#2A3362]">
                        <tr>
                          <th className="py-2 px-3">Language Code</th>
                          <th className="py-2 px-3">Display Name</th>
                          <th className="py-2 px-3 text-right">Payments</th>
                          <th className="py-2 px-3 text-right">At-Risk INR</th>
                          <th className="py-2 px-3 text-right">Recovered INR</th>
                          <th className="py-2 px-3 text-right">Recovery Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A3362] bg-[#1B2140]">
                        {summaryData.language_breakdown.map((item) => (
                          <tr key={item.language_code} className="hover:bg-[#222950] transition-colors">
                            <td className="py-2 px-3 font-bold text-[#E8A33D]">{item.language_code}</td>
                            <td className="py-2 px-3 text-[#F2F0EA]">{item.display_name}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#B4B9D2]">{item.payments_count}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#7E85A6]">{formatINR(item.revenue_at_risk_inr)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#7BA88C] font-semibold">{formatINR(item.recovered_amount_inr)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-[#7BA88C] font-bold">{formatPct(item.recovery_rate_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Methodology Notice */}
              <div className="p-3 rounded bg-[#141930] border border-[#2A3362] text-[11px] font-mono text-[#7E85A6] space-y-1">
                <div className="text-[#B4B9D2] font-semibold">Evaluation Methodology Note:</div>
                <p>
                  Metrics derived from the chronologically held-out test cohort of {seedsData?.cohort_size ?? "held-out"} recurring payment records.
                  The comparison control baseline executes a standard fixed 3-attempt retry policy without failure differentiation.
                  Ground-truth isolation is rigorously maintained; latent oracle parameters are evaluation-only and never exposed to the decision engine.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#2A3362] bg-[#171D36] flex items-center justify-between text-xs font-mono text-[#7E85A6]">
          <span>Revora Multi-Seed Evaluation v1.0</span>
          <button
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-[#12172B] hover:bg-[#222950] text-[#F2F0EA] border border-[#2A3362] text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
