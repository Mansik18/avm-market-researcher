# AVM Market Researcher — Project Documentation

AI-powered market research tool for product teams. Users describe their product through an interview, then the system runs a 4-phase market analysis pipeline using LLM + web search, producing a structured report with verdict (GO / NO_GO / PIVOT / GO_CONDITIONAL), segments, unit economics, risks, and a 90-day plan.

**Language**: Russian UI, Russian prompts, English codebase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.115 + Uvicorn, Python 3.12 |
| Frontend | React 18.3 + TypeScript + Vite 5.4 + Tailwind CSS 3.4 |
| Database | SQLite via SQLAlchemy 2.0 (auto-create tables on startup) |
| Auth | JWT (HS256, 7-day expiry) + bcrypt |
| LLM | OpenAI-compatible proxy (`gpt-5.4` at `llmserver.codecrafters.kz/v1`) |
| Web Search | Exa.ai API |
| State Mgmt | React Context API (auth only), local state in Chat.tsx |
| Deploy | Docker Compose (backend + frontend) |

---

## Project Structure

```
backend/
  app/
    main.py              # FastAPI app, CORS, router mounting
    config.py            # Settings from env (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, EXA_API_KEY)
    auth.py              # JWT creation, password hashing, get_current_user dependency
    db.py                # SQLAlchemy engine + SessionLocal + Base
    models.py            # User, Project, ProjectContext (ORM models)
    schemas.py           # Pydantic models: ContextData, AnalysisReport, Segment, etc.
    middleware.py         # Request logging (method, path, status, duration_ms)
    logging_config.py    # JSON structured logging
    routers/
      auth.py            # POST /auth/register, /auth/login, GET /auth/me
      projects.py        # CRUD: POST/GET/DELETE /projects/, context/history/report endpoints
      chat.py            # POST /projects/{id}/intake — single interview turn
      analysis.py        # POST /projects/{id}/analyze — full pipeline; report versioning
    services/
      llm.py             # AsyncOpenAI client, complete_text(), complete_with_tool()
      exa.py             # Exa search: query -> [{title, url, text, score}]
      intake.py          # Interview flow: LLM + update_context tool -> IntakeTurnResult
      analysis.py        # 4-phase pipeline: research -> segmentation -> deep_dive -> synthesis
      scoring.py         # LTV, LTV/CAC, payback, health classification, total_score
      skills.py          # Load .md skill files from backend/skills/
  skills/
    intake.md            # System prompt for interview bot
    full-analysis.md     # System prompt for market analysis
  .env                   # LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, EXA_API_KEY
  app.db                 # SQLite database file

frontend/
  src/
    main.tsx             # React entry point
    router.tsx           # Routes: /login, /register, /chat (protected)
    api/client.ts        # apiFetch wrapper, all API methods, TypeScript types
    context/AuthContext.tsx  # Auth state, token in localStorage
    pages/
      Login.tsx          # Email + password form
      Register.tsx       # Same as Login
      Chat.tsx           # Main app: sidebar + chat/report tabs, all local state
    components/
      Sidebar.tsx        # Project list, create/delete, mobile drawer
      ChatWindow.tsx     # Message display, auto-scroll
      MessageInput.tsx   # Textarea, Enter=send, Shift+Enter=newline
      ReportView.tsx     # Verdict, segments, unit economics, risks, 90-day plan
```

---

## Database Schema

3 tables, auto-created by SQLAlchemy `Base.metadata.create_all()`:

**users**: id, email (unique), password_hash, created_at

**projects**: id, user_id (FK users), name, created_at, updated_at, deleted_at (soft delete)

**project_contexts**: project_id (FK projects, PK), data_json (ContextData), history_json (chat messages), completeness (0-1), ready_for_analysis (bool), summary, last_report_json (AnalysisReport), last_report_at, report_history_json (versioned reports array), updated_at

All complex data stored as JSON text columns with Pydantic serialization.

---

## Key Data Models (schemas.py)

**ContextData** — Interview-gathered product info:
- description, audience, geography, stage (idea|validation|mvp|growth|scale)
- price, paying_customers, big_job, pain_points[], current_solutions[]
- competitors_mentioned[], segment_hypotheses[], notes

**AnalysisReport** — Full analysis output:
- verdict (GO|GO_CONDITIONAL|PIVOT|NO_GO), verdict_condition, positioning
- main_insight, asymmetric_opportunity
- competitors[] (name, url, pricing, positioning, strengths, weaknesses, unmet_job)
- segments[] (Segment with jobs, TAM/SAM/SOM, unit_econ, scores, category A/B/C)
- top_risks[] (assumption, probability, impact, score, experiment)
- competitor_response, next_three_steps[], plan_90d[]

