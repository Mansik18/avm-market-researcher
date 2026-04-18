"""Skill & knowledge loader — reads markdown files from disk on every call.

Skills live in backend/skills/, knowledge in backend/knowledge/.
No caching: edits apply without restart. ~10-30 KB per read, negligible.
"""
from pathlib import Path

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
