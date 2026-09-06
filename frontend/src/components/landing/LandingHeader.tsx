"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowRight, ShieldAlert, Menu, X, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { HealthResponse } from "../../lib/types";
import { useTour } from "../tour/TourContext";

export const LandingHeader: React.FC = () => {
  const { startTour } = useTour();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#2A3362] bg-[#12172B]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-[#E8A33D] flex items-center justify-center font-black text-[#12172B] text-base shadow-sm font-serif group-hover:scale-105 transition-transform">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-serif font-bold tracking-tight text-[#F2F0EA]">REVORA</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1B2140] text-[#B4B9D2] border border-[#2A3362] hidden xs:inline-block">
                Buildathon 2026
              </span>
            </div>
            <p className="text-[11px] text-[#7E85A6] hidden md:block">
              Adaptive Revenue Recovery for Recurring Indian Payments
            </p>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-mono text-[#B4B9D2]">
          <a href="#mechanism" className="hover:text-[#E8A33D] transition-colors">
            Mechanism
          </a>
          <a href="#language-proof" className="hover:text-[#E8A33D] transition-colors">
            Outreach
          </a>
          <a href="#evaluation-report" className="hover:text-[#E8A33D] transition-colors">
            Benchmark
          </a>
        </nav>

        {/* Desktop Header Actions */}
        <div className="hidden md:flex items-center gap-2.5 sm:gap-3">
          {/* Health indicator */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border min-h-[38px] ${
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
                ? `API CONNECTED (${health?.version || "1.0.0"})`
                : isHealthy === false
                ? "API OFFLINE"
                : "CHECKING..."}
            </span>
          </div>

          {/* Product tour CTA */}
          <button
            onClick={() => startTour(0)}
            data-testid="product-tour-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8A33D]/40 bg-[#E8A33D]/10 hover:bg-[#E8A33D]/20 text-[#E8A33D] font-mono text-xs font-semibold transition-all shadow-sm min-h-[38px] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E8A33D]" />
            <span>Product tour</span>
          </button>

          {/* Operator Console CTA */}
          <a
            href="/console"
            data-testid="header-console-link"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E8A33D] hover:bg-[#E8A33D]/90 text-[#12172B] font-mono text-xs font-bold transition-all shadow-sm group min-h-[38px]"
          >
            <span>Operator Console</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Mobile Action & Menu Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          <a
            href="/console"
            data-testid="header-console-link-mobile"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E8A33D] text-[#12172B] font-mono text-xs font-bold transition-all shadow-sm min-h-[44px]"
          >
            <span>Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
            data-testid="mobile-menu-toggle-btn"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#1B2140] text-[#F2F0EA] border border-[#2A3362] hover:bg-[#222950] transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {isMobileMenuOpen && (
        <div
          ref={menuRef}
          data-testid="mobile-menu-drawer"
          className="md:hidden mt-3 pt-3 pb-4 border-t border-[#2A3362] flex flex-col gap-3 animate-in slide-in-from-top-2 duration-150"
        >
          {/* Mobile Tour Button */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              startTour(0);
            }}
            data-testid="mobile-product-tour-btn"
            className="min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-md bg-[#E8A33D]/10 border border-[#E8A33D]/30 text-[#E8A33D] font-mono text-xs font-semibold hover:bg-[#E8A33D]/20 transition-colors w-full text-left cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#E8A33D]" />
            <span>Product tour</span>
          </button>

          {/* Anchor Links */}
          <nav className="flex flex-col gap-1 text-sm font-mono text-[#F2F0EA]">
            <a
              href="#mechanism"
              onClick={handleNavClick}
              className="min-h-[44px] flex items-center px-3 py-2 rounded-md hover:bg-[#1B2140] text-[#B4B9D2] hover:text-[#F2F0EA] transition-colors"
            >
              Pipeline Architecture
            </a>
            <a
              href="#language-proof"
              onClick={handleNavClick}
              className="min-h-[44px] flex items-center px-3 py-2 rounded-md hover:bg-[#1B2140] text-[#B4B9D2] hover:text-[#F2F0EA] transition-colors"
            >
              Multilingual Outreach
            </a>
            <a
              href="#evaluation-report"
              onClick={handleNavClick}
              className="min-h-[44px] flex items-center px-3 py-2 rounded-md hover:bg-[#1B2140] text-[#B4B9D2] hover:text-[#F2F0EA] transition-colors"
            >
              Evaluation Benchmark
            </a>
          </nav>

          {/* Status & Badges in Mobile Drawer */}
          <div className="pt-2 border-t border-[#2A3362]/60 flex flex-col gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-[#7E85A6]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy === true
                    ? "bg-[#7BA88C]"
                    : isHealthy === false
                    ? "bg-[#B5615A]"
                    : "bg-slate-500"
                }`}
              />
              <span>
                Backend API:{" "}
                <strong className={isHealthy ? "text-[#7BA88C]" : "text-[#B5615A]"}>
                  {isHealthy === true ? "Connected (v1.0)" : isHealthy === false ? "Offline" : "Checking..."}
                </strong>
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] text-[#E8A33D]">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Simulation Environment · No Real Money Moved</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

