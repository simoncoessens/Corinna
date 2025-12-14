"""Shared pytest fixtures for all tests."""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add backend paths to sys.path for imports
backend_path = Path(__file__).resolve().parent.parent
agents_path = backend_path / "agents"

# Critical: agents path must be in sys.path for `from tools import ...` to work
# since tools is a package inside agents/
if str(agents_path) not in sys.path:
    sys.path.insert(0, str(agents_path))

if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

# Add each agent's src directory for their internal imports
for agent_dir in ["company_matcher", "company_researcher", "service_categorizer", "main_agent"]:
    src_path = agents_path / agent_dir / "src"
    if src_path.exists() and str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_company_match() -> Dict[str, Any]:
    """Sample CompanyMatch data."""
    return {
        "name": "Acme Corporation",
        "top_domain": "acme.com",
        "confidence": "high",
        "summary_short": "A technology company.",
        "summary_long": "Acme Corporation is a leading technology company specializing in software development.",
    }


@pytest.fixture
def sample_company_match_result(sample_company_match) -> Dict[str, Any]:
    """Sample CompanyMatchResult data."""
    return {
        "input_name": "Acme Corp",
        "exact_match": sample_company_match,
        "suggestions": [],
    }


@pytest.fixture
def sample_subquestion() -> Dict[str, Any]:
    """Sample SubQuestion data."""
    return {
        "section": "GEOGRAPHICAL SCOPE",
        "question": "Where is the company headquartered?",
        "template_name": "questions/q00.jinja",
        "relevant_articles": [],
        "rationale": None,
    }


@pytest.fixture
def sample_subquestion_answer() -> Dict[str, Any]:
    """Sample SubQuestionAnswer data."""
    return {
        "section": "GEOGRAPHICAL SCOPE",
        "question": "Where is the company headquartered?",
        "answer": "The company is headquartered in Amsterdam, Netherlands.",
        "source": "company website",
        "confidence": "High",
        "information_found": True,
        "raw_research": "Search results indicated...",
    }


@pytest.fixture
def sample_company_profile() -> Dict[str, Any]:
    """Sample company profile for service categorization."""
    return {
        "company_name": "TechPlatform Inc",
        "description": "An online marketplace connecting buyers and sellers.",
        "services": ["marketplace", "hosting"],
        "user_count": 50000000,
        "eu_presence": True,
    }


@pytest.fixture
def sample_classification() -> Dict[str, Any]:
    """Sample DSA classification result."""
    return {
        "territorial_scope": {"is_in_scope": True, "reasoning": "Has EU users"},
        "service_classification": {
            "is_intermediary": True,
            "service_category": "Hosting",
            "is_online_platform": True,
            "is_marketplace": True,
            "is_search_engine": False,
        },
        "size_designation": {"is_vlop_vlose": False},
        "summary": "Online marketplace in scope of DSA.",
    }


# =============================================================================
# Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_redis_client():
    """Mock Redis client for cache tests."""
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    mock_client.get.return_value = None
    mock_client.setex.return_value = True
    return mock_client


@pytest.fixture
def mock_tavily_response() -> Dict[str, Any]:
    """Sample Tavily API response."""
    return {
        "results": [
            {
                "title": "Acme Corporation - Official Website",
                "url": "https://www.acme.com",
                "content": "Acme Corporation is a technology company...",
            },
            {
                "title": "Acme Corp LinkedIn",
                "url": "https://linkedin.com/company/acme",
                "content": "Acme Corporation | 5000 followers...",
            },
        ]
    }


@pytest.fixture
def mock_tavily_client(mock_tavily_response):
    """Mock AsyncTavilyClient."""
    mock_client = AsyncMock()
    mock_client.search = AsyncMock(return_value=mock_tavily_response)
    return mock_client


@pytest.fixture
def mock_llm_response():
    """Mock LLM response with content."""
    mock_response = MagicMock()
    mock_response.content = "This is a test response."
    mock_response.tool_calls = []
    return mock_response


@pytest.fixture
def mock_llm_json_response(sample_company_match_result):
    """Mock LLM response with JSON content."""
    mock_response = MagicMock()
    mock_response.content = json.dumps({
        "exact_match": sample_company_match_result["exact_match"],
        "suggestions": [],
    })
    mock_response.tool_calls = []
    return mock_response


@pytest.fixture
def mock_chat_openai(mock_llm_response):
    """Mock ChatOpenAI model."""
    mock_model = MagicMock()
    mock_model.ainvoke = AsyncMock(return_value=mock_llm_response)
    mock_model.bind_tools = MagicMock(return_value=mock_model)
    return mock_model


# =============================================================================
# Message Fixtures
# =============================================================================

@pytest.fixture
def human_message():
    """Create a HumanMessage fixture."""
    from langchain_core.messages import HumanMessage
    return HumanMessage(content="Acme Corporation")


@pytest.fixture
def ai_message():
    """Create an AIMessage fixture."""
    from langchain_core.messages import AIMessage
    return AIMessage(content="I found information about Acme Corporation.")


# =============================================================================
# API Test Fixtures
# =============================================================================

@pytest.fixture
def api_client():
    """FastAPI TestClient with mocked agents."""
    from fastapi.testclient import TestClient
    
    # Import with agents mocked to avoid initialization issues
    with patch.dict("sys.modules", {
        "company_matcher.graph": MagicMock(),
        "company_researcher.graph": MagicMock(),
        "service_categorizer.graph": MagicMock(),
        "main_agent.graph": MagicMock(),
    }):
        from api.main import app
        return TestClient(app)
