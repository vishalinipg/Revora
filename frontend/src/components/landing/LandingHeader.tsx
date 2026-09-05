"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { HealthResponse } from "../../lib/types";

export const LandingHeader: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
        setIsHealthy(res.status === "healthy");
      } catch {
        setIsHealthy(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2A3362] bg-[#12172B]/90 backdrop-blur-md px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#E8A33D] flex items-center justify-center font-black text-[#12172B] text-base shadow-sm font-serif">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-serif font-bold tracking-tight text-[#F2F0EA]">REVORA</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#1B2140] text-[#B4B9D2] border border-[#2A3362]">
                Buildathon 2026
              </span>
            </div>
            <p className="text-[11px] text-[#7E85A6] hidden sm:block">
              Adaptive Revenue Recovery for Recurring Indian Payments
            </p>
          </div>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Simulation disclaimer */}
          <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#E8A33D]/10 border border-[#E8A33D]/30 text-[#E8A33D] text-xs font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-[#E8A33D] flex-shrink-0" />
            <span>SIMULATION ENVIRONMENT</span>
          </div>

          {/* Health indicator */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${
              isHealthy === true
                ? "bg-[#7BA88C]/10 border-[#7BA88C]/30 text-[#7BA88C]"
                : isHealthy === false
                ? "bg-[#B5615A]/10 border-[#B5615A]/30 text-[#B5615A]"
                : "bg-[#1B2140] border-[#2A3362] text-[#7E85A6]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthy === true
                  ? "bg-[#7BA88C] animate-pulse"
                  : isHealthy === false
                  ? "bg-[#B5615A]"
                  : "bg-slate-500"
              }`}
            />
            <span className="hidden sm:inline">
              {isHealthy === true
                ? `API CONNECTED (${health?.version || "1.0.0"})`
                : isHealthy === false
                ? "API OFFLINE"
                : "CHECKING..."}
            </span>
            <span className="sm:hidden">
              {isHealthy === true ? "ONLINE" : isHealthy === false ? "OFFLINE" : "..."}
            </span>
          </div>

          {/* Primary Utility CTA: Operator Console */}
          <a
            href="/console"
            data-testid="header-console-link"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#1B2140] hover:bg-[#222950] text-[#F2F0EA] hover:text-white border border-[#2A3362] hover:border-[#E8A33D]/60 text-xs font-medium transition-all shadow-sm group"
          >
            <span>Operator Console</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#E8A33D] group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </header>
  );
};
