"""Evaluation and benchmark reporting endpoints.

Exposes evaluation summaries and multi-seed statistical benchmarks
derived from the chronologically held-out test cohort.

BASELINE TERMINOLOGY:
The comparison control policy is explicitly designated as:
"fixed 3-attempt blind-retry control baseline".
"""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from backend.app.config import REPORTS_DIR
from backend.app.schemas.api import EvaluationSummaryResponse, EvaluationSeedsResponse

router = APIRouter(prefix="/evaluation", tags=["Evaluation & Benchmark"])

BASELINE_DESCRIPTION = "fixed 3-attempt blind-retry control baseline"


def _load_evaluation_json() -> dict:
    """Load persistent evaluation report from disk."""
    json_path = REPORTS_DIR / "evaluation.json"
    if not json_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Evaluation report not found. Run 'python scripts/run_evaluation.py' first.",
        )
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/summary", response_model=EvaluationSummaryResponse)
def get_evaluation_summary():
    """Retrieve primary evaluation benchmark aggregates (Seed 42) on held-out test set."""
    data = _load_evaluation_json()

    return EvaluationSummaryResponse(
        metadata=data.get("metadata", {}),
        baseline_description=BASELINE_DESCRIPTION,
        primary_benchmark_seed_42=data.get("primary_benchmark_seed_42", {}),
        language_breakdown=data.get("language_breakdown", []),
        metric_definitions=data.get("metric_definitions", {}),
    )


@router.get("/seeds", response_model=EvaluationSeedsResponse)
def get_evaluation_multi_seed():
    """Retrieve multi-seed statistical robustness benchmark (5 seeds: mean ± std)."""
    data = _load_evaluation_json()
    metadata = data.get("metadata", {})
    multi_seed = data.get("multi_seed_robustness_benchmark", {})

    return EvaluationSeedsResponse(
        seeds_evaluated=metadata.get("seeds_evaluated", [42, 100, 555, 2026, 9999]),
        baseline_description=BASELINE_DESCRIPTION,
        cohort_size=metadata.get("cohort_size", 180),
        total_revenue_at_risk_inr=metadata.get("total_revenue_at_risk_inr", 0.0),
        multi_seed_robustness_benchmark=multi_seed,
    )
