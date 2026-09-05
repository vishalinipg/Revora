"use client";

import React from "react";
import { ArrowRight, ShieldCheck, Database, Cpu, Brain, GitCommit, MessageSquare, Terminal } from "lucide-react";

export const MechanismDiagram: React.FC = () => {
  const stages = [
    {
      id: "stage-1",
      title: "Signal Ingestion",
      provenance: "OBSERVED",
      provenanceColor: "text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/30",
      actor: "Payment Gateway Webhook",
      icon: Database,
      details: "Raw failure payload (`insufficient_funds`, `authentication_required`), recurring rail metadata (UPI AutoPay, Cards), and cycle attempt history.",
    },
    {
      id: "stage-2",
      title: "Deterministic Diagnosis",
      provenance: "DECISION",
      provenanceColor: "text-[#B4B9D2] bg-[#222950] border-[#2A3362]",
      actor: "Diagnosis Engine",
      icon: Cpu,
      details: "Rule-based partition into Transient (soft), Customer Actionable (mandate/auth), or Hard Blocked (account closed / fraud lock).",
    },
    {
      id: "stage-3",
      title: "ML Propensity Signal",
      provenance: "SIGNAL ONLY",
      provenanceColor: "text-[#7BA88C] bg-[#7BA88C]/10 border-[#7BA88C]/30",
      actor: "Calibrated Logistic Regression",
      icon: Brain,
      details: "Inference of payment recoverability score (0.0 to 1.0) with structured explanation factors. Treated as an advisory signal, never sole authority.",
    },
    {
      id: "stage-4",
      title: "Decision Engine & Stopping Rules",
      provenance: "DECISION",
      provenanceColor: "text-[#B4B9D2] bg-[#222950] border-[#2A3362]",
      actor: "Deterministic Policy Engine",
      icon: GitCommit,
      details: "Non-negotiable policy guards: RBI ₹15k e-mandate step-up rule, max 3 native retries, 24h cooldown windows, and immediate halt on hard failures.",
    },
    {
      id: "stage-5",
      title: "Multilingual Constrained Outreach",
      provenance: "SIMULATED OUTREACH",
      provenanceColor: "text-[#64B5F6] bg-[#64B5F6]/10 border-[#64B5F6]/30",
      actor: "Outreach Language Layer",
      icon: MessageSquare,
      details: "Templated communication in English, Hinglish, or Tanglish with dynamic update links. Zero OTP solicitation; regex safety guardrails active.",
    },
    {
      id: "stage-6",
      title: "Outbox & Audit Logging",
      provenance: "AUDIT LOGGED",
      provenanceColor: "text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30",
      actor: "SQLite Audit Table",
      icon: Terminal,
      details: "Append-only database transaction logging with immutable actor metadata. Synthetic outbox dispatch tagged with persistent simulation watermark.",
    },
  ];

  return (
    <section id="mechanism" className="w-full py-16 px-4 max-w-7xl mx-auto border-t border-[#2A3362]/60">
      {/* Section Heading */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#F2F0EA] tracking-tight">
          Deterministic Pipeline Architecture
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#B4B9D2] font-sans">
          How Revora converts raw webhook telemetry into audited, policy-compliant recovery decisions without blind retries.
        </p>
      </div>

      {/* Six-Stage Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className="bg-[#1B2140] border border-[#2A3362] rounded-lg p-5 flex flex-col justify-between hover:border-[#3D4A88] transition-colors relative group"
            >
              <div>
                {/* Header with Provenance Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-[#222950] text-[#E8A33D] border border-[#2A3362]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#F2F0EA]">Stage 0{idx + 1}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${stage.provenanceColor}`}>
                    [{stage.provenance}]
                  </span>
                </div>

                {/* Stage Title & Actor */}
                <h3 className="text-base font-serif font-semibold text-[#F2F0EA] mb-1">
                  {stage.title}
                </h3>
                <div className="text-[11px] font-mono text-[#7E85A6] mb-3">
                  Actor: <span className="text-[#B4B9D2]">{stage.actor}</span>
                </div>

                {/* Stage Description */}
                <p className="text-xs text-[#B4B9D2] leading-relaxed">
                  {stage.details}
                </p>
              </div>

              {/* Step indicator footer */}
              <div className="mt-4 pt-3 border-t border-[#2A3362]/50 flex items-center justify-between text-[11px] font-mono text-[#7E85A6]">
                <span>Data Boundary: Verified</span>
                {idx < stages.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-[#7E85A6] hidden lg:block group-hover:text-[#E8A33D] transition-colors" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provenance Legend / Guardrail Summary */}
      <div className="mt-8 p-4 rounded-lg bg-[#141930] border border-[#2A3362] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#7E85A6]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[#F2F0EA] font-semibold">Provenance Key:</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E8A33D]" /> Observed Webhook</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7BA88C]" /> ML Signal</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#B4B9D2]" /> Deterministic Rule</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#64B5F6]" /> Simulated Outreach</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#7BA88C]">
          <ShieldCheck className="w-4 h-4 text-[#7BA88C]" />
          <span>Zero Latent Oracle Leakage Across Operational Rails</span>
        </div>
      </div>
    </section>
  );
};
