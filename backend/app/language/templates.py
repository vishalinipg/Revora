"""Deterministic Fallback Outreach Templates for English, Tamil/Tanglish, and Hindi/Hinglish.

Safe, conversational, and culturally tailored for Indian recurring payments.
Guarantees:
- Transparent identification of merchant and payment rail
- Zero threatening language or deceptive urgency
- Zero requests for OTP, CVV, or UPI PIN
- Exact amount verification
"""
from typing import Dict, Any
from backend.app.core.constants import ActionType, CustomerLanguage


TEMPLATES: Dict[str, Dict[str, str]] = {
    # 1. English (Professional, polite, clear)
    CustomerLanguage.EN.value: {
        ActionType.RETRY.value: (
            "Hello {customer_name}, your recurring payment of ₹{amount:,.2f} for your "
            "{plan_name} subscription via {payment_rail} could not be processed. "
            "Under Revora policy, we will automatically re-attempt this charge in {cooldown_hours} hours. "
            "Please ensure adequate balance is available in your account. Thank you!"
        ),
        ActionType.PAYMENT_UPDATE_REQUEST.value: (
            "Hello {customer_name}, your recurring payment of ₹{amount:,.2f} for your "
            "{plan_name} subscription via {payment_rail} requires an updated payment method. "
            "To avoid service disruption, please review and update your payment details securely here: "
            "{update_link}. Thank you for choosing us!"
        ),
    },

    # 2. Tamil / Tanglish (Conversational, culturally natural)
    CustomerLanguage.TA_TANGLISH.value: {
        ActionType.RETRY.value: (
            "Vanakkam {customer_name}, ungal {plan_name} subscription-kaga ₹{amount:,.2f} "
            "{payment_rail} payment process aagavillai. Revora policy padi, adutha {cooldown_hours} "
            "hours-la automatic-a re-attempt seivom. Ungal account-la podhumaana balance irupadhai "
            "urudhi seiyavum. Nandri!"
        ),
        ActionType.PAYMENT_UPDATE_REQUEST.value: (
            "Vanakkam {customer_name}, ungal {plan_name} recurring payment-ana ₹{amount:,.2f}-ku "
            "payment method update thevaipadugiradhu. Ungal subscription thodarndhu nadakka, indha link "
            "moolam ungal payment details-ai update seiyavum: {update_link}. Nandri!"
        ),
    },

    # 3. Hindi / Hinglish (Conversational, professional)
    CustomerLanguage.HI_HINGLISH.value: {
        ActionType.RETRY.value: (
            "Namaste {customer_name}, aapke {plan_name} subscription ke liye ₹{amount:,.2f} ka "
            "{payment_rail} payment process nahi ho paya. Revora policy ke mutabik, hum {cooldown_hours} "
            "hours ke baad automatic retry karenge. Kripya apne account me balance check karein. Dhanyawad!"
        ),
        ActionType.PAYMENT_UPDATE_REQUEST.value: (
            "Namaste {customer_name}, aapke {plan_name} recurring payment (₹{amount:,.2f}) ke liye "
            "payment method update ki zaroorat hai. Subscription continue rakhne ke liye kripya is link "
            "par jaakar payment details update karein: {update_link}. Dhanyawad!"
        ),
    },
}


def get_deterministic_template(action: ActionType, language: str) -> str:
    """Retrieve template for action and language with strict English fallback."""
    lang_key = language if language in TEMPLATES else CustomerLanguage.EN.value
    action_key = action.value

    lang_dict = TEMPLATES.get(lang_key, TEMPLATES[CustomerLanguage.EN.value])
    if action_key not in lang_dict:
        raise ValueError(f"No customer outreach template defined for internal action '{action_key}'")

    return lang_dict[action_key]
