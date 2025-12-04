# Company Researcher

Standalone LangGraph agent for DSA (Digital Services Act) compliance research.

## Overview

Given a company name, this agent:

1. Parses predefined research questions from `search_fields.csv`
2. Searches for information about the company using Tavily
3. Summarizes findings using an LLM (DeepSeek by default)
4. Returns a structured JSON report

## Setup

### 1. Install dependencies

```bash
cd backend/agents/company_researcher
pip install -e .
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required keys:

- `OPENAI_API_KEY`: Your DeepSeek API key
- `OPENAI_BASE_URL`: `https://api.deepseek.com/v1`
- `TAVILY_API_KEY`: Your Tavily search API key

### 3. Ensure search_fields.csv exists

The agent looks for `search_fields.csv` at `backend/agents/search_fields.csv`.

## Running with LangGraph

```bash
cd backend/agents/company_researcher
langgraph dev
```

Then open the LangGraph Studio UI and:

1. Select "Company Researcher" graph
2. Send a message with the company name (e.g., "Spotify")
3. View the JSON report in the output

## Configuration

You can override defaults via environment variables or LangGraph UI:

| Setting                   | Default                | Description              |
| ------------------------- | ---------------------- | ------------------------ |
| `research_model`          | `openai:deepseek-chat` | Model for research       |
| `summarization_model`     | `openai:deepseek-chat` | Model for summarization  |
| `max_search_results`      | `3`                    | Results per search query |
| `max_search_queries`      | `2`                    | Queries per sub-question |
| `max_concurrent_research` | `3`                    | Parallel research tasks  |

## Output Format

```json
{
  "company_name": "Spotify",
  "generated_at": "2025-12-04T...",
  "answers": [
    {
      "section": "GEOGRAPHICAL SCOPE",
      "question": "What is the main establishment country for this company?",
      "answer": "Spotify is headquartered in Stockholm, Sweden.",
      "source": "spotify.com",
      "confidence": "High",
      "raw_research": "..."
    }
  ]
}
```

## Project Structure

```
company_researcher/
├── src/company_researcher/
│   ├── __init__.py
│   ├── configuration.py   # Config with defaults
│   ├── state.py           # LangGraph state definitions
│   ├── models.py          # Pydantic models
│   ├── utils.py           # API key helpers, Tavily search
│   ├── csv_parser.py      # Parse search_fields.csv
│   └── graph.py           # Main LangGraph workflow
├── langgraph.json         # LangGraph registration
├── pyproject.toml         # Python package config
└── .env.example           # Environment template
```
