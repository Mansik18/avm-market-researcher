"""Skill & knowledge loader — reads markdown + YAML config files on every call.

Skills live in backend/skills/, knowledge in backend/knowledge/.
No caching: edits apply without restart. ~10-30 KB per read, negligible.

Each skill may have an optional `<skill>.queries.yaml` alongside it that
defines Exa search queries (multi-language, templated).
"""
from pathlib import Path
import yaml

_SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"
_KNOWLEDGE_DIR = Path(__file__).resolve().parents[2] / "knowledge"


def load_skill(name: str) -> str:
    """Return the full markdown body of a skill by filename stem (without .md)."""
    path = _SKILLS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Skill not found: {path}")
    return path.read_text()


def load_knowledge(*names: str) -> str:
    """Load and concatenate one or more knowledge files.
    Returns them joined with separators for the LLM system prompt."""
    parts: list[str] = []
    for name in names:
        path = _KNOWLEDGE_DIR / f"{name}.md"
        if path.exists():
            parts.append(f"# Knowledge: {name}\n\n{path.read_text()}")
    return "\n\n---\n\n".join(parts)


def list_skills() -> list[str]:
    return sorted(p.stem for p in _SKILLS_DIR.glob("*.md"))


def list_knowledge() -> list[str]:
    return sorted(p.stem for p in _KNOWLEDGE_DIR.glob("*.md"))


def load_skill_queries(name: str) -> dict:
    """Return the parsed YAML query config for a skill, or {} if none exists."""
    path = _SKILLS_DIR / f"{name}.queries.yaml"
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text()) or {}


def render_query_group(
    queries_config: dict,
    group: str,
    lang: str,
    **context,
) -> list[str]:
    """Render a named query group (e.g. 'market_research') for given language
    with context variables. Missing placeholders render as empty string.

    Returns [] if group/lang is missing.
    """
    group_cfg = queries_config.get(group, {}) or {}
    templates = group_cfg.get(lang, [])
    if isinstance(templates, str):
        templates = [templates]
    out: list[str] = []
    for tpl in templates:
        try:
            out.append(tpl.format_map(_SafeDict(context)))
        except Exception:
            out.append(tpl)
    return out


class _SafeDict(dict):
    def __missing__(self, key):
        return ""
