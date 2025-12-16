"""Tests for FastAPI endpoints."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_returns_status(self):
        """Test /health returns healthy status."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "agents" in data

    def test_health_shows_agent_availability(self):
        """Test /health shows agent availability."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.get("/health")
        
        data = response.json()
        agents = data["agents"]
        
        assert "company_matcher" in agents
        assert "company_researcher" in agents
        assert "service_categorizer" in agents
        assert "main_agent" in agents


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_returns_api_info(self):
        """Test / returns API information."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "DSA Copilot API"
        assert "version" in data
        assert "endpoints" in data


class TestCompanyMatcherEndpoint:
    """Tests for company matcher endpoints."""

    def test_company_matcher_requires_name(self):
        """Test /agents/company_matcher requires company_name."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/company_matcher", json={
            "company_name": "",
            "country_of_establishment": "Belgium",
        })
        
        assert response.status_code == 400
        assert "Company name is required" in response.json()["detail"]

    def test_company_matcher_requires_country(self):
        """Test /agents/company_matcher requires country_of_establishment."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/company_matcher", json={
            "company_name": "Acme Corp",
            "country_of_establishment": "",
        })
        
        assert response.status_code == 400
        assert "Country of establishment is required" in response.json()["detail"]

    def test_company_matcher_invoke_success(self, sample_company_match_result):
        """Test /agents/company_matcher invoke returns result."""
        from fastapi.testclient import TestClient
        from api.main import app, company_matcher
        
        if company_matcher is None:
            pytest.skip("company_matcher not available")
        
        mock_result = {
            "match_result": json.dumps(sample_company_match_result),
        }
        
        with patch.object(company_matcher, "ainvoke", new=AsyncMock(return_value=mock_result)):
            client = TestClient(app)
            response = client.post("/agents/company_matcher", json={
                "company_name": "Acme Corp",
                "country_of_establishment": "Belgium",
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["input_name"] == "Acme Corp"


class TestCompanyResearcherEndpoint:
    """Tests for company researcher endpoints."""

    def test_company_researcher_requires_name(self):
        """Test /agents/company_researcher requires company_name."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/company_researcher", json={
            "company_name": "",
        })
        
        assert response.status_code == 400
        assert "Company name is required" in response.json()["detail"]

    def test_company_researcher_invoke_success(self, sample_subquestion_answer):
        """Test /agents/company_researcher invoke returns result."""
        from fastapi.testclient import TestClient
        from api.main import app, company_researcher
        
        if company_researcher is None:
            pytest.skip("company_researcher not available")
        
        report = {
            "company_name": "TestCorp",
            "generated_at": "2024-01-01T00:00:00",
            "answers": [sample_subquestion_answer],
        }
        
        mock_result = {
            "final_report": json.dumps(report),
        }
        
        with patch.object(company_researcher, "ainvoke", new=AsyncMock(return_value=mock_result)):
            client = TestClient(app)
            response = client.post("/agents/company_researcher", json={
                "company_name": "TestCorp",
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "TestCorp"


class TestServiceCategorizerEndpoint:
    """Tests for service categorizer endpoints."""

    def test_service_categorizer_invoke_success(self, sample_company_profile, sample_classification):
        """Test /agents/service_categorizer invoke returns result."""
        from fastapi.testclient import TestClient
        from api.main import app, service_categorizer
        
        if service_categorizer is None:
            pytest.skip("service_categorizer not available")
        
        report = {
            "company_name": sample_company_profile["company_name"],
            "classification": sample_classification,
            "obligations": [],
            "summary": "Summary",
        }
        
        mock_result = {
            "final_report": json.dumps(report),
        }
        
        with patch.object(service_categorizer, "ainvoke", new=AsyncMock(return_value=mock_result)):
            client = TestClient(app)
            response = client.post("/agents/service_categorizer", json={
                "company_profile": sample_company_profile,
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "TechPlatform Inc"


class TestMainAgentEndpoint:
    """Tests for main agent endpoints."""

    def test_main_agent_requires_message(self):
        """Test /agents/main_agent requires message."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/main_agent", json={
            "message": "",
        })
        
        assert response.status_code == 400
        assert "Message is required" in response.json()["detail"]

    def test_main_agent_invoke_success(self):
        """Test /agents/main_agent invoke returns result."""
        from fastapi.testclient import TestClient
        from api.main import app, main_agent
        
        if main_agent is None:
            pytest.skip("main_agent not available")
        
        mock_message = MagicMock()
        mock_message.content = "This is the response."
        
        mock_result = {
            "messages": [mock_message],
        }
        
        with patch.object(main_agent, "ainvoke", new=AsyncMock(return_value=mock_result)):
            client = TestClient(app)
            response = client.post("/agents/main_agent", json={
                "message": "What is DSA?",
            })
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data


class TestStreamingEndpoints:
    """Tests for streaming endpoints."""

    def test_company_matcher_stream_endpoint_exists(self):
        """Test /agents/company_matcher/stream endpoint exists."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        # Just verify the endpoint exists and validates
        response = client.post("/agents/company_matcher/stream", json={
            "company_name": "",
            "country_of_establishment": "Belgium",
        })
        
        # Should return 400 for validation, not 404
        assert response.status_code == 400

    def test_company_researcher_stream_endpoint_exists(self):
        """Test /agents/company_researcher/stream endpoint exists."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/company_researcher/stream", json={
            "company_name": "",
        })
        
        assert response.status_code == 400

    def test_service_categorizer_stream_endpoint_exists(self):
        """Test /agents/service_categorizer/stream endpoint exists."""
        from fastapi.testclient import TestClient
        from api.main import app, service_categorizer
        
        if service_categorizer is None:
            pytest.skip("service_categorizer not available")
        
        client = TestClient(app)
        # Service categorizer doesn't have empty validation
        # Just verify endpoint responds
        response = client.post("/agents/service_categorizer/stream", json={
            "company_profile": {},
        })
        
        # Should return streaming response or error, not 404
        assert response.status_code != 404

    def test_main_agent_stream_endpoint_exists(self):
        """Test /agents/main_agent/stream endpoint exists."""
        from fastapi.testclient import TestClient
        from api.main import app
        
        client = TestClient(app)
        response = client.post("/agents/main_agent/stream", json={
            "message": "",
        })
        
        assert response.status_code == 400


