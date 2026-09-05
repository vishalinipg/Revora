"""Tests for Multilingual Outreach Layer & Mock Outbox (Phase 5).

Validates:
1. Strict Decision Boundary: STOP and HUMAN_ESCALATION decisions never generate customer-facing messages.
2. Language Resolution: en, ta_tanglish, hi_hinglish, and unknown -> English fallback (never inferred from region).
3. Exact Amount & Safety Compliance: Amount must match, sensitive words (OTP, PIN, CVV) strictly prohibited.
4. LLM Failure Fallback: Deterministic templates cleanly handle LLM failures or safety violations.
5. Mock Outbox Watermarking: All messages have `is_simulation=True` and `SIMULATED — NO MESSAGE SENT`.
"""
import pytest
from backend.app.core.constants import ActionType, CustomerLanguage
from backend.app.decision_engine.engine import PolicyDecision, RevoraDecisionEngine
from backend.app.decision_engine.policy import PolicyEvaluationContext, REVORA_POLICY_VERSION
from backend.app.language.generator import MultilingualOutreachGenerator, OutreachDraft
from backend.app.language.safety import MessageSafetyValidator
from backend.app.models.outbox import OutboxMessage
from backend.app.models.audit_log import AuditLog


def _make_dummy_decision(action: ActionType, payment_id: str = "pay_test_lang_01") -> PolicyDecision:
    return PolicyDecision(
        payment_id=payment_id,
        action=action,
        decision_reason=f"Test decision for {action.value}",
        policy_version=REVORA_POLICY_VERSION,
        diagnosis_category="soft_funds",
        recoverability_class="soft",
        propensity_score=0.85,
        propensity_confidence=0.85,
        risk_tier="LOW",
        policy_checks={},
        violated_constraints=[],
        decision_trace=["Trace step 1"],
        created_at="2026-09-05T12:00:00",
    )


# ==============================================================================
# 1. STRICT DECISION BOUNDARY TESTS
# ==============================================================================

def test_stop_decision_suppresses_customer_outreach():
    """CRITICAL BOUNDARY: Language layer MUST NOT send customer outreach for STOP action."""
    decision = _make_dummy_decision(ActionType.STOP)
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Aarav Sharma",
        customer_id="cust_001",
        preferred_language="en",
        amount=1499.0,
        payment_rail="upi_autopay",
        subscription_plan="pro_monthly",
    )

    assert draft.is_customer_facing is False
    assert draft.outbox_id is None
    assert "[INTERNAL]" in draft.message_body
    assert "suppressed" in draft.generation_status


def test_human_escalation_suppresses_customer_outreach():
    """CRITICAL BOUNDARY: Language layer MUST NOT send customer outreach for HUMAN_ESCALATION."""
    decision = _make_dummy_decision(ActionType.HUMAN_ESCALATION)
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Priya Nair",
        customer_id="cust_002",
        preferred_language="ta_tanglish",
        amount=4999.0,
        payment_rail="upi_autopay",
        subscription_plan="business_monthly",
    )

    assert draft.is_customer_facing is False
    assert draft.outbox_id is None
    assert "[INTERNAL]" in draft.message_body


# ==============================================================================
# 2. LANGUAGE RESOLUTION & REGION ISOLATION TESTS
# ==============================================================================

def test_language_resolution_hierarchy():
    """Verify explicit preference resolution and strict English fallback for unknown/unrecognized."""
    assert MultilingualOutreachGenerator.resolve_language("en") == "en"
    assert MultilingualOutreachGenerator.resolve_language("ta_tanglish") == "ta_tanglish"
    assert MultilingualOutreachGenerator.resolve_language("hi_hinglish") == "hi_hinglish"
    # Unknown, None, or unsupported must fall back strictly to English
    assert MultilingualOutreachGenerator.resolve_language("unknown") == "en"
    assert MultilingualOutreachGenerator.resolve_language(None) == "en"
    assert MultilingualOutreachGenerator.resolve_language("french") == "en"


def test_language_never_inferred_from_region():
    """Verify that a customer in Tamil Nadu with unknown preference resolves to English, NOT Tamil."""
    # The generator only accepts preferred_language, having no access to region
    resolved = MultilingualOutreachGenerator.resolve_language("unknown")
    assert resolved == "en", "Violation: Language was inferred instead of falling back to English!"


# ==============================================================================
# 3. MULTILINGUAL TEMPLATE ACCURACY & AMOUNT VERIFICATION
# ==============================================================================

