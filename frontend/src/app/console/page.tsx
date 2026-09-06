"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "../../components/Header";
import { MetricsOverview } from "../../components/MetricsOverview";
import { PaymentQueue } from "../../components/PaymentQueue";
import { BenchmarkModal } from "../../components/BenchmarkModal";
import {
  PaginatedPaymentsResponse,
  EvaluationSummaryResponse,
} from "../../lib/types";
import { api } from "../../lib/api";
import { useTour } from "../../components/tour/TourContext";

export default function OperatorConsolePage() {
  const { activeModal, setActiveModal, setSelectedPaymentId: setTourSelectedPaymentId, isActive } = useTour();

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

  // Selected Payment State
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

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

      if (data.items.length > 0 && !selectedPaymentId) {
        setSelectedPaymentId(data.items[0].payment_id);
      }
    } catch (err: any) {
      setPaymentsError(err.message || "Failed to load payments queue.");
    } finally {
      setIsLoadingPayments(false);
    }
  }, [page, filters, selectedPaymentId]);

  // Initial Data Load
  useEffect(() => {
    fetchMetrics();
    fetchPayments();
  }, [fetchMetrics, fetchPayments]);

  // Sync first real payment ID into tour context
  useEffect(() => {
    if (paymentsData?.items?.length) {
      setTourSelectedPaymentId(paymentsData.items[0].payment_id);
    }
  }, [paymentsData, setTourSelectedPaymentId]);

  // Sync benchmark modal from tour
  useEffect(() => {
    if (activeModal === "benchmark") {
      setIsBenchmarkOpen(true);
    } else if (isActive) {
      setIsBenchmarkOpen(false);
    }
  }, [activeModal, isActive]);

  const handleSelectPayment = (id: string) => {
    setSelectedPaymentId(id);
    setTourSelectedPaymentId(id);
  };

  const handleFilterChange = (newFilters: { status: string; rail: string; failureCode: string }) => {
    setFilters(newFilters);
    setPage(0);
  };

  const handleRefreshAll = () => {
    fetchMetrics();
    fetchPayments();
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
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:gap-5">
        {/* Executive Metric Aggregates */}
        <MetricsOverview
          data={metricsData}
          isLoading={isLoadingMetrics}
          error={metricsError}
          onRetry={fetchMetrics}
        />

        {/* Full-Length Payment Operations Console Workspace */}
        <section aria-label="Payment Operations Console" className="flex-1 flex flex-col gap-5 sm:gap-6 w-full">
          {/* Full-Length Recurring Payments Queue */}
          <div className="w-full">
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
        </section>
      </main>

      {/* Multi-Seed Evaluation & Benchmark Modal */}
      {isBenchmarkOpen && (
        <BenchmarkModal
          onClose={() => {
            setIsBenchmarkOpen(false);
            setActiveModal(null);
          }}
        />
      )}
    </div>
  );
}

