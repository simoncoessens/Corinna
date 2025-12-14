"""Load research sub-questions from Jinja prompt templates.

The current version of company_researcher stores one question per template in:
  src/company_researcher/prompts/questions/qXX.jinja

This replaces the legacy CSV-based question loading.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional

from company_researcher.models import SubQuestion


_QUESTION_MARKER = "Research question about {{ company_name }}:"


def _extract_question_from_template(template_text: str, *, template_name: str) -> str:
    """Extract the question line from a question template."""
    text = template_text
    
    # Try the new format first: look for "## Research Question" section
    if "## Research Question" in text:
        text = text.split("## Research Question", 1)[1]
    # Fallback to legacy format
    elif _QUESTION_MARKER in text:
        text = text.split(_QUESTION_MARKER, 1)[1]

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # Skip headings / reminders that might appear before the question.
        if line.startswith("##"):
            continue
        if line.startswith("**"):
            continue
        if line.lower().startswith("use web_search"):
            continue
        return line

    raise ValueError(f"Could not extract question from template: {template_name}")


def _infer_section_from_index(idx: int) -> str:
    # Keep this logic simple and aligned with the current q00-q15 set.
    # q00-q07: GEOGRAPHICAL SCOPE (8 questions)
    # q08-q09: COMPANY SIZE (2 questions: employee headcount, turnover/balance sheet combined)
    # q10-q15: TYPE OF SERVICE PROVIDED (6 questions)
    if 0 <= idx <= 7:
        return "GEOGRAPHICAL SCOPE"
    if 8 <= idx <= 9:
        return "COMPANY SIZE"
    if idx >= 10:
        return "TYPE OF SERVICE PROVIDED"
    return "OTHER"


_QFILE_RE = re.compile(r"^q(?P<idx>\d+)\.jinja$", re.IGNORECASE)


def load_subquestions_from_templates(
    questions_dir: Optional[Path] = None,
) -> List[SubQuestion]:
    """Load and parse SubQuestions from `prompts/questions` templates."""
    if questions_dir is None:
        # question_loader.py is in .../src/company_researcher/
        questions_dir = Path(__file__).resolve().parent / "prompts" / "questions"

    if not questions_dir.exists():
        raise FileNotFoundError(f"Questions directory not found: {questions_dir}")

    qfiles: list[tuple[int, Path]] = []
    for path in questions_dir.iterdir():
        if not path.is_file():
            continue
        m = _QFILE_RE.match(path.name)
        if not m:
            continue
        qfiles.append((int(m.group("idx")), path))

    qfiles.sort(key=lambda t: t[0])
    if not qfiles:
        raise FileNotFoundError(f"No question templates found in: {questions_dir}")

    subquestions: list[SubQuestion] = []
    for idx, path in qfiles:
        template_text = path.read_text(encoding="utf-8")
        question = _extract_question_from_template(template_text, template_name=path.name)
        section = _infer_section_from_index(idx)
        subquestions.append(
            SubQuestion(
                section=section,
                question=question,
                template_name=f"questions/q{idx:02d}.jinja",
            )
        )

    return subquestions

