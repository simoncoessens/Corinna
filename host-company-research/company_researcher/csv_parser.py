"""CSV parser for extracting research sub-questions."""

import csv
import re
from pathlib import Path
from typing import List

from company_researcher.models import SubQuestion


def parse_subquestions_from_csv(csv_path: Path | None = None) -> List[SubQuestion]:
    """
    Parse search_fields.csv into individual sub-questions.
    
    If csv_path is None, looks for search_fields.csv in the agents folder.
    """
    if csv_path is None:
        # Default: look in host-company-research/search_fields.csv
        # __file__ = .../host-company-research/company_researcher/csv_parser.py
        # parents[1] = .../host-company-research
        csv_path = Path(__file__).resolve().parents[1] / "search_fields.csv"
    
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    subquestions: List[SubQuestion] = []
    current_section: str = ""
    current_articles: List[str] = []

    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            section_name = (row.get("Section") or "").strip()
            info_needed = (row.get("Information Needed") or "").strip()
            article = (row.get("Relevant Article(s) \\ Recital(s)") or "").strip()

            if section_name:
                current_section = section_name
                current_articles = [article] if article else []

                # GEOGRAPHICAL SCOPE: parse bullet points
                if section_name == "GEOGRAPHICAL SCOPE" and info_needed:
                    bullets = re.split(r'\n-\s*', info_needed)
                    for bullet in bullets:
                        bullet = bullet.strip().lstrip('- ').strip()
                        if bullet and len(bullet) > 5:
                            question = bullet.split('(')[0].strip()
                            if question:
                                subquestions.append(SubQuestion(
                                    section=current_section,
                                    question=f"What is the {question.lower()} for this company?",
                                    relevant_articles=current_articles.copy(),
                                ))

                # COMPANY SIZE: sub-questions for each metric
                elif section_name == "COMPANY SIZE":
                    for metric in ["employee headcount", "annual turnover/revenue", "balance sheet total"]:
                        subquestions.append(SubQuestion(
                            section=current_section,
                            question=f"What is the {metric} of this company?",
                            relevant_articles=current_articles.copy(),
                        ))

                # TYPE OF SERVICE PROVIDED: main classification question
                elif section_name == "TYPE OF SERVICE PROVIDED":
                    subquestions.append(SubQuestion(
                        section=current_section,
                        question="What type of digital/intermediary service does this company provide?",
                        relevant_articles=current_articles.copy(),
                    ))

            else:
                if article:
                    current_articles.append(article)

                # For TYPE OF SERVICE: each service type is a sub-question
                if current_section == "TYPE OF SERVICE PROVIDED" and info_needed:
                    service_type = info_needed.strip().lstrip('- ').strip()
                    if service_type and "intermediary service" not in service_type.lower():
                        subquestions.append(SubQuestion(
                            section=current_section,
                            question=f"Does this company operate as a '{service_type}'?",
                            relevant_articles=current_articles.copy(),
                        ))

    return subquestions