class TestRequestModels:
    """Tests for API request models."""

    def test_company_matcher_request_model(self):
        """Test CompanyMatcherRequest model."""
        from api.main import CompanyMatcherRequest
        
        request = CompanyMatcherRequest(
            company_name="Test Corp",
            country_of_establishment="Belgium",
        )
        
        assert request.company_name == "Test Corp"
        assert request.country_of_establishment == "Belgium"

    def test_company_researcher_request_model(self):
        """Test CompanyResearcherRequest model."""
        from api.main import CompanyResearcherRequest
        
        request = CompanyResearcherRequest(
            company_name="Test Corp",
            top_domain="test.com",
            summary_long="A test company.",
        )
        
        assert request.company_name == "Test Corp"
        assert request.top_domain == "test.com"

    def test_company_researcher_request_optional_fields(self):
        """Test CompanyResearcherRequest optional fields."""
        from api.main import CompanyResearcherRequest
        
        request = CompanyResearcherRequest(
            company_name="Test Corp",
        )
        
        assert request.top_domain is None
        assert request.summary_long is None

    def test_service_categorizer_request_model(self):
        """Test ServiceCategorizerRequest model."""
        from api.main import ServiceCategorizerRequest
        
        profile = {"company_name": "Test", "services": ["hosting"]}
        request = ServiceCategorizerRequest(company_profile=profile)
        
        assert request.company_profile == profile

    def test_main_agent_request_model(self):
        """Test MainAgentRequest model."""
        from api.main import MainAgentRequest
        
        request = MainAgentRequest(
            message="What is DSA?",
            frontend_context="Step 1",
        )
        
        assert request.message == "What is DSA?"
        assert request.frontend_context == "Step 1"


