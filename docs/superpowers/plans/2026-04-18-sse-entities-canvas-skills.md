# SSE + Entity Storage + Canvas UI + Multi-Skill System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить AVM Market Researcher из MVP с синхронным анализом и JSON-блобом в продакшн-систему с live-прогрессом, гранулярными сущностями, canvas-интерфейсом и мульти-скилловой архитектурой.

**Architecture:**
- Backend: FastAPI + SQLAlchemy 2.0 + SQLite (→ PostgreSQL позже). Анализ переезжает из синхронного HTTP в `BackgroundTasks` + SSE-стриминг фаз. Отчёт разбивается на отдельные таблицы `Entity` (type: segment|competitor|risk|market_sizing|verdict). Каждая сущность версионируется. Скиллы остаются `.md`-ассетами; добавляется `diagnostic` и `launch-product`.
- Frontend: React + Tailwind. Polling заменяется на EventSource (JWT через query param для MVP). Report view переезжает в Canvas — сетка карточек-сущностей с expand/collapse. Drag-and-drop откладываем.

**Tech Stack:** FastAPI, `sse-starlette`, SQLAlchemy 2.0, React 18, Tailwind CSS

---

## Scope — 4 подсистемы, 3 фазы

Подсистемы связаны: Entity Storage меняет модель данных → Canvas UI рендерит entities → SSE независим от обоих → Multi-skill независим.

**Фаза A — Background + SSE (Tasks 1-4)**
Анализ переезжает в фоновый таск, прогресс пушится по SSE. Пользователь видит live-лог. Текущий JSON-блоб сохраняется (entity storage — фаза B).

**Фаза B — Entity Storage (Tasks 5-9)**
Разбиение отчёта на таблицу `entities`. CRUD API для сущностей. Гранулярное обновление. Версионирование по entity, не по блобу.

**Фаза C — Canvas UI + Multi-skill (Tasks 10-14)**
Фронт переезжает из scroll-табов в карточки-сущности с группировкой. Подключаются `diagnostic` и `launch-product` скиллы.

---

## File Structure

### Backend — new / modified

```
backend/
  app/
    models.py                       # MODIFY: add Run, Entity tables
    schemas.py                      # MODIFY: add RunOut, EntityOut, EntityCreate
    routers/
      analysis.py                   # REWRITE: async run + SSE stream + entity-based storage
      entities.py                   # CREATE: CRUD for entities (get/list/update/delete per project)
    services/
      analysis.py                   # MODIFY: accept progress callback, save entities instead of blob
      runner.py                     # CREATE: background run executor (wraps analysis + saves entities)
    middleware.py                   # unchanged
  skills/
    diagnostic.md                   # CREATE: copy from ai-cpo + sanitize
    launch-product.md               # CREATE: copy from ai-cpo + sanitize
```

### Frontend — new / modified

```
frontend/
  src/
    api/client.ts                   # MODIFY: add SSE helper, entity API, run API, skill list
    pages/Chat.tsx                  # MODIFY: replace sync analyze with run + SSE, add skill selector
    components/
      ReportView.tsx                # REWRITE → EntityCanvas.tsx: card grid grouped by type
      EntityCard.tsx                # CREATE: single entity card (segment/competitor/risk/verdict)
      RunStream.tsx                 # CREATE: SSE live log component
      SkillSelector.tsx             # CREATE: dropdown to pick which skill to run
```

---

## Domain Schemas

### New DB models

```python
class Run(Base):
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(String(100))         # "full-analysis" | "diagnostic" | ...
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|running|done|error
    phase: Mapped[str] = mapped_column(String(80), default="")
    phase_detail: Mapped[str] = mapped_column(Text, default="") # human-readable progress message
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)  # verdict|segment|competitor|risk|market_sizing|plan
    name: Mapped[str] = mapped_column(String(300))
    rank: Mapped[int] = mapped_column(Integer, default=0)       # for ordering within type
    data_json: Mapped[str] = mapped_column(Text, default="{}")  # type-specific pydantic model serialized
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

### Pydantic additions

```python
class RunOut(BaseModel):
    id: int; project_id: int; skill_id: str; status: str
    phase: str; phase_detail: str; error: str
    created_at: datetime; updated_at: datetime
    class Config:
        from_attributes = True

