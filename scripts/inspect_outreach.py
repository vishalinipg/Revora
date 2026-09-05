"""Inspect sample multilingual outreach messages across English, Tamil/Tanglish, and Hindi/Hinglish."""
import sys
from pathlib import Path

# Force UTF-8 stdout for Windows terminals
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.core.constants import ActionType
from backend.app.decision_engine.engine import PolicyDecision
from backend.app.language.generator import MultilingualOutreachGenerator


def make_decision(action: ActionType, payment_id: str = "pay_demo_01") -> PolicyDecision:
    return PolicyDecision(
        payment_id=payment_id,
        action=action,
        decision_reason=f"Approved action: {action.value}",
        policy_version="revora_policy_v1",
        diagnosis_category="soft_funds",
        recoverability_class="soft",
        propensity_score=0.82,
        propensity_confidence=0.82,
        risk_tier="LOW",
        policy_checks={},
        violated_constraints=[],
        decision_trace=[],
        created_at="2026-09-05T12:00:00",
    )


def main():
    print("================================================================================")
    print("REVORA MULTILINGUAL OUTREACH SAMPLES (PHASE 5)")
    print("Disclaimer: All messages strictly watermarked 'SIMULATED — NO MESSAGE SENT'")
    print("================================================================================\n")

    # 1. English - RETRY
    d_retry = make_decision(ActionType.RETRY, "pay_rev_00752")
    draft_en = MultilingualOutreachGenerator.draft_outreach(
        decision=d_retry,
        customer_name="Karthik Subramanian",
        customer_id="cust_001",
        preferred_language="en",
        amount=492.19,
        payment_rail="upi_autopay",
        subscription_plan="starter_monthly",
        cooldown_hours=24,
    )
    print("1. ENGLISH [en] — ACTION: RETRY")
    print(f"Customer: Karthik Subramanian | Amount: ₹492.19 | Rail: UPI AutoPay | Status: {draft_en.generation_status}")
    print(f"Message Body:\n\"{draft_en.message_body}\"")
    print(f"Scheduled At: {draft_en.scheduled_at} (+24h cooldown)")
    print(f"Watermark: {draft_en.simulation_disclaimer}\n")

    # 2. Tamil / Tanglish - RETRY
    draft_ta = MultilingualOutreachGenerator.draft_outreach(
        decision=d_retry,
        customer_name="Priya Nair",
        customer_id="cust_002",
        preferred_language="ta_tanglish",
        amount=1499.0,
        payment_rail="upi_autopay",
        subscription_plan="pro_monthly",
        cooldown_hours=24,
    )
    print("2. TAMIL / TANGLISH [ta_tanglish] — ACTION: RETRY")
    print(f"Customer: Priya Nair | Amount: ₹1,499.00 | Rail: UPI AutoPay | Status: {draft_ta.generation_status}")
    print(f"Message Body:\n\"{draft_ta.message_body}\"")
    print(f"Watermark: {draft_ta.simulation_disclaimer}\n")

    # 3. Hindi / Hinglish - PAYMENT_UPDATE_REQUEST
    d_update = make_decision(ActionType.PAYMENT_UPDATE_REQUEST, "pay_rev_00510")
    draft_hi = MultilingualOutreachGenerator.draft_outreach(
        decision=d_update,
        customer_name="Aarav Sharma",
        customer_id="cust_003",
        preferred_language="hi_hinglish",
        amount=13893.86,
        payment_rail="card",
        subscription_plan="enterprise_monthly",
    )
    print("3. HINDI / HINGLISH [hi_hinglish] — ACTION: PAYMENT_UPDATE_REQUEST")
    print(f"Customer: Aarav Sharma | Amount: ₹13,893.86 | Rail: Card | Status: {draft_hi.generation_status}")
    print(f"Message Body:\n\"{draft_hi.message_body}\"")
    print(f"Watermark: {draft_hi.simulation_disclaimer}\n")

    # 4. Unknown Language Fallback -> English
    draft_unk = MultilingualOutreachGenerator.draft_outreach(
        decision=d_update,
        customer_name="Siddharth Rao",
        customer_id="cust_004",
        preferred_language="unknown",
        amount=4999.0,
        payment_rail="upi_autopay",
        subscription_plan="business_monthly",
    )
    print("4. UNKNOWN LANGUAGE FALLBACK -> ENGLISH [en]")
    print(f"Customer: Siddharth Rao | Preferred: unknown -> Resolved: {draft_unk.language_used}")
    print(f"Message Body:\n\"{draft_unk.message_body}\"\n")

    # 5. Boundary Test: STOP Decision
    d_stop = make_decision(ActionType.STOP, "pay_rev_00117")
    draft_stop = MultilingualOutreachGenerator.draft_outreach(
        decision=d_stop,
        customer_name="Vikram Malhotra",
        customer_id="cust_005",
        preferred_language="en",
        amount=5079.59,
        payment_rail="upi_autopay",
        subscription_plan="business_monthly",
    )
    print("5. BOUNDARY ENFORCEMENT — ACTION: STOP")
    print(f"Customer Facing: {draft_stop.is_customer_facing}")
    print(f"Status: {draft_stop.generation_status}")
    print(f"Message Body: {draft_stop.message_body}\n")


if __name__ == "__main__":
    main()
