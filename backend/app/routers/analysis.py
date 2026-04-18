"""Analysis router — background runs + SSE streaming + entity queries + legacy compat."""
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..auth import get_current_user, get_current_user_from_token
from ..config import settings
from ..db import get_db, SessionLocal
from ..models import Project, ProjectContext, Run, Entity, User
from ..schemas import ContextData, RunOut
from ..services.runner import execute_run

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


def _preflight(ctx: ContextData) -> list[str]:
    missing = []
    if not ctx.description:
        missing.append("описание продукта")
    if not ctx.audience:
        missing.append("аудитория")
    if not ctx.geography:
        missing.append("география")
    if not ctx.big_job:
        missing.append("главная задача")
    return missing


# ---------- Runs ----------

@router.post("/projects/{project_id}/runs", response_model=RunOut, status_code=202)
def start_run(
    project_id: int,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, current_user, db)
    ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
    if not ctx_row:
        raise HTTPException(status_code=409, detail="Project has no context yet")
    ctx = ContextData(**(json.loads(ctx_row.data_json) if ctx_row.data_json else {}))
    missing = _preflight(ctx)
    if missing:
        raise HTTPException(status_code=409,
                            detail=f"Не хватает данных: {', '.join(missing)}. Дополни контекст в чате.")
    if not settings.exa_api_key:
        raise HTTPException(status_code=500, detail="EXA_API_KEY is not configured")

    run = Run(project_id=project.id, skill_id="full-analysis", status="pending",
              created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)
    background.add_task(execute_run, run.id, project.id, ctx.model_dump(), "full-analysis")
    return run


@router.get("/projects/{project_id}/runs/{run_id}", response_model=RunOut)
def get_run(
    project_id: int,
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    run = db.get(Run, run_id)
    if not run or run.project_id != project_id:
        raise HTTPException(status_code=404)
    return run


@router.get("/projects/{project_id}/runs/{run_id}/stream")
async def stream_run(
    project_id: int,
    run_id: int,
    token: str = "",
    db: Session = Depends(get_db),
):
    """SSE stream of run progress. JWT passed as ?token= (EventSource can't set headers)."""
    user = get_current_user_from_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    _owned(project_id, user, db)

    async def generate():
        last_phase = None
        while True:
            sdb = SessionLocal()
            try:
                run = sdb.get(Run, run_id)
                if not run:
                    break
                current = {
                    "status": run.status,
                    "phase": run.phase,
                    "detail": run.phase_detail,
                    "error": run.error,
                }
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
def list_runs(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    return db.query(Run).filter_by(project_id=project_id).order_by(Run.id.desc()).all()


# ---------- Entities ----------

@router.get("/projects/{project_id}/entities")
def list_entities(
    project_id: int,
    run_id: int | None = None,
    type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    q = db.query(Entity).filter(Entity.project_id == project_id)
    if run_id:
        q = q.filter(Entity.run_id == run_id)
    if type:
        q = q.filter(Entity.type == type)
    rows = q.order_by(Entity.type, Entity.rank).all()
    return [
        {
            "id": e.id, "type": e.type, "name": e.name, "rank": e.rank,
            "data": json.loads(e.data_json), "version": e.version,
            "run_id": e.run_id, "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in rows
    ]


@router.get("/projects/{project_id}/entities/{entity_id}")
def get_entity(
    project_id: int,
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    e = db.get(Entity, entity_id)
    if not e or e.project_id != project_id:
        raise HTTPException(status_code=404)
    return {
        "id": e.id, "type": e.type, "name": e.name, "rank": e.rank,
        "data": json.loads(e.data_json), "version": e.version,
        "run_id": e.run_id, "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ---------- Legacy compat ----------

@router.post("/projects/{project_id}/analyze", response_model=RunOut, status_code=202)
def analyze_legacy(
    project_id: int,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Legacy endpoint — now returns Run for SSE subscription."""
    return start_run(project_id, background, current_user, db)


@router.get("/projects/{project_id}/report-versions")
def get_report_versions(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    ctx = db.query(ProjectContext).filter_by(project_id=project_id).first()
    if not ctx:
        return {"versions": []}
    history: list = json.loads(ctx.report_history_json or "[]")
    versions = []
    for h in history:
        versions.append({"version": h["version"], "created_at": h.get("created_at")})
    if ctx.last_report_json:
        versions.append({
            "version": len(history) + 1,
            "created_at": ctx.last_report_at.isoformat() if ctx.last_report_at else None,
            "current": True,
        })
    return {"versions": versions}


@router.get("/projects/{project_id}/report-versions/{version}")
def get_report_version(
    project_id: int,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    ctx = db.query(ProjectContext).filter_by(project_id=project_id).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="No reports")
    history: list = json.loads(ctx.report_history_json or "[]")
    current_version = len(history) + 1
    if version == current_version and ctx.last_report_json:
        return json.loads(ctx.last_report_json)
    for h in history:
        if h["version"] == version:
            return h["report"]
    raise HTTPException(status_code=404, detail="Version not found")