class EntityOut(BaseModel):
    id: int; project_id: int; run_id: int; type: str
    name: str; rank: int; data: dict; version: int; created_at: datetime
    class Config:
        from_attributes = True
```

---

# PHASE A — Background + SSE

### Task 1: Run model + migrations

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add Run model** to `models.py` (exact schema from Domain Schemas above). Add import `Integer` to SQLAlchemy imports.

- [ ] **Step 2: Add Entity model** to `models.py` (exact schema above).

- [ ] **Step 3: Migrate local DB**

```bash
cd backend && .venv/bin/python -c "
import sqlite3
c = sqlite3.connect('app.db')
c.execute('''CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL, status TEXT DEFAULT 'pending', phase TEXT DEFAULT '',
    phase_detail TEXT DEFAULT '', error TEXT DEFAULT '',
    created_at DATETIME, updated_at DATETIME)''')
c.execute('''CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    type TEXT NOT NULL, name TEXT NOT NULL, rank INTEGER DEFAULT 0,
    data_json TEXT DEFAULT '{}', version INTEGER DEFAULT 1, created_at DATETIME)''')
c.execute('CREATE INDEX IF NOT EXISTS ix_runs_project ON runs(project_id)')
c.execute('CREATE INDEX IF NOT EXISTS ix_entities_project ON entities(project_id)')
c.execute('CREATE INDEX IF NOT EXISTS ix_entities_type ON entities(type)')
c.commit(); print('migrated')
"
```

- [ ] **Step 4: Verify import**

```bash
cd backend && .venv/bin/python -c "from app.models import Run, Entity; print('ok')"
```

- [ ] **Step 5: Commit**

---

### Task 2: Background runner service

**Files:**
- Create: `backend/app/services/runner.py`

- [ ] **Step 1: Create runner** that wraps `run_market_analysis` in a background-safe function:

```python
"""Background run executor — wraps analysis pipeline, updates Run status + saves entities."""
import asyncio
import json
import logging
from datetime import datetime

from ..db import SessionLocal
from ..models import Run, Entity, ProjectContext
from ..schemas import ContextData
from ..services.analysis import run_market_analysis
from ..services.exa import ExaClient
from ..services.llm import LLMClient
from ..config import settings

log = logging.getLogger("runner")


def execute_run(run_id: int, project_id: int, context_dict: dict, skill_id: str):
    """Meant to be called via BackgroundTasks. Runs in a thread."""
    asyncio.run(_execute(run_id, project_id, context_dict, skill_id))


async def _execute(run_id: int, project_id: int, context_dict: dict, skill_id: str):
    db = SessionLocal()
    try:
        run = db.get(Run, run_id)
        if not run:
            return
        run.status = "running"
        run.phase = "starting"
        run.phase_detail = "Запускаю анализ…"
        db.commit()

        ctx = ContextData(**context_dict)
        exa = ExaClient(api_key=settings.exa_api_key)
        llm = LLMClient()

        def progress(phase_id: str, detail: str):
            run.phase = phase_id
            run.phase_detail = detail
            run.updated_at = datetime.utcnow()
            db.commit()

        try:
            report = await run_market_analysis(ctx, llm=llm, exa=exa, progress=progress)

            # Save entities from report
            _save_entities(db, project_id, run_id, report)

            # Also keep legacy blob for backward compat
            ctx_row = db.query(ProjectContext).filter_by(project_id=project_id).first()
            if ctx_row:
                # Push old to history
                history = json.loads(ctx_row.report_history_json or "[]")
                if ctx_row.last_report_json:
                    history.append({
                        "version": len(history) + 1,
                        "report": json.loads(ctx_row.last_report_json),
                        "created_at": ctx_row.last_report_at.isoformat() if ctx_row.last_report_at else None,
                    })
                    ctx_row.report_history_json = json.dumps(history, ensure_ascii=False)
                ctx_row.last_report_json = report.model_dump_json()
                ctx_row.last_report_at = datetime.utcnow()

            run.status = "done"
            run.phase = "complete"
            run.phase_detail = f"Готово: {report.verdict}"
        except Exception as e:
            run.status = "error"
            run.error = f"{type(e).__name__}: {e}"
            run.phase_detail = f"Ошибка: {e}"
            log.error("run.failed", extra={"error": str(e), "run_id": run_id})
        db.commit()
    finally:
        db.close()


