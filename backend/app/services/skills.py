"""Tiny skill loader — reads markdown skill files from disk on every call.

Skills are plain markdown. No frontmatter, no agents, no registry abstractions —
just files with rules for the LLM. No caching: we read the file every time so
edits to `.md` apply without a backend restart. Cheap, ~10 KB per read.
"""
from pathlib import Path

_SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"


def load_skill(name: str) -> str:
    """Return the full markdown body of a skill by filename stem (without .md)."""
    path = _SKILLS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Skill not found: {path}")
    return path.read_text()


def list_skills() -> list[str]:
    return sorted(p.stem for p in _SKILLS_DIR.glob("*.md"))
