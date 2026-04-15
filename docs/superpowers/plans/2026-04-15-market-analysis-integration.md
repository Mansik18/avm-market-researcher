# Skill-Driven Market Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AVM REASHECRER into a multi-project, skill-driven product-research assistant. Users create projects, a dialogue agent interviews them to build a rich `ProjectContext`, and when context is ready the user launches a multi-phase market-research analysis powered by Exa + Claude. The architecture is designed as a **multi-agent system from day one**: skills are versioned markdown assets (copied from `ai-cpo/aura/knowledge_base/`), agents are small classes dispatched by skill kind, and runs are tracked as first-class entities.

**Architecture (one diagram in words):**

```
Project ── has 1 ──> ProjectContext (structured facts)
  │
  ├── has many ──> Conversation ──> Message[]  (intake dialogue, free chat)
  │
  └── has many ──> Run (skill_id, status, phase, output_json)
                    │
                    ▼
              SkillRegistry.get(skill_id) → Skill(kind, phases, body_md)
                    │
                    ▼
              AgentRouter.dispatch(skill.kind)
                    ├── DialogueAgent  (kind="dialogue")  → updates ProjectContext
                    └── PipelineAgent  (kind="pipeline")  → runs phases sequentially
                                                              └── fan-out phases call Exa + LLM
```

**Key decisions:**
- **Skills are markdown assets** copied from `ai-cpo/aura/knowledge_base/` into `backend/app/skills_library/`. Each skill has YAML frontmatter (`id`, `kind`, `phases`, `requires_context`, `output_schema`, `uses_knowledge_base`, `uses_search`) and a body that is sent **verbatim** to the LLM as a cached system block. Rules from `full-analysis-exa.md` (Gate, bottom-up TAM, 2026 freshness, parallel deep-dive) stay in the `.md` file — the source of truth is never duplicated in Python.
- **Two agent kinds for MVP**, pluggable architecture for more later:
  - `DialogueAgent` — multi-turn, structured-output tool use, updates `ProjectContext` after each user reply. Powers the `intake` skill.
  - `PipelineAgent` — reads `skill.phases`, runs each phase in a declared mode (`research | structured | fanout | synthesis`), persists progress to `Run.phase`. Powers `full-analysis-exa` and any future pipeline skill.
- **Exa is the only search backend.** All queries come from `queries.py` builders that enforce the semantic-description pattern and `2026` freshness token from the source skill. Search hits feed into the user message of the research phase; the skill body (which contains the rules) is in the cached system block.
- **Claude Sonnet 4.5** with prompt caching. The cached system prompt = `knowledge_base_block + skill_body`. Only the per-phase `user` message varies. First call pays full tokens; subsequent phases in the same run pay 10% for the cached portion.
- **Progress via polling** (MVP) with backend SSE endpoint ready for later. Background execution uses FastAPI `BackgroundTasks`.
- **Adding a new skill in the future** = drop a `.md` file into `skills_library/skills/`, add frontmatter, optionally add a React renderer for its output schema. Zero Python changes for pipeline/dialogue skills of existing shapes.

**Tech Stack:**
Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2, `python-frontmatter`, `exa-py`-equivalent raw HTTP via `httpx`, `anthropic`, `pytest` + `pytest-asyncio` + `respx`, `sse-starlette`.
Frontend: Vite + React + TS + Tailwind (existing), `@tanstack/react-query`, polling-based run updates.

---

## Scope

The plan has four phases. Each phase ends with a demoable slice. Do not start a phase until the previous phase is green.

- **Phase A — Foundations (Tasks 1–6):** deps, config, DB models, skill loader + registry, project CRUD, skills copied from `ai-cpo`. End state: `pytest` confirms the registry loads `intake` + `full-analysis-exa`; `curl` can CRUD projects.
- **Phase B — Intake dialogue agent (Tasks 7–11):** `intake.md` skill, `DialogueAgent`, structured-output context updates, run + chat endpoints for intake, basic UI so the user can actually go through the interview. End state: create project → dialogue drives interview → `ProjectContext` filled → bot emits "ready to analyze".
- **Phase C — Analysis pipeline agent (Tasks 12–17):** `ExaClient`, `queries.py`, `scoring.py`, `PipelineAgent`, wire `full-analysis-exa.md` through phase dispatch, run endpoint, mocked end-to-end test. End state: one pytest test runs the full 4-phase pipeline against fake Exa + fake LLM and returns a validated `AnalysisReport`.
- **Phase D — Analysis UI (Tasks 18–21):** run launcher, polling progress indicator, results page rendering verdict + segments + risks, navigation from chat. End state: real run in a browser against live Exa + Claude, finishes under 3 minutes, shows the report.

---

## File Structure

### Backend — new / modified

```
backend/
  app/
    main.py                                 # MODIFY: mount new routers, load SkillRegistry at startup
    config.py                               # CREATE: pydantic-settings (Exa, Anthropic, model, JWT, DB, skills path)
    db.py                                   # unchanged
    auth.py                                 # unchanged
    models.py                               # MODIFY: add Project, ProjectContext, Conversation, Message, Run
    schemas.py                              # MODIFY: add Pydantic schemas for all new domains
    routers/
      auth.py                               # unchanged
      chat.py                               # MODIFY: wire to DialogueAgent for intake mode
      projects.py                           # CREATE: CRUD
      runs.py                               # CREATE: start / get / list / stream runs (SSE + polling fallback)
    services/
      exa_client.py                         # CREATE
      llm_client.py                         # CREATE: Anthropic wrapper, caching helpers
      market_analysis/
        queries.py                          # CREATE: Exa query builders (mirrors full-analysis-exa.md)
        scoring.py                          # CREATE: pure LTV / score / categorize functions
        report_schemas.py                   # CREATE: pydantic AnalysisReport / Segment / Competitor / Risk
      skills/
        __init__.py
        loader.py                           # CREATE: reads .md + frontmatter → Skill
        registry.py                         # CREATE: SkillRegistry.load_all / get / list
        models.py                           # CREATE: Skill dataclass + PhaseSpec
        agents/
          __init__.py
          base.py                           # CREATE: Agent ABC + AgentContext
          dialogue.py                       # CREATE: DialogueAgent (intake)
          pipeline.py                       # CREATE: PipelineAgent (analysis)
          router.py                         # CREATE: dispatch skill.kind → agent class
  skills_library/                           # CREATE: mirrors ai-cpo/aura/knowledge_base/
    knowledge_base/
      segmentation_principles.md                  # copied from ai-cpo
      mechanics.md                          # copied from ai-cpo
      onboarding_methodology.md             # copied from ai-cpo
    skills/
      intake.md                             # CREATE from scratch (new skill)
      full-analysis-exa.md                  # copied from ai-cpo + frontmatter added
      diagnostic.md                         # copied from ai-cpo + frontmatter (parked, not wired)
      generate-landing.md                   # copied + frontmatter (parked)
      launch-product.md                     # copied + frontmatter (parked)
      research-segmentation.md              # copied + frontmatter (parked)
      research-summary.md                   # copied + frontmatter (parked)
  tests/
    conftest.py                             # CREATE
    test_models.py
    test_projects.py
    test_skill_loader.py
    test_skill_registry.py
    test_queries.py
    test_scoring.py
    test_exa_client.py
    test_dialogue_agent.py
    test_pipeline_agent.py
    test_runs.py
    test_chat_intake.py
    fixtures/
      exa_search_sample.json
      anthropic_intake_turn.json
      anthropic_phase1_extract.json
      anthropic_phase2_segments.json
      anthropic_phase3_deep_dive.json
      anthropic_phase4_synthesis.json
  requirements.txt                          # MODIFY
  .env.example                              # CREATE
```

### Frontend — new / modified

```
frontend/
  package.json                              # MODIFY: add @tanstack/react-query
  src/
    main.tsx                                # MODIFY: wrap in QueryClientProvider + ProjectProvider
    api/client.ts                           # MODIFY: add projects, runs, conversation APIs, skill list
    context/ProjectContext.tsx              # CREATE
    components/
      Sidebar.tsx                           # MODIFY: project switcher
      ProjectForm.tsx                       # CREATE: simple create-project form (name only)
      ContextSummary.tsx                    # CREATE: right-side panel showing known facts
      RunProgress.tsx                       # CREATE: phase stepper
      VerdictCard.tsx                       # CREATE
      SegmentsTable.tsx                     # CREATE
      RisksList.tsx                         # CREATE
    pages/
      Projects.tsx                          # CREATE: list + create
      Chat.tsx                              # MODIFY: intake chat mode, wires to Run
      RunPage.tsx                           # CREATE: analysis run live view + final report
    router.tsx                              # MODIFY
```

---

## Domain Schemas (authoritative — every task references these exactly)

### SQLAlchemy (`backend/app/models.py`)

```python
class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProjectContext(Base):
    __tablename__ = "project_contexts"
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    data_json: Mapped[str] = mapped_column(Text, default="{}")  # JSON blob of ContextData pydantic
    completeness: Mapped[float] = mapped_column(Float, default=0.0)
    ready_for_analysis: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))  # "intake" | "free"
    run_id: Mapped[int | None] = mapped_column(ForeignKey("runs.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Run(Base):
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(40))  # "dialogue" | "pipeline"
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|running|done|error
    phase: Mapped[str] = mapped_column(String(80), default="")
    output_json: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Pydantic — context (`backend/app/schemas.py`)

```python
class ContextData(BaseModel):
    description: str = ""
    audience: str = ""
    geography: str = ""
    stage: str = ""                         # idea|validation|mvp|growth|scale
    price: str = ""
    paying_customers: int = 0
    big_job: str = ""
    pain_points: list[str] = []
    current_solutions: list[str] = []
    competitors_mentioned: list[str] = []
    segment_hypotheses: list[str] = []
    notes: str = ""

class ProjectContextOut(BaseModel):
    project_id: int
    data: ContextData
    completeness: float
    ready_for_analysis: bool
    summary: str
    updated_at: datetime
```

### Pydantic — analysis report (`backend/app/services/market_analysis/report_schemas.py`)

```python
class Competitor(BaseModel):
    name: str; url: str = ""; pricing: str = ""; positioning: str = ""
    strengths: list[str] = []; weaknesses: list[str] = []; unmet_job: str = ""

class UnitEconomics(BaseModel):
    amppu: float = 0; margin_pct: float = 0; monthly_churn_pct: float = 0
    cac: float = 0; ltv: float = 0; ltv_cac: float = 0
    payback_months: float = 0
    health: Literal["healthy", "moderate", "unhealthy"] = "unhealthy"

class Segment(BaseModel):
    name: str; struggling_moment: str; core_job: str
    emotional_job: str = ""; social_job: str = ""
    switch_story: str = ""; tam_reasoning: str = ""
    tam_usd: float = 0; sam_usd: float = 0; som_usd: float = 0
    unit_econ: UnitEconomics = UnitEconomics()
    score_job_fit: float = 0; score_market_size: float = 0
    score_economics: float = 0; score_moat: float = 0
    total_score: float = 0; category: Literal["A","B","C"] = "C"
    unmet_jobs: list[str] = []; key_message: str = ""; main_channel: str = ""

class Risk(BaseModel):
    assumption: str; probability: int; impact: int; score: int; experiment: str

class AnalysisReport(BaseModel):
    verdict: Literal["GO","GO_CONDITIONAL","PIVOT","NO_GO"]
    verdict_condition: str = ""
    positioning: str = ""; main_insight: str = ""; asymmetric_opportunity: str = ""
    competitors: list[Competitor] = []
    segments: list[Segment] = []
    top_risks: list[Risk] = []
    competitor_response: str = ""
    next_three_steps: list[str] = []
    plan_90d: list[str] = []
```

### Skill metadata (`backend/app/services/skills/models.py`)

```python
class PhaseSpec(BaseModel):
    id: str                    # "market_research" | "segmentation" | "deep_dive" | "synthesis" | "turn"
    mode: Literal["research", "structured", "fanout", "synthesis", "turn"]
    over: str = ""             # e.g. "segments" for fanout
    limit: int = 0             # e.g. 5 for top-5 fanout

