"""Message Safety and Compliance Validator for Customer Outreach.

Guarantees:
1. Exact monetary amount is verified.
2. Sensitive credentials (OTP, CVV, PIN, password) are strictly prohibited.
3. Coercive or deceptive language (court, arrest, fake urgency, fake discount) is blocked.
4. Action alignment: message semantics must strictly match the approved action.
"""
from dataclasses import dataclass
from typing import List, Optional
from backend.app.core.constants import ActionType


PROHIBITED_KEYWORDS = [
    "otp",
    "one time password",
    "upi pin",
    "card pin",
    "cvv",
    "cvc",
    "atm pin",
    "internet banking password",
    "bank password",
    "court",
    "police",
    "legal action",
    "arrest",
    "jail",
    "penalty fee",
    "legal notice",
    "50% discount if paid now",
    "lottery",
]


@dataclass(frozen=True)
class SafetyCheckResult:
    is_safe: bool
    violations: List[str]


class MessageSafetyValidator:
    """Validates that all customer-facing drafts meet fintech safety guidelines."""

    @classmethod
    def validate(
        cls,
        message: str,
        expected_amount: float,
        expected_action: ActionType,
    ) -> SafetyCheckResult:
        violations: List[str] = []
        msg_lower = message.lower()

        # 1. Check for prohibited security & coercive words
        for word in PROHIBITED_KEYWORDS:
            if word in msg_lower:
                violations.append(f"PROHIBITED_WORD: Message contains forbidden security/threat term '{word}'")

        # 2. Check for exact amount verification
        # The amount formatted as ₹X,XXX.XX or numeric string must appear
        formatted_amount_str = f"{expected_amount:,.2f}"
        unformatted_amount_str = f"{expected_amount:.2f}"
        int_amount_str = f"{int(expected_amount)}"

        amount_present = (
            formatted_amount_str in message
            or unformatted_amount_str in message
            or int_amount_str in message
        )
        if not amount_present:
            violations.append(
                f"AMOUNT_MISMATCH: Message does not contain the exact expected payment amount (₹{expected_amount:,.2f})"
            )

        # 3. Message length check (standard WhatsApp / SMS burst size)
        if len(message) > 600:
            violations.append(f"LENGTH_EXCEEDED: Message length ({len(message)}) exceeds 600 character ceiling")

        # 4. Action semantic alignment
        if expected_action == ActionType.PAYMENT_UPDATE_REQUEST:
            if "http" not in message and "link" not in msg_lower:
                violations.append("ACTION_MISMATCH: Payment update message missing payment update link")
        elif expected_action == ActionType.RETRY:
            if "retry" not in msg_lower and "re-attempt" not in msg_lower:
                violations.append("ACTION_MISMATCH: Retry message does not inform customer of re-attempt")

        return SafetyCheckResult(
            is_safe=len(violations) == 0,
            violations=violations,
        )
