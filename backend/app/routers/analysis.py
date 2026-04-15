"""Market analysis endpoint — synchronous, ~1-3 minutes per call."""
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
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
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
    # Minimum viable context check — we need at least a description and audience
    if not ctx.description or not ctx.audience:
        raise HTTPException(
            status_code=409,
            detail="Project context is incomplete — intake interview must provide at least description and audience",
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

    # Persist as project's last report
    ctx_row.last_report_json = report.model_dump_json()
    ctx_row.last_report_at = datetime.utcnow()
    db.commit()

    return report
