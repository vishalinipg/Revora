"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Activity,
  Cpu,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { DecisionInspector } from "../../../../components/DecisionInspector";
import { CustomerTimeline } from "../../../../components/CustomerTimeline";
import { MockOutboxModal } from "../../../../components/MockOutboxModal";
import {
  PaymentDetailResponse,
  DecisionResponse,
  PaymentTimelineResponse,
} from "../../../../lib/types";
import { api } from "../../../../lib/api";

export default function InspectPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const paymentId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  // Payment Detail State
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Live Decision Execution State
  const [isExecutingDecision, setIsExecutingDecision] = useState(false);
  const [lastDecisionResult, setLastDecisionResult] = useState<DecisionResponse | null>(null);

  // Timeline State & Modal
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineData, setTimelineData] = useState<PaymentTimelineResponse | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Outbox Preview Modal
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);

  // 1. Fetch Selected Payment Detail
  const fetchPaymentDetail = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await api.getPaymentDetail(id);
      setPaymentDetail(detail);
    } catch (err: any) {
      setDetailError(err.message || "Failed to fetch payment details.");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetail(paymentId);
    }
  }, [paymentId, fetchPaymentDetail]);

  // 2. Trigger Live Decision Engine Re-run
  const handleExecuteDecision = async (): Promise<DecisionResponse | null> => {
    if (!paymentId) return null;
    setIsExecutingDecision(true);
    try {
      const result = await api.evaluateDecision(paymentId);
      setLastDecisionResult(result);
      fetchPaymentDetail(paymentId);
      return result;
    } catch (err: any) {
      alert(`Decision Engine execution failed: ${err.message}`);
      return null;
    } finally {
      setIsExecutingDecision(false);
    }
  };

  // 3. Open Timeline
  const handleOpenTimeline = async () => {
    if (!paymentId) return;
    setIsTimelineOpen(true);
    setIsLoadingTimeline(true);
    setTimelineError(null);
    try {
      const timeline = await api.getPaymentTimeline(paymentId);
      setTimelineData(timeline);
    } catch (err: any) {
      setTimelineError(err.message || "Failed to load customer audit timeline.");
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#12172B] text-[#F2F0EA] font-sans antialiased selection:bg-[#E8A33D]/20 selection:text-[#E8A33D]">
      {/* Top Application Bar */}
      <header className="border-b border-[#2A3362] bg-[#171D36]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/console"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#E8A33D]" />
            <span>Back to Payments Queue</span>
          </Link>

          <div className="h-5 w-px bg-[#2A3362] hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#7E85A6] uppercase tracking-wider">
              Inspecting Payment
            </span>
            <span className="text-sm font-mono font-bold text-[#F2F0EA] px-2.5 py-0.5 rounded-md bg-[#222950] border border-[#2A3362]">
              {paymentId}
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#222950]/80 border border-[#2A3362] text-[11px] font-mono text-[#B4B9D2]">
            <Shield className="w-3.5 h-3.5 text-[#E8A33D]" />
            <span>SIMULATION ENVIRONMENT · NO REAL MONEY MOVED</span>
          </div>

          <button
            onClick={() => fetchPaymentDetail(paymentId)}
            disabled={isLoadingDetail}
            className="p-1.5 rounded-lg bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh payment signals"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetail ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Inspection Body */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
        <section aria-label="Payment Operations Console" className="flex-1 w-full">
          <DecisionInspector
            paymentDetail={paymentDetail}
            isLoading={isLoadingDetail}
            error={detailError}
            onRerunDecision={handleExecuteDecision}
            isExecutingDecision={isExecutingDecision}
            onOpenOutreach={() => setIsOutboxOpen(true)}
            onOpenTimeline={handleOpenTimeline}
            lastDecisionResult={lastDecisionResult}
          />
        </section>
      </main>

      {/* Audit Timeline Drawer / Modal */}
      {isTimelineOpen && (
        <CustomerTimeline
          timeline={timelineData}
          isLoading={isLoadingTimeline}
          error={timelineError}
          onClose={() => setIsTimelineOpen(false)}
          paymentId={paymentId}
        />
      )}

      {/* Simulated Multilingual Outbox Modal */}
      {isOutboxOpen && paymentId && (
        <MockOutboxModal
          paymentId={paymentId}
          onClose={() => setIsOutboxOpen(false)}
        />
      )}
    </div>
  );
}
