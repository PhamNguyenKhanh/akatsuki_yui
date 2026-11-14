#!/usr/bin/env python3
"""Mirror docs/**/*.docx into markdown/**/*.md as empty files.

docs/ is the single source of truth. Idempotent; never overwrites.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MD = ROOT / "markdown"

README_TEXT = """# Markdown Documentation Library

This directory mirrors the Word (`.docx`) library in `../docs/`.
Every `.docx` there has a matching `.md` file here with the same folder and
file name. The DOCX library is the source of truth for the structure; new
Markdown files are generated with `scripts/generate_markdown.py`.
"""


def discover(docs_root: Path = DOCS):
    """Return (folders, files) as relative paths of the docs/ tree."""
    folders, files = set(), []
    for p in sorted(docs_root.rglob("*.docx")):
        if p.name.startswith("~$"):
            continue
        rel = p.relative_to(docs_root)
        files.append(rel)
        folders.update(rel.parents)
    folders.discard(Path("."))
    return sorted(folders), files


def create_empty_md(path: Path) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()
    return True


def write_if_missing(path: Path, text: str) -> bool:
    if path.exists():
        return False
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def inventory_text(files) -> str:
    lines = ["# Document Inventory", "",
             f"Total documents: {len(files)}", ""]
    lines += [f"- {f.with_suffix('.md').as_posix()}" for f in files]
    return "\n".join(lines) + "\n"


def generate():
    folders, files = discover()
    stats = {"folders_created": 0, "created": 0, "skipped": 0}
    MD.mkdir(exist_ok=True)
    for f in folders:
        d = MD / f
        if not d.exists():
            d.mkdir(parents=True)
            stats["folders_created"] += 1
    for f in files:
        if create_empty_md(MD / f.with_suffix(".md")):
            stats["created"] += 1
        else:
            stats["skipped"] += 1
    write_if_missing(MD / "README.md", README_TEXT)
    write_if_missing(MD / "DOCUMENT-INVENTORY.md", inventory_text(files))
    return stats


if __name__ == "__main__":
    print(generate())

