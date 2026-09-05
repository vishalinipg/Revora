"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "../../components/Header";
import { MetricsOverview } from "../../components/MetricsOverview";
import { PaymentQueue } from "../../components/PaymentQueue";
import { DecisionInspector } from "../../components/DecisionInspector";
import { CustomerTimeline } from "../../components/CustomerTimeline";
import { MockOutboxModal } from "../../components/MockOutboxModal";
import { BenchmarkModal } from "../../components/BenchmarkModal";
import {
  PaginatedPaymentsResponse,
  PaymentDetailResponse,
  DecisionResponse,
  PaymentTimelineResponse,
  EvaluationSummaryResponse,
} from "../../lib/types";
import { api } from "../../lib/api";

export default function OperatorConsolePage() {
  // Global / Executive Metrics State
  const [metricsData, setMetricsData] = useState<EvaluationSummaryResponse | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Payments Queue State
  const [paymentsData, setPaymentsData] = useState<PaginatedPaymentsResponse | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Queue Filters
  const [filters, setFilters] = useState({
    status: "",
    rail: "",
    failureCode: "",
  });

  // Selected Payment & Detail State
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
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

  // Benchmark / Multi-Seed Robustness Modal
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);

  // 1. Fetch Executive Evaluation Metrics
  const fetchMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const data = await api.getEvaluationSummary();
      setMetricsData(data);
    } catch (err: any) {
      setMetricsError(err.message || "Failed to load executive evaluation metrics.");
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // 2. Fetch Payments Queue
  const fetchPayments = useCallback(async () => {
    setIsLoadingPayments(true);
    setPaymentsError(null);
    try {
      const data = await api.getPayments({
        limit: pageSize,
        offset: page * pageSize,
        status: filters.status || undefined,
        rail: filters.rail || undefined,
        failure_code: filters.failureCode || undefined,
      });
      setPaymentsData(data);

      // Auto-select first payment if none currently selected
      if (data.items.length > 0 && !selectedPaymentId) {
        setSelectedPaymentId(data.items[0].payment_id);
      }
    } catch (err: any) {
      setPaymentsError(err.message || "Failed to load payments queue.");
    } finally {
      setIsLoadingPayments(false);
    }
  }, [page, filters, selectedPaymentId]);

  // 3. Fetch Selected Payment Detail
  const fetchPaymentDetail = useCallback(async (id: string) => {
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

  // 4. Trigger Live Decision Engine Re-run
  const handleExecuteDecision = async (): Promise<DecisionResponse | null> => {
    if (!selectedPaymentId) return null;
    setIsExecutingDecision(true);
    try {
      const result = await api.evaluateDecision(selectedPaymentId);
      setLastDecisionResult(result);
      // Refresh details to update state
      fetchPaymentDetail(selectedPaymentId);
      // Refresh metrics as this creates an audit record
      fetchMetrics();
      return result;
    } catch (err: any) {
      alert(`Decision Engine execution failed: ${err.message}`);
      return null;
    } finally {
      setIsExecutingDecision(false);
    }
  };

  // 5. Open Timeline
  const handleOpenTimeline = async () => {
    if (!selectedPaymentId) return;
    setIsTimelineOpen(true);
    setIsLoadingTimeline(true);
    setTimelineError(null);
    try {
      const data = await api.getPaymentTimeline(selectedPaymentId);
      setTimelineData(data);
    } catch (err: any) {
      setTimelineError(err.message || "Failed to load payment timeline.");
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (selectedPaymentId) {
      fetchPaymentDetail(selectedPaymentId);
      setLastDecisionResult(null);
    }
  }, [selectedPaymentId, fetchPaymentDetail]);

  const handleSelectPayment = (id: string) => {
    setSelectedPaymentId(id);
  };

  const handleFilterChange = (newFilters: { status: string; rail: string; failureCode: string }) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page
  };

  const handleRefreshAll = () => {
    fetchMetrics();
    fetchPayments();
    if (selectedPaymentId) fetchPaymentDetail(selectedPaymentId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#12172B] text-[#F2F0EA] font-sans antialiased selection:bg-[#E8A33D]/20 selection:text-[#E8A33D]">
      {/* Top Application Bar */}
      <Header
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isLoadingMetrics || isLoadingPayments}
      />

      {/* Main Operator Console Workspace */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 py-3 flex flex-col gap-3">
        {/* Executive Metric Aggregates */}
        <MetricsOverview
          data={metricsData}
          isLoading={isLoadingMetrics}
          error={metricsError}
          onRetry={fetchMetrics}
        />

        {/* 2-Column High-Density Workstation Layout */}
        <section aria-label="Payment Operations Console" className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[580px]">
          {/* Left Column: At-Risk Payments Queue (5 cols) */}
          <div className="lg:col-span-5 h-full min-h-[500px]">
            <PaymentQueue
              data={paymentsData}
              isLoading={isLoadingPayments}
              error={paymentsError}
              selectedPaymentId={selectedPaymentId}
              onSelectPayment={handleSelectPayment}
              filters={filters}
              onFilterChange={handleFilterChange}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onRetry={fetchPayments}
            />
          </div>

          {/* Right Column: Signal & Decision Inspector (7 cols) */}
          <div className="lg:col-span-7 h-full min-h-[500px]">
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
          </div>
        </section>
      </main>

      {/* Audit Timeline Drawer / Modal */}
      {isTimelineOpen && (
        <CustomerTimeline
          timeline={timelineData}
          isLoading={isLoadingTimeline}
          error={timelineError}
          onClose={() => setIsTimelineOpen(false)}
          paymentId={selectedPaymentId || ""}
        />
      )}

      {/* Simulated Multilingual Outbox Modal */}
      {isOutboxOpen && selectedPaymentId && (
        <MockOutboxModal
          paymentId={selectedPaymentId}
          onClose={() => setIsOutboxOpen(false)}
        />
      )}

      {/* Multi-Seed Evaluation & Benchmark Modal */}
      {isBenchmarkOpen && (
        <BenchmarkModal onClose={() => setIsBenchmarkOpen(false)} />
      )}
    </div>
  );
}
