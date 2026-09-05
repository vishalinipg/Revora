/**
 * Formatting and visual presentation utilities.
 */

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format Indian Rupee currency with standard Indian numbering formatting.
 * e.g., 1094978.07 -> ₹10,94,978.07
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage.
 */
export function formatPct(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return "0.0%";
  return `${val.toFixed(decimals)}%`;
}

/**
 * Format ISO datetime string to legible date/time in IST.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Visual styling classes for Risk Tiers.
 */
export function getRiskTierBadge(tier: string | undefined): { label: string; className: string } {
  switch (tier?.toUpperCase()) {
    case "CRITICAL":
      return {
        label: "CRITICAL",
        className: "bg-[#B5615A]/15 text-[#B5615A] border border-[#B5615A]/40",
      };
    case "HIGH":
      return {
        label: "HIGH",
        className: "bg-[#E8A33D]/15 text-[#E8A33D] border border-[#E8A33D]/40",
      };
    case "MEDIUM":
      return {
        label: "MEDIUM",
        className: "bg-[#E8A33D]/10 text-[#E8A33D] border border-[#E8A33D]/30",
      };
    case "LOW":
      return {
        label: "LOW",
        className: "bg-[#7BA88C]/15 text-[#7BA88C] border border-[#7BA88C]/40",
      };
    default:
      return {
        label: tier || "UNKNOWN",
        className: "bg-[#222950] text-[#B4B9D2] border border-[#2A3362]",
      };
  }
}

/**
 * Visual styling for Payment Status.
 */
export function getPaymentStatusBadge(status: string | undefined): { label: string; className: string } {
  switch (status?.toLowerCase()) {
    case "failed":
      return {
        label: "FAILED",
        className: "bg-[#B5615A]/15 text-[#B5615A] border border-[#B5615A]/40",
      };
    case "pending_retry":
      return {
        label: "PENDING RETRY",
        className: "bg-[#E8A33D]/15 text-[#E8A33D] border border-[#E8A33D]/40",
      };
    case "recovered":
      return {
        label: "RECOVERED",
        className: "bg-[#7BA88C]/15 text-[#7BA88C] border border-[#7BA88C]/40",
      };
    case "halted":
      return {
        label: "HALTED",
        className: "bg-[#222950] text-[#7E85A6] border border-[#2A3362]",
      };
    default:
      return {
        label: (status || "UNKNOWN").toUpperCase(),
        className: "bg-[#1B2140] text-[#B4B9D2] border border-[#2A3362]",
      };
  }
}

/**
 * Visual styling for Action Type.
 */
export function getActionBadge(action: string | undefined): { label: string; className: string } {
  switch (action?.toLowerCase()) {
    case "smart_retry":
    case "retry":
      return {
        label: "SMART RETRY",
        className: "bg-[#64B5F6]/15 text-[#64B5F6] border border-[#64B5F6]/40",
      };
    case "in_app_notification":
      return {
        label: "IN-APP NOTIF",
        className: "bg-[#818CF8]/15 text-[#818CF8] border border-[#818CF8]/40",
      };
    case "whatsapp_reminder":
      return {
        label: "WHATSAPP REMINDER",
        className: "bg-[#7BA88C]/15 text-[#7BA88C] border border-[#7BA88C]/40",
      };
    case "mandate_update_prompt":
    case "payment_update_request":
      return {
        label: "UPDATE MANDATE",
        className: "bg-[#E8A33D]/15 text-[#E8A33D] border border-[#E8A33D]/40",
      };
    case "human_escalation":
      return {
        label: "HUMAN ESCALATION",
        className: "bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/40",
      };
    case "stop":
      return {
        label: "TERMINAL STOP",
        className: "bg-[#B5615A]/15 text-[#B5615A] border border-[#B5615A]/40",
      };
    default:
      return {
        label: (action || "NONE").toUpperCase(),
        className: "bg-[#222950] text-[#B4B9D2] border border-[#2A3362]",
      };
  }
}

/**
 * Rail display label.
 */
export function getRailLabel(rail: string | undefined): string {
  if (rail?.toLowerCase().includes("upi")) return "UPI AutoPay";
  if (rail?.toLowerCase().includes("card")) return "Card Subscription";
  return rail || "Standard Rail";
}
