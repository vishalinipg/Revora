"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Filter, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { PaymentRead, PaginatedPaymentsResponse } from "../lib/types";
import { formatINR, formatDateTime, getPaymentStatusBadge, getRailLabel } from "../lib/utils";

interface PaymentQueueProps {
  data: PaginatedPaymentsResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedPaymentId: string | null;
  onSelectPayment: (paymentId: string) => void;
  filters: {
    status: string;
    rail: string;
    failureCode: string;
  };
  onFilterChange: (filters: { status: string; rail: string; failureCode: string }) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

export const PaymentQueue: React.FC<PaymentQueueProps> = ({
  data,
  isLoading,
  error,
  selectedPaymentId,
  onSelectPayment,
  filters,
  onFilterChange,
  page,
  pageSize,
  onPageChange,
  onRetry,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Client-side quick filter on current loaded batch
  const filteredItems = items.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.payment_id.toLowerCase().includes(q) ||
      p.customer_id.toLowerCase().includes(q) ||
      p.mandate_id.toLowerCase().includes(q) ||
      (p.failure_code && p.failure_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#1B2140] border border-[#2A3362] rounded-xl overflow-hidden shadow-sm">
      {/* Table Header & Controls Bar */}
      <div className="p-4 border-b border-[#2A3362] space-y-3 bg-[#171D36]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-[#F2F0EA] tracking-wide uppercase font-display">
              Recurring Payments Queue
            </h2>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
              {total} total records
            </span>
          </div>

          <div className="text-xs font-mono text-[#7E85A6]">
            Showing <strong className="text-[#F2F0EA]">{Math.min(total, page * pageSize + 1)}–{Math.min(total, (page + 1) * pageSize)}</strong> of {total}
          </div>
        </div>

        {/* Filter Toolbar: Full-width responsive layout */}
        <div
          data-testid="payment-queue-filters"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {/* Instant Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7E85A6]" />
            <input
              type="text"
              placeholder="Search payment ID, customer, mandate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-[#222950] border border-[#2A3362] rounded-lg text-[#F2F0EA] placeholder-[#7E85A6] focus:outline-none focus:border-[#E8A33D] transition-colors font-mono"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#222950] border border-[#2A3362] rounded-lg text-[#F2F0EA] focus:outline-none focus:border-[#E8A33D] transition-colors font-mono cursor-pointer"
          >
            <option value="">Status: All Lifecycle States</option>
            <option value="failed">Failed (Soft/Hard)</option>
            <option value="pending_retry">Pending Retry Cooldown</option>
            <option value="recovered">Recovered (Success)</option>
            <option value="halted">Halted (Mandate Inactive)</option>
          </select>

          {/* Rail Filter */}
          <select
            value={filters.rail}
            onChange={(e) => onFilterChange({ ...filters, rail: e.target.value })}
            className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#222950] border border-[#2A3362] rounded-lg text-[#F2F0EA] focus:outline-none focus:border-[#E8A33D] transition-colors font-mono cursor-pointer"
          >
            <option value="">Payment Rail: All Rails</option>
            <option value="upi_autopay">UPI AutoPay (e-Mandate)</option>
            <option value="card">Card Subscription</option>
          </select>

          {/* Failure Code Filter */}
          <select
            value={filters.failureCode}
            onChange={(e) => onFilterChange({ ...filters, failureCode: e.target.value })}
            className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#222950] border border-[#2A3362] rounded-lg text-[#F2F0EA] focus:outline-none focus:border-[#E8A33D] transition-colors font-mono cursor-pointer"
          >
            <option value="">Failure Code: All Causes</option>
            <option value="insufficient_funds">insufficient_funds (Soft)</option>
            <option value="bank_timeout">bank_timeout (Soft)</option>
            <option value="authentication_required">authentication_required (AFA)</option>
            <option value="expired_mandate">expired_mandate (Hard)</option>
            <option value="blocked_account">blocked_account (Hard)</option>
            <option value="unknown">unknown (Ambiguous)</option>
          </select>
        </div>
      </div>

      {/* Queue Content: Stacked Cards on Mobile (< md) & Table on Desktop (>= md) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[580px] min-h-[440px]">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-[#E8A33D] animate-spin mx-auto" />
            <div className="text-xs font-mono text-[#B4B9D2]">Loading operational payments queue...</div>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-7 h-7 text-[#B5615A] mx-auto" />
            <div className="text-sm font-medium text-[#F2F0EA]">Failed to load payments</div>
            <div className="text-xs text-[#B4B9D2] max-w-md mx-auto">{error}</div>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] transition-colors min-h-[44px] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-[#7E85A6] mx-auto" />
            <div className="text-sm text-[#F2F0EA]">No payments match selected filters</div>
            <div className="text-xs text-[#7E85A6]">Try clearing filters or search query</div>
          </div>
        ) : (
          <>
            {/* Mobile Stacked Cards View (< md) */}
            <div
              data-testid="mobile-payment-cards-container"
              className="md:hidden divide-y divide-[#222950]"
            >
              {filteredItems.map((payment) => {
                const isSelected = payment.payment_id === selectedPaymentId;
                const statusBadge = getPaymentStatusBadge(payment.status);

                return (
                  <div
                    key={`card-${payment.payment_id}`}
                    onClick={() => {
                      onSelectPayment(payment.payment_id);
                      router.push(`/console/inspect/${payment.payment_id}`);
                    }}
                    className={`p-4 space-y-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#222950] border-l-4 border-l-[#E8A33D]"
                        : "hover:bg-[#1E2548]"
                    }`}
                  >
                    {/* Card Header: Payment ID, Date, Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-sm text-[#F2F0EA]">
                          {payment.payment_id}
                        </div>
                        <div className="text-[11px] font-mono text-[#7E85A6] mt-0.5">
                          {formatDateTime(payment.due_date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-mono font-bold text-[#F2F0EA] tabular-nums">
                          {formatINR(payment.amount)}
                        </div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium mt-1 ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>

                    {/* Card Details: Customer, Mandate, Rail, Failure Code */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#171D36] p-2.5 rounded-lg border border-[#2A3362]">
                      <div>
                        <span className="text-[10px] text-[#7E85A6] uppercase block">Customer / Mandate</span>
                        <span className="text-[#B4B9D2] text-[11px] truncate block">{payment.customer_id}</span>
                        <span className="text-[#7E85A6] text-[10px] truncate block">{payment.mandate_id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7E85A6] uppercase block">Rail & Failure</span>
                        <span className="text-[#B4B9D2] text-[11px] block">{getRailLabel(payment.payment_rail)}</span>
                        <span className="text-[#E8A33D] text-[10px] truncate block" title={payment.failure_code || "None"}>
                          {payment.failure_code || "No failure code"}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Retries + Inspect Action */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="text-xs font-mono text-[#B4B9D2]">
                        Retries:{" "}
                        <span className={payment.native_retry_attempt >= 3 ? "text-[#B5615A] font-bold" : "text-[#F2F0EA]"}>
                          {payment.native_retry_attempt} / 3
                        </span>
                      </div>

                      <Link
                        href={`/console/inspect/${payment.payment_id}`}
                        data-testid={`mobile-inspect-btn-${payment.payment_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-[#222950] hover:bg-[#E8A33D] hover:text-[#12172B] text-[#F2F0EA] border border-[#2A3362] hover:border-[#E8A33D] transition-all cursor-pointer shadow-sm group"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#E8A33D] group-hover:text-[#12172B] transition-colors" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <table
              data-testid="desktop-payment-queue-table"
              className="hidden md:table w-full text-left text-xs border-collapse"
            >
              <thead className="bg-[#171D36] text-[#B4B9D2] font-mono text-[11px] sticky top-0 border-b border-[#2A3362] z-10">
                <tr>
                  <th className="py-3.5 px-4 font-medium whitespace-nowrap">Payment ID</th>
                  <th className="py-3.5 px-4 font-medium whitespace-nowrap">Customer / Mandate</th>
                  <th className="py-3.5 px-4 font-medium text-right whitespace-nowrap">Amount (₹)</th>
                  <th className="py-3.5 px-4 font-medium whitespace-nowrap">Rail</th>
                  <th className="py-3.5 px-4 font-medium whitespace-nowrap">Failure Code</th>
                  <th className="py-3.5 px-4 font-medium text-center whitespace-nowrap">Retries</th>
                  <th className="py-3.5 px-4 font-medium text-center whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 font-medium text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222950]">
                {filteredItems.map((payment) => {
                  const isSelected = payment.payment_id === selectedPaymentId;
                  const statusBadge = getPaymentStatusBadge(payment.status);

                  return (
                    <tr
                      key={payment.payment_id}
                      onClick={() => {
                        onSelectPayment(payment.payment_id);
                        router.push(`/console/inspect/${payment.payment_id}`);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#222950] border-l-4 border-l-[#E8A33D]"
                          : "hover:bg-[#1E2548]"
                      }`}
                    >
                      {/* Payment ID & Timestamp */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="font-semibold text-[#F2F0EA]">
                          {payment.payment_id}
                        </div>
                        <div className="text-[10px] text-[#7E85A6] mt-0.5">
                          {formatDateTime(payment.due_date)}
                        </div>
                      </td>

                      {/* Customer & Mandate */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="text-[#B4B9D2] text-[11px]">
                          {payment.customer_id}
                        </div>
                        <div className="text-[#7E85A6] text-[10px] mt-0.5">
                          {payment.mandate_id}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#F2F0EA] tabular-nums whitespace-nowrap">
                        {formatINR(payment.amount)}
                      </td>

                      {/* Rail */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#222950] text-[#B4B9D2] border border-[#2A3362]">
                          {getRailLabel(payment.payment_rail)}
                        </span>
                      </td>

                      {/* Failure Code */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        {payment.failure_code ? (
                          <span className="text-[#E8A33D] text-[11px]">
                            {payment.failure_code}
                          </span>
                        ) : (
                          <span className="text-[#7E85A6]">—</span>
                        )}
                      </td>

                      {/* Retries */}
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[#B4B9D2] whitespace-nowrap">
                        <span className={payment.native_retry_attempt >= 3 ? "text-[#B5615A] font-bold" : ""}>
                          {payment.native_retry_attempt}
                        </span>
                        <span className="text-[#7E85A6]"> / 3</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-mono font-medium ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Inspect Button Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link
                          href={`/console/inspect/${payment.payment_id}`}
                          data-testid={`inspect-btn-${payment.payment_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-[#222950] hover:bg-[#E8A33D] hover:text-[#12172B] text-[#F2F0EA] border border-[#2A3362] hover:border-[#E8A33D] transition-all cursor-pointer shadow-sm group min-h-[36px]"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3 text-[#E8A33D] group-hover:text-[#12172B] transition-colors" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-[#2A3362] bg-[#171D36] flex items-center justify-between text-xs font-mono text-[#B4B9D2]">
        <div>
          Page {page + 1} of {totalPages}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 0 || isLoading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= totalPages || isLoading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#222950] hover:bg-[#28315E] text-[#F2F0EA] border border-[#2A3362] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
