"""Market analysis endpoint with report versioning."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import Project, ProjectContext, User
from ..schemas import AnalysisReport, ContextData
from ..services.analysis import run_market_analysis
from ..services.exa import ExaClient
from ..services.llm import LLMClient

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


@router.post("/projects/{project_id}/analyze", response_model=AnalysisReport)
async def analyze(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, current_user, db)
    ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
    if not ctx_row:
        raise HTTPException(status_code=409, detail="Project has no context yet")
    ctx = ContextData(**(json.loads(ctx_row.data_json) if ctx_row.data_json else {}))
    # Pre-flight: check critical fields
    missing: list[str] = []
    if not ctx.description:
        missing.append("описание продукта")
    if not ctx.audience:
        missing.append("аудитория")
    if not ctx.geography:
        missing.append("география рынка")
    if not ctx.big_job:
        missing.append("главная задача/боль")
    if missing:
        raise HTTPException(
            status_code=409,
            detail=f"Не хватает данных для запуска анализа: {', '.join(missing)}. Дополни контекст в чате.",
        )
    if not settings.exa_api_key:
        raise HTTPException(status_code=500, detail="EXA_API_KEY is not configured on the server")

    try:
        report = await run_market_analysis(
            ctx,
            llm=LLMClient(),
            exa=ExaClient(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {type(e).__name__}: {e}")

    # Push old report to history (if exists)
    history: list = json.loads(ctx_row.report_history_json or "[]")
    if ctx_row.last_report_json:
        old_version = len(history) + 1
        history.append({
            "version": old_version,
            "report": json.loads(ctx_row.last_report_json),
            "created_at": ctx_row.last_report_at.isoformat() if ctx_row.last_report_at else None,
        })
        ctx_row.report_history_json = json.dumps(history, ensure_ascii=False)

    # Save new report as current
    ctx_row.last_report_json = report.model_dump_json()
    ctx_row.last_report_at = datetime.utcnow()
    db.commit()

    return report


@router.get("/projects/{project_id}/report-versions")
def get_report_versions(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns list of all report versions including current."""
    _owned(project_id, current_user, db)
    ctx = db.query(ProjectContext).filter_by(project_id=project_id).first()
    if not ctx:
        return {"versions": []}

    history: list = json.loads(ctx.report_history_json or "[]")
    versions = []
    for h in history:
        versions.append({
            "version": h["version"],
            "created_at": h.get("created_at"),
        })
    # Add current as latest version
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
    """Returns a specific report version."""
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