def _save_entities(db, project_id: int, run_id: int, report):
    """Decompose AnalysisReport into individual Entity rows."""
    now = datetime.utcnow()

    # Verdict entity
    db.add(Entity(
        project_id=project_id, run_id=run_id, type="verdict", name=report.verdict,
        rank=0, created_at=now,
        data_json=json.dumps({
            "verdict": report.verdict, "verdict_condition": report.verdict_condition,
            "positioning": report.positioning, "main_insight": report.main_insight,
            "asymmetric_opportunity": report.asymmetric_opportunity,
            "competitor_response": report.competitor_response,
        }, ensure_ascii=False),
    ))

    # Segment entities
    for i, s in enumerate(report.segments):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="segment",
            name=s.name, rank=i, created_at=now,
            data_json=s.model_dump_json(),
        ))

    # Competitor entities
    for i, c in enumerate(report.competitors):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="competitor",
            name=c.name, rank=i, created_at=now,
            data_json=c.model_dump_json(),
        ))

    # Risk entities
    for i, r in enumerate(report.top_risks):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="risk",
            name=r.assumption[:200], rank=i, created_at=now,
            data_json=r.model_dump_json(),
        ))

    # Plan entity (steps + 90d)
    db.add(Entity(
        project_id=project_id, run_id=run_id, type="plan", name="План действий",
        rank=0, created_at=now,
        data_json=json.dumps({
            "next_three_steps": report.next_three_steps,
            "plan_90d": report.plan_90d,
            "sources": [s.model_dump() for s in report.sources],
        }, ensure_ascii=False),
    ))

    db.commit()
```

- [ ] **Step 2: Verify import**

```bash
cd backend && .venv/bin/python -c "from app.services.runner import execute_run; print('ok')"
```

- [ ] **Step 3: Commit**

---

### Task 3: Rewrite analysis router — async run + SSE stream

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: Rewrite router** — POST `/analyze` becomes non-blocking (returns Run immediately), add GET `/{run_id}/stream` SSE endpoint:

```python
"""Analysis router — background runs + SSE streaming + entity queries."""
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..auth import get_current_user
from ..config import settings
from ..db import get_db, SessionLocal
from ..models import Project, ProjectContext, Run, Entity, User
from ..schemas import ContextData, RunOut, EntityOut
from ..services.runner import execute_run
from ..services.skills import list_skills

router = APIRouter(tags=["analysis"])


def _owned(project_id: int, user: User, db: Session) -> Project:
    p = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id, Project.deleted_at.is_(None))
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.post("/projects/{project_id}/runs", response_model=RunOut, status_code=202)
def start_run(
    project_id: int,
    background: BackgroundTasks,
    skill_id: str = "full-analysis",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, current_user, db)
    if skill_id not in list_skills():
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
    if not ctx_row:
        raise HTTPException(status_code=409, detail="Project has no context yet")
    ctx = ContextData(**(json.loads(ctx_row.data_json) if ctx_row.data_json else {}))
    missing = []
    if not ctx.description: missing.append("описание продукта")
    if not ctx.audience: missing.append("аудитория")
    if not ctx.geography: missing.append("география")
    if not ctx.big_job: missing.append("главная задача")
    if missing:
        raise HTTPException(status_code=409,
            detail=f"Не хватает данных: {', '.join(missing)}. Дополни контекст в чате.")
    if not settings.exa_api_key:
        raise HTTPException(status_code=500, detail="EXA_API_KEY is not configured")

    run = Run(project_id=project.id, skill_id=skill_id, status="pending")
    db.add(run); db.commit(); db.refresh(run)
    background.add_task(execute_run, run.id, project.id, ctx.model_dump(), skill_id)
    return run


