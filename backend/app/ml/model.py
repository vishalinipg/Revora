"""Propensity-to-Pay / Recoverability Model wrapper with structured explanations."""
from dataclasses import dataclass
from typing import List, Dict, Any
import numpy as np


@dataclass
class PropensityPrediction:
    recoverability_score: float         # 0.0 to 1.0 (estimated probability of recovery)
    confidence: float                  # Model confidence interval/certainty [0.5, 1.0]
    model_version: str                 # e.g. "revora_propensity_logreg_v1"
    important_features: List[Dict[str, Any]] # Active positive/negative contributors
    explanation_summary: str           # Human-readable structured evidence statement


class PropensityModel:
    """Interpretable recovery propensity estimator with feature contribution proofs."""

    def __init__(
        self,
        classifier,
        scaler,
        feature_names: List[str],
        model_version: str = "revora_propensity_logreg_v1",
        metadata: Dict[str, Any] = None
    ):
        self.classifier = classifier
        self.scaler = scaler
        self.feature_names = feature_names
        self.model_version = model_version
        self.metadata = metadata or {}

    def predict(self, feature_vector: np.ndarray) -> PropensityPrediction:
        """Predict recoverability propensity and compute structured feature contributions."""
        if feature_vector.ndim == 1:
            X_raw = feature_vector.reshape(1, -1)
        else:
            X_raw = feature_vector

        # Standardize features for logistic inference
        X_scaled = self.scaler.transform(X_raw)

        # Compute probability: P(recoverable = 1)
        probs = self.classifier.predict_proba(X_scaled)[0]
        score = float(probs[1])
        score = round(max(0.01, min(0.99, score)), 4)

        # Confidence is distance from maximum uncertainty (0.50) scaled to [0.5, 1.0]
        confidence = round(0.5 + abs(score - 0.5), 4)

        # Compute semantically grounded feature contributions using natural-scale weights:
        # w_j = coef_j / std_j
        contributions = []
        if hasattr(self.classifier, "coef_"):
            coefs = self.classifier.coef_[0]
            scales = self.scaler.scale_
            raw_vals = X_raw[0]

            for name, coef, scale, raw_val in zip(self.feature_names, coefs, scales, raw_vals):
                natural_weight = coef / scale
                impact = 0.0
                is_active = False

                # 1. Binary features: only active if raw_val == 1.0
                if name.startswith(("failure_is_", "mandate_is_", "is_")):
                    if raw_val == 1.0:
                        impact = float(natural_weight)
                        is_active = True
                # 2. Continuous features: relative to domain reference baseline
                elif name == "historical_success_rate":
                    # Reference baseline is 0.50 (neutral). Above 0.50 is positive support; below is a drag.
                    impact = float(natural_weight * (raw_val - 0.50))
                    is_active = abs(impact) >= 0.05
                elif name == "consecutive_failure_count":
                    # First failure is baseline (0 penalty). Additional consecutive failures add penalties.
                    if raw_val > 1:
                        impact = float(natural_weight * (raw_val - 1.0))
                        is_active = True
                elif name == "native_retry_attempt":
                    if raw_val > 0:
                        impact = float(natural_weight * raw_val)
                        is_active = True
                elif name == "days_since_last_success":
                    # Staleness penalty beyond 30 days
                    if raw_val > 30:
                        impact = float(natural_weight * (raw_val - 30.0) / 30.0)
                        is_active = abs(impact) >= 0.05
                elif name == "customer_tenure_days":
                    # Tenure bonus beyond 30 days
                    if raw_val > 30:
                        impact = float(natural_weight * (raw_val - 30.0) / 365.0)
                        is_active = abs(impact) >= 0.05
                elif name == "amount":
                    # Amount friction above ₹5,000
                    if raw_val > 5000.0:
                        impact = float(natural_weight * (raw_val - 5000.0) / 5000.0)
                        is_active = abs(impact) >= 0.05

                if is_active and abs(impact) > 0.001:
                    contributions.append({
                        "feature": name,
                        "impact": round(impact, 4),
                        "raw_value": round(float(raw_val), 2),
                        "direction": "positive" if impact >= 0 else "negative"
                    })

            # Sort active contributions by absolute impact descending
            contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)

        # Generate structured human-readable explanation summary
        top_positive = [c for c in contributions if c["impact"] > 0][:3]
        top_negative = [c for c in contributions if c["impact"] < 0][:3]

        reasons = []
        if score >= 0.65:
            reasons.append("High recovery propensity driven by:")
            for p in top_positive:
                reasons.append(f"• {self._format_feature_evidence(p['feature'], p['raw_value'])} (support: +{p['impact']:.2f})")
            if top_negative:
                reasons.append(f"• Risk offset: {self._format_feature_evidence(top_negative[0]['feature'], top_negative[0]['raw_value'])} ({top_negative[0]['impact']:.2f})")
        elif score <= 0.35:
            reasons.append("Low recovery propensity constrained by:")
            for n in top_negative:
                reasons.append(f"• {self._format_feature_evidence(n['feature'], n['raw_value'])} (penalty: {n['impact']:.2f})")
            if top_positive:
                reasons.append(f"• Minor mitigation: {self._format_feature_evidence(top_positive[0]['feature'], top_positive[0]['raw_value'])} (+{top_positive[0]['impact']:.2f})")
        else:
            reasons.append("Moderate recovery propensity due to balanced factors:")
            for p in top_positive[:2]:
                reasons.append(f"• Favorable: {self._format_feature_evidence(p['feature'], p['raw_value'])} (+{p['impact']:.2f})")
            for n in top_negative[:2]:
                reasons.append(f"• Risk factor: {self._format_feature_evidence(n['feature'], n['raw_value'])} ({n['impact']:.2f})")

        explanation = "\n".join(reasons) if reasons else "Propensity evaluated from historical baseline."

        return PropensityPrediction(
            recoverability_score=score,
            confidence=confidence,
            model_version=self.model_version,
            important_features=contributions[:5],
            explanation_summary=explanation,
        )

    @staticmethod
    def _format_feature_evidence(feature_name: str, raw_value: float) -> str:
        """Format feature into readable merchant-facing evidence."""
        mappings = {
            "historical_success_rate": f"{raw_value:.0%} historical payment success rate",
            "consecutive_failure_count": f"{int(raw_value)} consecutive cycle failure(s)",
            "native_retry_attempt": f"{int(raw_value)} native gateway retries attempted",
            "mandate_is_active": "active recurring mandate",
            "mandate_is_expired_or_revoked": "expired or revoked mandate",
            "failure_is_soft_funds": "temporary insufficient funds failure code",
            "failure_is_soft_timeout": "transient bank gateway timeout",
            "failure_is_auth_required": "customer authentication/AFA required",
            "failure_is_hard_blocked": "permanently blocked account or fraud lock",
            "customer_tenure_days": f"{int(raw_value)} days of established customer tenure",
            "amount": f"ticket size of ₹{raw_value:,.2f}",
            "is_upi_autopay": "UPI AutoPay recurring rail",
            "days_since_last_success": f"{int(raw_value)} days elapsed since last successful debit",
        }
        return mappings.get(feature_name, f"{feature_name} = {raw_value}")
