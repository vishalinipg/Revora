"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

export const LandingFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-[#2A3362] bg-[#12172B] px-4 lg:px-8 py-8 mt-12 text-xs font-mono text-[#7E85A6]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center sm:text-left">
        {/* Brand context */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#E8A33D] flex items-center justify-center font-bold text-[#12172B] text-xs font-serif flex-shrink-0">
            R
          </div>
          <div>
            <span className="font-serif font-semibold text-[#F2F0EA]">REVORA</span>
            <span className="mx-2 text-[#2A3362]">|</span>
            <span>Razorpay Buildathon 2026</span>
          </div>
        </div>

        {/* Simulation Watermark Notice */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded bg-[#E8A33D]/10 border border-[#E8A33D]/30 text-[#E8A33D] text-[11px] text-center max-w-full">
          <ShieldAlert className="w-3.5 h-3.5 text-[#E8A33D] flex-shrink-0" />
          <span>SYNTHETIC ENVIRONMENT · NO REAL MONEY MOVED</span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-mono">
          <a
            href="/console"
            className="min-h-[44px] inline-flex items-center text-[#B4B9D2] hover:text-[#E8A33D] transition-colors"
          >
            Operator Console
          </a>
          <a
            href="#mechanism"
            className="min-h-[44px] inline-flex items-center text-[#B4B9D2] hover:text-[#E8A33D] transition-colors"
          >
            Mechanism
          </a>
          <a
            href="#language-proof"
            className="min-h-[44px] inline-flex items-center text-[#B4B9D2] hover:text-[#E8A33D] transition-colors"
          >
            Outreach
          </a>
          <a
            href="#evaluation-report"
            className="min-h-[44px] inline-flex items-center text-[#B4B9D2] hover:text-[#E8A33D] transition-colors"
          >
            Benchmark
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-[#2A3362]/40 text-center text-[11px] text-[#7E85A6]">
        Revora Adaptive Recurring Payment Recovery Engine · Built with strict 4-way ground truth isolation, deterministic stopping policies, and causal outcome evaluation.
      </div>
    </footer>
  );
};