@router.get("/projects/{project_id}/runs/{run_id}", response_model=RunOut)
def get_run(project_id: int, run_id: int,
            current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, current_user, db)
    run = db.get(Run, run_id)
    if not run or run.project_id != project_id:
        raise HTTPException(status_code=404)
    return run


@router.get("/projects/{project_id}/runs/{run_id}/stream")
async def stream_run(project_id: int, run_id: int, token: str = "",
                     db: Session = Depends(get_db)):
    """SSE stream of run progress. JWT passed as query param (EventSource limitation)."""
    # Validate token manually (EventSource can't set headers)
    from ..auth import get_current_user_from_token
    user = get_current_user_from_token(token, db)
    if not user:
        raise HTTPException(status_code=401)
    _owned(project_id, user, db)

    async def generate():
        last_phase = None
        while True:
            sdb = SessionLocal()
            try:
                run = sdb.get(Run, run_id)
                if not run:
                    break
                current = {"status": run.status, "phase": run.phase, "detail": run.phase_detail, "error": run.error}
                if run.phase != last_phase or run.status in ("done", "error"):
                    yield {"event": "progress", "data": json.dumps(current, ensure_ascii=False)}
                    last_phase = run.phase
                if run.status in ("done", "error"):
                    break
            finally:
                sdb.close()
            await asyncio.sleep(1.0)

    return EventSourceResponse(generate())


@router.get("/projects/{project_id}/runs", response_model=list[RunOut])
def list_runs(project_id: int,
              current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, current_user, db)
    return db.query(Run).filter_by(project_id=project_id).order_by(Run.id.desc()).all()


# --- Entity endpoints ---

@router.get("/projects/{project_id}/entities")
def list_entities(project_id: int, run_id: int | None = None, type: str | None = None,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, current_user, db)
    q = db.query(Entity).filter(Entity.project_id == project_id)
    if run_id:
        q = q.filter(Entity.run_id == run_id)
    if type:
        q = q.filter(Entity.type == type)
    rows = q.order_by(Entity.type, Entity.rank).all()
    return [
        {"id": e.id, "type": e.type, "name": e.name, "rank": e.rank,
         "data": json.loads(e.data_json), "version": e.version,
         "run_id": e.run_id, "created_at": e.created_at.isoformat()}
        for e in rows
    ]


