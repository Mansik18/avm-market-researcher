"""Intake chat endpoint — one dialogue turn at a time, scoped to a project."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Project, ProjectContext, User
from ..schemas import (
    ContextData,
    IntakeTurnIn,
    IntakeTurnOut,
    HistoryMessage,
    ProjectContextOut,
)
from ..services.intake import run_intake_turn
from ..services.llm import LLMClient

router = APIRouter(tags=["chat"])


def _owned(project_id: int, user: User, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
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


@router.post("/projects/{project_id}/intake", response_model=IntakeTurnOut)
async def intake_turn(
    project_id: int,
    payload: IntakeTurnIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, current_user, db)
    ctx = _get_or_create_context(project.id, db)

    history: list[dict] = json.loads(ctx.history_json or "[]")
    current_ctx = ContextData(**(json.loads(ctx.data_json) if ctx.data_json else {}))

    # Persist the user message up-front (unless it's the cold-start empty ping)
    user_text = payload.message.strip()
    now = datetime.utcnow()
    if user_text:
        history.append({
            "role": "user",
            "content": user_text,
            "created_at": now.isoformat(),
        })

    # Run the LLM turn. For the cold start (empty message on empty history)
    # run_intake_turn returns a hardcoded greeting without calling the LLM.
    result = await run_intake_turn(
        llm=LLMClient(),
        current_context=current_ctx,
        history=[
            {"role": m["role"], "content": m["content"]}
            for m in history
            if m["role"] in ("user", "assistant")
        ][:-1] if user_text else [],
        new_user_message=user_text,
        report_json=ctx.last_report_json or "",
    )

    assistant_msg = {
        "role": "assistant",
        "content": result.reply_text,
        "created_at": datetime.utcnow().isoformat(),
    }
    history.append(assistant_msg)

    # Persist updated context and history
    ctx.data_json = result.context.model_dump_json()
    ctx.history_json = json.dumps(history, ensure_ascii=False)
    ctx.completeness = result.completeness
    ctx.ready_for_analysis = result.ready_for_analysis
    if result.summary:
        ctx.summary = result.summary
    project.updated_at = datetime.utcnow()  # bump so projects list re-orders
    db.commit()
    db.refresh(ctx)

    return IntakeTurnOut(
        assistant_message=HistoryMessage(**assistant_msg),
        context=_context_out(ctx),
    )
