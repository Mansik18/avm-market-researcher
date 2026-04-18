"""Pure scoring functions — LTV, unit economics, segment scoring, A/B/C categorization."""
from typing import Literal

from ..schemas import UnitEconomics


def compute_ltv(amppu: float, margin_pct: float, monthly_churn_pct: float) -> float:
    if monthly_churn_pct <= 0:
        return 0.0
    return (amppu * (margin_pct / 100.0)) / (monthly_churn_pct / 100.0)


def compute_unit_economics(
    amppu: float,
    margin_pct: float,
    monthly_churn_pct: float,
    cac: float,
) -> UnitEconomics:
    ltv = compute_ltv(amppu, margin_pct, monthly_churn_pct)
    ratio = ltv / cac if cac else 0.0
    payback = cac / amppu if amppu else 0.0
    if ratio >= 3 and payback <= 6:
        health: Literal["healthy", "moderate", "unhealthy"] = "healthy"
    elif ratio >= 1 and payback <= 12:
        health = "moderate"
    else:
        health = "unhealthy"
    # Sensitivity: stress-test ±20% on each input
    is_fragile = False
    if health != "unhealthy":
        stress_scenarios = [
            (amppu * 0.8, margin_pct, monthly_churn_pct, cac),       # revenue -20%
            (amppu, margin_pct, monthly_churn_pct * 1.2, cac),       # churn +20%
            (amppu, margin_pct, monthly_churn_pct, cac * 1.3),       # CAC +30%
        ]
        for sa, sm, sc, scc in stress_scenarios:
            s_ltv = compute_ltv(sa, sm, sc)
            s_ratio = s_ltv / scc if scc else 0
            if s_ratio < 1:
                is_fragile = True
                break

    return UnitEconomics(
        amppu=amppu,
        margin_pct=margin_pct,
        monthly_churn_pct=monthly_churn_pct,
        cac=cac,
        ltv=ltv,
        ltv_cac=ratio,
        payback_months=payback,
        health=health,
        is_fragile=is_fragile,
    )


def score_segment(
    job_fit: float,
    market_size: float,
    economics: float,
    moat: float,
    ltv_cac: float | None = None,
) -> float:
    """Weighted score per our methodology. If LTV/CAC < 1 — Gate fails, segment gets 0."""
    if ltv_cac is not None and ltv_cac < 1:
        return 0.0
    return job_fit * 0.40 + market_size * 0.25 + economics * 0.25 + moat * 0.10


def categorize(total: float, ltv_cac: float = 0.0, switch_score: float = 0.0) -> Literal["A", "B", "C", "D", "X"]:
    """ABCDX grading:
    A (≥70) — priority, go now
    B (50-69) — second tier
    C (<50 or LTV/CAC<1) — defer
    D — economics work but can't scale (niche trap): score ≥50 but switch_score < 0
    X — insufficient data to score
    """
    if total == 0 and ltv_cac == 0:
        return "X"  # no data
    if ltv_cac > 0 and ltv_cac < 1:
        return "C"  # gate fail
    if total >= 50 and switch_score < 0:
        return "D"  # niche trap — economics work but people won't switch
    if total >= 70:
        return "A"
    if total >= 50:
        return "B"
    return "C"
