/**
 * Centralized Typed API Client for Revora Operator Dashboard.
 * 
 * STRICT ARCHITECTURAL PRINCIPLES:
 * 1. Zero frontend business logic: fetches authoritative server responses only.
 * 2. Never fabricate mock metrics, mock payments, or mock outcomes if backend is down.
 * 3. Prohibits ground-truth leakage: runtime payload scanner confirms absence of Tier 2/3 fields.
 */

import {
  HealthResponse,
  PaginatedPaymentsResponse,
  PaymentDetailResponse,
  DecisionResponse,
  OutreachResponse,
  PaymentTimelineResponse,
  EvaluationSummaryResponse,
  EvaluationSeedsResponse,
} from "./types";

// Determine base API URL (supports browser rewrites or direct port 8000)
const API_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "")
  : (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000");

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Audit and verify that an API response payload is completely clean of
 * forbidden Tier 2/3 ground truth fields through recursive traversal.
 */
export function auditPayloadIsolation(payload: any): { isClean: boolean; violations: string[] } {
  const forbiddenKeys = new Set([
    "payment_ground_truth",
    "true_failure_cause",
    "ground_truth_recoverability",
    "optimal_recovery_action",
    "oracle_regret",
    "causal_outcome",
  ]);

  const violations = new Set<string>();

  function scanRecursive(obj: any, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 20) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        scanRecursive(item, depth + 1);
      }
      return;
    }

    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.has(key)) {
        violations.add(key);
      }
      scanRecursive(obj[key], depth + 1);
    }
  }

  scanRecursive(payload);

  // Secondary serialized JSON string check
  try {
    const serialized = JSON.stringify(payload);
    if (serialized) {
      for (const key of forbiddenKeys) {
        if (serialized.includes(`"${key}"`)) {
          violations.add(key);
        }
      }
    }
  } catch {
    // Ignore stringify issues
  }

  return {
    isClean: violations.size === 0,
    violations: Array.from(violations),
  };
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      let errorDetail = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const rawText = await response.text();
        try {
          const jsonBody = JSON.parse(rawText);
          if (jsonBody?.detail) {
            errorDetail = typeof jsonBody.detail === "string" ? jsonBody.detail : JSON.stringify(jsonBody.detail);
          }
        } catch {
          if (rawText && rawText.trim().length > 0) {
            errorDetail = rawText.trim();
          }
        }
      } catch {
        // Fall back to HTTP status text
      }
      throw new ApiError(errorDetail, response.status);
    }

    const data: T = await response.json();

    // Verify isolation guarantee in developer/audit mode
    const audit = auditPayloadIsolation(data);
    if (!audit.isClean) {
      console.error("[CRITICAL ISOLATION BREACH] Prohibited ground-truth keys detected:", audit.violations);
    }

    return data;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      `Backend connection failed: ${err.message || "Network error. Ensure Revora FastAPI is running on port 8000."}`,
      0,
      err
    );
  }
}

export const api = {
  /** Check FastAPI backend health */
  getHealth: (): Promise<HealthResponse> => {
    return fetchJson<HealthResponse>("/health");
  },

  /** List operational recurring payments with server-side filters */
  getPayments: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    rail?: string;
    failure_code?: string;
  }): Promise<PaginatedPaymentsResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset !== undefined) query.set("offset", params.offset.toString());
    if (params?.status) query.set("status", params.status);
    if (params?.rail) query.set("rail", params.rail);
    if (params?.failure_code) query.set("failure_code", params.failure_code);

    const qs = query.toString();
    return fetchJson<PaginatedPaymentsResponse>(`/api/v1/payments${qs ? `?${qs}` : ""}`);
  },

  /** Retrieve full payment operational details, risk evaluation, and ML propensity */
  getPaymentDetail: (paymentId: string): Promise<PaymentDetailResponse> => {
    return fetchJson<PaymentDetailResponse>(`/api/v1/payments/${encodeURIComponent(paymentId)}`);
  },

  /** Execute Revora Decision Engine for a payment */
  evaluateDecision: (paymentId: string): Promise<DecisionResponse> => {
    return fetchJson<DecisionResponse>(`/api/v1/payments/${encodeURIComponent(paymentId)}/decision`, {
      method: "POST",
    });
  },

  /** Generate safe, simulated multilingual outreach draft for a payment */
  generateOutreach: (paymentId: string): Promise<OutreachResponse> => {
    return fetchJson<OutreachResponse>(`/api/v1/payments/${encodeURIComponent(paymentId)}/outreach`, {
      method: "POST",
    });
  },

  /** Retrieve chronological event timeline for a payment */
  getPaymentTimeline: (paymentId: string): Promise<PaymentTimelineResponse> => {
    return fetchJson<PaymentTimelineResponse>(`/api/v1/payments/${encodeURIComponent(paymentId)}/timeline`);
  },

  /** Retrieve held-out evaluation summary benchmark */
  getEvaluationSummary: (): Promise<EvaluationSummaryResponse> => {
    return fetchJson<EvaluationSummaryResponse>("/api/v1/evaluation/summary");
  },

  /** Retrieve multi-seed statistical robustness benchmark */
  getEvaluationSeeds: (): Promise<EvaluationSeedsResponse> => {
    return fetchJson<EvaluationSeedsResponse>("/api/v1/evaluation/seeds");
  },
};
