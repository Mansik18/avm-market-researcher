"""Projects CRUD and context/report endpoints."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Project, ProjectContext, User
from ..schemas import (
    ContextData,
    ProjectCreate,
    ProjectOut,
    ProjectContextOut,
    AnalysisReport,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _owned(project_id: int, user: User, db: Session) -> Project:
    p = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id, Project.deleted_at.is_(None))
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _get_or_create_context(project_id: int, db: Session) -> ProjectContext:
    ctx = db.query(ProjectContext).filter_by(project_id=project_id).first()
    if ctx:
        return ctx
    ctx = ProjectContext(project_id=project_id, data_json="{}", history_json="[]")
    db.add(ctx)
    db.commit()
    db.refresh(ctx)
    return ctx


def _context_out(ctx: ProjectContext) -> ProjectContextOut:
    data = ContextData(**(json.loads(ctx.data_json) if ctx.data_json else {}))
    return ProjectContextOut(
        project_id=ctx.project_id,
        data=data,
        completeness=ctx.completeness,
        ready_for_analysis=ctx.ready_for_analysis,
        summary=ctx.summary,
        has_report=bool(ctx.last_report_json),
        last_report_at=ctx.last_report_at,
        updated_at=ctx.updated_at,
    )


@router.post("/", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = Project(user_id=current_user.id, name=payload.name.strip())
    db.add(p)
    db.commit()
    db.refresh(p)
    _get_or_create_context(p.id, db)
    return p


@router.get("/", response_model=list[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Project)
        .filter(Project.user_id == current_user.id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
        .all()
    )


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _owned(project_id, current_user, db)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = _owned(project_id, current_user, db)
    p.deleted_at = datetime.utcnow()
    db.commit()


@router.get("/{project_id}/context", response_model=ProjectContextOut)
def get_context(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    ctx = _get_or_create_context(project_id, db)
    return _context_out(ctx)


@router.get("/{project_id}/history")
def get_history(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    ctx = _get_or_create_context(project_id, db)
    return {"messages": json.loads(ctx.history_json or "[]")}


@router.get("/{project_id}/report", response_model=AnalysisReport)
def get_report(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    ctx = _get_or_create_context(project_id, db)
    if not ctx.last_report_json:
        raise HTTPException(status_code=404, detail="No analysis report yet")
    return AnalysisReport(**json.loads(ctx.last_report_json))