@pytest.mark.parametrize("lang,expected_greeting", [
    ("en", "Hello"),
    ("ta_tanglish", "Vanakkam"),
    ("hi_hinglish", "Namaste"),
])
def test_all_three_languages_generate_valid_drafts(lang, expected_greeting):
    """Verify that English, Tamil/Tanglish, and Hindi/Hinglish generate valid copy with exact amount."""
    decision = _make_dummy_decision(ActionType.RETRY)
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Karthik Subramanian",
        customer_id="cust_003",
        preferred_language=lang,
        amount=2499.50,
        payment_rail="upi_autopay",
        subscription_plan="pro_monthly",
        cooldown_hours=24,
    )

    assert draft.is_customer_facing is True
    assert draft.language_used == lang
    assert expected_greeting in draft.message_body
    assert "2,499.50" in draft.message_body
    assert "24" in draft.message_body
    assert draft.safety_result.is_safe is True


def test_payment_update_request_includes_link():
    """Verify PAYMENT_UPDATE_REQUEST draft includes secure simulated update link."""
    decision = _make_dummy_decision(ActionType.PAYMENT_UPDATE_REQUEST)
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Ananya Iyer",
        customer_id="cust_004",
        preferred_language="en",
        amount=999.0,
        payment_rail="card",
        subscription_plan="starter_monthly",
    )

    assert "https://pay.revora.fintech.sim/update/" in draft.message_body
    assert "999.00" in draft.message_body
    assert draft.safety_result.is_safe is True


# ==============================================================================
# 4. SAFETY VALIDATION & LLM FALLBACK TESTS
# ==============================================================================

def test_safety_validator_rejects_credential_requests():
    """Verify validator blocks messages requesting OTP, PIN, or CVV."""
    bad_msg = "Please share your OTP and UPI PIN to complete the ₹1,499.00 payment."
    result = MessageSafetyValidator.validate(bad_msg, expected_amount=1499.0, expected_action=ActionType.RETRY)

    assert result.is_safe is False
    assert any("otp" in v.lower() for v in result.violations)
    assert any("pin" in v.lower() for v in result.violations)


def test_safety_validator_rejects_amount_alterations():
    """Verify validator blocks messages that alter the required payment amount."""
    # Expected amount is 1499.00, but message says 500.00
    hallucinated_msg = "Your payment of ₹500.00 will be retried."
    result = MessageSafetyValidator.validate(hallucinated_msg, expected_amount=1499.0, expected_action=ActionType.RETRY)

    assert result.is_safe is False
    assert any("AMOUNT_MISMATCH" in v for v in result.violations)


def test_llm_failure_triggers_deterministic_fallback():
    """Verify that an unsafe or failing LLM response cleanly falls back to deterministic template."""
    decision = _make_dummy_decision(ActionType.RETRY)

    # Hallucinating LLM client function that attempts to ask for OTP
    def unsafe_llm_client(ctx):
        return "Hello, please provide your OTP for the ₹1,499.00 charge."

    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Deepa Sundaram",
        customer_id="cust_005",
        preferred_language="en",
        amount=1499.0,
        payment_rail="upi_autopay",
        subscription_plan="pro_monthly",
        llm_client_fn=unsafe_llm_client,
    )

    # Fallback should have been triggered
    assert draft.fallback_used is True
    assert draft.generation_status == "deterministic_fallback"
    assert "otp" not in draft.message_body.lower()
    assert draft.safety_result.is_safe is True


# ==============================================================================
# 5. MOCK OUTBOX PERSISTENCE & AUDIT TRAIL TESTS
# ==============================================================================

def test_mock_outbox_persistence_and_watermark(seeded_db_session):
    """Verify that generated drafts persist to outbox_messages with explicit simulation watermark."""
    decision = _make_dummy_decision(ActionType.RETRY, payment_id="pay_rev_00752")
    draft = MultilingualOutreachGenerator.draft_outreach(
        decision=decision,
        customer_name="Aarav Sharma",
        customer_id="cust_rev_0088",
        preferred_language="hi_hinglish",
        amount=492.19,
        payment_rail="upi_autopay",
        subscription_plan="starter_monthly",
    )

    outbox_record = MultilingualOutreachGenerator.persist_to_mock_outbox(
        draft=draft,
        decision=decision,
        db_session=seeded_db_session,
    )

    assert outbox_record is not None
    assert outbox_record.is_simulation is True
    assert outbox_record.simulation_disclaimer == "SIMULATED — NO MESSAGE SENT"
    assert outbox_record.channel == "whatsapp_simulated"
    assert outbox_record.language_used == "hi_hinglish"
    assert outbox_record.status == "simulated_scheduled"

    # Verify audit log was recorded
    audit_entry = seeded_db_session.query(AuditLog).filter(
        AuditLog.entity_id == outbox_record.outbox_id
    ).first()
    assert audit_entry is not None
    assert audit_entry.event == "simulated_outreach_scheduled"
