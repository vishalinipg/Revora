"use client";

import React from "react";
import { History, X, ShieldAlert, Cpu, ArrowRight, CheckCircle2, AlertOctagon, Clock } from "lucide-react";
import { PaymentTimelineResponse, TimelineEvent } from "../lib/types";
import { formatDateTime } from "../lib/utils";

interface CustomerTimelineProps {
  timeline: PaymentTimelineResponse | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  paymentId: string;
}

export const CustomerTimeline: React.FC<CustomerTimelineProps> = ({
  timeline,
  isLoading,
  error,
  onClose,
  paymentId,
}) => {
  const events = timeline?.events || [];

  const getProvenanceBadge = (eventType: string, actor: string) => {
    // 1. OBSERVED: Genuine external gateway/bank webhook signals
    if (eventType === "payment_attempt_failed" || actor === "payment_rail" || eventType.startsWith("observed_")) {
      return {
        label: "OBSERVED",
        tooltip: "Observed external gateway webhook / bank payment rail event",
        className: "bg-[#B5615A]/15 text-[#B5615A] border border-[#B5615A]/40",
        dotColor: "bg-[#B5615A]",
      };
    }
    // 2. DECISION: Internal deterministic evaluations (Risk Detection, Failure Diagnosis, Policy Action)
    if (
      eventType.includes("decision") ||
      eventType.includes("action") ||
      eventType.includes("diagnos") ||
      eventType.includes("risk") ||
      actor === "revora_decision_engine" ||
      actor === "revora_diagnosis_engine" ||
      actor === "revora_risk_detector"
    ) {
      return {
        label: "DECISION",
        tooltip: "Authoritative deterministic engine evaluation (Risk / Diagnosis / Policy Action)",
        className: "bg-[#E8A33D]/15 text-[#E8A33D] border border-[#E8A33D]/40",
        dotColor: "bg-[#E8A33D]",
      };
    }
    // 3. SIMULATED OUTREACH: Draft generation in simulated mock outbox
    if (
      eventType.includes("outreach") ||
      actor === "mock_outbox" ||
      actor === "multilingual_outreach_generator"
    ) {
      return {
        label: "SIMULATED OUTREACH",
        tooltip: "Simulated customer communication draft in mock outbox (No real message dispatched)",
        className: "bg-[#64B5F6]/15 text-[#64B5F6] border border-[#64B5F6]/40",
        dotColor: "bg-[#64B5F6]",
      };
    }
    // 4. SIMULATED OUTCOME: Outcome simulated in test environment
    return {
      label: "SIMULATED OUTCOME",
      tooltip: "Simulated recovery outcome in synthetic test cohort (No real money moved)",
      className: "bg-[#7BA88C]/15 text-[#7BA88C] border border-[#7BA88C]/40",
      dotColor: "bg-[#7BA88C]",
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div
        data-testid="customer-timeline-modal"
        className="bg-[#1B2140] border border-[#2A3362] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#2A3362] bg-[#171D36] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-[#E8A33D] flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-[#F2F0EA] flex items-center gap-2 font-display flex-wrap">
                <span>Lifecycle Event Timeline</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
                  {paymentId}
                </span>
              </div>
              <div className="text-[11px] text-[#B4B9D2]">
                Audited chronological sequence with distinct provenance demarcation
              </div>
            </div>
          </div>

          <button
            data-testid="close-timeline-btn"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-[#B4B9D2] hover:text-[#F2F0EA] bg-[#222950] hover:bg-[#28315E] border border-[#2A3362] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provenance Disclaimer Legend */}
        <div className="px-3.5 sm:px-4 py-2 bg-[#171D36] border-b border-[#2A3362] flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] font-mono">
          <span className="text-[#7E85A6]">Event Provenance:</span>
          <span className="inline-flex items-center gap-1 text-[#B5615A]">
            <span className="w-2 h-2 rounded-full bg-[#B5615A]" />
            <strong>[OBSERVED]</strong> Provider Webhooks
          </span>
          <span className="inline-flex items-center gap-1 text-[#E8A33D]">
            <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
            <strong>[DECISION]</strong> Revora Engine
          </span>
          <span className="inline-flex items-center gap-1 text-[#64B5F6]">
            <span className="w-2 h-2 rounded-full bg-[#64B5F6]" />
            <strong>[SIMULATED OUTREACH]</strong> Mock Outbox
          </span>
          <span className="inline-flex items-center gap-1 text-[#7BA88C]">
            <span className="w-2 h-2 rounded-full bg-[#7BA88C]" />
            <strong>[SIMULATED OUTCOME]</strong> Simulator
          </span>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono text-[#B4B9D2]">
              Loading chronological events...
            </div>
          ) : error ? (
            <div className="p-4 rounded bg-[#B5615A]/10 border border-[#B5615A]/30 text-[#B5615A] text-xs">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7E85A6]">
              No timeline events recorded yet for this payment.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2A3362]">
              {events.map((evt, idx) => {
                const provenance = getProvenanceBadge(evt.event_type, evt.actor);

                return (
                  <div key={evt.event_id || idx} className="relative space-y-1.5">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-[#1B2140] ${provenance.dotColor}`}
                    />

                    {/* Event Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${provenance.className}`}>
                          {provenance.label}
                        </span>
                        <span className="text-xs font-mono font-semibold text-[#F2F0EA]">
                          {evt.event_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#7E85A6]">
                        <Clock className="w-3 h-3 text-[#7E85A6]" />
                        <span>{formatDateTime(evt.timestamp)}</span>
                      </div>
                    </div>

                    {/* Actor */}
                    <div className="text-[11px] font-mono text-[#B4B9D2]">
                      Actor: <span className="text-[#F2F0EA]">{evt.actor}</span>
                    </div>

                    {/* Payload Details */}
                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <div className="p-2.5 rounded bg-[#222950] border border-[#2A3362] text-[11px] font-mono space-y-1">
                        {Object.entries(evt.details).map(([key, val]) => (
                          <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                            <span className="text-[#7E85A6] sm:min-w-[120px] flex-shrink-0">{key}:</span>
                            <span className="text-[#F2F0EA] break-all">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#2A3362] bg-[#171D36] flex items-center justify-between text-xs font-mono text-[#7E85A6]">
          <span>Revora Event Logging v1.0</span>
          <button
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-lg bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] text-xs font-medium cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