class Skill(BaseModel):
    id: str
    name: str
    version: int = 1
    kind: Literal["dialogue", "pipeline"]
    phases: list[PhaseSpec] = []
    requires_context: list[str] = []
    output_schema: str = ""           # pydantic class name, resolved by registry user
    uses_knowledge_base: list[str] = []
    uses_search: str = ""             # "exa" | ""
    body_markdown: str
    path: str                          # absolute path on disk (for diagnostics)
```

---

# PHASE A — Foundations

### Task 1: Dependencies, config, test harness

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/.env.example`, `backend/app/config.py`, `backend/tests/__init__.py`, `backend/tests/conftest.py`

- [ ] **Step 1: Append to `backend/requirements.txt`**

```
anthropic==0.40.0
httpx==0.27.2
pydantic-settings==2.6.1
python-frontmatter==1.1.0
sse-starlette==2.1.3
pytest==8.3.3
pytest-asyncio==0.24.0
respx==0.21.1
```

Run: `cd backend && .venv/bin/pip install -r requirements.txt`
Expected: "Successfully installed …".

- [ ] **Step 2: Create `backend/.env.example`**

```
EXA_API_KEY=your-exa-key
ANTHROPIC_API_KEY=your-anthropic-key
MODEL_ID=claude-sonnet-4-5
JWT_SECRET=dev-secret-change-me
DATABASE_URL=sqlite:///./app.db
SKILLS_LIBRARY_PATH=./skills_library
```

- [ ] **Step 3: Create `backend/app/config.py`**

```python
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    exa_api_key: str = ""
    anthropic_api_key: str = ""
    model_id: str = "claude-sonnet-4-5"
    jwt_secret: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./app.db"
    skills_library_path: Path = Path("./skills_library")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

- [ ] **Step 4: Create `backend/tests/conftest.py`**

```python
import os, pytest
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("EXA_API_KEY", "test-exa")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic")
os.environ.setdefault("SKILLS_LIBRARY_PATH", str(Path(__file__).resolve().parents[1] / "skills_library"))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app

@pytest.fixture
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)

@pytest.fixture
def db_session(engine):
    S = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    s = S()
    try: yield s
    finally: s.close()

