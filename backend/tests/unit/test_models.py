"""Unit tests for Pydantic models."""

import json
import pytest
from datetime import datetime


class TestCompanyMatcherModels:
    """Tests for company_matcher models."""

    def test_company_match_creation(self, sample_company_match):
        """Test CompanyMatch model creation with valid data."""
        from company_matcher.models import CompanyMatch
        
        match = CompanyMatch(**sample_company_match)
        
        assert match.name == "Acme Corporation"
        assert match.top_domain == "acme.com"
        assert match.confidence == "high"
        assert match.summary_short == "A technology company."
        assert "leading technology company" in match.summary_long

    def test_company_match_minimal(self):
        """Test CompanyMatch with minimal required fields."""
        from company_matcher.models import CompanyMatch
        
        match = CompanyMatch(
            name="Test Co",
            top_domain="test.com",
            confidence="medium",
            summary_long="A test company description.",
        )
        
        assert match.name == "Test Co"
        assert match.summary_short is None  # Optional field

    def test_company_match_extra_fields_ignored(self):
        """Test that extra fields are ignored due to model_config."""
        from company_matcher.models import CompanyMatch
        
        match = CompanyMatch(
            name="Test Co",
            top_domain="test.com",
            confidence="high",
            summary_long="Description",
            extra_field="should be ignored",
        )
        
        assert not hasattr(match, "extra_field")

    def test_company_match_result_creation(self, sample_company_match):
        """Test CompanyMatchResult model creation."""
        from company_matcher.models import CompanyMatch, CompanyMatchResult
        
        exact_match = CompanyMatch(**sample_company_match)
        result = CompanyMatchResult(
            input_name="Acme Corp",
            exact_match=exact_match,
            suggestions=[],
        )
        
        assert result.input_name == "Acme Corp"
        assert result.exact_match is not None
        assert result.exact_match.name == "Acme Corporation"
        assert result.suggestions == []

    def test_company_match_result_no_match(self):
        """Test CompanyMatchResult with no exact match."""
        from company_matcher.models import CompanyMatch, CompanyMatchResult
        
        suggestion = CompanyMatch(
            name="Similar Corp",
            top_domain="similar.com",
            confidence="medium",
            summary_long="A similar company.",
        )
        
        result = CompanyMatchResult(
            input_name="Unknown Corp",
            exact_match=None,
            suggestions=[suggestion],
        )
        
        assert result.exact_match is None
        assert len(result.suggestions) == 1

    def test_company_match_result_to_json(self, sample_company_match):
        """Test CompanyMatchResult JSON serialization."""
        from company_matcher.models import CompanyMatch, CompanyMatchResult
        
        exact_match = CompanyMatch(**sample_company_match)
        result = CompanyMatchResult(
            input_name="Acme Corp",
            exact_match=exact_match,
            suggestions=[],
        )
        
        json_str = result.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["input_name"] == "Acme Corp"
        assert parsed["exact_match"]["name"] == "Acme Corporation"
        assert "suggestions" in parsed


