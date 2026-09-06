"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, X, ShieldAlert, ShieldCheck, AlertOctagon, CheckCircle2, Lock, RefreshCw, Send } from "lucide-react";
import { OutreachResponse } from "../lib/types";
import { api } from "../lib/api";

interface MockOutboxModalProps {
  paymentId: string;
  onClose: () => void;
}

export const MockOutboxModal: React.FC<MockOutboxModalProps> = ({ paymentId, onClose }) => {
  const [draft, setDraft] = useState<OutreachResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOutreach = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.generateOutreach(paymentId);
      setDraft(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate outreach draft.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutreach();
  }, [paymentId]);

  const getLanguageLabel = (lang: string | null | undefined) => {
    switch (lang?.toLowerCase()) {
      case "en":
        return "English (en)";
      case "hi_hinglish":
        return "Hindi / Hinglish (hi_hinglish)";
      case "ta_tanglish":
        return "Tamil / Tanglish (ta_tanglish)";
      default:
        return lang || "Standard English";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1B2140] border border-[#2A3362] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Persistent Simulation Warning Watermark Banner */}
        <div className="bg-[#E8A33D] text-[#12172B] px-3 sm:px-4 py-2 text-center font-bold text-[11px] sm:text-xs tracking-wider uppercase flex flex-wrap items-center justify-center gap-1.5">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>SIMULATED — NO MESSAGE SENT · SYNTHETIC ONLY</span>
        </div>

        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#2A3362] bg-[#171D36] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-[#E8A33D] flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-[#F2F0EA] flex items-center gap-2 font-display flex-wrap">
                <span>Multilingual Mock Outbox</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
                  {paymentId}
                </span>
              </div>
              <div className="text-[11px] text-[#B4B9D2]">
                Constrained Outreach Preview & Safety Guardrails
              </div>
            </div>
          </div>

          <button
            data-testid="close-outbox-btn"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-[#B4B9D2] hover:text-[#F2F0EA] bg-[#222950] hover:bg-[#28315E] border border-[#2A3362] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-[#E8A33D] animate-spin mx-auto" />
              <div className="text-xs font-mono text-[#B4B9D2]">
                Evaluating policy action & safety rules...
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded bg-[#B5615A]/10 border border-[#B5615A]/30 text-[#B5615A] text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                <span>Outreach Generation Error</span>
              </div>
              <div>{error}</div>
              <button
                onClick={fetchOutreach}
                className="mt-2 min-h-[40px] px-3 py-1 rounded bg-[#B5615A]/20 hover:bg-[#B5615A]/30 border border-[#B5615A]/40 text-[#F2F0EA] text-xs cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !draft ? null : draft.outreach_suppressed ? (
            /* SUPPRESSED STATE: STOP or HUMAN_ESCALATION */
            <div className="p-5 sm:p-6 rounded-lg bg-[#B5615A]/10 border border-[#B5615A]/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#B5615A]/20 border border-[#B5615A]/40 flex items-center justify-center mx-auto text-[#B5615A]">
                <Lock className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-[#F2F0EA] uppercase tracking-wide">
                Outreach Suppressed by Revora Policy
              </div>
              <p className="text-xs text-[#B4B9D2] max-w-md mx-auto leading-relaxed">
                {draft.suppression_reason ||
                  `Action '${draft.action_type}' is designated terminal or internal escalation. Automated customer communication is strictly prohibited.`}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-[#B5615A]/15 text-[#B5615A] border border-[#B5615A]/30">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Customer Protection Rule Active · Zero Messages Dispatched</span>
                </span>
              </div>
            </div>
          ) : (
            /* APPROVED OUTREACH DRAFT */
            <div className="space-y-3">
              {/* Meta Tags */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
                  Channel: <strong>{(draft.channel || "whatsapp").toUpperCase()}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#222950] text-[#E8A33D] border border-[#2A3362]">
                  Language: <strong>{getLanguageLabel(draft.language_used)}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
                  Action: <strong>{draft.action_type}</strong>
                </span>
              </div>

              {/* Message Chat Preview Bubble */}
              <div className="p-3.5 sm:p-4 rounded-lg bg-[#171D36] border border-[#2A3362] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-[#7E85A6] pb-1 border-b border-[#2A3362]">
                  <span>SIMULATED DISPATCH PREVIEW</span>
                  <span className="text-[10px]">WATERMARK: {draft.simulation_watermark}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#222950] border border-[#2A3362] text-[#F2F0EA] text-xs leading-relaxed whitespace-pre-line font-sans select-all break-words">
                  {draft.message_body}
                </div>
              </div>

              {/* Safety Guarantees Checklist */}
              <div className="p-3 rounded-lg bg-[#171D36] border border-[#2A3362] space-y-1.5 text-xs font-mono">
                <div className="text-[11px] text-[#B4B9D2] uppercase font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#7BA88C] flex-shrink-0" />
                  <span>Fintech Safety Compliance Guarantees</span>
                </div>
                <div className="space-y-1 text-[#B4B9D2] text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#7BA88C]">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    <span>No customer credential solicitation (Zero OTP / PIN / Password requests)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#7BA88C]">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    <span>Deterministic template fallback active (LLM hallucination-proof)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#7BA88C]">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    <span>Simulated outbox persistence only (Real SMS/WhatsApp rail disconnected)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#2A3362] bg-[#171D36] flex items-center justify-between text-xs font-mono text-[#7E85A6]">
          <span>Revora Outbox Mock v1.0</span>
          <button
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] text-xs font-medium cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
