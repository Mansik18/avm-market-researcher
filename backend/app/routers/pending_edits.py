"""Pending edits — agent-proposed changes awaiting user approval."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import PendingEdit, Project, ProjectContext, User
from ..schemas import ContextData, PendingEditOut

router = APIRouter(tags=["pending-edits"])


def _owned(project_id: int, user: User, db: Session) -> Project:
    p = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id, Project.deleted_at.is_(None))
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _to_out(edit: PendingEdit) -> PendingEditOut:
    return PendingEditOut(
        id=edit.id,
        project_id=edit.project_id,
        target=edit.target,
        field=edit.field,
        old_value=json.loads(edit.old_value_json or "null"),
        new_value=json.loads(edit.new_value_json or "null"),
        reason=edit.reason,
        status=edit.status,
        created_at=edit.created_at,
        resolved_at=edit.resolved_at,
    )


@router.get("/projects/{project_id}/pending-edits", response_model=list[PendingEditOut])
def list_pending_edits(
    project_id: int,
    status: str = "pending",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    q = db.query(PendingEdit).filter(PendingEdit.project_id == project_id)
    if status != "all":
        q = q.filter(PendingEdit.status == status)
    return [_to_out(e) for e in q.order_by(PendingEdit.id.desc()).all()]


@router.post("/projects/{project_id}/pending-edits/{edit_id}/approve", response_model=PendingEditOut)
def approve_edit(
    project_id: int,
    edit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, current_user, db)
    edit = db.get(PendingEdit, edit_id)
    if not edit or edit.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edit not found")
    if edit.status != "pending":
        raise HTTPException(status_code=409, detail=f"Edit is already {edit.status}")

    # Apply the change
    if edit.target == "context":
        ctx_row = db.query(ProjectContext).filter_by(project_id=project.id).first()
        if ctx_row:
            data = json.loads(ctx_row.data_json or "{}")
            data[edit.field] = json.loads(edit.new_value_json or "null")
            ctx_row.data_json = json.dumps(data, ensure_ascii=False)
            # Rebuild typed ContextData to validate
            try:
                ContextData(**data)
            except Exception:
                pass  # permissive — user approved, write as-is
    # Future: target == "entity" — apply to entities table

    edit.status = "approved"
    edit.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(edit)
    return _to_out(edit)


@router.post("/projects/{project_id}/pending-edits/{edit_id}/reject", response_model=PendingEditOut)
def reject_edit(
    project_id: int,
    edit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned(project_id, current_user, db)
    edit = db.get(PendingEdit, edit_id)
    if not edit or edit.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edit not found")
    if edit.status != "pending":
        raise HTTPException(status_code=409, detail=f"Edit is already {edit.status}")
    edit.status = "rejected"
    edit.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(edit)
    return _to_out(edit)