class TestCompanyResearcherModels:
    """Tests for company_researcher models."""

    def test_subquestion_creation(self, sample_subquestion):
        """Test SubQuestion model creation."""
        from company_researcher.models import SubQuestion
        
        sq = SubQuestion(**sample_subquestion)
        
        assert sq.section == "GEOGRAPHICAL SCOPE"
        assert "headquartered" in sq.question
        assert sq.template_name == "questions/q00.jinja"

    def test_subquestion_build_prompt(self):
        """Test SubQuestion.build_prompt method."""
        from company_researcher.models import SubQuestion
        
        sq = SubQuestion(
            section="COMPANY SIZE",
            question="How many employees?",
            relevant_articles=["Article 33: Transparency"],
        )
        
        prompt = sq.build_prompt("TestCorp")
        
        assert "TestCorp" in prompt
        assert "How many employees?" in prompt
        assert "COMPANY SIZE" in prompt

    def test_subquestion_build_search_queries(self):
        """Test SubQuestion.build_search_queries method."""
        from company_researcher.models import SubQuestion
        
        sq = SubQuestion(
            section="TYPE OF SERVICE",
            question="What services does the company provide?",
        )
        
        queries = sq.build_search_queries("TechCorp")
        
        assert len(queries) == 2
        assert "TechCorp" in queries[0]
        assert "What services" in queries[0]

    def test_subquestion_answer_creation(self, sample_subquestion_answer):
        """Test SubQuestionAnswer model creation."""
        from company_researcher.models import SubQuestionAnswer
        
        answer = SubQuestionAnswer(**sample_subquestion_answer)
        
        assert answer.section == "GEOGRAPHICAL SCOPE"
        assert "Amsterdam" in answer.answer
        assert answer.confidence == "High"
        assert answer.information_found is True

    def test_subquestion_answer_defaults(self):
        """Test SubQuestionAnswer default values."""
        from company_researcher.models import SubQuestionAnswer
        
        answer = SubQuestionAnswer(
            section="TEST",
            question="Test question?",
            answer="Test answer.",
        )
        
        assert answer.source == "Unknown"
        assert answer.confidence == "Medium"
        assert answer.raw_research is None
        assert answer.information_found is True

    def test_company_research_result_creation(self, sample_subquestion_answer):
        """Test CompanyResearchResult model creation."""
        from company_researcher.models import CompanyResearchResult, SubQuestionAnswer
        
        answer = SubQuestionAnswer(**sample_subquestion_answer)
        result = CompanyResearchResult(
            company_name="TestCorp",
            answers=[answer],
        )
        
        assert result.company_name == "TestCorp"
        assert len(result.answers) == 1
        assert isinstance(result.generated_at, datetime)

    def test_company_research_result_to_json(self, sample_subquestion_answer):
        """Test CompanyResearchResult JSON serialization."""
        from company_researcher.models import CompanyResearchResult, SubQuestionAnswer
        
        answer = SubQuestionAnswer(**sample_subquestion_answer)
        result = CompanyResearchResult(
            company_name="TestCorp",
            answers=[answer],
        )
        
        json_str = result.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["company_name"] == "TestCorp"
        assert len(parsed["answers"]) == 1
        assert "generated_at" in parsed


class TestServiceCategorizerModels:
    """Tests for service_categorizer models."""

    def test_classification_creation(self):
        """Test Classification model creation."""
        from service_categorizer.models import Classification
        
        classification = Classification(
            is_in_scope=True,
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_search_engine=False,
            is_vlop_vlose=False,
            reasoning="Company provides hosting services in the EU.",
        )
        
        assert classification.is_in_scope is True
        assert classification.service_category == "Hosting"
        assert classification.is_online_platform is True

    def test_obligation_creation(self):
        """Test Obligation model creation."""
        from service_categorizer.models import Obligation
        
        obligation = Obligation(
            article="Article 14",
            title="Terms of Service",
            description="Must include information about content moderation.",
            category="Online Platform",
        )
        
        assert obligation.article == "Article 14"
        assert "content moderation" in obligation.description

    def test_obligation_analysis_creation(self):
        """Test ObligationAnalysis model creation."""
        from service_categorizer.models import ObligationAnalysis
        
        analysis = ObligationAnalysis(
            article="Article 14",
            title="Terms of Service",
            applies=True,
            implications="Company must update ToS to include content moderation policies.",
            action_items=["Review current ToS", "Add content moderation section"],
        )
        
        assert analysis.applies is True
        assert len(analysis.action_items) == 2

    def test_compliance_report_creation(self):
        """Test ComplianceReport model creation."""
        from service_categorizer.models import (
            Classification,
            ComplianceReport,
            ObligationAnalysis,
        )
        
        classification = Classification(
            is_in_scope=True,
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_search_engine=False,
            is_vlop_vlose=False,
            reasoning="In scope.",
        )
        
        analysis = ObligationAnalysis(
            article="Article 14",
            title="ToS",
            applies=True,
            implications="Update ToS.",
            action_items=["Action 1"],
        )
        
        report = ComplianceReport(
            company_name="TestCorp",
            classification=classification,
            obligation_analyses=[analysis],
            summary="Company needs to comply with DSA.",
        )
        
        assert report.company_name == "TestCorp"
        assert report.classification.is_in_scope is True
        assert len(report.obligation_analyses) == 1

    def test_compliance_report_to_json(self):
        """Test ComplianceReport JSON serialization."""
        from service_categorizer.models import (
            Classification,
            ComplianceReport,
            ObligationAnalysis,
        )
        
        classification = Classification(
            is_in_scope=True,
            service_category="Hosting",
            is_online_platform=False,
            is_marketplace=False,
            is_search_engine=False,
            is_vlop_vlose=False,
            reasoning="Test",
        )
        
        report = ComplianceReport(
            company_name="TestCorp",
            classification=classification,
            obligation_analyses=[],
            summary="Summary",
        )
        
        json_str = report.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["company_name"] == "TestCorp"
        assert parsed["classification"]["is_in_scope"] is True




