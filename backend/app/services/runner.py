"""Background run executor — wraps analysis pipeline, updates Run rows, saves entities."""
import asyncio
import json
import logging
from datetime import datetime

from ..config import settings
from ..db import SessionLocal
from ..models import Run, Entity, ProjectContext
from ..schemas import ContextData
from ..services.analysis import run_market_analysis
from ..services.exa import ExaClient
from ..services.llm import LLMClient

log = logging.getLogger("runner")


def execute_run(run_id: int, project_id: int, context_dict: dict, skill_id: str):
    """Called via BackgroundTasks — runs in a thread."""
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
        run.updated_at = datetime.utcnow()
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

            # Save entities
            _save_entities(db, project_id, run_id, report)

            # Legacy blob compat
            ctx_row = db.query(ProjectContext).filter_by(project_id=project_id).first()
            if ctx_row:
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
            log.info("run.complete", extra={"run_id": run_id, "phase": "complete"})
        except Exception as e:
            run.status = "error"
            run.error = f"{type(e).__name__}: {e}"
            run.phase_detail = f"Ошибка: {e}"
            log.error("run.failed", extra={"error": str(e), "run_id": run_id})

        run.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def _save_entities(db, project_id: int, run_id: int, report):
    now = datetime.utcnow()

    # Verdict
    db.add(Entity(
        project_id=project_id, run_id=run_id, type="verdict",
        name=report.verdict, rank=0, created_at=now,
        data_json=json.dumps({
            "verdict": report.verdict,
            "verdict_condition": report.verdict_condition,
            "positioning": report.positioning,
            "main_insight": report.main_insight,
            "asymmetric_opportunity": report.asymmetric_opportunity,
            "competitor_response": report.competitor_response,
        }, ensure_ascii=False),
    ))

    # Segments
    for i, s in enumerate(report.segments):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="segment",
            name=s.name, rank=i, created_at=now,
            data_json=s.model_dump_json(),
        ))

    # Competitors
    for i, c in enumerate(report.competitors):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="competitor",
            name=c.name, rank=i, created_at=now,
            data_json=c.model_dump_json(),
        ))

    # Risks
    for i, r in enumerate(report.top_risks):
        db.add(Entity(
            project_id=project_id, run_id=run_id, type="risk",
            name=r.assumption[:200], rank=i, created_at=now,
            data_json=r.model_dump_json(),
        ))

    # Plan
    db.add(Entity(
        project_id=project_id, run_id=run_id, type="plan",
        name="План действий", rank=0, created_at=now,
        data_json=json.dumps({
            "next_three_steps": report.next_three_steps,
            "plan_90d": report.plan_90d,
            "sources": [s.model_dump() for s in report.sources],
        }, ensure_ascii=False),
    ))

    db.commit()
