# Test Suite

Comprehensive unit and integration tests for the SNIP-tool backend agents, tools, and API.

## Quick Start

```bash
# Install test dependencies
cd backend
pip install -r requirements.txt

# Run all tests
pytest

# Run with coverage report
pytest --cov=agents --cov-report=html
```

## Test Structure

```
tests/
├── unit/              # Pure unit tests (models, utils, state, loaders)
├── tools/             # Tool tests with mocked external APIs
├── agents/            # Agent graph node tests with mocked LLMs
└── api/              # FastAPI endpoint tests
```

## Running Tests

### Run All Tests

```bash
cd backend
pytest
```

### Run Specific Test Files

```bash
# Run only model tests
pytest tests/unit/test_models.py

# Run only API tests
pytest tests/api/test_endpoints.py

# Run only agent tests
pytest tests/agents/
```

### Run Specific Test Classes or Functions

```bash
# Run a specific test class
pytest tests/unit/test_models.py::TestCompanyMatcherModels

# Run a specific test function
pytest tests/unit/test_models.py::TestCompanyMatcherModels::test_company_match_creation
```

### Run Tests with Coverage

```bash
# Terminal coverage report
pytest --cov=agents --cov-report=term-missing

# HTML coverage report (opens in browser)
pytest --cov=agents --cov-report=html
open htmlcov/index.html  # macOS
```

### Run Tests Verbosely

```bash
# Show detailed output
pytest -v

# Show even more details
pytest -vv
```

### Run Tests in Parallel (faster)

```bash
# Install pytest-xdist first: pip install pytest-xdist
pytest -n auto
```

## Test Categories

### Unit Tests (`tests/unit/`)

Pure function tests that don't require external dependencies:

- **test_models.py**: Pydantic model validation and serialization
- **test_state.py**: State definitions and reducers
- **test_utils.py**: Utility functions (URL parsing, JSON extraction, etc.)
- **test_config.py**: Configuration classes
- **test_question_loader.py**: Question template loading
- **test_obligations.py**: DSA obligation loading

### Tool Tests (`tests/tools/`)

Tests for shared tools with mocked external services:

- **test_cache.py**: Redis cache (mocked)
- **test_tavily.py**: Tavily search API (mocked)

### Agent Tests (`tests/agents/`)

Tests for LangGraph agent nodes with mocked LLM calls:

- **test_company_matcher.py**: Company matching agent
- **test_company_researcher.py**: Company research agent
- **test_service_categorizer.py**: Service categorization agent
- **test_main_agent.py**: Main conversational agent

### API Tests (`tests/api/`)

FastAPI endpoint tests using TestClient:

- **test_endpoints.py**: All API endpoints (health, agents, streaming)

## Test Fixtures

Shared fixtures are defined in `conftest.py`:

- Sample data: `sample_company_match`, `sample_subquestion`, etc.
- Mock clients: `mock_redis_client`, `mock_tavily_client`, `mock_llm_response`
- API client: `api_client` (FastAPI TestClient)

## Writing New Tests

1. **Unit tests**: Place in `tests/unit/` - no mocking needed for pure functions
2. **Tool tests**: Place in `tests/tools/` - mock external APIs
3. **Agent tests**: Place in `tests/agents/` - mock LLM responses
4. **API tests**: Place in `tests/api/` - use TestClient

Example test structure:

```python
import pytest
from unittest.mock import patch

class TestMyFeature:
    """Tests for my feature."""

    def test_basic_functionality(self):
        """Test basic case."""
        result = my_function("input")
        assert result == "expected"

    @pytest.mark.asyncio
    async def test_async_function(self):
        """Test async function."""
        result = await my_async_function()
        assert result is not None

    def test_with_mock(self, mock_llm_response):
        """Test with mocked dependency."""
        with patch("module.external_call", return_value=mock_llm_response):
            result = my_function()
            assert result is not None
```

## Troubleshooting

### Import Errors

If you see import errors, ensure you're running tests from the `backend/` directory:

```bash
cd backend
pytest
```

### Missing Dependencies

Install all dependencies:

```bash
pip install -r requirements.txt
```

### Redis/Tavily Connection Errors

These are expected in tests - the tools are mocked. If you see real connection attempts, check that mocks are properly applied.

## Continuous Integration

To run tests in CI/CD:

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests with coverage
pytest --cov=agents --cov-report=xml

# Coverage threshold (fail if below 70%)
pytest --cov=agents --cov-fail-under=70
```

## Test Statistics

- **Total Tests**: 181
- **Coverage**: ~77% on agents module
- **Test Categories**: 4 (unit, tools, agents, api)
- **Fixtures**: 36 shared fixtures

