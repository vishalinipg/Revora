"use client";

import React from "react";
import { ShieldCheck, AlertOctagon } from "lucide-react";
import { auditPayloadIsolation } from "../lib/api";

interface GroundTruthBadgeProps {
  payload: any;
  className?: string;
}

export const GroundTruthBadge: React.FC<GroundTruthBadgeProps> = ({ payload, className = "" }) => {
  if (!payload) return null;

  const audit = auditPayloadIsolation(payload);

  if (!audit.isClean) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono ${className}`}>
        <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
        <span>ISOLATION VIOLATION: [{audit.violations.join(", ")}] detected</span>
      </div>
    );
  }

  return (
    <div
      title="Verified: Payload contains strictly Tier 1 observed signals. Zero access to PaymentGroundTruth, true failure cause, or oracle regret."
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium ${className}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      <span>Isolation Verified · Zero Ground-Truth Leakage</span>
    </div>
  );
};
