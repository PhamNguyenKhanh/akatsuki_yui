#!/usr/bin/env python3
"""Generate the empty documentation library (idempotent, never overwrites)."""
from pathlib import Path

from docx import Document

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

PURPOSES = {
    "01-Overview": "Project overview: vision, scope and roadmap.",
    "02-Requirements": "Requirements specification and business analysis.",
    "03-UI-UX": "UI/UX design: guidelines, flows, wireframes, design system.",
    "04-Architecture": "System architecture, tech stack, structure and decisions.",
    "05-Database": "Database design, ERD, data dictionary, naming conventions.",
    "06-API": "API specification: guidelines, contract, error handling.",
    "07-Development": "Development guidelines: coding standards, Git, workflow.",
    "08-Testing": "Testing strategy, plan, cases and bug tracking.",
    "09-Security": "Security requirements, authentication/authorization, RBAC.",
    "10-Deployment": "Deployment guide, environment configuration, installation.",
    "11-AI-Agents": "AI agent guidelines: instructions, context, workflow, prompts.",
}

STRUCTURE = {
    "01-Overview": ["Project-Overview"],
    "02-Requirements": ["Requirements-Specification", "Business-Analysis"],
    "03-UI-UX": ["UI-UX-Design"],
    "04-Architecture": ["System-Architecture"],
    "05-Database": ["Database-Design"],
    "06-API": ["API-Specification"],
    "07-Development": ["Development-Guidelines"],
    "08-Testing": ["Testing-Documentation"],
    "09-Security": ["Security-Documentation"],
    "10-Deployment": ["Deployment-Guide"],
    "11-AI-Agents": ["AI-Agent-Guidelines"],
}


def create_empty_docx(path: Path) -> bool:
    """Create an empty DOCX. Return False (skip) if the file already exists."""
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    Document().save(str(path))
    return True


def generate(docs_root: Path = DOCS) -> dict:
    stats = {"folders": len(STRUCTURE), "expected": 0, "created": 0, "skipped": 0}
    for folder, names in STRUCTURE.items():
        (docs_root / folder).mkdir(parents=True, exist_ok=True)
        for name in names:
            stats["expected"] += 1
            if create_empty_docx(docs_root / folder / f"{name}.docx"):
                stats["created"] += 1
            else:
                stats["skipped"] += 1
    return stats


def write_if_missing(path: Path, text: str) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def readme_text() -> str:
    lines = ["# Documentation Library", "",
             "| Folder | Purpose |", "|---|---|"]
    lines += [f"| `{f}` | {PURPOSES[f]} |" for f in STRUCTURE]
    return "\n".join(lines) + "\n"


def inventory_text() -> str:
    total = sum(len(v) for v in STRUCTURE.values())
    lines = ["# Document Inventory", "",
             f"Total folders: {len(STRUCTURE)}  ", f"Total documents: {total}", ""]
    for folder, names in STRUCTURE.items():
        lines += [f"## {folder}", ""]
        lines += [f"- {n}.docx" for n in names]
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    s = generate()
    write_if_missing(DOCS / "README.md", readme_text())
    write_if_missing(DOCS / "DOCUMENT-INVENTORY.md", inventory_text())
    print(s)

