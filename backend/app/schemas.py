from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


# ---------- auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- project context ----------

class ContextData(BaseModel):
    description: str = ""
    audience: str = ""
    geography: str = ""
    stage: str = ""  # idea | validation | mvp | growth | scale
    price: str = ""
    paying_customers: int = 0
    big_job: str = ""
    pain_points: list[str] = []
    current_solutions: list[str] = []
    competitors_mentioned: list[str] = []
    segment_hypotheses: list[str] = []
    notes: str = ""


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ProjectOut(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectContextOut(BaseModel):
    project_id: int
    data: ContextData
    completeness: float
    ready_for_analysis: bool
    summary: str
    has_report: bool
    last_report_at: datetime | None
    updated_at: datetime


class IntakeTurnIn(BaseModel):
    message: str


class IntakeTurnOut(BaseModel):
    assistant_message: HistoryMessage
    context: ProjectContextOut


# ---------- analysis report ----------

class Source(BaseModel):
    url: str
    title: str = ""

class Competitor(BaseModel):
    name: str
    url: str = ""
    pricing: str = ""
    positioning: str = ""
    strengths: list[str] = []
    weaknesses: list[str] = []
    unmet_job: str = ""
    user_quotes: list[str] = []  # real user review quotes from G2/Capterra/ProductHunt
    sources: list[Source] = []


class UnitEconomics(BaseModel):
    amppu: float = 0
    margin_pct: float = 0
    monthly_churn_pct: float = 0
    cac: float = 0
    ltv: float = 0
    ltv_cac: float = 0
    payback_months: float = 0
    health: Literal["healthy", "moderate", "unhealthy"] = "unhealthy"
    is_fragile: bool = False  # true if ±20% change in any input makes health unhealthy


class Segment(BaseModel):
    name: str
    struggling_moment: str = ""
    core_job: str = ""
    emotional_job: str = ""
    social_job: str = ""
    switch_story: str = ""
    tam_reasoning: str = ""
    tam_usd: float = 0
    sam_usd: float = 0
    som_usd: float = 0
    unit_econ: UnitEconomics = UnitEconomics()
    score_job_fit: float = 0
    score_market_size: float = 0
    score_economics: float = 0
    score_moat: float = 0
    total_score: float = 0
    category: Literal["A", "B", "C", "D", "X"] = "C"
    unmet_jobs: list[str] = []
    key_message: str = ""
    main_channel: str = ""
    devils_advocate: str = ""
    # 4 Forces of switching (0-100 each)
    force_added_value: float = 0       # how much better than current solution
    force_problem_severity: float = 0  # how painful is the problem
    force_barriers: float = 0          # switching cost / friction
    force_habit_strength: float = 0    # inertia of current behavior
    switch_score: float = 0            # (added_value + severity) - (barriers + habits)
    sources: list[Source] = []


class Risk(BaseModel):
    assumption: str
    probability: int = 0  # 1..5
    impact: int = 0  # 1..5
    score: int = 0
    metric: str = ""       # what to measure (e.g. "% стоматологий готовых платить $50/мес")
    threshold: str = ""    # success/fail line (e.g. "если < 15% — модель не сходится")
    experiment: str = ""   # how to verify in 30 days


class AnalysisReport(BaseModel):
    verdict: Literal["GO", "GO_CONDITIONAL", "PIVOT", "NO_GO"] = "NO_GO"
    verdict_condition: str = ""
    positioning: str = ""
    main_insight: str = ""
    asymmetric_opportunity: str = ""
    competitors: list[Competitor] = []
    segments: list[Segment] = []
    top_risks: list[Risk] = []
    competitor_response: str = ""
    next_three_steps: list[str] = []
    plan_90d: list[str] = []
    sources: list[Source] = []
    created_at: datetime | None = None


# ---------- run + entity ----------

class PendingEditOut(BaseModel):
    id: int
    project_id: int
    target: str
    field: str
    old_value: object = None
    new_value: object = None
    reason: str
    status: str
    created_at: datetime
    resolved_at: datetime | None


class RunOut(BaseModel):
    id: int
    project_id: int
    skill_id: str
    status: str
    phase: str
    phase_detail: str
    error: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- legacy (kept to avoid breaking existing chat router imports) ----------

class ChatMessageIn(BaseModel):
    message: str
    mode: str | None = None


class ChatMessageOut(BaseModel):
    reply: str