**Segment** — Market segment with scoring:
- Jobs: core_job, emotional_job, social_job, struggling_moment, switch_story
- Market: tam_usd, sam_usd, som_usd, tam_reasoning
- Scores: score_job_fit, score_market_size, score_economics, score_moat (0-100 each)
- total_score (weighted: job_fit*0.40 + market_size*0.25 + economics*0.25 + moat*0.10)
- category: A (>=70), B (50-69), C (<50)
- UnitEconomics: amppu, margin_pct, monthly_churn_pct, cac, ltv, ltv_cac, payback_months, health

---

## Core Business Flows

### 1. Interview (Intake)

`POST /projects/{id}/intake` -> `services/intake.py`

1. First empty message on empty history -> hardcoded greeting (no LLM call)
2. LLM receives: `skills/intake.md` system prompt + current ContextData + chat history + user message
3. LLM forced to call `update_context` tool -> returns updated fields + _completeness + _ready_for_analysis + _summary + _assistant_reply
4. Merges new context, saves to DB, returns assistant message + updated context
5. 4 critical questions asked one-by-one: description -> audience -> big_job -> geography
6. When completeness=1.0: summary generated, ready_for_analysis=true

### 2. Analysis Pipeline

`POST /projects/{id}/analyze` -> `services/analysis.py`

**Phase 1 — Market Research** (parallel Exa searches):
- 4 queries built from ContextData (competitors, market size, non-consumers, reviews)
- Exa returns search results; LLM extracts structured facts (competitors, trends, TAM reasoning)

**Phase 2 — Segmentation**:
- LLM generates 7-9 segments from market facts
- Must include "Non-consumers" segment
- Each segment: name, jobs (core/emotional/social), struggling_moment, TAM/SAM/SOM

**Phase 3 — Deep Dive** (parallel for top-5 segments):
- LLM scores each segment on 4 axes (job_fit, market_size, economics, moat) [0-100]
- Estimates unit economics (amppu, margin, churn, CAC)
- Python scoring: LTV = (amppu * margin%) / churn%; LTV/CAC; payback = CAC/amppu
- Gate: if LTV/CAC < 1 -> score = 0

**Phase 4 — Synthesis**:
- Verdict logic: GO (A-segment + LTV/CAC>3), GO_CONDITIONAL, PIVOT, NO_GO
- Generates: positioning, insight, opportunity, risks, competitor response, next steps, 90-day plan

Old report archived to report_history_json before saving new one.

### 3. Post-Report Discussion

After analysis, user can continue chatting (discussion mode) to ask questions about the report, update context, or re-run analysis (creates new version).

---

## API Endpoints Summary

```
POST   /auth/register              -> TokenResponse
POST   /auth/login                 -> TokenResponse
GET    /auth/me                    -> UserOut

POST   /projects/                  -> ProjectOut
GET    /projects/                  -> ProjectOut[]
GET    /projects/{id}              -> ProjectOut
DELETE /projects/{id}              -> 204 (soft delete)

GET    /projects/{id}/context      -> ProjectContextOut
GET    /projects/{id}/history      -> HistoryMessage[]
GET    /projects/{id}/report       -> AnalysisReport

POST   /projects/{id}/intake       -> IntakeTurnOut (interview turn)
POST   /projects/{id}/analyze      -> AnalysisReport (full pipeline, 1-3 min)

GET    /projects/{id}/report-versions     -> [{version, created_at}]
GET    /projects/{id}/report-versions/{v} -> AnalysisReport
```

---

## LLM Integration Details

- Client: `AsyncOpenAI` pointed at custom proxy
- Model: configurable via `LLM_MODEL` env var (currently `gpt-5.4`)
- Two calling patterns:
  - `complete_text(system, user)` — plain text response
  - `complete_with_tool(system, messages, tool_schema)` — forced tool_choice for structured JSON extraction
- Token pricing logged: $0.005/1K input, $0.015/1K output
- Skill prompts loaded from `backend/skills/*.md` at runtime

---

## Frontend Architecture

- SPA with 3 routes: `/login`, `/register`, `/chat` (protected)
- `Chat.tsx` is the main page: sidebar (project list) + main area (interview tab / report tab)
- Auth: JWT token stored in localStorage, injected via `apiFetch` wrapper
- API base: `VITE_API_BASE` env var (default `http://localhost:8000`)
- Mobile: sidebar becomes slide-in drawer
- Color scheme: blues (#1E40AF primary), emerald accents (#10a37f)
- Verdict colors: GO=emerald, GO_CONDITIONAL=amber, PIVOT=orange, NO_GO=red
- Segment categories: A=emerald, B=amber, C=neutral

---

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev  # port 5173

# Docker
docker compose up --build
```

---

## Key Design Decisions

- **JSON columns** instead of normalized tables for ContextData/Reports — flexibility over query power
- **Soft deletes** for projects (deleted_at timestamp)
- **Skill files** (.md) as system prompts — editable without code changes
- **Tool-based LLM output** — forces structured JSON via OpenAI tool_choice
- **Cold-start greeting** — first message returns hardcoded text, no LLM call
- **Report versioning** — old reports archived before overwrite
- **No migrations** — SQLAlchemy auto-creates tables; SQLite as dev database
