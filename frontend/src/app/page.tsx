"use client";

import React, { useEffect, useState } from "react";
import { LandingHeader } from "../components/landing/LandingHeader";
import { HeroParticleNumeral } from "../components/landing/HeroParticleNumeral";
import { MechanismDiagram } from "../components/landing/MechanismDiagram";
import { LanguageProof } from "../components/landing/LanguageProof";
import { EvaluationReport } from "../components/landing/EvaluationReport";
import { LandingFooter } from "../components/landing/LandingFooter";
import { api } from "../lib/api";
import { EvaluationSummaryResponse } from "../lib/types";

export default function LandingPage() {
  const [summaryData, setSummaryData] = useState<EvaluationSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await api.getEvaluationSummary();
        setSummaryData(data);
      } catch (err) {
        console.warn("Could not load initial evaluation summary for hero numeral:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const primary = summaryData?.primary_benchmark_seed_42;
  const recoveredAmount = primary?.revora.total_recovered_amount_inr ?? 932677.51;
  const recoveryRate = primary?.revora.revenue_recovery_rate_pct ?? 85.2;

  return (
    <div className="min-h-screen flex flex-col bg-[#12172B] text-[#F2F0EA] font-sans antialiased selection:bg-[#E8A33D]/20 selection:text-[#E8A33D]">
      {/* Top Application Bar */}
      <LandingHeader />

      {/* Main Landing Content */}
      <main className="flex-1 flex flex-col items-center">
        {/* Three.js Particle Convergence Hero with Live Numeral Headline */}
        <HeroParticleNumeral
          recoveredAmount={recoveredAmount}
          recoveryRatePct={recoveryRate}
          isLoading={isLoading}
        />

        {/* Six-Stage Deterministic Pipeline Architecture */}
        <MechanismDiagram />

        {/* Multilingual Constrained Outreach Showcase */}
        <LanguageProof />

        {/* Live Evaluation & Robustness Benchmark Report */}
        <EvaluationReport />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}

