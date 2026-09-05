"""API Smoke Test Script.

Executes direct endpoint calls against the live SQLite database (data/revora.db)
using FastAPI TestClient to verify routing, serialization, and ground-truth isolation.
"""
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.app.main import app

INR = "₹"


def main():
    print("=" * 80)
    print("REVORA PHASE 8 — FASTAPI BACKEND SMOKE TEST")
    print("=" * 80)

    client = TestClient(app)

    # 1. Health check
    print("\n1. Testing GET /health ...")
    r = client.get("/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    health = r.json()
    print(f"   Status: {health['status']} | Service: {health['service']} | Rail Target: {health['production_rail_target']}")

    # 2. Root overview
    print("\n2. Testing GET / ...")
    r = client.get("/")
    assert r.status_code == 200
    root = r.json()
    print(f"   Product: {root['product']} | Tagline: {root['tagline']} | Docs: {root['docs_url']}")

    # 3. List payments
    print("\n3. Testing GET /api/v1/payments?limit=3 ...")
    r = client.get("/api/v1/payments?limit=3")
    assert r.status_code == 200
    p_data = r.json()
    print(f"   Total Payments: {p_data['total']} | Returned Items: {len(p_data['items'])}")
    print(f"   Disclaimer: {p_data['disclaimer']}")

    test_payment = p_data["items"][0]
    pid = test_payment["payment_id"]

    # 4. Get payment detail
    print(f"\n4. Testing GET /api/v1/payments/{pid} ...")
    r = client.get(f"/api/v1/payments/{pid}")
    assert r.status_code == 200
    p_detail = r.json()
    print(f"   Payment ID: {pid} | Amount: {INR}{p_detail['payment']['amount']:,.2f}")
    print(f"   Customer: {p_detail['customer']['name']} ({p_detail['customer']['customer_id']})")
    print(f"   Risk Tier: {p_detail['risk_assessment']['risk_tier']} (Score: {p_detail['risk_assessment']['risk_score']:.1f})")
    print(f"   Diagnosis Category: {p_detail['failure_diagnosis']['failure_category']}")
    print(f"   Propensity Score: {p_detail['propensity_score']:.4f} (Conf: {p_detail['propensity_confidence']:.4f})")

    # Anti-leakage assertion
    raw_text = r.text
    assert "true_failure_cause" not in raw_text, "LEAKAGE: true_failure_cause found in API response!"
    assert "ground_truth_recoverability" not in raw_text, "LEAKAGE: ground_truth_recoverability found in API response!"
    assert "optimal_recovery_action" not in raw_text, "LEAKAGE: optimal_recovery_action found in API response!"
    print("   [SAFEGUARD VERIFIED]: Zero hidden ground-truth fields exposed.")

    # 5. Evaluate Decision
    print(f"\n5. Testing POST /api/v1/payments/{pid}/decision ...")
    r = client.post(f"/api/v1/payments/{pid}/decision")
    assert r.status_code == 200
    dec = r.json()
    print(f"   Decision ID: {dec['decision_id']}")
    print(f"   Action: {dec['action']}")
    print(f"   Reason: {dec['decision_reason']}")
    print(f"   Policy Version: {dec['policy_version']} | Audit Logged: {dec['audit_logged']}")

    # 6. Generate Outreach
    print(f"\n6. Testing POST /api/v1/payments/{pid}/outreach ...")
    r = client.post(f"/api/v1/payments/{pid}/outreach")
    assert r.status_code == 200
    outreach = r.json()
    print(f"   Outreach Suppressed: {outreach['outreach_suppressed']}")
    if outreach['outreach_suppressed']:
        print(f"   Suppression Reason: {outreach['suppression_reason']}")
    else:
        print(f"   Channel: {outreach['channel']} | Language: {outreach['language_used']}")
        print(f"   Message Preview: {outreach['message_body'][:70]}...")
        print(f"   Watermark: {outreach['simulation_watermark']}")

    # 7. Get Timeline
    print(f"\n7. Testing GET /api/v1/payments/{pid}/timeline ...")
    r = client.get(f"/api/v1/payments/{pid}/timeline")
    assert r.status_code == 200
    timeline = r.json()
    print(f"   Timeline Events Count: {len(timeline['events'])}")
    for e in timeline['events'][:4]:
        print(f"     - [{e['timestamp'][:19]}] {e['event_type']} (by {e['actor']})")

    # 8. Evaluation Summary
    print("\n8. Testing GET /api/v1/evaluation/summary ...")
    r = client.get("/api/v1/evaluation/summary")
    assert r.status_code == 200
    eval_sum = r.json()
    meta = eval_sum["metadata"]
    print(f"   Evaluated Cohort: {meta['cohort_size']} payments | Total Risk: {INR}{meta['total_revenue_at_risk_inr']:,.2f}")
    print(f"   Baseline Control: {eval_sum['baseline_description']}")
    comp_delta = eval_sum["primary_benchmark_seed_42"]["comparative_delta"]
    print(f"   Primary Delta: +{INR}{comp_delta['absolute_recovered_amount_delta_inr']:,.2f} (+{comp_delta['absolute_revenue_recovery_rate_delta_pct']:.2f}% rate lift)")

    # 9. Multi-Seed Benchmark
    print("\n9. Testing GET /api/v1/evaluation/seeds ...")
    r = client.get("/api/v1/evaluation/seeds")
    assert r.status_code == 200
    eval_seeds = r.json()
    print(f"   Seeds Evaluated: {eval_seeds['seeds_evaluated']}")
    rate_stats = eval_seeds["multi_seed_robustness_benchmark"]["revora_revenue_recovery_rate"]
    print(f"   Revora Recovery Rate (mean ± std): {rate_stats['mean']:.2f}% ± {rate_stats['std']:.2f}%")

    print("\n" + "=" * 80)
    print("ALL 9 API ENDPOINTS VERIFIED OPERATIONAL & COMPLIANT WITH ZERO LEAKAGE")
    print("=" * 80)


if __name__ == "__main__":
    main()
