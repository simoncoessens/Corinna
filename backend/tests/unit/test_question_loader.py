"""Unit tests for question_loader module."""

import pytest
from pathlib import Path


class TestQuestionLoader:
    """Tests for question_loader functions."""

    def test_extract_question_from_template_basic(self):
        """Test _extract_question_from_template with basic template."""
        from company_researcher.question_loader import _extract_question_from_template
        
        template = """## Research Instructions
Research question about {{ company_name }}:
What is the company's main business?

Use web_search to find information.
"""
        
        question = _extract_question_from_template(template, template_name="test.jinja")
        assert question == "What is the company's main business?"

    def test_extract_question_from_template_skips_headings(self):
        """Test _extract_question_from_template skips markdown headings."""
        from company_researcher.question_loader import _extract_question_from_template
        
        template = """Research question about {{ company_name }}:
## Section Header
**Bold text**
The actual question here?
"""
        
        question = _extract_question_from_template(template, template_name="test.jinja")
        assert question == "The actual question here?"

    def test_extract_question_from_template_skips_instructions(self):
        """Test _extract_question_from_template skips use web_search lines."""
        from company_researcher.question_loader import _extract_question_from_template
        
        template = """Research question about {{ company_name }}:
Use web_search to find details.
What are the company's services?
"""
        
        question = _extract_question_from_template(template, template_name="test.jinja")
        assert question == "What are the company's services?"

    def test_extract_question_from_template_raises_on_empty(self):
        """Test _extract_question_from_template raises ValueError on no question."""
        from company_researcher.question_loader import _extract_question_from_template
        
        template = """## Only headings
**And bold**
"""
        
        with pytest.raises(ValueError, match="Could not extract question"):
            _extract_question_from_template(template, template_name="empty.jinja")

    def test_infer_section_from_index_geographical(self):
        """Test _infer_section_from_index for geographical scope questions."""
        from company_researcher.question_loader import _infer_section_from_index
        
        for idx in range(0, 7):
            section = _infer_section_from_index(idx)
            assert section == "GEOGRAPHICAL SCOPE"

    def test_infer_section_from_index_company_size(self):
        """Test _infer_section_from_index for company size questions."""
        from company_researcher.question_loader import _infer_section_from_index
        
        for idx in range(7, 10):
            section = _infer_section_from_index(idx)
            assert section == "COMPANY SIZE"

    def test_infer_section_from_index_service_type(self):
        """Test _infer_section_from_index for service type questions."""
        from company_researcher.question_loader import _infer_section_from_index
        
        for idx in [10, 11, 12, 15, 16]:
            section = _infer_section_from_index(idx)
            assert section == "TYPE OF SERVICE PROVIDED"

    def test_load_subquestions_from_templates(self):
        """Test load_subquestions_from_templates loads actual templates."""
        from company_researcher.question_loader import load_subquestions_from_templates
        
        subquestions = load_subquestions_from_templates()
        
        # Should load q00.jinja through q15.jinja (16 questions)
        assert len(subquestions) == 16
        
        # Check first question structure
        first = subquestions[0]
        assert first.section == "GEOGRAPHICAL SCOPE"
        assert first.template_name == "questions/q00.jinja"
        assert len(first.question) > 0

    def test_load_subquestions_ordering(self):
        """Test load_subquestions_from_templates returns ordered questions."""
        from company_researcher.question_loader import load_subquestions_from_templates
        
        subquestions = load_subquestions_from_templates()
        
        # Verify ordering by template name
        for i, sq in enumerate(subquestions):
            expected_template = f"questions/q{i:02d}.jinja"
            assert sq.template_name == expected_template

    def test_load_subquestions_all_have_questions(self):
        """Test all loaded subquestions have non-empty questions."""
        from company_researcher.question_loader import load_subquestions_from_templates
        
        subquestions = load_subquestions_from_templates()
        
        for sq in subquestions:
            assert sq.question, f"Empty question for {sq.template_name}"
            assert len(sq.question.strip()) > 5  # Reasonable minimum length

    def test_load_subquestions_invalid_directory(self, tmp_path):
        """Test load_subquestions_from_templates raises on invalid directory."""
        from company_researcher.question_loader import load_subquestions_from_templates
        
        fake_dir = tmp_path / "nonexistent"
        
        with pytest.raises(FileNotFoundError):
            load_subquestions_from_templates(questions_dir=fake_dir)

    def test_load_subquestions_empty_directory(self, tmp_path):
        """Test load_subquestions_from_templates raises on empty directory."""
        from company_researcher.question_loader import load_subquestions_from_templates
        
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        
        with pytest.raises(FileNotFoundError, match="No question templates found"):
            load_subquestions_from_templates(questions_dir=empty_dir)
