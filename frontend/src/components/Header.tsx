"use client";

import React, { useEffect, useState } from "react";
import { Activity, ShieldAlert, BarChart3, RefreshCw, Server } from "lucide-react";
import { api } from "../lib/api";
import { HealthResponse } from "../lib/types";

interface HeaderProps {
  onOpenBenchmark: () => void;
  onRefreshAll: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBenchmark,
  onRefreshAll,
  isRefreshing = false,
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  const checkHealth = async () => {
    try {
      const res = await api.getHealth();
      setHealth(res);
      setIsHealthy(res.status === "healthy");
    } catch {
      setIsHealthy(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-[#2A3362] bg-[#12172B]/95 backdrop-blur-sm px-4 sm:px-6 py-3 sticky top-0 z-40">
      <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4">
        {/* Brand & Context */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E8A33D] flex items-center justify-center font-black text-[#12172B] text-base sm:text-lg shadow-sm font-display flex-shrink-0">
              R
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[#F2F0EA] font-display">REVORA</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#1B2140] text-[#B4B9D2] border border-[#2A3362]">
                  Console v1.0
                </span>
                <a
                  href="/"
                  className="text-xs font-mono px-2 py-0.5 rounded text-[#7E85A6] hover:text-[#E8A33D] hover:bg-[#1B2140] border border-transparent hover:border-[#2A3362] transition-colors"
                >
                  ← Overview
                </a>
              </div>
              <p className="text-[11px] sm:text-xs text-[#B4B9D2] mt-0.5 leading-snug">
                Adaptive Revenue Recovery for Recurring Payments · Razorpay Buildathon 2026
              </p>
            </div>
          </div>

          <div className="hidden 2xl:block h-6 w-px bg-[#2A3362] mx-1" />

          {/* System Target & Rail Info */}
          <div className="hidden 2xl:flex items-center gap-2.5 text-xs font-mono text-[#7E85A6]">
            <span>Target Rail:</span>
            <span className="text-[#F2F0EA] bg-[#1B2140] px-2.5 py-1 rounded-md border border-[#2A3362]">
              UPI AutoPay (NPCI e-Mandate)
            </span>
            <span className="ml-1">Adapter:</span>
            <span className="text-[#F2F0EA] bg-[#1B2140] px-2.5 py-1 rounded-md border border-[#2A3362]">
              Razorpay Card Subscriptions (Test)
            </span>
          </div>
        </div>

        {/* Status, Simulation Disclaimer, and Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Simulation Disclaimer Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#E8A33D]/10 border border-[#E8A33D]/30 text-[#E8A33D] text-[11px] sm:text-xs font-medium min-h-[38px]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#E8A33D] flex-shrink-0" />
            <span className="hidden sm:inline">SIMULATION ENVIRONMENT ·</span>
            <span className="font-semibold">NO REAL MONEY MOVED</span>
          </div>

          {/* Health Status Indicator */}
          <div
            className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono border min-h-[38px] ${
              isHealthy === true
                ? "bg-[#7BA88C]/10 border-[#7BA88C]/30 text-[#7BA88C]"
                : isHealthy === false
                ? "bg-[#B5615A]/10 border-[#B5615A]/30 text-[#B5615A]"
                : "bg-[#1B2140] border-[#2A3362] text-[#7E85A6]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isHealthy === true
                  ? "bg-[#7BA88C] animate-pulse"
                  : isHealthy === false
                  ? "bg-[#B5615A]"
                  : "bg-slate-500"
              }`}
            />
            <span>
              {isHealthy === true
                ? `API CONNECTED (${health?.version || "v1.0"})`
                : isHealthy === false
                ? "API OFFLINE"
                : "CHECKING..."}
            </span>
          </div>

          {/* Benchmark Modal Trigger */}
          <button
            data-testid="open-benchmark-btn"
            onClick={onOpenBenchmark}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1B2140] hover:bg-[#222950] text-[#F2F0EA] border border-[#2A3362] transition-colors shadow-sm min-h-[38px] cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#E8A33D]" />
            <span>Benchmark & Multi-Seed</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title="Refresh operational data"
            className="p-2 min-h-[38px] min-w-[38px] rounded-lg text-[#B4B9D2] hover:text-[#F2F0EA] bg-[#1B2140] hover:bg-[#222950] border border-[#2A3362] flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#E8A33D]" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
