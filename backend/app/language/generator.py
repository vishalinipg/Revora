"""Multilingual Outreach Generator & Mock Outbox Dispatcher.

Strict Boundary Principle:
The Decision Engine decides WHAT action is allowed.
The Language Layer decides only HOW to communicate that already-approved action.

Guarantees:
1. Zero communication on STOP / HUMAN_ESCALATION decisions.
2. Explicit customer language preference (en, ta_tanglish, hi_hinglish); unknown -> English.
3. Zero inference of language from region or location.
4. Deterministic template fallback when LLM is unavailable or unsafe.
5. All outgoing records watermarked: 'SIMULATED — NO MESSAGE SENT'.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from uuid import uuid4

from backend.app.core.constants import ActionType, CustomerLanguage
from backend.app.decision_engine.engine import PolicyDecision
from backend.app.language.templates import get_deterministic_template
from backend.app.language.safety import MessageSafetyValidator, SafetyCheckResult
from backend.app.models.outbox import OutboxMessage
from backend.app.models.audit_log import AuditLog


@dataclass(frozen=True)
class OutreachDraft:
    outbox_id: Optional[str]
    payment_id: str
    customer_id: str
    action: ActionType
    language_used: str
    message_body: str
    is_customer_facing: bool
    channel: str
    generation_status: str              # "deterministic_template", "llm_generated", "deterministic_fallback"
    fallback_used: bool
    safety_result: SafetyCheckResult
    scheduled_at: datetime
    is_simulation: bool = True
    simulation_disclaimer: str = "SIMULATED — NO MESSAGE SENT"


class MultilingualOutreachGenerator:
    """Generates culturally resonant customer communications adhering to strict fintech boundaries."""

    @classmethod
    def resolve_language(cls, preferred_language: Optional[str]) -> str:
        """Resolve customer language with strict English fallback; never infer from region."""
        valid_languages = {
            CustomerLanguage.EN.value,
            CustomerLanguage.TA_TANGLISH.value,
            CustomerLanguage.HI_HINGLISH.value,
        }
        if preferred_language and preferred_language.lower() in valid_languages:
            return preferred_language.lower()
        return CustomerLanguage.EN.value

    @classmethod
    def draft_outreach(
        cls,
        decision: PolicyDecision,
        customer_name: str,
        customer_id: str,
        preferred_language: Optional[str],
        amount: float,
        payment_rail: str,
        subscription_plan: str,
        cooldown_hours: int = 24,
        llm_client_fn: Optional[Callable[[Dict[str, Any]], str]] = None,
    ) -> OutreachDraft:
        """Draft communication strictly corresponding to the approved decision action."""
        payment_id = decision.payment_id

        # BOUNDARY RULE: Internal decisions (STOP, HUMAN_ESCALATION) must NEVER spam customer
        if decision.action in [ActionType.STOP, ActionType.HUMAN_ESCALATION]:
            return OutreachDraft(
                outbox_id=None,
                payment_id=payment_id,
                customer_id=customer_id,
                action=decision.action,
                language_used="none",
                message_body=f"[INTERNAL] Customer outreach suppressed: Decision is {decision.action.value.upper()}.",
                is_customer_facing=False,
                channel="internal_audit",
                generation_status="suppressed_internal_action",
                fallback_used=False,
                safety_result=SafetyCheckResult(is_safe=True, violations=[]),
                scheduled_at=datetime.utcnow(),
            )

        # 1. Resolve Language (Explicit preference only)
        target_language = cls.resolve_language(preferred_language)

        # 2. Context variables for templates / LLM
        update_link = f"https://pay.revora.fintech.sim/update/{payment_id}"
        template_vars = {
            "customer_name": customer_name,
            "amount": amount,
            "payment_rail": "UPI AutoPay" if payment_rail == "upi_autopay" else "Card",
            "plan_name": subscription_plan.replace("_", " ").title(),
            "cooldown_hours": cooldown_hours,
            "update_link": update_link,
        }

        # 3. Attempt LLM generation if client provided; otherwise use deterministic template
        draft_text: Optional[str] = None
        generation_status = "deterministic_template"
        fallback_used = True

        if llm_client_fn is not None:
            try:
                llm_prompt_ctx = {
                    "action": decision.action.value,
                    "target_language": target_language,
                    **template_vars
                }
                raw_llm_response = llm_client_fn(llm_prompt_ctx)

                # Validate LLM output against strict safety guidelines
                safety_check = MessageSafetyValidator.validate(
                    message=raw_llm_response,
                    expected_amount=amount,
                    expected_action=decision.action,
                )

                if safety_check.is_safe:
                    draft_text = raw_llm_response
                    generation_status = "llm_generated"
                    fallback_used = False
                else:
                    generation_status = "deterministic_fallback"
                    fallback_used = True
            except Exception:
                # On any LLM timeout, exception, or failure -> fallback to deterministic template
                generation_status = "deterministic_fallback"
                fallback_used = True

        # If LLM was not used or failed validation, format the deterministic template
        if draft_text is None:
            raw_template = get_deterministic_template(decision.action, target_language)
            draft_text = raw_template.format(**template_vars)

        # Run final safety check on resulting draft
        final_safety = MessageSafetyValidator.validate(
            message=draft_text,
            expected_amount=amount,
            expected_action=decision.action,
        )

        # Calculate simulated dispatch time
        now = datetime.utcnow()
        if decision.action == ActionType.RETRY:
            scheduled_at = now + timedelta(hours=cooldown_hours)
        else:
            scheduled_at = now + timedelta(minutes=5)

        outbox_id = f"outbox_sim_{uuid4().hex[:12]}"

        return OutreachDraft(
            outbox_id=outbox_id,
            payment_id=payment_id,
            customer_id=customer_id,
            action=decision.action,
            language_used=target_language,
            message_body=draft_text,
            is_customer_facing=True,
            channel="whatsapp_simulated",
            generation_status=generation_status,
            fallback_used=fallback_used,
            safety_result=final_safety,
            scheduled_at=scheduled_at,
        )

    @classmethod
    def persist_to_mock_outbox(
        cls,
        draft: OutreachDraft,
        decision: PolicyDecision,
        db_session,
    ) -> Optional[OutboxMessage]:
        """Persist customer-facing simulated outreach to mock outbox and audit log."""
        if not draft.is_customer_facing or not draft.outbox_id:
            return None

        # 1. Create Mock Outbox Record
        outbox_msg = OutboxMessage(
            outbox_id=draft.outbox_id,
            payment_id=draft.payment_id,
            customer_id=draft.customer_id,
            channel=draft.channel,
            language_used=draft.language_used,
            message_body=draft.message_body,
            is_simulation=True,
            simulation_disclaimer="SIMULATED — NO MESSAGE SENT",
            status="simulated_scheduled",
            trigger_action=draft.action.value,
            policy_version=decision.policy_version,
            model_version=decision.propensity_confidence and "revora_propensity_logreg_v1",
            fallback_template_used=draft.fallback_used,
            scheduled_at=draft.scheduled_at,
            created_at=datetime.utcnow(),
        )
        db_session.add(outbox_msg)

        # 2. Append to Immutable Audit Log
        audit = AuditLog(
            log_id=f"log_outbox_{uuid4().hex[:12]}",
            entity_type="outbox_message",
            entity_id=draft.outbox_id,
            event="simulated_outreach_scheduled",
            payload_snapshot=(
                f'{{"action": "{draft.action.value}", "language": "{draft.language_used}", '
                f'"status": "{draft.generation_status}", "fallback": {str(draft.fallback_used).lower()}}}'
            ),
            actor="llm_language_layer" if not draft.fallback_used else "template_engine",
            timestamp=datetime.utcnow(),
        )
        db_session.add(audit)
        db_session.commit()

        return outbox_msg
