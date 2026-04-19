from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Float, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)


class ProjectContext(Base):
    __tablename__ = "project_contexts"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    # Structured product facts (ContextData JSON)
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    # Intake chat history as JSON list of {role, content, created_at}
    history_json: Mapped[str] = mapped_column(Text, default="[]")
    completeness: Mapped[float] = mapped_column(Float, default=0.0)
    ready_for_analysis: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    # Current active report (AnalysisReport JSON) — empty until analysis run
    last_report_json: Mapped[str] = mapped_column(Text, default="")
    last_report_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # All report versions: JSON array of {version, report, created_at}
    report_history_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    phase: Mapped[str] = mapped_column(String(80), default="")
    phase_detail: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PendingEdit(Base):
    """A change proposed by the agent that requires user approval before applying.

    Used in discussion mode: when the agent discovers new info that should update
    project context (e.g., user mentions "we now have 30 paying customers"),
    instead of silently merging, we stage it here and surface to UI for confirmation.
    """
    __tablename__ = "pending_edits"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    # "context" = ProjectContext.data_json field update
    # Future: "entity" = specific Entity row update
    target: Mapped[str] = mapped_column(String(40), default="context")
    # Field name being changed, e.g. "paying_customers" or "price"
    field: Mapped[str] = mapped_column(String(80))
    # JSON-serialized old value + new value for diff display
    old_value_json: Mapped[str] = mapped_column(Text, default="null")
    new_value_json: Mapped[str] = mapped_column(Text, default="null")
    # Why the agent wants this change (surfaces in UI)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending|approved|rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(300))
    rank: Mapped[int] = mapped_column(Integer, default=0)
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
