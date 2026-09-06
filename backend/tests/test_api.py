"""FastAPI Integration and Endpoint Tests for Revora.

Verifies:
1. GET /health
2. GET /api/v1/payments (listing, pagination, filtering)
3. GET /api/v1/payments/{payment_id} (detail, diagnosis, ML score)
4. Unknown payment handling (404)
5. POST /api/v1/payments/{payment_id}/decision (deterministic action, audit log)
6. POST /api/v1/payments/{payment_id}/outreach (multilingual copy, watermark)
7. STOP suppression on outreach
8. HUMAN_ESCALATION suppression on outreach
9. GET /api/v1/payments/{payment_id}/timeline (chronological ordering)
10. GET /api/v1/evaluation/summary (held-out benchmark aggregates)
11. GET /api/v1/evaluation/seeds (multi-seed statistical robustness)
12. Ground-truth isolation: operational endpoints NEVER leak hidden causes or oracle fields!
"""
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import get_db
from backend.app.core.constants import ActionType, ActionOutcome
from backend.app.models import Payment, Customer, Mandate


@pytest.fixture
def client(seeded_db_session):
    """FastAPI TestClient with overridden database session."""
    def override_get_db():
        try:
            yield seeded_db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_api_health_endpoint(client):
    """Verify /health returns 200 and expected status fields."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "revora-api"
    assert data["environment"] == "test_mode"
    assert "UPI AutoPay" in data["production_rail_target"]


def test_api_root_endpoint(client):
    """Verify / returns 200 and links to docs and health."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["product"] == "Revora"
    assert data["version"] in ("1.0.0", "1.0.1")


def test_api_list_payments(client):
    """Verify GET /api/v1/payments returns paginated payment items."""
    response = client.get("/api/v1/payments?limit=10&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert data["total"] > 0
    assert len(data["items"]) == 10
    assert "SIMULATED" in data["disclaimer"]

    # Test filtering by status
    resp_filtered = client.get("/api/v1/payments?status=failed&limit=5")
    assert resp_filtered.status_code == 200
    filtered_data = resp_filtered.json()
    for item in filtered_data["items"]:
        assert item["status"] == "failed"


def test_api_get_payment_detail_and_ground_truth_isolation(client, seeded_db_session):
    """Verify GET /api/v1/payments/{payment_id} and strictly enforce ground-truth isolation."""
    payment = seeded_db_session.query(Payment).first()
    assert payment is not None

    response = client.get(f"/api/v1/payments/{payment.payment_id}")
    assert response.status_code == 200
    data = response.json()

    # Verify operational fields present
    assert data["payment"]["payment_id"] == payment.payment_id
    assert data["customer"]["customer_id"] == payment.customer_id
    assert data["mandate"]["mandate_id"] == payment.mandate_id
    assert "risk_assessment" in data
    assert "failure_diagnosis" in data
    assert "propensity_score" in data
    assert 0.0 <= data["propensity_score"] <= 1.0

    # CRITICAL GROUND-TRUTH ISOLATION CHECK:
    # Ensure hidden fields NEVER appear in operational API responses
    serialized_text = response.text
    assert "true_failure_cause" not in serialized_text
    assert "ground_truth_recoverability" not in serialized_text
    assert "optimal_recovery_action" not in serialized_text


def test_api_get_unknown_payment_returns_404(client):
    """Verify 404 response for nonexistent payment ID."""
    response = client.get("/api/v1/payments/nonexistent_payment_id_9999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_api_evaluate_decision(client, seeded_db_session):
    """Verify POST /api/v1/payments/{payment_id}/decision executes Decision Engine."""
    payment = seeded_db_session.query(Payment).filter(Payment.failure_code == "insufficient_funds").first()
    assert payment is not None

    response = client.post(f"/api/v1/payments/{payment.payment_id}/decision")
    assert response.status_code == 200
    data = response.json()

    assert data["payment_id"] == payment.payment_id
    assert data["action"] in [a.value for a in ActionType]
    assert data["policy_version"] == "revora_policy_v1"
    assert data["audit_logged"] is True
    assert 0.0 <= data["propensity_score"] <= 1.0
    assert len(data["reason"]) > 0


def test_api_outreach_generation_and_watermark(client, seeded_db_session):
    """Verify POST /api/v1/payments/{payment_id}/outreach produces watermarked copy."""
    # Choose a soft funds failure where action will be RETRY or PAYMENT_UPDATE_REQUEST
    payment = seeded_db_session.query(Payment).filter(Payment.failure_code == "insufficient_funds").first()
    assert payment is not None

    response = client.post(f"/api/v1/payments/{payment.payment_id}/outreach")
    assert response.status_code == 200
    data = response.json()

    assert data["payment_id"] == payment.payment_id
    assert data["simulation_watermark"] == "SIMULATED — NO MESSAGE SENT"
    assert data["is_simulation"] is True

    if not data["outreach_suppressed"]:
        assert len(data["message_body"]) > 0
        assert data["channel"] == "whatsapp_simulated"
        assert data["language_used"] in ["en", "ta_tanglish", "hi_hinglish"]


def test_api_outreach_suppression_on_hard_blocked(client, seeded_db_session):
    """Verify STOP and HUMAN_ESCALATION suppress customer outreach via API."""
    payment = seeded_db_session.query(Payment).filter(Payment.failure_code == "blocked_account").first()
    assert payment is not None

    response = client.post(f"/api/v1/payments/{payment.payment_id}/outreach")
    assert response.status_code == 200
    data = response.json()

    # Hard blocked account triggers HUMAN_ESCALATION or STOP -> MUST be suppressed!
    assert data["outreach_suppressed"] is True
    assert data["message_body"] is None
    assert "suppressed" in data["suppression_reason"].lower()


def test_api_payment_timeline(client, seeded_db_session):
    """Verify GET /api/v1/payments/{payment_id}/timeline returns ordered events."""
    payment = seeded_db_session.query(Payment).first()
    assert payment is not None

    # Trigger decision to ensure events exist in timeline
    client.post(f"/api/v1/payments/{payment.payment_id}/decision")

    response = client.get(f"/api/v1/payments/{payment.payment_id}/timeline")
    assert response.status_code == 200
    data = response.json()

    assert data["payment_id"] == payment.payment_id
    events = data["events"]
    assert len(events) >= 2  # At least failed attempt and risk detected

    # Verify chronological ordering
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)


def test_api_evaluation_summary_and_seeds(client):
    """Verify GET /api/v1/evaluation/summary and GET /api/v1/evaluation/seeds."""
    # 1. Summary
    resp_summary = client.get("/api/v1/evaluation/summary")
    assert resp_summary.status_code == 200
    data_sum = resp_summary.json()
    assert data_sum["baseline_description"] == "fixed 3-attempt blind-retry control baseline"
    assert "primary_benchmark_seed_42" in data_sum
    assert "language_breakdown" in data_sum

    # 2. Multi-seed
    resp_seeds = client.get("/api/v1/evaluation/seeds")
    assert resp_seeds.status_code == 200
    data_seeds = resp_seeds.json()
    assert len(data_seeds["seeds_evaluated"]) >= 3
    assert data_seeds["baseline_description"] == "fixed 3-attempt blind-retry control baseline"
    assert "multi_seed_robustness_benchmark" in data_seeds