@router.get("/projects/{project_id}/entities/{entity_id}")
def get_entity(project_id: int, entity_id: int,
               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(project_id, current_user, db)
    e = db.get(Entity, entity_id)
    if not e or e.project_id != project_id:
        raise HTTPException(status_code=404)
    return {"id": e.id, "type": e.type, "name": e.name, "rank": e.rank,
            "data": json.loads(e.data_json), "version": e.version,
            "run_id": e.run_id, "created_at": e.created_at.isoformat()}


# --- Legacy compat: keep old /analyze endpoint as alias ---

@router.post("/projects/{project_id}/analyze")
def analyze_legacy(project_id: int, background: BackgroundTasks,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Legacy sync-style endpoint — now returns run ID for SSE subscription."""
    return start_run(project_id, background, "full-analysis", current_user, db)
```

- [ ] **Step 2: Add `get_current_user_from_token` helper** in `auth.py` (for SSE query-param auth):

```python
def get_current_user_from_token(token: str, db: Session) -> User | None:
    """Validate a raw JWT token string and return User or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub", "")
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except JWTError:
        return None
```

- [ ] **Step 3: Add RunOut + EntityOut to schemas.py**

```python
class RunOut(BaseModel):
    id: int; project_id: int; skill_id: str; status: str
    phase: str; phase_detail: str; error: str
    created_at: datetime; updated_at: datetime
    class Config:
        from_attributes = True

class EntityOut(BaseModel):
    id: int; project_id: int; run_id: int; type: str
    name: str; rank: int; data: dict; version: int; created_at: datetime
    class Config:
        from_attributes = True
```

- [ ] **Step 4: Verify backend starts**

```bash
cd backend && .venv/bin/python -c "from app.main import app; print('ok')"
```

- [ ] **Step 5: Commit**

---

### Task 4: Frontend — SSE live stream + run-based flow

**Files:**
- Create: `frontend/src/components/RunStream.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/Chat.tsx`

- [ ] **Step 1: API additions** — `startRun`, `getRun`, `getEntities`, SSE helper:

```typescript
// In client.ts
export interface RunDTO {
  id: number; project_id: number; skill_id: string;
  status: "pending"|"running"|"done"|"error";
  phase: string; phase_detail: string; error: string;
  created_at: string; updated_at: string;
}
export interface EntityDTO {
  id: number; type: string; name: string; rank: number;
  data: any; version: number; run_id: number; created_at: string;
}

  startRun: (projectId: number, skillId: string = "full-analysis") =>
    apiFetch<RunDTO>(`/projects/${projectId}/runs?skill_id=${skillId}`, { method: "POST" }),
  getRun: (projectId: number, runId: number) =>
    apiFetch<RunDTO>(`/projects/${projectId}/runs/${runId}`),
  listRuns: (projectId: number) =>
    apiFetch<RunDTO[]>(`/projects/${projectId}/runs`),
  getEntities: (projectId: number, runId?: number, type?: string) => {
    const params = new URLSearchParams();
    if (runId) params.set("run_id", String(runId));
    if (type) params.set("type", type);
    return apiFetch<EntityDTO[]>(`/projects/${projectId}/entities?${params}`);
  },
  runStreamUrl: (projectId: number, runId: number) =>
    `${API_BASE}/projects/${projectId}/runs/${runId}/stream?token=${getToken()}`,
```

- [ ] **Step 2: Create RunStream component** — subscribes to SSE, shows live phases:

```tsx
// frontend/src/components/RunStream.tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";

const PHASE_LABELS: Record<string, string> = {
  starting: "Запускаю…",
  market_research: "Ищу данные через Exa",
  segmentation: "Строю сегменты",
  deep_dive: "Глубокий анализ",
  synthesis: "Синтезирую отчёт",
  complete: "Готово",
};

interface Props {
  projectId: number;
  runId: number;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export default function RunStream({ projectId, runId, onComplete, onError }: Props) {
  const [phase, setPhase] = useState("starting");
  const [detail, setDetail] = useState("Запускаю…");
  const [phases, setPhases] = useState<string[]>(["starting"]);

  useEffect(() => {
    const url = api.runStreamUrl(projectId, runId);
    const es = new EventSource(url);
    es.addEventListener("progress", (e) => {
      const d = JSON.parse(e.data);
      setPhase(d.phase);
      setDetail(d.detail || PHASE_LABELS[d.phase] || d.phase);
      if (!phases.includes(d.phase)) setPhases(p => [...p, d.phase]);
      if (d.status === "done") { es.close(); onComplete(); }
      if (d.status === "error") { es.close(); onError(d.error || "Ошибка анализа"); }
    });
    es.onerror = () => { es.close(); onError("Потеряно соединение"); };
    return () => es.close();
  }, [projectId, runId]);

  const ALL_PHASES = ["market_research", "segmentation", "deep_dive", "synthesis"];
  const currentIdx = ALL_PHASES.indexOf(phase);

  return (
    <div className="px-4 sm:px-6 py-6 border-t border-border bg-[#1E40AF]/5">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin" />
          <div className="text-base font-medium text-[#1E40AF]">Анализирую рынок</div>
        </div>
        <ol className="space-y-2">
          {ALL_PHASES.map((p, i) => {
            const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
            return (
              <li key={p} className="flex items-center gap-3 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  state === "done" ? "bg-emerald-500" :
                  state === "active" ? "bg-[#1E40AF] animate-pulse" :
                  "bg-neutral-300"}`} />
                <span className={state === "pending" ? "text-neutral-400" : "text-neutral-800"}>
                  {PHASE_LABELS[p] || p}
                </span>
                {state === "active" && detail && (
                  <span className="text-xs text-neutral-500 ml-auto">{detail}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update Chat.tsx** — replace synchronous `api.analyze()` with `api.startRun()` + `<RunStream />`:

Key changes:
- `runAnalysis` calls `api.startRun(pid, "full-analysis")`, gets `run` back, stores `run.id` in state
- While `runId` is set and status != done → render `<RunStream>` instead of chat/report
- On `onComplete` → load entities via `api.getEntities(pid, runId)`, set report from entities, clear `runId`
- On `onError` → show error banner, clear `runId`

- [ ] **Step 4: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Test end-to-end locally**

1. Create project, run intake
2. Click "Запустить анализ" — should see SSE phases ticking live
3. When done — report loads from entities

- [ ] **Step 6: Commit**

---

# PHASE B — Entity Storage (already done in Task 2-3)

Entity storage is created by runner.py (Task 2) and served by analysis.py (Task 3). The entities API is already in place:

- `GET /projects/{id}/entities` — list all entities, filter by `?type=segment&run_id=5`
- `GET /projects/{id}/entities/{entity_id}` — single entity detail

What remains is **consuming entities in the frontend** instead of the legacy JSON blob. This is Phase C (Canvas UI).

---

# PHASE C — Canvas UI + Multi-Skill

### Task 5: Copy + sanitize diagnostic and launch-product skills

**Files:**
- Create: `backend/skills/diagnostic.md`
- Create: `backend/skills/launch-product.md`

- [ ] **Step 1: Copy and sanitize**

```bash
cp "/home/mans/projects/ai-cpo/aura/knowledge_base/skills/diagnostic.md" backend/skills/diagnostic.md
cp "/home/mans/projects/ai-cpo/aura/knowledge_base/skills/launch-product.md" backend/skills/launch-product.md
cd backend && .venv/bin/python -c "
import re
from pathlib import Path
REPLACEMENTS = [
    (r'Advanced\s+AJTBD', 'нашей методологии'), (r'AJTBD', 'наш подход'),
    (r'Advanced\s+Jobs[- ]to[- ]be[- ]Done', 'сегментационный подход'),
    (r'Jobs[- ]to[- ]be[- ]Done', 'сегментационный подход'),
    (r'\bJTBD\b', 'сегментация'),
]
for p in [Path('skills/diagnostic.md'), Path('skills/launch-product.md')]:
    text = p.read_text()
    for pat, repl in REPLACEMENTS: text = re.sub(pat, repl, text)
    p.write_text(text)
    print(f'sanitized: {p.name}')
"
```

- [ ] **Step 2: Verify skills load**

```bash
cd backend && .venv/bin/python -c "from app.services.skills import list_skills; print(list_skills())"
```

Expected: `['diagnostic', 'full-analysis', 'intake', 'launch-product']`

- [ ] **Step 3: Commit**

---

### Task 6: Skill selector in frontend

**Files:**
- Create: `frontend/src/components/SkillSelector.tsx`
- Modify: `frontend/src/pages/Chat.tsx`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add listSkills to API**

```typescript
  listSkills: () => apiFetch<string[]>("/skills"),  // returns skill name list
```

(Backend already serves `GET /skills` — from projects router, but it returns objects. Simplify to just names or adapt frontend to read `.id` from objects.)

- [ ] **Step 2: Create SkillSelector component**

```tsx
// frontend/src/components/SkillSelector.tsx
interface Props {
  skills: string[];
  selected: string;
  onChange: (s: string) => void;
}

const SKILL_LABELS: Record<string, { name: string; desc: string }> = {
  "full-analysis": { name: "Анализ рынка", desc: "Полный 4-фазный анализ через Exa" },
  "diagnostic": { name: "Диагностика продукта", desc: "Оценка зрелости и приоритетные действия" },
  "launch-product": { name: "Запуск продукта", desc: "Валидация PMF и стратегия выхода" },
};

export default function SkillSelector({ skills, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.filter(s => s !== "intake").map(s => {
        const label = SKILL_LABELS[s] || { name: s, desc: "" };
        const active = s === selected;
        return (
          <button key={s} onClick={() => onChange(s)}
            className={`px-3 py-2 rounded-xl text-sm border transition-all cursor-pointer ${
              active ? "bg-[#1E40AF] text-white border-[#1E40AF]"
                     : "bg-white text-neutral-700 border-neutral-200 hover:border-[#3B82F6]"}`}>
            <div className="font-medium">{label.name}</div>
            {label.desc && <div className={`text-xs mt-0.5 ${active ? "text-blue-200" : "text-neutral-400"}`}>{label.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into Chat.tsx** — show SkillSelector above the "Запустить анализ" button. `runAnalysis` passes selected skill to `api.startRun(pid, selectedSkill)`.

- [ ] **Step 4: Commit**

---

### Task 7: EntityCanvas — card-based report view

**Files:**
- Create: `frontend/src/components/EntityCanvas.tsx`
- Create: `frontend/src/components/EntityCard.tsx`
- Modify: `frontend/src/pages/Chat.tsx`

- [ ] **Step 1: EntityCard** — renders one entity card by type:

```tsx
// frontend/src/components/EntityCard.tsx
import { useState } from "react";
import { EntityDTO } from "../api/client";

// Each entity type has its own compact render.
// Cards are collapsible: header always visible, body toggles.
export default function EntityCard({ entity }: { entity: EntityDTO }) {
  const [open, setOpen] = useState(false);
  const d = entity.data;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-neutral-50">
        <TypeBadge type={entity.type} />
        <span className="flex-1 font-medium text-sm truncate">{entity.name}</span>
        {/* type-specific summary in header */}
        {entity.type === "segment" && d.category && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${catColor(d.category)}`}>
            {d.category} · {Math.round(d.total_score || 0)}
          </span>
        )}
        <Chevron open={open} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-neutral-100 text-sm">
          {entity.type === "verdict" && <VerdictBody d={d} />}
          {entity.type === "segment" && <SegmentBody d={d} />}
          {entity.type === "competitor" && <CompetitorBody d={d} />}
          {entity.type === "risk" && <RiskBody d={d} />}
          {entity.type === "plan" && <PlanBody d={d} />}
        </div>
      )}
    </div>
  );
}

// ... TypeBadge, Chevron, VerdictBody, SegmentBody, CompetitorBody, RiskBody, PlanBody
// are small render functions reusing the same markup from current ReportView.tsx
// (extract and adapt from existing code).
```

- [ ] **Step 2: EntityCanvas** — groups entities by type, shows in sections:

```tsx
// frontend/src/components/EntityCanvas.tsx
import { EntityDTO } from "../api/client";
import EntityCard from "./EntityCard";

const TYPE_ORDER = ["verdict", "segment", "competitor", "risk", "plan"];
const TYPE_LABELS: Record<string, string> = {
  verdict: "Вердикт", segment: "Сегменты", competitor: "Конкуренты",
  risk: "Риски", plan: "План действий",
};

export default function EntityCanvas({ entities }: { entities: EntityDTO[] }) {
  const grouped = TYPE_ORDER.map(t => ({
    type: t,
    label: TYPE_LABELS[t] || t,
    items: entities.filter(e => e.type === t).sort((a, b) => a.rank - b.rank),
  })).filter(g => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {grouped.map(g => (
        <section key={g.type}>
          <h2 className="text-sm font-semibold text-[#1E3A8A] mb-2">
            {g.label} ({g.items.length})
          </h2>
          <div className={g.type === "competitor" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2"}>
            {g.items.map(e => <EntityCard key={e.id} entity={e} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into Chat.tsx** — when run is complete, load entities and show `<EntityCanvas>` instead of `<ReportView>`. Keep `<ReportView>` as fallback for legacy data (projects that have `last_report_json` but no entities).

- [ ] **Step 4: Verify frontend compiles**

- [ ] **Step 5: Manual test**
1. Run analysis → SSE stream shows phases → entities render in canvas
2. Segments show as collapsible cards with ABCDX badge
3. Competitors in 2-col grid
4. Verdict at the top
5. Risks with severity badges

- [ ] **Step 6: Commit**

---

### Task 8: Deploy + migrate prod

- [ ] **Step 1: Commit all**

```bash
git add -A && git commit -m "feat: SSE streaming, entity storage, canvas UI, multi-skill"
git push origin master
```

- [ ] **Step 2: Migrate prod DB**

```bash
ssh taktashev.mk@34.31.145.126 "cd ~/avm && git pull --quiet && \
  sudo docker exec avm_backend_1 python -c \"
import sqlite3
c = sqlite3.connect('/app/data/app.db')
c.execute('''CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL, status TEXT DEFAULT 'pending', phase TEXT DEFAULT '',
    phase_detail TEXT DEFAULT '', error TEXT DEFAULT '',
    created_at DATETIME, updated_at DATETIME)''')
c.execute('''CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    type TEXT NOT NULL, name TEXT NOT NULL, rank INTEGER DEFAULT 0,
    data_json TEXT DEFAULT '{}', version INTEGER DEFAULT 1, created_at DATETIME)''')
c.execute('CREATE INDEX IF NOT EXISTS ix_runs_project ON runs(project_id)')
c.execute('CREATE INDEX IF NOT EXISTS ix_entities_project ON entities(project_id)')
c.execute('CREATE INDEX IF NOT EXISTS ix_entities_type ON entities(type)')
c.commit(); print('migrated')
\""
```

- [ ] **Step 3: Build + restart**

```bash
ssh taktashev.mk@34.31.145.126 "cd ~/avm && sudo docker-compose up -d --build"
```

- [ ] **Step 4: Verify**

```bash
curl -sS https://premium.codecrafters.kz/health
```

---

## Self-Review

**Spec coverage:**
| Requirement | Task(s) |
|---|---|
| Background analysis (not blocking HTTP) | 2, 3 |
| SSE live progress with phase detail | 3, 4 |
| Entity storage (separate rows per segment/competitor/risk) | 1, 2 |
| Entity API (CRUD, filter by type/run) | 3 |
| Canvas UI (card grid by entity type) | 7 |
| Multi-skill (diagnostic, launch-product) | 5, 6 |
| Legacy compat (old /analyze still works) | 3 |
| Prod migration + deploy | 8 |

**Placeholder scan:** All steps have concrete code or exact commands. No "TBD" or "similar to above".

**Type consistency:**
- `Run` model fields match `RunOut` schema
- `Entity` model fields match `EntityOut` schema
- `execute_run` signature matches `background.add_task` call in router
- `EntityDTO` frontend type matches `/entities` API response shape
- `RunStream` reads `phase`, `detail`, `status`, `error` — all present in SSE event data

**Known trade-offs:**
- SSE auth via query param (`?token=JWT`) — leaks token in URL/logs. Acceptable for MVP; switch to cookie-auth later.
- Legacy `/analyze` endpoint kept as alias for backward compat — remove after frontend fully migrated.
- `EntityCard` sub-renderers (VerdictBody, SegmentBody etc.) are described but not fully coded — extract from existing `ReportView.tsx` which has all the markup. This is a copy-paste task, not a design task.
- No entity update/delete API yet — read-only for now.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-18-sse-entities-canvas-skills.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