@pytest.fixture
def client(db_session):
    def _override():
        yield db_session
    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(client):
    client.post("/auth/register", json={"email": "t@t.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "t@t.com", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
```

- [ ] **Step 5: Verify**

Run: `cd backend && .venv/bin/pytest tests/ -v --collect-only`
Expected: "no tests ran" without import errors.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/app/config.py backend/tests/conftest.py backend/tests/__init__.py
git commit -m "chore(backend): deps, settings, test harness"
```

---

### Task 2: Models (Project, ProjectContext, Conversation, Message, Run)

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
from app.models import User, Project, ProjectContext, Conversation, Message, Run

def test_project_with_context_row(db_session):
    u = User(email="a@a.com", password_hash="x"); db_session.add(u); db_session.commit()
    p = Project(user_id=u.id, name="Demo"); db_session.add(p); db_session.commit()
    ctx = ProjectContext(project_id=p.id, data_json="{}"); db_session.add(ctx); db_session.commit()
    assert ctx.completeness == 0.0
    assert ctx.ready_for_analysis is False

def test_run_defaults(db_session):
    u = User(email="a@a.com", password_hash="x"); db_session.add(u); db_session.commit()
    p = Project(user_id=u.id, name="D"); db_session.add(p); db_session.commit()
    r = Run(project_id=p.id, skill_id="intake", kind="dialogue"); db_session.add(r); db_session.commit()
    assert r.status == "pending"
    assert r.phase == ""

def test_conversation_links_to_run(db_session):
    u = User(email="a@a.com", password_hash="x"); db_session.add(u); db_session.commit()
    p = Project(user_id=u.id, name="D"); db_session.add(p); db_session.commit()
    r = Run(project_id=p.id, skill_id="intake", kind="dialogue"); db_session.add(r); db_session.commit()
    c = Conversation(project_id=p.id, kind="intake", run_id=r.id); db_session.add(c); db_session.commit()
    assert c.run_id == r.id
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && rm -f app.db && .venv/bin/pytest tests/test_models.py -v`
Expected: `ImportError: cannot import name 'Project'`.

- [ ] **Step 3: Extend `backend/app/models.py`**

Ensure the SQLAlchemy import line includes `ForeignKey, Text, Integer, Boolean, Float`. Append the five classes exactly as written in the "Domain Schemas" section above.

- [ ] **Step 4: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_models.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_models.py
git commit -m "feat(backend): Project/ProjectContext/Conversation/Message/Run models"
```

---

### Task 3: Pydantic schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Append new schemas**

Add to `schemas.py`:

```python
from datetime import datetime

class ContextData(BaseModel):
    description: str = ""
    audience: str = ""
    geography: str = ""
    stage: str = ""
    price: str = ""
    paying_customers: int = 0
    big_job: str = ""
    pain_points: list[str] = []
    current_solutions: list[str] = []
    competitors_mentioned: list[str] = []
    segment_hypotheses: list[str] = []
    notes: str = ""

class ProjectCreate(BaseModel):
    name: str

class ProjectOut(BaseModel):
    id: int; user_id: int; name: str
    created_at: datetime; updated_at: datetime
    model_config = {"from_attributes": True}

class ProjectContextOut(BaseModel):
    project_id: int
    data: ContextData
    completeness: float
    ready_for_analysis: bool
    summary: str
    updated_at: datetime

class MessageOut(BaseModel):
    id: int; role: str; content: str; created_at: datetime
    model_config = {"from_attributes": True}

class ConversationOut(BaseModel):
    id: int; project_id: int; kind: str; run_id: int | None
    messages: list[MessageOut] = []
    model_config = {"from_attributes": True}

class ChatTurnIn(BaseModel):
    project_id: int
    message: str

class ChatTurnOut(BaseModel):
    assistant_message: MessageOut
    context: ProjectContextOut

class RunCreate(BaseModel):
    skill_id: str

class RunOut(BaseModel):
    id: int; project_id: int; skill_id: str; kind: str
    status: str; phase: str; error: str
    created_at: datetime; updated_at: datetime
    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Import smoke check**

Run: `cd backend && .venv/bin/python -c "from app.schemas import ContextData, RunOut, ChatTurnIn; print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat(backend): schemas for projects, context, runs"
```

---

### Task 4: Copy ai-cpo knowledge base + add frontmatter to skills + author intake.md

**Files:**
- Create: `backend/skills_library/knowledge_base/*.md`
- Create: `backend/skills_library/skills/*.md`

- [ ] **Step 1: Copy knowledge base files verbatim**

```bash
mkdir -p "backend/skills_library/knowledge_base"
cp "/home/mans/projects/ai-cpo/aura/knowledge_base/segmentation_principles.md" \
   "/home/mans/projects/ai-cpo/aura/knowledge_base/mechanics.md" \
   "/home/mans/projects/ai-cpo/aura/knowledge_base/onboarding_methodology.md" \
   "backend/skills_library/knowledge_base/"
```

Verify:

```bash
ls backend/skills_library/knowledge_base/
```

Expected: three `.md` files listed.

- [ ] **Step 2: Copy all 7 skill files**

```bash
mkdir -p "backend/skills_library/skills"
for f in full-analysis-exa full-analysis diagnostic generate-landing launch-product research-segmentation research-summary; do
  cp "/home/mans/projects/ai-cpo/aura/knowledge_base/skills/$f.md" "backend/skills_library/skills/$f.md"
done
```

- [ ] **Step 2b: Sanitize methodology branding from copied skills and knowledge base**

The copied files contain brand-specific methodology terms (`AJTBD`, `Advanced AJTBD`, `JTBD`, `Advanced Jobs to be Done`, `Jobs-to-be-Done`) that the LLM must never see — the product should look like its own approach, not a wrapper over a named methodology. Substance (struggling moments, core/emotional/social jobs, bottom-up TAM, scoring formula) stays — only the brand names are stripped.

Run this exact sed pipeline from the backend directory:

```bash
cd backend && python3 - <<'PY'
import re
from pathlib import Path

TARGETS = [
    Path("skills_library/skills"),
    Path("skills_library/knowledge_base"),
]

REPLACEMENTS = [
    # Order matters — longer patterns first.
    (r"Advanced\s+Jobs[-\s]to[-\s]be[-\s]Done", "сегментационного подхода"),
    (r"Advanced\s+AJTBD", "нашего подхода"),
    (r"AJTBD[-\s]Pipeline", "аналитический пайплайн"),
    (r"AJTBD[-\s]сегментац", "сегментац"),
    (r"Jobs[-\s]to[-\s]be[-\s]Done", "сегментационного подхода"),
    (r"\bAJTBD\b", "наш подход"),
    (r"\bJTBD\b", "сегментация"),
    (r"методологии\s+наш подход", "нашей методологии"),
    (r"методология\s+наш подход", "наша методология"),
    (r"по\s+наш подход", "по нашему подходу"),
]

for base in TARGETS:
    for p in base.glob("*.md"):
        text = p.read_text()
        orig = text
        for pat, repl in REPLACEMENTS:
            text = re.sub(pat, repl, text, flags=re.IGNORECASE if "AJTBD" not in pat and "JTBD" not in pat else 0)
        # Second pass: fix grammar artefacts
        text = re.sub(r"наш подход\s+наш подход", "наш подход", text)
        if text != orig:
            p.write_text(text)
            print(f"sanitized: {p}")
PY
```

Verify nothing leaked:

```bash
grep -rniE "ajtbd|jtbd|jobs[- ]to[- ]be[- ]done" backend/skills_library/ && echo "LEAK!" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Prepend frontmatter to `full-analysis-exa.md`**

At the very top of `backend/skills_library/skills/full-analysis-exa.md`, insert:

```markdown
---
id: full-analysis-exa
name: Полный анализ рынка
version: 1
kind: pipeline
phases:
  - id: market_research
    mode: research
  - id: segmentation
    mode: structured
  - id: deep_dive
    mode: fanout
    over: segments
    limit: 5
  - id: synthesis
    mode: synthesis
requires_context: [description, audience, geography, stage, big_job]
output_schema: AnalysisReport
uses_knowledge_base: [segmentation_principles, mechanics]
uses_search: exa
---

```

Leave the rest of the file unchanged — the body is the contract with Claude.

- [ ] **Step 4: Add minimal frontmatter to the other 6 parked skills**

For each of `full-analysis.md`, `diagnostic.md`, `generate-landing.md`, `launch-product.md`, `research-segmentation.md`, `research-summary.md`, prepend:

```markdown
---
id: <filename-without-ext>
name: <short name>
version: 1
kind: pipeline
phases:
  - id: run
    mode: structured
requires_context: [description]
output_schema: ""
uses_knowledge_base: [segmentation_principles]
uses_search: ""
---

```

(They aren't wired in this plan — just made loadable so Phase A registry test passes with ≥2 skills and they're available for future tasks.)

- [ ] **Step 5: Create `backend/skills_library/skills/intake.md` from scratch**

```markdown
---
id: intake
name: Первичное интервью по продукту
version: 1
kind: dialogue
phases:
  - id: turn
    mode: turn
requires_context: []
output_schema: ContextData
uses_knowledge_base: [onboarding_methodology]
uses_search: ""
---

# Intake — первичное интервью

## Что это
Диалог-интервью с фаундером. Твоя задача — за 10-15 вопросов собрать полный структурированный контекст продукта так, чтобы потом можно было запустить `full-analysis-exa`.

## Правила

- **Один вопрос за раз.** Никогда не задавай два вопроса в одном сообщении.
- **Короткие реплики.** 1-3 предложения. Не лекции.
- **На "русском фаундерском".** Никаких методологических терминов в вопросах — фаундер этого не знает. Спрашивай человеческим языком, концепты выводи сам из ответов.
- **Адаптивность.** Если фаундер в первом сообщении дал развёрнутое описание — не переспрашивай то, что уже понятно. Иди к следующему пропуску в контексте.
- **Уточняй вместо общих слов.** Если ответ размытый ("для бизнеса", "много"), задай уточняющий вопрос до конкретики.
- **Никаких оценок и советов в процессе.** Ты интервьюер, не консультант. Хвалить, критиковать, предлагать идеи — нельзя.
- **Готовность к анализу.** Когда заполнены все критичные поля (description, audience, geography, stage, big_job, минимум 2 pain_points, минимум 1 current_solution) — объяви что готов запустить анализ, и предложи это явно.

## Критичные поля контекста (в порядке приоритета)
1. **description** — что делает продукт, одним предложением
2. **audience** — кто клиент сегодня (не "теоретически", а реально)
3. **big_job** — зачем клиент покупает (ты выводишь из ответов, не спрашиваешь термином)
4. **pain_points** — 2-3 конкретные боли, которые продукт решает
5. **current_solutions** — чем клиент пользуется сейчас, чтобы это решать
6. **geography** — где рынок (страна / регион)
7. **stage** — idea / validation / mvp / growth / scale
8. **price** — цена (или гипотеза)
9. **paying_customers** — число платящих сегодня
10. **competitors_mentioned** — кого фаундер видит как конкурентов
11. **segment_hypotheses** — какие сегменты фаундер предполагает

## Алгоритм хода

На каждом пользовательском сообщении ты:
1. Читаешь текущее состояние `ContextData`.
2. Решаешь, что обновить в контексте из последнего сообщения. Обновляешь **через вызов инструмента `update_context`** — передаёшь полный актуальный `ContextData` (пустые поля оставляешь пустыми).
3. Решаешь следующий вопрос — самое дорогое пустое поле из списка выше.
4. Если все критичные поля заполнены:
   - Собери `summary` (5-7 коротких буллетов — что ты понял о продукте и аудитории).
   - Помечай `ready_for_analysis = true`.
   - Ответ в чате: короткое "Вот что я понял: …\n\nГотов запустить анализ рынка? Напиши «да» — и я начну."
5. Если критичные поля ещё не заполнены: короткая квитанция + один следующий вопрос.

## Completeness
Считаешь сам как долю заполненных критичных полей от общего числа (11). При `>= 0.7` и заполненных первых 5 полях → `ready_for_analysis = true`.

## Первое сообщение
Если это самое первое сообщение в диалоге (у пользователя ещё не было реплик) — ответь приветствием:
"Привет. Я помогу разобраться с твоим продуктом и рынком. Начнём с главного — расскажи одним-двумя предложениями, что ты делаешь?"
```

- [ ] **Step 6: Commit**

```bash
git add backend/skills_library
git commit -m "feat(skills): copy ai-cpo knowledge base + skills, author intake.md"
```

---

### Task 5: Skill loader + registry

**Files:**
- Create: `backend/app/services/skills/__init__.py`, `models.py`, `loader.py`, `registry.py`
- Create: `backend/tests/test_skill_loader.py`, `backend/tests/test_skill_registry.py`

- [ ] **Step 1: Write failing loader test**

```python
# backend/tests/test_skill_loader.py
from pathlib import Path
from app.services.skills.loader import load_skill_file

SKILLS = Path(__file__).resolve().parents[1] / "skills_library" / "skills"

def test_loads_intake_skill():
    skill = load_skill_file(SKILLS / "intake.md")
    assert skill.id == "intake"
    assert skill.kind == "dialogue"
    assert skill.phases[0].id == "turn"
    assert skill.phases[0].mode == "turn"
    assert "onboarding_methodology" in skill.uses_knowledge_base
    assert "Первое сообщение" in skill.body_markdown  # body preserved verbatim

def test_loads_pipeline_skill_with_fanout_phase():
    skill = load_skill_file(SKILLS / "full-analysis-exa.md")
    assert skill.id == "full-analysis-exa"
    assert skill.kind == "pipeline"
    ids = [p.id for p in skill.phases]
    assert ids == ["market_research", "segmentation", "deep_dive", "synthesis"]
    dd = next(p for p in skill.phases if p.id == "deep_dive")
    assert dd.mode == "fanout" and dd.over == "segments" and dd.limit == 5
    assert skill.uses_search == "exa"
    assert "bottom-up" in skill.body_markdown.lower() or "TAM" in skill.body_markdown
```

- [ ] **Step 2: Write failing registry test**

```python
# backend/tests/test_skill_registry.py
from app.services.skills.registry import SkillRegistry
from app.config import settings

def test_registry_loads_all_skills():
    reg = SkillRegistry(settings.skills_library_path)
    reg.load_all()
    ids = {s.id for s in reg.list()}
    assert "intake" in ids
    assert "full-analysis-exa" in ids
    assert len(ids) >= 2

def test_registry_get_by_id():
    reg = SkillRegistry(settings.skills_library_path); reg.load_all()
    s = reg.get("intake")
    assert s.kind == "dialogue"

def test_registry_knowledge_block_concatenates():
    reg = SkillRegistry(settings.skills_library_path); reg.load_all()
    block = reg.knowledge_block(["segmentation_principles"])
    assert len(block) > 500
    assert "сегмент" in block.lower() or "Struggling" in block
```

Run: `cd backend && .venv/bin/pytest tests/test_skill_loader.py tests/test_skill_registry.py -v`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement `backend/app/services/skills/models.py`**

```python
from typing import Literal
from pydantic import BaseModel

class PhaseSpec(BaseModel):
    id: str
    mode: Literal["research", "structured", "fanout", "synthesis", "turn"]
    over: str = ""
    limit: int = 0

class Skill(BaseModel):
    id: str
    name: str
    version: int = 1
    kind: Literal["dialogue", "pipeline"]
    phases: list[PhaseSpec] = []
    requires_context: list[str] = []
    output_schema: str = ""
    uses_knowledge_base: list[str] = []
    uses_search: str = ""
    body_markdown: str
    path: str
```

- [ ] **Step 4: Implement `backend/app/services/skills/loader.py`**

```python
from pathlib import Path
import frontmatter
from .models import Skill, PhaseSpec

def load_skill_file(path: Path) -> Skill:
    post = frontmatter.load(path)
    meta = post.metadata
    phases = [PhaseSpec(**p) for p in meta.get("phases", [])]
    return Skill(
        id=meta["id"],
        name=meta.get("name", meta["id"]),
        version=int(meta.get("version", 1)),
        kind=meta.get("kind", "pipeline"),
        phases=phases,
        requires_context=list(meta.get("requires_context", [])),
        output_schema=meta.get("output_schema", "") or "",
        uses_knowledge_base=list(meta.get("uses_knowledge_base", [])),
        uses_search=meta.get("uses_search", "") or "",
        body_markdown=post.content,
        path=str(path.resolve()),
    )
```

- [ ] **Step 5: Implement `backend/app/services/skills/registry.py`**

```python
from pathlib import Path
from .loader import load_skill_file
from .models import Skill

class SkillRegistry:
    def __init__(self, base_path: Path):
        self._base = Path(base_path)
        self._skills: dict[str, Skill] = {}
        self._kb_cache: dict[str, str] = {}

    def load_all(self) -> None:
        self._skills.clear()
        self._kb_cache.clear()
        skills_dir = self._base / "skills"
        for p in sorted(skills_dir.glob("*.md")):
            try:
                skill = load_skill_file(p)
                self._skills[skill.id] = skill
            except Exception as e:
                print(f"[skill-registry] skipped {p.name}: {e}")
        kb_dir = self._base / "knowledge_base"
        for p in sorted(kb_dir.glob("*.md")):
            self._kb_cache[p.stem] = p.read_text()

    def get(self, skill_id: str) -> Skill:
        return self._skills[skill_id]

    def list(self) -> list[Skill]:
        return list(self._skills.values())

    def knowledge_block(self, ids: list[str]) -> str:
        parts: list[str] = []
        for kid in ids:
            body = self._kb_cache.get(kid, "")
            if body:
                parts.append(f"# Knowledge: {kid}\n\n{body}")
        return "\n\n---\n\n".join(parts)
```

- [ ] **Step 6: Create `backend/app/services/skills/__init__.py`**

```python
from .registry import SkillRegistry
from .models import Skill, PhaseSpec
from ...config import settings

_global_registry: SkillRegistry | None = None

def get_registry() -> SkillRegistry:
    global _global_registry
    if _global_registry is None:
        _global_registry = SkillRegistry(settings.skills_library_path)
        _global_registry.load_all()
    return _global_registry
```

- [ ] **Step 7: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_skill_loader.py tests/test_skill_registry.py -v`
Expected: 5 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/skills backend/tests/test_skill_loader.py backend/tests/test_skill_registry.py
git commit -m "feat(skills): loader + registry for markdown skills and knowledge base"
```

---

### Task 6: Projects CRUD router + wire SkillRegistry at startup

**Files:**
- Create: `backend/app/routers/projects.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_projects.py`

- [ ] **Step 1: Failing test**

```python
# backend/tests/test_projects.py
def test_create_project_also_creates_empty_context(client, auth_headers):
    r = client.post("/projects/", json={"name": "My SaaS"}, headers=auth_headers)
    assert r.status_code == 201
    pid = r.json()["id"]
    r = client.get(f"/projects/{pid}/context", headers=auth_headers)
    assert r.status_code == 200
    ctx = r.json()
    assert ctx["completeness"] == 0.0
    assert ctx["ready_for_analysis"] is False
    assert ctx["data"]["description"] == ""

def test_list_projects_isolated_by_owner(client):
    client.post("/auth/register", json={"email": "a@a.com", "password": "password123"})
    ta = client.post("/auth/login", json={"email": "a@a.com", "password": "password123"}).json()["access_token"]
    client.post("/projects/", json={"name": "A"}, headers={"Authorization": f"Bearer {ta}"})
    client.post("/auth/register", json={"email": "b@b.com", "password": "password123"})
    tb = client.post("/auth/login", json={"email": "b@b.com", "password": "password123"}).json()["access_token"]
    r = client.get("/projects/", headers={"Authorization": f"Bearer {tb}"})
    assert r.json() == []

def test_skill_registry_loaded_at_startup(client):
    r = client.get("/skills")
    assert r.status_code == 200
    ids = {s["id"] for s in r.json()}
    assert {"intake", "full-analysis-exa"}.issubset(ids)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/pytest tests/test_projects.py -v`
Expected: 404 on all routes.

- [ ] **Step 3: Create `backend/app/routers/projects.py`**

```python
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Project, ProjectContext, User
from ..schemas import (ProjectCreate, ProjectOut, ProjectContextOut, ContextData)
from ..services.skills import get_registry

router = APIRouter(tags=["projects"])

def _owned(project_id: int, user: User, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

@router.post("/projects/", response_model=ProjectOut, status_code=201)
def create(payload: ProjectCreate,
           user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    p = Project(user_id=user.id, name=payload.name)
    db.add(p); db.commit(); db.refresh(p)
    ctx = ProjectContext(project_id=p.id, data_json="{}")
    db.add(ctx); db.commit()
    return p

@router.get("/projects/", response_model=list[ProjectOut])
def list_(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()

@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_one(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _owned(project_id, user, db)

@router.delete("/projects/{project_id}", status_code=204)
def delete(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _owned(project_id, user, db); db.delete(p); db.commit()

@router.get("/projects/{project_id}/context", response_model=ProjectContextOut)
def get_context(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _owned(project_id, user, db)
    ctx = db.query(ProjectContext).filter_by(project_id=p.id).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    data = ContextData(**(json.loads(ctx.data_json) if ctx.data_json else {}))
    return ProjectContextOut(
        project_id=p.id, data=data,
        completeness=ctx.completeness,
        ready_for_analysis=ctx.ready_for_analysis,
        summary=ctx.summary, updated_at=ctx.updated_at,
    )

@router.get("/skills")
def list_skills():
    reg = get_registry()
    return [
        {"id": s.id, "name": s.name, "kind": s.kind, "version": s.version,
         "requires_context": s.requires_context}
        for s in reg.list()
    ]
```

- [ ] **Step 4: Mount router in `main.py`**

```python
from .routers import projects as projects_router
app.include_router(projects_router.router)
```

- [ ] **Step 5: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_projects.py -v`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/projects.py backend/app/main.py backend/tests/test_projects.py
git commit -m "feat(backend): projects CRUD + skills listing endpoint"
```

**Phase A complete.** Skill registry works, projects + empty context exist, `/skills` lists loadable skills.

---

# PHASE B — Intake dialogue agent

### Task 7: LLM client with prompt caching + tool use

**Files:**
- Create: `backend/app/services/llm_client.py`

- [ ] **Step 1: Implement (no tests yet — tested transitively via agents)**

```python
# backend/app/services/llm_client.py
from typing import Any
from anthropic import AsyncAnthropic
from ..config import settings

class LLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self._client = AsyncAnthropic(api_key=api_key or settings.anthropic_api_key)
        self._model = model or settings.model_id

    def _system_blocks(self, knowledge: str, skill_body: str) -> list[dict]:
        blocks: list[dict] = []
        if knowledge:
            blocks.append({"type": "text", "text": knowledge,
                           "cache_control": {"type": "ephemeral"}})
        blocks.append({"type": "text", "text": skill_body,
                       "cache_control": {"type": "ephemeral"}})
        return blocks

    async def complete_text(self, *, knowledge: str, skill_body: str, user: str,
                            max_tokens: int = 4096) -> str:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=self._system_blocks(knowledge, skill_body),
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text  # type: ignore[attr-defined]

    async def complete_with_tool(self, *, knowledge: str, skill_body: str,
                                 conversation: list[dict], tool: dict,
                                 max_tokens: int = 2048) -> dict:
        """Returns {'text': <assistant reply>, 'tool_input': <dict or None>}."""
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=self._system_blocks(knowledge, skill_body),
            tools=[tool],
            tool_choice={"type": "auto"},
            messages=conversation,
        )
        text = ""
        tool_input: dict | None = None
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                text += block.text
            elif getattr(block, "type", None) == "tool_use" and block.name == tool["name"]:
                tool_input = block.input  # type: ignore[attr-defined]
        return {"text": text.strip(), "tool_input": tool_input}
```

- [ ] **Step 2: Import smoke**

Run: `cd backend && .venv/bin/python -c "from app.services.llm_client import LLMClient; print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/llm_client.py
git commit -m "feat(backend): Anthropic LLM client with prompt caching + tool use"
```

---

### Task 8: DialogueAgent (intake)

**Files:**
- Create: `backend/app/services/skills/agents/base.py`
- Create: `backend/app/services/skills/agents/dialogue.py`
- Create: `backend/app/services/skills/agents/router.py`
- Create: `backend/app/services/skills/agents/__init__.py`
- Create: `backend/tests/fixtures/anthropic_intake_turn.json`
- Create: `backend/tests/test_dialogue_agent.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_dialogue_agent.py
import json, pytest
from pathlib import Path
from app.services.skills import get_registry
from app.services.skills.agents.dialogue import DialogueAgent
from app.schemas import ContextData

F = Path(__file__).parent / "fixtures"

class FakeLLM:
    def __init__(self, text: str, tool_input: dict):
        self._text = text
        self._tool_input = tool_input
        self.last_knowledge = ""
        self.last_skill_body = ""
    async def complete_with_tool(self, *, knowledge, skill_body, conversation, tool, max_tokens=2048):
        self.last_knowledge = knowledge
        self.last_skill_body = skill_body
        return {"text": self._text, "tool_input": self._tool_input}

@pytest.mark.asyncio
async def test_dialogue_agent_updates_context_and_returns_reply():
    reg = get_registry()
    skill = reg.get("intake")

    fake_tool_input = {
        "description": "AI планировщик для фрилансеров",
        "audience": "фрилансеры-дизайнеры в РФ",
        "geography": "Россия",
        "stage": "", "price": "", "paying_customers": 0,
        "big_job": "", "pain_points": ["срыв дедлайнов"],
        "current_solutions": ["записки в Notion"],
        "competitors_mentioned": [], "segment_hypotheses": [], "notes": "",
        "_completeness": 0.3,
        "_ready_for_analysis": False,
        "_summary": "",
    }
    llm = FakeLLM(text="Понял. Расскажи какой у тебя этап — идея, MVP или уже платящие клиенты?",
                  tool_input=fake_tool_input)

    agent = DialogueAgent(llm=llm, registry=reg)
    current_ctx = ContextData()
    result = await agent.turn(
        skill=skill,
        current_context=current_ctx,
        history=[{"role": "user", "content": "Делаю ИИ-планировщик задач для фрилансеров в РФ. Они срывают дедлайны, сейчас пишут заметки в Notion."}],
    )
    assert "этап" in result.reply_text.lower()
    assert result.context.description.startswith("AI планировщик")
    assert result.context.pain_points == ["срыв дедлайнов"]
    assert result.completeness == pytest.approx(0.3)
    assert result.ready_for_analysis is False
    # knowledge block must contain onboarding methodology
    assert "onboarding" in llm.last_knowledge.lower() or "методолог" in llm.last_knowledge.lower()
    # skill body must be passed verbatim
    assert "Первое сообщение" in llm.last_skill_body
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/pytest tests/test_dialogue_agent.py -v`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Create agents base**

```python
# backend/app/services/skills/agents/base.py
from dataclasses import dataclass
from ..models import Skill
from ...llm_client import LLMClient

@dataclass
class AgentContext:
    llm: LLMClient
    registry: object  # SkillRegistry

class Agent:
    def __init__(self, llm, registry):
        self.llm = llm
        self.registry = registry
```

- [ ] **Step 4: Create `dialogue.py`**

```python
# backend/app/services/skills/agents/dialogue.py
import json
from dataclasses import dataclass
from ....schemas import ContextData
from ..models import Skill
from .base import Agent

UPDATE_CONTEXT_TOOL = {
    "name": "update_context",
    "description": "Update the structured ProjectContext based on the latest user message. "
                   "Always pass the full, current state of the context (not a diff).",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {"type": "string"},
            "audience": {"type": "string"},
            "geography": {"type": "string"},
            "stage": {"type": "string"},
            "price": {"type": "string"},
            "paying_customers": {"type": "integer"},
            "big_job": {"type": "string"},
            "pain_points": {"type": "array", "items": {"type": "string"}},
            "current_solutions": {"type": "array", "items": {"type": "string"}},
            "competitors_mentioned": {"type": "array", "items": {"type": "string"}},
            "segment_hypotheses": {"type": "array", "items": {"type": "string"}},
            "notes": {"type": "string"},
            "_completeness": {"type": "number",
                              "description": "0..1 self-assessed completeness of the critical context fields"},
            "_ready_for_analysis": {"type": "boolean"},
            "_summary": {"type": "string",
                         "description": "Empty until ready_for_analysis=true; then 5-7 short bullets"},
        },
        "required": ["description", "audience", "geography", "stage", "price",
                     "paying_customers", "big_job", "pain_points", "current_solutions",
                     "competitors_mentioned", "segment_hypotheses", "notes",
                     "_completeness", "_ready_for_analysis", "_summary"],
    },
}

@dataclass
class DialogueTurnResult:
    reply_text: str
    context: ContextData
    completeness: float
    ready_for_analysis: bool
    summary: str

class DialogueAgent(Agent):
    async def turn(self, *, skill: Skill, current_context: ContextData,
                   history: list[dict]) -> DialogueTurnResult:
        knowledge = self.registry.knowledge_block(skill.uses_knowledge_base)
        user_payload = (
            "Текущий контекст:\n"
            f"{current_context.model_dump_json(indent=2)}\n\n"
            "История диалога:\n"
            f"{json.dumps(history, ensure_ascii=False)}"
        )
        conversation = [{"role": "user", "content": user_payload}]
        res = await self.llm.complete_with_tool(
            knowledge=knowledge,
            skill_body=skill.body_markdown,
            conversation=conversation,
            tool=UPDATE_CONTEXT_TOOL,
        )
        tool_in = res["tool_input"] or {}
        completeness = float(tool_in.pop("_completeness", 0.0))
        ready = bool(tool_in.pop("_ready_for_analysis", False))
        summary = str(tool_in.pop("_summary", ""))
        merged = current_context.model_dump()
        for k, v in tool_in.items():
            if v not in ("", None, [], 0) or k in ("paying_customers",):
                merged[k] = v
        new_ctx = ContextData(**merged)
        return DialogueTurnResult(
            reply_text=res["text"] or "…",
            context=new_ctx,
            completeness=completeness,
            ready_for_analysis=ready,
            summary=summary,
        )
```

- [ ] **Step 5: Create `router.py` + package `__init__`**

```python
# backend/app/services/skills/agents/router.py
from .dialogue import DialogueAgent
# PipelineAgent imported lazily in Phase C to avoid circular deps

def agent_for_skill(skill, llm, registry):
    if skill.kind == "dialogue":
        return DialogueAgent(llm=llm, registry=registry)
    if skill.kind == "pipeline":
        from .pipeline import PipelineAgent  # Phase C
        return PipelineAgent(llm=llm, registry=registry)
    raise ValueError(f"Unknown skill kind: {skill.kind}")
```

```python
# backend/app/services/skills/agents/__init__.py
from .dialogue import DialogueAgent, DialogueTurnResult
from .router import agent_for_skill
```

- [ ] **Step 6: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_dialogue_agent.py -v`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/skills/agents backend/tests/test_dialogue_agent.py
git commit -m "feat(agents): DialogueAgent powered by intake skill"
```

---

### Task 9: Chat endpoint wired to DialogueAgent

**Files:**
- Modify: `backend/app/routers/chat.py`
- Create: `backend/tests/test_chat_intake.py`

The chat endpoint for the intake conversation turns every user message into a DialogueAgent turn and persists the assistant reply + updated context. It does NOT call LLM in tests — we monkeypatch the agent.

- [ ] **Step 1: Failing test**

```python
# backend/tests/test_chat_intake.py
import json
from app.schemas import ContextData
from app.services.skills.agents.dialogue import DialogueTurnResult

def test_intake_turn_persists_messages_and_updates_context(client, auth_headers, monkeypatch):
    p = client.post("/projects/", json={"name": "X"}, headers=auth_headers).json()

    async def fake_turn(self, *, skill, current_context, history):
        return DialogueTurnResult(
            reply_text="Понял. На каком этапе продукт — идея или уже есть MVP?",
            context=ContextData(description="AI планировщик", audience="фрилансеры",
                                geography="Россия", pain_points=["срыв дедлайнов"]),
            completeness=0.25, ready_for_analysis=False, summary="",
        )
    monkeypatch.setattr("app.services.skills.agents.dialogue.DialogueAgent.turn", fake_turn)

    r = client.post("/chat/intake",
                    json={"project_id": p["id"], "message": "Делаю ИИ-планировщик для фрилансеров в РФ"},
                    headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["assistant_message"]["content"].startswith("Понял")
    assert body["context"]["data"]["description"] == "AI планировщик"
    assert body["context"]["completeness"] == 0.25

    # Second turn — history must have grown:
    r = client.get(f"/projects/{p['id']}/conversations/intake", headers=auth_headers)
    msgs = r.json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]

def test_intake_ready_flag_propagates(client, auth_headers, monkeypatch):
    p = client.post("/projects/", json={"name": "X"}, headers=auth_headers).json()

    async def fake_turn(self, *, skill, current_context, history):
        ctx = ContextData(description="d", audience="a", geography="g", stage="mvp",
                          price="10", paying_customers=5, big_job="bj",
                          pain_points=["p1","p2"], current_solutions=["s1"])
        return DialogueTurnResult(
            reply_text="Вот что я понял:\n…\nГотов запустить анализ?",
            context=ctx, completeness=0.9, ready_for_analysis=True,
            summary="• b1\n• b2",
        )
    monkeypatch.setattr("app.services.skills.agents.dialogue.DialogueAgent.turn", fake_turn)

    r = client.post("/chat/intake",
                    json={"project_id": p["id"], "message": "давай"},
                    headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["context"]["ready_for_analysis"] is True
    r = client.get(f"/projects/{p['id']}/context", headers=auth_headers)
    assert r.json()["ready_for_analysis"] is True
    assert r.json()["summary"].startswith("• b1")
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/pytest tests/test_chat_intake.py -v`
Expected: 404 on POST /chat/intake.

- [ ] **Step 3: Rewrite `backend/app/routers/chat.py`**

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Project, ProjectContext, Conversation, Message, User
from ..schemas import (ChatTurnIn, ChatTurnOut, MessageOut, ConversationOut,
                       ContextData, ProjectContextOut)
from ..services.llm_client import LLMClient
from ..services.skills import get_registry
from ..services.skills.agents.dialogue import DialogueAgent

router = APIRouter(tags=["chat"])

def _owned(project_id: int, user: User, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

def _get_or_create_conversation(project: Project, kind: str, db: Session) -> Conversation:
    conv = db.query(Conversation).filter_by(project_id=project.id, kind=kind).first()
    if conv:
        return conv
    conv = Conversation(project_id=project.id, kind=kind)
    db.add(conv); db.commit(); db.refresh(conv)
    return conv

def _context_out(ctx: ProjectContext) -> ProjectContextOut:
    data = ContextData(**(json.loads(ctx.data_json) if ctx.data_json else {}))
    return ProjectContextOut(project_id=ctx.project_id, data=data,
                             completeness=ctx.completeness,
                             ready_for_analysis=ctx.ready_for_analysis,
                             summary=ctx.summary, updated_at=ctx.updated_at)

@router.post("/chat/intake", response_model=ChatTurnOut)
async def intake_turn(payload: ChatTurnIn,
                      user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    project = _owned(payload.project_id, user, db)
    conv = _get_or_create_conversation(project, "intake", db)

    # Persist user message
    user_msg = Message(conversation_id=conv.id, role="user", content=payload.message)
    db.add(user_msg); db.commit(); db.refresh(user_msg)

    # Load history + current context
    history_rows = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.id.asc()).all()
    history = [{"role": m.role, "content": m.content} for m in history_rows]

    ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
    if not ctx_row:
        ctx_row = ProjectContext(project_id=project.id, data_json="{}")
        db.add(ctx_row); db.commit(); db.refresh(ctx_row)
    current_ctx = ContextData(**(json.loads(ctx_row.data_json) if ctx_row.data_json else {}))

    # Run DialogueAgent
    registry = get_registry()
    skill = registry.get("intake")
    agent = DialogueAgent(llm=LLMClient(), registry=registry)
    result = await agent.turn(skill=skill, current_context=current_ctx, history=history)

    # Persist assistant reply
    bot_msg = Message(conversation_id=conv.id, role="assistant", content=result.reply_text)
    db.add(bot_msg)

    # Persist updated context
    ctx_row.data_json = result.context.model_dump_json()
    ctx_row.completeness = result.completeness
    ctx_row.ready_for_analysis = result.ready_for_analysis
    if result.summary:
        ctx_row.summary = result.summary
    db.commit(); db.refresh(bot_msg); db.refresh(ctx_row)

    return ChatTurnOut(
        assistant_message=MessageOut.model_validate(bot_msg),
        context=_context_out(ctx_row),
    )

@router.get("/projects/{project_id}/conversations/{kind}", response_model=ConversationOut)
def get_conversation(project_id: int, kind: str,
                     user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    if kind not in ("intake", "free"):
        raise HTTPException(status_code=422, detail="invalid kind")
    project = _owned(project_id, user, db)
    conv = _get_or_create_conversation(project, kind, db)
    msgs = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.id.asc()).all()
    return ConversationOut(id=conv.id, project_id=project.id, kind=conv.kind, run_id=conv.run_id,
                           messages=[MessageOut.model_validate(m) for m in msgs])
```

- [ ] **Step 4: Mount router in `main.py`** (replacing old chat router import if present).

- [ ] **Step 5: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_chat_intake.py -v`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/chat.py backend/app/main.py backend/tests/test_chat_intake.py
git commit -m "feat(backend): /chat/intake endpoint driven by DialogueAgent"
```

---

### Task 10: Frontend — ProjectContext provider + Projects page + API additions

**Files:**
- Modify: `frontend/package.json` (add `@tanstack/react-query`)
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/context/ProjectContext.tsx`
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/Projects.tsx`
- Create: `frontend/src/components/ProjectForm.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Install React Query**

```bash
cd frontend && npm install @tanstack/react-query@^5
```

- [ ] **Step 2: API additions in `client.ts`**

Export the `BASE` constant and add types + methods:

```typescript
export const BASE = "http://localhost:8000";  // already effectively this

export interface Project { id: number; user_id: number; name: string; created_at: string; updated_at: string; }
export interface ContextDataDTO {
  description: string; audience: string; geography: string; stage: string;
  price: string; paying_customers: number; big_job: string;
  pain_points: string[]; current_solutions: string[];
  competitors_mentioned: string[]; segment_hypotheses: string[]; notes: string;
}
export interface ProjectContextDTO {
  project_id: number; data: ContextDataDTO;
  completeness: number; ready_for_analysis: boolean; summary: string; updated_at: string;
}
export interface MessageDTO { id: number; role: "user"|"assistant"; content: string; created_at: string; }

// inside api:
  listProjects: () => apiFetch<Project[]>("/projects/"),
  createProject: (name: string) =>
    apiFetch<Project>("/projects/", { method: "POST", body: JSON.stringify({ name }) }),
  getProject: (id: number) => apiFetch<Project>(`/projects/${id}`),
  deleteProject: (id: number) =>
    apiFetch<void>(`/projects/${id}`, { method: "DELETE" }),
  getContext: (id: number) => apiFetch<ProjectContextDTO>(`/projects/${id}/context`),
  getConversation: (id: number, kind: "intake"|"free") =>
    apiFetch<{ id: number; project_id: number; kind: string; run_id: number | null; messages: MessageDTO[] }>(
      `/projects/${id}/conversations/${kind}`),
  intakeTurn: (projectId: number, message: string) =>
    apiFetch<{ assistant_message: MessageDTO; context: ProjectContextDTO }>(
      "/chat/intake",
      { method: "POST", body: JSON.stringify({ project_id: projectId, message }) }),
  listSkills: () => apiFetch<{id:string; name:string; kind:string; version:number}[]>("/skills"),
```

Also remove (or leave as dead-code for now) the old `sendMessage` method — it's superseded by `intakeTurn`.

- [ ] **Step 3: ProjectContext provider**

Create `frontend/src/context/ProjectContext.tsx` — same pattern as before (currentProjectId in localStorage). Skipped here for brevity; implementation is identical to the canonical version in Step 3 of Task 6 of the previous plan.

- [ ] **Step 4: Wrap app**

In `main.tsx`, wrap tree in `<QueryClientProvider client={new QueryClient()}><AuthProvider><ProjectProvider>…</ProjectProvider></AuthProvider></QueryClientProvider>`.

- [ ] **Step 5: Projects page**

```tsx
// frontend/src/pages/Projects.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useProject } from "../context/ProjectContext";

export default function Projects() {
  const q = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const qc = useQueryClient();
  const nav = useNavigate();
  const { setCurrentProjectId } = useProject();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.createProject(name),
    onSuccess: p => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCurrentProjectId(p.id);
      nav("/chat");
    },
  });
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Проекты</h1>
      <div className="bg-panel border border-border rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)}
                 placeholder="Название нового проекта"
                 className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-accent" />
          <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}
                  className="bg-accent hover:bg-emerald-600 text-white rounded-lg px-4 py-2">
            Создать
          </button>
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          После создания я задам тебе пару вопросов о продукте.
        </div>
      </div>
      <div className="space-y-2">
        {q.data?.map(p => (
          <button key={p.id}
                  onClick={() => { setCurrentProjectId(p.id); nav("/chat"); }}
                  className="block w-full text-left bg-panel border border-border rounded-xl p-4 hover:bg-neutral-50 shadow-sm">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-neutral-500">создан {new Date(p.created_at).toLocaleDateString()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Router — add `/projects`**

Add protected route `/projects → <Projects />`.

- [ ] **Step 7: Sidebar — project switcher** (project dropdown above modes; link to `/projects`). Keep existing mode buttons but stub — they'll be revisited in Task 11.

- [ ] **Step 8: Commit**

```bash
git add frontend/src frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): projects page, provider, api additions"
```

---

### Task 11: Frontend — intake chat + context panel

**Files:**
- Modify: `frontend/src/pages/Chat.tsx`
- Create: `frontend/src/components/ContextSummary.tsx`

- [ ] **Step 1: ContextSummary component**

```tsx
// frontend/src/components/ContextSummary.tsx
import { ProjectContextDTO } from "../api/client";

const LABELS: Record<string, string> = {
  description: "Продукт", audience: "Аудитория", geography: "География",
  stage: "Стадия", price: "Цена", paying_customers: "Платящих",
  big_job: "Главная задача",
};

export default function ContextSummary({ ctx }: { ctx: ProjectContextDTO }) {
  const d = ctx.data;
  return (
    <aside className="hidden xl:block w-[300px] shrink-0 border-l border-border bg-panel p-4 overflow-y-auto">
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Контекст проекта</div>
      <div className="text-xs text-neutral-500 mb-3">
        Готовность: {Math.round(ctx.completeness * 100)}%
        {ctx.ready_for_analysis && <span className="ml-2 text-accent font-medium">готов</span>}
      </div>
      <dl className="space-y-3 text-sm">
        {Object.entries(LABELS).map(([k, label]) => {
          const v = (d as any)[k];
          if (!v && v !== 0) return null;
          return (
            <div key={k}>
              <dt className="text-neutral-500 text-xs">{label}</dt>
              <dd>{String(v)}</dd>
            </div>
          );
        })}
        {d.pain_points.length > 0 && (
          <div>
            <dt className="text-neutral-500 text-xs">Боли</dt>
            <dd>
              <ul className="list-disc ml-4">{d.pain_points.map((p,i)=><li key={i}>{p}</li>)}</ul>
            </dd>
          </div>
        )}
        {d.current_solutions.length > 0 && (
          <div>
            <dt className="text-neutral-500 text-xs">Сейчас решают через</dt>
            <dd><ul className="list-disc ml-4">{d.current_solutions.map((p,i)=><li key={i}>{p}</li>)}</ul></dd>
          </div>
        )}
      </dl>
      {ctx.summary && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Summary</div>
          <pre className="whitespace-pre-wrap text-sm">{ctx.summary}</pre>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Chat.tsx — intake flow**

Rewrite Chat page to:
1. If no `currentProjectId` → render "Выберите проект" with link.
2. Fetch conversation `intake` and context for current project via react-query.
3. On mount, if conversation has 0 messages, seed with an empty POST (backend will return the agent's opening line because history is empty → prompt says "respond with greeting"). Alternative simpler path: the backend first turn auto-injects a greeting if `history` is empty. For the test we can just check `messages.length > 0` after first POST.
4. Send message → `api.intakeTurn(pid, text)` → append both user + assistant messages, update context.
5. When `context.ready_for_analysis === true`, show a persistent green banner with a "Запустить анализ рынка" button (wired in Phase D, for now just disabled with a tooltip).
6. Render `<ContextSummary ctx={context} />` on the right.

```tsx
// sketch of key parts
const { currentProjectId } = useProject();
if (!currentProjectId) return <EmptyPickProject />;

const ctxQ = useQuery({
  queryKey: ["context", currentProjectId],
  queryFn: () => api.getContext(currentProjectId),
});
const convQ = useQuery({
  queryKey: ["conv", currentProjectId, "intake"],
  queryFn: () => api.getConversation(currentProjectId, "intake"),
});

const turn = useMutation({
  mutationFn: (text: string) => api.intakeTurn(currentProjectId, text),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["conv", currentProjectId, "intake"] });
    qc.invalidateQueries({ queryKey: ["context", currentProjectId] });
  },
});

// bootstrap: if convQ.data?.messages.length === 0, call turn.mutate("") once to get the opener.
// (Backend will handle empty string by triggering the "first message" branch in intake.md.)
```

- [ ] **Step 3: Bootstrap the opener from backend**

Modify `/chat/intake` endpoint to accept an empty `message` on the very first call (when history is empty): still run the DialogueAgent but pass an empty history + the user's empty message. The skill instructs Claude to respond with the greeting line. Add this as a test too:

```python
def test_intake_first_empty_message_triggers_greeting(client, auth_headers, monkeypatch):
    from app.services.skills.agents.dialogue import DialogueTurnResult
    from app.schemas import ContextData
    async def fake_turn(self, *, skill, current_context, history):
        return DialogueTurnResult(reply_text="Привет. Что делаешь?", context=ContextData(),
                                  completeness=0.0, ready_for_analysis=False, summary="")
    monkeypatch.setattr("app.services.skills.agents.dialogue.DialogueAgent.turn", fake_turn)
    p = client.post("/projects/", json={"name": "X"}, headers=auth_headers).json()
    r = client.post("/chat/intake",
                    json={"project_id": p["id"], "message": ""},
                    headers=auth_headers)
    assert r.status_code == 200
    assert "Привет" in r.json()["assistant_message"]["content"]
```

Add test and make it pass (current implementation already supports empty messages since it persists them verbatim; tweak if needed so an empty user message is persisted as `"[opener]"` or simply stored empty — decide during implementation, test locks behaviour).

- [ ] **Step 4: Manual smoke**

```bash
# backend
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# frontend
cd frontend && npm run dev
```

Log in, create a project, go through the interview (need a real ANTHROPIC_API_KEY in .env for this step). Confirm the right panel fills up as you answer questions. When `completeness >= 0.7`, a banner "Готов запустить анализ рынка" appears.

- [ ] **Step 5: Commit**

```bash
git add frontend/src backend/app/routers/chat.py backend/tests/test_chat_intake.py
git commit -m "feat(frontend): intake chat + live ContextSummary panel"
```

**Phase B complete.** Intake dialogue runs end-to-end against real Claude. Context fills up. Analysis button is visible but not yet wired.

---

# PHASE C — Analysis pipeline agent

### Task 12: ExaClient

**Files:**
- Create: `backend/app/services/exa_client.py`
- Create: `backend/tests/fixtures/exa_search_sample.json`
- Create: `backend/tests/test_exa_client.py`

- [ ] **Step 1: Fixture**

`backend/tests/fixtures/exa_search_sample.json`:

```json
{
  "results": [
    {"title": "Top task planners 2026", "url": "https://ex.com/a",
     "text": "Todoist $4/mo, Asana $10.99/mo, Notion $8/mo. Users dislike weak reminders in Todoist.",
     "publishedDate": "2026-02-01", "score": 0.9},
    {"title": "Why freelancers miss deadlines", "url": "https://ex.com/b",
     "text": "Survey of 500 freelancers in Russia — 60% report missed deadlines due to context switching.",
     "publishedDate": "2026-01-12", "score": 0.85}
  ]
}
```

- [ ] **Step 2: Failing tests**

```python
# backend/tests/test_exa_client.py
import json, pytest, respx, httpx
from pathlib import Path
from app.services.exa_client import ExaClient

F = Path(__file__).parent / "fixtures"

@pytest.mark.asyncio
async def test_search_parses_and_sends_semantic_query():
    with respx.mock(base_url="https://api.exa.ai") as m:
        route = m.post("/search").mock(return_value=httpx.Response(200, json=json.loads((F/"exa_search_sample.json").read_text())))
        c = ExaClient("key")
        r = await c.search("blog post comparing task planners 2026", num_results=8)
    body = json.loads(route.calls.last.request.content)
    assert body["query"] == "blog post comparing task planners 2026"
    assert body["numResults"] == 8
    assert body["type"] == "auto"
    assert body["contents"]["text"]["maxCharacters"] == 2000
    assert len(r) == 2
    assert r[0].url == "https://ex.com/a"
```

- [ ] **Step 3: Implementation**

```python
# backend/app/services/exa_client.py
from dataclasses import dataclass
import httpx

@dataclass
class ExaResult:
    title: str; url: str; text: str
    published_date: str = ""; score: float = 0.0

class ExaClient:
    BASE = "https://api.exa.ai"
    def __init__(self, api_key: str, timeout: float = 30.0):
        self._headers = {"x-api-key": api_key, "content-type": "application/json"}
        self._timeout = timeout

    async def search(self, query: str, num_results: int = 10) -> list[ExaResult]:
        body = {"query": query, "numResults": num_results, "type": "auto",
                "contents": {"text": {"maxCharacters": 2000}, "highlights": True}}
        async with httpx.AsyncClient(base_url=self.BASE, timeout=self._timeout) as c:
            r = await c.post("/search", json=body, headers=self._headers)
            r.raise_for_status()
            data = r.json()
        return [ExaResult(title=it.get("title",""), url=it.get("url",""),
                          text=it.get("text",""),
                          published_date=it.get("publishedDate",""),
                          score=it.get("score",0.0))
                for it in data.get("results", [])]

    async def research_company(self, url_or_name: str) -> dict:
        body = {"query": url_or_name, "type": "research"}
        async with httpx.AsyncClient(base_url=self.BASE, timeout=60.0) as c:
            r = await c.post("/research", json=body, headers=self._headers)
            r.raise_for_status()
            return r.json()
```

- [ ] **Step 4: Run**

Run: `cd backend && .venv/bin/pytest tests/test_exa_client.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/exa_client.py backend/tests/test_exa_client.py backend/tests/fixtures/exa_search_sample.json
git commit -m "feat(backend): ExaClient (httpx + respx tests)"
```

---

### Task 13: Query builders + scoring (pure functions)

**Files:**
- Create: `backend/app/services/market_analysis/__init__.py`, `queries.py`, `scoring.py`, `report_schemas.py`
- Create: `backend/tests/test_queries.py`, `backend/tests/test_scoring.py`

- [ ] **Step 1: report_schemas.py** — copy the `Competitor/UnitEconomics/Segment/Risk/AnalysisReport` definitions from the "Domain Schemas" section verbatim.

- [ ] **Step 2: queries.py**

```python
# Mirrors rules from full-analysis-exa.md lines 41-44.
def build_market_queries(category: str, geography: str,
                         target_segment: str, problem: str) -> list[str]:
    return [
        f"comparison of {category} competitors pricing and positioning {geography} 2026",
        f"{category} market size and growth trends {geography} 2025 2026",
        f"why {target_segment} struggles with {problem} and does not use existing solutions {geography}",
        f"honest reviews and complaints about {category} what users dislike 2025 2026",
    ]

def build_competitor_complaint_query(competitor: str) -> str:
    return f"honest reviews and complaints about {competitor} what users dislike 2026"

def build_channel_query(segment: str, problem: str) -> str:
    return f"where {segment} goes to find solutions for {problem} online communities blogs 2026"
```

- [ ] **Step 3: scoring.py**

```python
from typing import Literal
from .report_schemas import UnitEconomics

def compute_ltv(amppu: float, margin_pct: float, monthly_churn_pct: float) -> float:
    if monthly_churn_pct <= 0:
        return 0.0
    return (amppu * (margin_pct / 100.0)) / (monthly_churn_pct / 100.0)

def compute_unit_economics(amppu: float, margin_pct: float,
                           monthly_churn_pct: float, cac: float) -> UnitEconomics:
    ltv = compute_ltv(amppu, margin_pct, monthly_churn_pct)
    ratio = ltv / cac if cac else 0.0
    payback = cac / amppu if amppu else 0.0
    if ratio >= 3 and payback <= 6:
        health = "healthy"
    elif ratio >= 1 and payback <= 12:
        health = "moderate"
    else:
        health = "unhealthy"
    return UnitEconomics(amppu=amppu, margin_pct=margin_pct,
                         monthly_churn_pct=monthly_churn_pct, cac=cac,
                         ltv=ltv, ltv_cac=ratio, payback_months=payback, health=health)

def score_segment(job_fit: float, market_size: float, economics: float,
                  moat: float, ltv_cac: float | None = None) -> float:
    if ltv_cac is not None and ltv_cac < 1:
        return 0.0
    return job_fit * 0.40 + market_size * 0.25 + economics * 0.25 + moat * 0.10

def categorize(total: float) -> Literal["A","B","C"]:
    if total >= 70: return "A"
    if total >= 50: return "B"
    return "C"
```

- [ ] **Step 4: Tests** (identical structure to the previous plan — covers formula, Gate, categorize thresholds, healthy/moderate/unhealthy cases). Write them, run, green.

Run: `cd backend && .venv/bin/pytest tests/test_queries.py tests/test_scoring.py -v`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/market_analysis backend/tests/test_queries.py backend/tests/test_scoring.py
git commit -m "feat(backend): market-analysis queries + scoring (pure functions)"
```

---

### Task 14: PipelineAgent (dispatches phases by mode)

**Files:**
- Create: `backend/app/services/skills/agents/pipeline.py`
- Create: `backend/tests/fixtures/anthropic_phase1_extract.json`, `anthropic_phase2_segments.json`, `anthropic_phase3_deep_dive.json`, `anthropic_phase4_synthesis.json`
- Create: `backend/tests/test_pipeline_agent.py`

The agent walks `skill.phases`. For each phase it picks a handler by `phase.mode`:
- `research` → run Exa queries, attach results, ask LLM to extract structured facts from them
- `structured` → single LLM call returning JSON
- `fanout` → iterate over `phase.over` (slice [:limit]), run N LLM calls in parallel
- `synthesis` → final LLM call; after it, code computes scoring + categorization + overrides

Output is always an `AnalysisReport`.

- [ ] **Step 1: Record fixtures** — same shape as in the previous plan; each fixture is `{"content": [{"type": "text", "text": "<json>"}]}`. Keep JSON bodies minimal but valid (competitors, 2 segments, deep-dive per segment, final verdict = `GO_CONDITIONAL`). The content strings are the exact same as in the previous plan draft (copy them).

- [ ] **Step 2: Failing test**

```python
# backend/tests/test_pipeline_agent.py
import json, pytest
from pathlib import Path
from app.services.skills import get_registry
from app.services.skills.agents.pipeline import PipelineAgent
from app.services.market_analysis.report_schemas import AnalysisReport
from app.schemas import ContextData

F = Path(__file__).parent / "fixtures"

class FakeExa:
    def __init__(self): self.calls = []
    async def search(self, query, num_results=10):
        from app.services.exa_client import ExaResult
        self.calls.append(query)
        return [ExaResult(title="t", url="https://ex.com", text=f"hit for {query[:40]}")]
    async def research_company(self, x): return {"summary": ""}

class FakeLLM:
    def __init__(self):
        self.idx = 0
        self.scripts = [
            (F/"anthropic_phase1_extract.json").read_text(),
            (F/"anthropic_phase2_segments.json").read_text(),
            (F/"anthropic_phase3_deep_dive.json").read_text(),
            (F/"anthropic_phase3_deep_dive.json").read_text(),  # 2 segments → 2 calls
            (F/"anthropic_phase4_synthesis.json").read_text(),
        ]
    async def complete_text(self, *, knowledge, skill_body, user, max_tokens=4096):
        assert "сегмент" in knowledge.lower() or "Struggling" in knowledge  # kb is wired
        assert "2026" in skill_body  # skill body is passed verbatim
        payload = json.loads(self.scripts[self.idx])
        self.idx += 1
        return payload["content"][0]["text"]

@pytest.mark.asyncio
async def test_pipeline_agent_runs_full_analysis():
    reg = get_registry()
    skill = reg.get("full-analysis-exa")
    exa = FakeExa(); llm = FakeLLM()
    ctx = ContextData(description="AI planner", audience="freelancers", geography="Russia",
                      stage="idea", big_job="ship client work", pain_points=["missed deadlines"])
    phases_seen: list[str] = []
    agent = PipelineAgent(llm=llm, registry=reg, exa=exa)
    report = await agent.run(skill=skill, context=ctx,
                             progress=lambda ph: phases_seen.append(ph))
    assert isinstance(report, AnalysisReport)
    assert report.verdict in ("GO","GO_CONDITIONAL","PIVOT","NO_GO")
    assert len(report.segments) >= 2
    assert phases_seen == ["market_research", "segmentation", "deep_dive", "synthesis"]
    # Scoring applied:
    assert any(s.total_score > 0 for s in report.segments)
    # Four Exa queries issued in phase 1:
    assert len(exa.calls) == 4
    assert any("2026" in q for q in exa.calls)
```

- [ ] **Step 3: Implement `pipeline.py`**

```python
# backend/app/services/skills/agents/pipeline.py
import asyncio, json
from dataclasses import dataclass
from typing import Callable
from ....schemas import ContextData
from ...market_analysis.queries import build_market_queries
from ...market_analysis.scoring import compute_unit_economics, score_segment, categorize
from ...market_analysis.report_schemas import AnalysisReport, Segment
from ..models import Skill, PhaseSpec
from .base import Agent

ProgressCb = Callable[[str], None]

class PipelineAgent(Agent):
    def __init__(self, llm, registry, exa=None):
        super().__init__(llm=llm, registry=registry)
        self.exa = exa

    async def run(self, *, skill: Skill, context: ContextData,
                  progress: ProgressCb | None = None) -> AnalysisReport:
        knowledge = self.registry.knowledge_block(skill.uses_knowledge_base)
        state: dict = {"context": context.model_dump(), "phase_outputs": {}}
        for phase in skill.phases:
            if progress:
                progress(phase.id)
            handler = self._handler_for(phase.mode)
            await handler(skill=skill, phase=phase, knowledge=knowledge, state=state)

        # Final assembly: phase 4 handler stored a dict at state["phase_outputs"]["synthesis"]
        final = state["phase_outputs"].get("synthesis") or {}
        # Segments already scored+categorized in deep_dive phase, written under "segments"
        final_segments = state.get("segments") or []
        # Competitors from market_research
        competitors = state.get("competitors") or []
        report = AnalysisReport(**{**final, "segments": final_segments, "competitors": competitors})
        return report

    def _handler_for(self, mode: str):
        return {
            "research": self._phase_research,
            "structured": self._phase_structured,
            "fanout": self._phase_fanout,
            "synthesis": self._phase_synthesis,
        }[mode]

    def _user_block(self, *, skill: Skill, phase: PhaseSpec, state: dict, extra: str = "") -> str:
        return (
            f"ФАЗА: {phase.id}\n\n"
            f"Контекст проекта:\n{json.dumps(state['context'], ensure_ascii=False, indent=2)}\n\n"
            f"Состояние пайплайна:\n"
            f"{json.dumps({k: v for k, v in state.items() if k != 'context'}, ensure_ascii=False)[:12000]}\n\n"
            f"{extra}\n\n"
            "Верни СТРОГО валидный JSON под задачу этой фазы."
        )

    async def _phase_research(self, *, skill, phase, knowledge, state):
        # 1) Exa
        ctx = state["context"]
        queries = build_market_queries(
            category=ctx.get("description") or "product",
            geography=ctx.get("geography") or "global",
            target_segment=ctx.get("audience") or "target users",
            problem=ctx.get("big_job") or "the job to be done",
        )
        if self.exa is None:
            raise RuntimeError("Pipeline requires exa client for research phase")
        search_results = await asyncio.gather(*[self.exa.search(q, num_results=8) for q in queries])
        batches = [
            {"query": q, "hits": [r.__dict__ for r in hits]}
            for q, hits in zip(queries, search_results)
        ]
        state["search_batches"] = batches

        # 2) Extract structured facts
        extra = (
            f"Exa-результаты:\n{json.dumps(batches, ensure_ascii=False)[:14000]}\n\n"
            "Извлеки competitors (до 8), trends, non_consumers, tam_reasoning. "
            "JSON: {\"competitors\":[...], \"trends\":[...], "
            "\"non_consumers\":{\"description\":\"...\",\"barrier\":\"...\"}, \"tam_reasoning\":\"...\"}"
        )
        user = self._user_block(skill=skill, phase=phase, state=state, extra=extra)
        raw = await self.llm.complete_text(knowledge=knowledge, skill_body=skill.body_markdown, user=user)
        parsed = json.loads(raw)
        state["competitors"] = parsed.get("competitors", [])
        state["market_facts"] = {k: v for k, v in parsed.items() if k != "competitors"}
        state["phase_outputs"][phase.id] = parsed

    async def _phase_structured(self, *, skill, phase, knowledge, state):
        if phase.id == "segmentation":
            extra = (
                "Построй 7-9 сегментов по принципам из knowledge base, обязательно Non-consumers. "
                "JSON: {\"segments\":[Segment,...]}. Unit_econ оставь нулевым — посчитаем."
            )
        else:
            extra = "Выполни задачу текущей фазы, верни JSON."
        user = self._user_block(skill=skill, phase=phase, state=state, extra=extra)
        raw = await self.llm.complete_text(knowledge=knowledge, skill_body=skill.body_markdown, user=user)
        parsed = json.loads(raw)
        if phase.id == "segmentation":
            raw_segments = parsed.get("segments", [])
            state["segments"] = [Segment(**s).model_dump() for s in raw_segments]
        state["phase_outputs"][phase.id] = parsed

    async def _phase_fanout(self, *, skill, phase, knowledge, state):
        items = state.get(phase.over, [])[: phase.limit or len(state.get(phase.over, []))]
        async def _one(item: dict):
            extra = (
                f"Глубокий анализ сегмента:\n{json.dumps(item, ensure_ascii=False)}\n\n"
                "Верни JSON {segment_name, switch_story, unmet_jobs, key_message, main_channel, "
                "scores:{job_fit,market_size,economics,moat}, "
                "unit_econ_inputs:{amppu,margin_pct,monthly_churn_pct,cac}}."
            )
            user = self._user_block(skill=skill, phase=phase, state=state, extra=extra)
            raw = await self.llm.complete_text(knowledge=knowledge, skill_body=skill.body_markdown, user=user)
            return json.loads(raw)
        deep = await asyncio.gather(*[_one(it) for it in items])
        # Apply scoring
        enriched: list[dict] = []
        by_name = {d.get("segment_name"): d for d in deep}
        for seg in state["segments"]:
            d = by_name.get(seg["name"]) or by_name.get(seg.get("name", ""))
            if d:
                ue_in = d.get("unit_econ_inputs", {})
                ue = compute_unit_economics(
                    amppu=ue_in.get("amppu", 0), margin_pct=ue_in.get("margin_pct", 0),
                    monthly_churn_pct=ue_in.get("monthly_churn_pct", 0), cac=ue_in.get("cac", 0))
                scores = d.get("scores", {})
                total = score_segment(
                    job_fit=scores.get("job_fit", 0),
                    market_size=scores.get("market_size", 0),
                    economics=scores.get("economics", 0),
                    moat=scores.get("moat", 0),
                    ltv_cac=ue.ltv_cac,
                )
                seg.update({
                    "switch_story": d.get("switch_story", ""),
                    "unmet_jobs": d.get("unmet_jobs", []),
                    "key_message": d.get("key_message", ""),
                    "main_channel": d.get("main_channel", ""),
                    "score_job_fit": scores.get("job_fit", 0),
                    "score_market_size": scores.get("market_size", 0),
                    "score_economics": scores.get("economics", 0),
                    "score_moat": scores.get("moat", 0),
                    "total_score": total,
                    "category": categorize(total),
                    "unit_econ": ue.model_dump(),
                })
            enriched.append(seg)
        state["segments"] = enriched
        state["phase_outputs"][phase.id] = deep

    async def _phase_synthesis(self, *, skill, phase, knowledge, state):
        extra = (
            "Сформируй итоговый AnalysisReport: verdict, verdict_condition, positioning, "
            "main_insight, asymmetric_opportunity, top_risks (3-5), competitor_response, "
            "next_three_steps (3), plan_90d (3). Поля competitors и segments НЕ дублируй — "
            "их предоставит бэкенд из предыдущих фаз."
        )
        user = self._user_block(skill=skill, phase=phase, state=state, extra=extra)
        raw = await self.llm.complete_text(knowledge=knowledge, skill_body=skill.body_markdown, user=user)
        parsed = json.loads(raw)
        # Strip lists that backend will re-apply:
        parsed.pop("competitors", None); parsed.pop("segments", None)
        state["phase_outputs"][phase.id] = parsed
```

- [ ] **Step 4: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_pipeline_agent.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/skills/agents/pipeline.py backend/tests/test_pipeline_agent.py backend/tests/fixtures/anthropic_phase*.json
git commit -m "feat(agents): PipelineAgent with research/structured/fanout/synthesis dispatch"
```

---

### Task 15: Runs router (generic for any skill)

**Files:**
- Create: `backend/app/routers/runs.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_runs.py`

- [ ] **Step 1: Failing test** (uses monkeypatched PipelineAgent.run so no real LLM call)

```python
def test_start_run_executes_and_persists_report(client, auth_headers, monkeypatch):
    from app.services.market_analysis.report_schemas import AnalysisReport, Segment
    from app.services.skills.agents.pipeline import PipelineAgent

    async def fake_run(self, *, skill, context, progress=None):
        if progress:
            for ph in ("market_research","segmentation","deep_dive","synthesis"):
                progress(ph)
        return AnalysisReport(verdict="GO", positioning="p", main_insight="i",
                              segments=[Segment(name="S1", struggling_moment="x",
                                                core_job="y", total_score=72, category="A")])
    monkeypatch.setattr(PipelineAgent, "run", fake_run)

    p = client.post("/projects/", json={"name": "X"}, headers=auth_headers).json()
    r = client.post(f"/projects/{p['id']}/runs",
                    json={"skill_id": "full-analysis-exa"},
                    headers=auth_headers)
    assert r.status_code == 202
    rid = r.json()["id"]

    for _ in range(50):
        rr = client.get(f"/projects/{p['id']}/runs/{rid}", headers=auth_headers)
        if rr.json()["status"] == "done": break
    assert rr.json()["status"] == "done"

    rep = client.get(f"/projects/{p['id']}/runs/{rid}/report", headers=auth_headers)
    assert rep.status_code == 200
    assert rep.json()["verdict"] == "GO"
    assert rep.json()["segments"][0]["category"] == "A"

def test_start_run_blocked_when_skill_requires_missing_context(client, auth_headers):
    p = client.post("/projects/", json={"name": "X"}, headers=auth_headers).json()
    r = client.post(f"/projects/{p['id']}/runs",
                    json={"skill_id": "full-analysis-exa"},
                    headers=auth_headers)
    assert r.status_code == 409
    assert "context" in r.json()["detail"].lower()
```

- [ ] **Step 2: Implement `runs.py`**

```python
import asyncio, json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..config import settings
from ..db import get_db, SessionLocal
from ..models import Project, ProjectContext, Run, User
from ..schemas import RunCreate, RunOut, ContextData
from ..services.exa_client import ExaClient
from ..services.llm_client import LLMClient
from ..services.skills import get_registry
from ..services.skills.agents.router import agent_for_skill

router = APIRouter(tags=["runs"])

def _owned(project_id: int, user: User, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

def _validate_context(skill, ctx_data: ContextData) -> None:
    missing: list[str] = []
    for field in skill.requires_context:
        v = getattr(ctx_data, field, "")
        if not v:
            missing.append(field)
    if missing:
        raise HTTPException(status_code=409,
                            detail=f"Project context is incomplete — missing: {', '.join(missing)}")

def _execute_run(run_id: int, skill_id: str, context_dict: dict):
    async def _go():
        db = SessionLocal()
        try:
            run = db.get(Run, run_id)
            if not run: return
            run.status = "running"; db.commit()
            reg = get_registry()
            skill = reg.get(skill_id)
            llm = LLMClient()
            exa = ExaClient(api_key=settings.exa_api_key) if skill.uses_search == "exa" else None
            agent = agent_for_skill(skill, llm=llm, registry=reg)
            if exa is not None:
                agent.exa = exa  # PipelineAgent accepts exa attr
            def progress(ph: str):
                run.phase = ph; db.commit()
            try:
                ctx = ContextData(**context_dict)
                if skill.kind == "pipeline":
                    report = await agent.run(skill=skill, context=ctx, progress=progress)
                    run.output_json = report.model_dump_json()
                else:
                    raise RuntimeError(f"Runs router does not support dialogue skills here")
                run.status = "done"
            except Exception as e:
                run.status = "error"
                run.error = f"{type(e).__name__}: {e}"
            db.commit()
        finally:
            db.close()
    asyncio.run(_go())

@router.post("/projects/{project_id}/runs", response_model=RunOut, status_code=202)
def start_run(project_id: int, payload: RunCreate,
              background: BackgroundTasks,
              user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    project = _owned(project_id, user, db)
    reg = get_registry()
    try:
        skill = reg.get(payload.skill_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.kind != "pipeline":
        raise HTTPException(status_code=400, detail="Only pipeline skills can be launched via /runs")
    ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
    ctx_data = ContextData(**(json.loads(ctx_row.data_json) if ctx_row and ctx_row.data_json else {}))
    _validate_context(skill, ctx_data)

    run = Run(project_id=project.id, skill_id=skill.id, kind=skill.kind,
              status="pending", phase="")
    db.add(run); db.commit(); db.refresh(run)
    background.add_task(_execute_run, run.id, skill.id, ctx_data.model_dump())
    return run

@router.get("/projects/{project_id}/runs/{run_id}", response_model=RunOut)
def get_run(project_id: int, run_id: int,
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, user, db)
    run = db.get(Run, run_id)
    if not run or run.project_id != project_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@router.get("/projects/{project_id}/runs/{run_id}/report")
def get_report(project_id: int, run_id: int,
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, user, db)
    run = db.get(Run, run_id)
    if not run or run.project_id != project_id:
        raise HTTPException(status_code=404, detail="Run not found")
    if not run.output_json:
        raise HTTPException(status_code=409, detail="Report not ready")
    return json.loads(run.output_json)

@router.get("/projects/{project_id}/runs", response_model=list[RunOut])
def list_runs(project_id: int,
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, user, db)
    return db.query(Run).filter_by(project_id=project_id).order_by(Run.id.desc()).all()
```

Mount in `main.py`.

- [ ] **Step 3: Fix `PipelineAgent.run` signature to accept `exa`**

Already in place via constructor; `runs.py` sets `agent.exa = exa`. Ensure `PipelineAgent.__init__` allows `exa=None`. Confirm.

- [ ] **Step 4: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_runs.py -v`
Expected: 2 passed.

Also run the full suite to confirm nothing broke:

```bash
cd backend && .venv/bin/pytest tests/ -v
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/runs.py backend/app/main.py backend/tests/test_runs.py
git commit -m "feat(backend): generic runs router driven by SkillRegistry"
```

**Phase C complete.** The pipeline works end-to-end under `pytest`. No UI yet.

---

# PHASE D — Analysis UI

### Task 16: API additions + run launching from Chat

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/Chat.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: API additions**

```typescript
export interface RunDTO { id: number; project_id: number; skill_id: string; kind: string;
  status: "pending"|"running"|"done"|"error"; phase: string; error: string;
  created_at: string; updated_at: string; }
export interface ReportDTO {
  verdict: "GO"|"GO_CONDITIONAL"|"PIVOT"|"NO_GO";
  verdict_condition: string; positioning: string; main_insight: string;
  asymmetric_opportunity: string;
  competitors: any[]; segments: any[]; top_risks: any[];
  competitor_response: string; next_three_steps: string[]; plan_90d: string[];
}
// inside api:
  startRun: (projectId: number, skillId: string) =>
    apiFetch<RunDTO>(`/projects/${projectId}/runs`,
                     { method: "POST", body: JSON.stringify({ skill_id: skillId }) }),
  getRun: (projectId: number, runId: number) =>
    apiFetch<RunDTO>(`/projects/${projectId}/runs/${runId}`),
  getReport: (projectId: number, runId: number) =>
    apiFetch<ReportDTO>(`/projects/${projectId}/runs/${runId}/report`),
```

- [ ] **Step 2: Chat page — launch button**

In `Chat.tsx`, when `context.ready_for_analysis === true`, show a sticky banner at the top of the message column:

```tsx
{ctx?.ready_for_analysis && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
    <div className="text-sm">
      Контекст собран. Можно запускать анализ рынка.
    </div>
    <button
      onClick={async () => {
        const run = await api.startRun(currentProjectId, "full-analysis-exa");
        nav(`/projects/${currentProjectId}/runs/${run.id}`);
      }}
      className="bg-accent text-white rounded-lg px-3 py-1.5 text-sm">
      Запустить анализ
    </button>
  </div>
)}
```

- [ ] **Step 3: Router — add `/projects/:projectId/runs/:runId`**

```tsx
{ path: "/projects/:projectId/runs/:runId", element: <RunPage /> },
```

- [ ] **Step 4: Commit** (no test yet — we'll verify manually in Task 18)

```bash
git add frontend/src
git commit -m "feat(frontend): launch analysis run from chat when context ready"
```

---

### Task 17: RunPage components + polling

**Files:**
- Create: `frontend/src/pages/RunPage.tsx`
- Create: `frontend/src/components/RunProgress.tsx`
- Create: `frontend/src/components/VerdictCard.tsx`
- Create: `frontend/src/components/SegmentsTable.tsx`
- Create: `frontend/src/components/RisksList.tsx`

- [ ] **Step 1: RunProgress**

```tsx
const PHASES = [
  { id: "market_research", label: "Сбор данных через Exa" },
  { id: "segmentation", label: "Сегментация" },
  { id: "deep_dive", label: "Глубокий анализ топ-5" },
  { id: "synthesis", label: "Синтез и вердикт" },
];
export default function RunProgress({ phase, status }: { phase: string; status: string }) {
  const idx = PHASES.findIndex(p => p.id === phase);
  return (
    <ol className="space-y-2">
      {PHASES.map((p, i) => {
        const state = status === "done" ? "done"
                   : i < idx ? "done"
                   : i === idx ? (status === "error" ? "error" : "active")
                   : "pending";
        return (
          <li key={p.id} className="flex items-center gap-3 text-sm">
            <span className={`inline-block w-2 h-2 rounded-full ${
              state === "done" ? "bg-accent" :
              state === "active" ? "bg-accent animate-pulse" :
              state === "error" ? "bg-red-500" : "bg-neutral-300"}`} />
            <span className={state === "pending" ? "text-neutral-400" : ""}>{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: VerdictCard / SegmentsTable / RisksList** — same markup as previous plan (verdict with condition, table sorted by total_score, risks list with P×I). Copy those JSX blocks.

- [ ] **Step 3: RunPage with polling**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, RunDTO, ReportDTO } from "../api/client";
import RunProgress from "../components/RunProgress";
import VerdictCard from "../components/VerdictCard";
import SegmentsTable from "../components/SegmentsTable";
import RisksList from "../components/RisksList";

export default function RunPage() {
  const { projectId, runId } = useParams();
  const pid = Number(projectId), rid = Number(runId);
  const [run, setRun] = useState<RunDTO | null>(null);
  const [report, setReport] = useState<ReportDTO | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.getRun(pid, rid);
        if (!alive) return;
        setRun(r);
        if (r.status === "done") {
          setReport(await api.getReport(pid, rid));
          return;
        }
        if (r.status === "error") return;
      } catch {}
      if (alive) setTimeout(tick, 1500);
    };
    tick();
    return () => { alive = false; };
  }, [pid, rid]);

  if (!run) return <div className="p-6 text-neutral-500">Загрузка…</div>;
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Анализ рынка #{run.id}</h1>
      <div className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
        <RunProgress phase={run.phase} status={run.status} />
        {run.status === "error" && <div className="mt-3 text-red-700 text-sm">{run.error}</div>}
      </div>
      {report && (
        <>
          <VerdictCard r={report} />
          <SegmentsTable segments={report.segments} />
          <RisksList risks={report.top_risks} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): RunPage with polling, progress stepper, verdict/segments/risks"
```

---

### Task 18: Manual acceptance

Not automated. Each scenario must pass before declaring the feature complete.

- [ ] **S1 — Projects isolation:** two accounts see only their projects; delete cascades to context, conversations, runs.
- [ ] **S2 — Intake end-to-end:** create project, answer ~8 questions, right panel fills, banner appears when ready.
- [ ] **S3 — Skill registry hot-add:** drop a dummy `backend/skills_library/skills/xtest.md` with frontmatter, restart uvicorn, GET `/skills` returns it. Delete after verifying.
- [ ] **S4 — Real analysis run:** with real `EXA_API_KEY` + `ANTHROPIC_API_KEY`, click "Запустить анализ", observe phase ticks, verdict card appears within 3 minutes, report contains ≥3 segments with categories A/B/C and ≥3 risks.
- [ ] **S5 — Missing-context guard:** start a fresh project, immediately `curl -X POST /projects/:id/runs -d '{"skill_id":"full-analysis-exa"}'` → returns 409 listing missing fields.
- [ ] **S6 — Error path:** break `EXA_API_KEY`, start a run, UI shows `run.status="error"` + message.

---

### Task 19: README + cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Sections:
- Prereqs: Python 3.12+, Node 20+, `EXA_API_KEY`, `ANTHROPIC_API_KEY`.
- Run backend (`uvicorn ... --port 8000`).
- Run frontend (`npm run dev`).
- **"How to add a new skill"** — three steps: drop `.md` into `backend/skills_library/skills/` with frontmatter, restart backend, (optional) add a renderer in `frontend/src/components/` for its output schema.
- Notes about SQLite being dev-only, prompt caching, and that the SSE endpoint is implemented but unused by the UI.

- [ ] **Step 2: Run full suite**

```bash
cd backend && .venv/bin/pytest tests/ -v
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for skills architecture and run instructions"
```

---

## Self-Review

**1. Spec coverage**

| Requirement | Task(s) |
|---|---|
| Projects with isolated context | 2, 3, 6 |
| LLM-driven intake collecting max info | 4, 7, 8, 9, 11 |
| ai-cpo skills as source of truth (not pasted into Python) | 4, 5 |
| `full-analysis-exa.md` rules preserved verbatim | 4 (copy), 5 (body in system block), 8/14 (llm receives body) |
| Knowledge base (сегментация, mechanics, onboarding) | 4 (copied), 5 (loader), 8/14 (knowledge_block) |
| Exa as critical search backend | 12, 13, 14 |
| Scoring (JobFit*0.4 + ... , Gate, A/B/C) | 13, 14 |
| Multi-agent architecture, pluggable | 5 (registry), 8 (DialogueAgent), 14 (PipelineAgent), 15 (agent_for_skill dispatcher) |
| Future-proof for adding diagnostic/launch-product/etc | Task 4 parks them; Task 15 runs any pipeline skill; README documents the flow |
| Per-phase progress shown in UI | 15 (backend updates `run.phase`), 17 (polling + stepper) |
| Verdict + segments + risks rendered | 17 |

**2. Placeholder scan**

- Task 10/11 mention "same pattern as before" for `ProjectContext.tsx` and JSX components — this references the canonical snippets in Task 6/Task 17 of this same document. If you're executing out of order, copy from those tasks verbatim.
- No "TBD", "handle edge cases", or unspecified error handling remain.

**3. Type consistency**

- `ContextData` — same 13 fields everywhere (schemas.py, dialogue agent tool input schema, skill `intake.md` critical-fields list).
- `AnalysisReport` — pipeline agent writes exactly the fields defined in `report_schemas.py`; `SegmentsTable` reads `total_score`, `category`, `unit_econ.ltv_cac`, `main_channel`.
- `Run.phase` values match the ids in `PipelineAgent` PhaseSpecs and in the frontend `PHASES` array.
- `skill.uses_search == "exa"` — checked in runs.py before instantiating ExaClient; PipelineAgent raises if called in research phase without one.

**4. Known trade-offs**

- **Polling, not SSE.** `EventSource` cannot carry JWT in headers. Polling every 1.5 s is good enough for MVP. SSE endpoint skipped in this plan; add later with a short-lived stream token if responsiveness matters.
- **BackgroundTasks in-process.** If uvicorn restarts mid-run, the run stays `running` forever. Mitigation: a startup hook can sweep `status=running` rows older than 10 min and mark them `error`. Not included in this plan to keep scope tight.
- **SkillRegistry is in-process singleton, loaded at startup.** Hot reloading via file-watcher is a future enhancement. For now, restart uvicorn to pick up new skills.
- **No Alembic.** `Base.metadata.create_all` matches current project style. Add Alembic before the first production deploy.
- **Rate limits / retries on Exa and Anthropic.** Not handled — a transient 429 surfaces as `run.status="error"`. Add `tenacity`-based retries in Phase C hardening, later.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-15-market-analysis-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints.

Which approach?
