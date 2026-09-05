"use client";

import React, { useState } from "react";
import { MessageSquare, ShieldCheck, CheckCircle2, Lock, AlertTriangle } from "lucide-react";

export const LanguageProof: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "ta">("en");

  const samples = {
    en: {
      langCode: "en",
      name: "English",
      tagline: "Clear, transparent, and respectful tone for Indian enterprise SaaS & subscription products",
      channel: "WhatsApp · Simulated",
      templateId: "tpl_update_request_en_v1",
      body: "Hello Lakshmi Pillai, your recurring payment of ₹492.19 for your Starter Monthly subscription via UPI AutoPay could not be completed due to a temporary bank mandate verification issue. Under Revora policy, please update your payment method securely here: https://pay.revora.internal/update/man_rev_0025. Please do not share any OTP or PIN. Thank you!",
    },
    hi: {
      langCode: "hi_hinglish",
      name: "Hindi (Hinglish)",
      tagline: "Natural conversational Latin-script Hindi, eliminating customer intimidation while maintaining compliance",
      channel: "WhatsApp · Simulated",
      templateId: "tpl_update_request_hi_v1",
      body: "Namaste Lakshmi Pillai, aapka ₹492.19 ka Starter Monthly subscription payment UPI AutoPay mandate issue ke kaaran process nahi ho paaya. Revora policy ke antargat, kripya apna payment method yahan update karein: https://pay.revora.internal/update/man_rev_0025. Apna OTP ya UPI PIN kabhi kisi ke saath share na karein. Dhanyawaad!",
    },
    ta: {
      langCode: "ta_tanglish",
      name: "Tamil (Tanglish)",
      tagline: "Culturally fluent Latin-script Tamil for South Indian customer cohorts, avoiding generic translations",
      channel: "WhatsApp · Simulated",
      templateId: "tpl_update_request_ta_v1",
      body: "Vanakkam Lakshmi Pillai, ungaludaiya ₹492.19 Starter Monthly subscription payment UPI AutoPay mandate issue kaaranamaaga process aagavillai. Revora policy-in padi, ungal payment method-ai inge update seyyavum: https://pay.revora.internal/update/man_rev_0025. Ungal OTP allathu PIN-ai yarukkum share seyyatheergal. Nandri!",
    },
  };

  const activeSample = samples[selectedLang];

  const safetyGuarantees = [
    {
      title: "Zero Credential Solicitation",
      description: "Strictly prohibited from asking for OTPs, UPI PINs, passwords, card numbers, or CVVs. Validated via deterministic AST/regex scans.",
    },
    {
      title: "Amount Tampering Prevention",
      description: "The payment amount (e.g. ₹492.19) is locked from the billing ledger. The language layer cannot modify or round transaction values.",
    },
    {
      title: "Deterministic Fallback Guarantee",
      description: "If an LLM response is delayed, malformed, or fails safety checks, the engine immediately dispatches a verified deterministic template.",
    },
    {
      title: "Automatic Suppression Enforcement",
      description: "Terminal failure codes and blocked accounts automatically suppress customer outreach, preventing harassment of locked accounts.",
    },
  ];

  return (
    <section id="language-proof" className="w-full py-16 px-4 max-w-7xl mx-auto border-t border-[#2A3362]/60">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#F2F0EA] tracking-tight">
          Multilingual Constrained Outreach
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#B4B9D2] font-sans">
          Context-aware communications generated under strict mathematical and safety guardrails across India&apos;s primary commercial languages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Language Message Preview (7 cols) */}
        <div className="lg:col-span-7 bg-[#1B2140] border border-[#2A3362] rounded-lg p-5 flex flex-col gap-4">
          {/* Language Selector Tabs */}
          <div className="flex items-center justify-between pb-3 border-b border-[#2A3362]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#E8A33D]" />
              <span className="text-xs font-mono font-semibold text-[#F2F0EA]">Outreach Drafts</span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#141930] rounded-md border border-[#2A3362]">
              <button
                data-testid="lang-tab-en"
                onClick={() => setSelectedLang("en")}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  selectedLang === "en"
                    ? "bg-[#E8A33D] text-[#12172B] font-bold shadow-sm"
                    : "text-[#B4B9D2] hover:text-[#F2F0EA]"
                }`}
              >
                English
              </button>
              <button
                data-testid="lang-tab-hi"
                onClick={() => setSelectedLang("hi")}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  selectedLang === "hi"
                    ? "bg-[#E8A33D] text-[#12172B] font-bold shadow-sm"
                    : "text-[#B4B9D2] hover:text-[#F2F0EA]"
                }`}
              >
                Hindi (Hinglish)
              </button>
              <button
                data-testid="lang-tab-ta"
                onClick={() => setSelectedLang("ta")}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  selectedLang === "ta"
                    ? "bg-[#E8A33D] text-[#12172B] font-bold shadow-sm"
                    : "text-[#B4B9D2] hover:text-[#F2F0EA]"
                }`}
              >
                Tamil (Tanglish)
              </button>
            </div>
          </div>

          {/* Active Language Metadata */}
          <div className="flex items-center justify-between text-xs font-mono text-[#7E85A6]">
            <span>Channel: <strong className="text-[#F2F0EA]">{activeSample.channel}</strong></span>
            <span>Template: <code className="text-[#E8A33D]">{activeSample.templateId}</code></span>
          </div>

          <p className="text-xs text-[#B4B9D2] italic font-sans">
            {activeSample.tagline}
          </p>

          {/* Message Preview Box */}
          <div className="bg-[#141930] border border-[#2A3362] rounded-lg p-4 font-sans text-sm text-[#F2F0EA] leading-relaxed relative">
            {/* Simulation Watermark Banner */}
            <div className="mb-2.5 pb-2 border-b border-[#2A3362]/60 flex items-center justify-between text-[11px] font-mono text-[#E8A33D]">
              <span className="flex items-center gap-1.5 font-bold">
                <Lock className="w-3 h-3 text-[#E8A33D]" />
                SIMULATED — NO MESSAGE SENT
              </span>
              <span className="text-[#7E85A6]">Zero Real SMS/WhatsApp Gateways</span>
            </div>

            <p className="whitespace-pre-line">
              {activeSample.body}
            </p>
          </div>

          {/* Validation Footnote */}
          <div className="text-[11px] font-mono text-[#7BA88C] flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#7BA88C]" />
            <span>Safety validator checks: PASS (No credentials requested · Amount locked · Dynamic link verified)</span>
          </div>
        </div>

        {/* Right Column: Explicit Safety Guarantees (5 cols) */}
        <div className="lg:col-span-5 bg-[#1B2140] border border-[#2A3362] rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#2A3362]">
            <ShieldCheck className="w-4 h-4 text-[#7BA88C]" />
            <span className="text-xs font-mono font-semibold text-[#F2F0EA] uppercase tracking-wider">
              Fintech Safety Invariants
            </span>
          </div>

          <div className="space-y-4">
            {safetyGuarantees.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs font-serif font-semibold text-[#F2F0EA] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E8A33D]" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-[#B4B9D2] pl-3 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Suppression Proof Note */}
          <div className="mt-2 p-3 rounded bg-[#141930] border border-[#2A3362] text-[11px] font-mono text-[#7E85A6] space-y-1">
            <div className="flex items-center gap-1.5 text-[#B5615A] font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Customer Protection Guarantee</span>
            </div>
            <p>
              The language layer never decides policy. When the Decision Engine returns <code className="text-[#F2F0EA]">STOP</code> or <code className="text-[#F2F0EA]">HUMAN_ESCALATION</code>, the backend suppresses outreach automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
