<div align="center">
  <img src="frontend/public/bari_logo_original.png" alt="Università degli Studi di Bari" width="140" />
  <img src="frontend/public/MUR_logo-300x300.jpg" alt="Ministero dell’Università e della Ricerca" width="140" />
  <img src="frontend/public/Santanna_logo.png" alt="Sant’Anna School of Advanced Studies" width="140" />
</div>

**snip-project** is a DSA copilot built from a stack of LangGraph agents. It is being built by Simon Coessens in collaboration with Vittorio Franzese (legal lead; PhD in AI & Law at the University of Tübingen), under PI Prof. Antonio Davola, as the Digital Services Act Self-Assessment Tool within the PRIN PNRR 2022 – SNIP “Self-Assessment Network Impact Program” during an External Expert engagement (Università degli Studi di Bari, Jun–Nov 2025). Project context: [SNIP Project](https://www.antoniodavola.com/snip/). It resolves the company entity, pulls public signals, classifies the service against the DSA taxonomy, and emits an obligation-scoped report backed by a local DSA knowledge base (Qdrant + embeddings). The tool is under active development; a hosted version will be released soon.

**TL;DR**: EU digital regulation is dense. This tool determines whether a company is in-scope for the Digital Services Act, assigns the correct service category, and explains which obligations matter for that company.

## System Overview

- Minimal input surface: the user provides a company name; all other context is AI-harvested and user-validated.
- Backend: FastAPI (`backend/api/main.py`) exposes streaming and blocking endpoints per agent graph. Streaming is SSE-based and forwards LangGraph event traces (LLM tokens, tool starts/ends, node transitions).
- Models/tools: `deepseek-chat` (LangChain), Tavily search, Qdrant retriever (`knowledge_base`) with OpenAI embeddings.
- Frontend: Next.js app orchestrates the multi-phase flow and passes `frontend_context` into the main agent so replies are aware of the active company/phase.

## Agent Graphs (LangGraph)

- **Company Matcher (`backend/agents/company_matcher`)** – ReAct loop with tools `web_search` (Tavily) and `finish_matching`. Iterates a capped number of times to resolve the canonical company (name + URL) and returns structured JSON.
- **Company Researcher (`backend/agents/company_researcher`)** – Loads sub-questions from CSV, runs parallel research agents per question, then summarises with a separate model call. Batching is governed by `max_concurrent_research`; output is `SubQuestionAnswer[]` plus raw research traces.
- **Service Categorizer (`backend/agents/service_categorizer`)** – Ingests the confirmed profile JSON, classifies territorial scope and service class, derives obligations from YAML specs, and runs per-obligation analyses (batched) before emitting a consolidated compliance report.
- **Main Agent (`backend/agents/main_agent`)** – Lightweight ReAct wrapper with tools `retrieve_dsa_knowledge` (Qdrant-backed RAG) and `web_search`. Accepts `frontend_context` to condition the system prompt on UI state.

## API Surface (FastAPI)

- `/agents/company_matcher[/stream]` – entity resolution.
- `/agents/company_researcher[/stream]` – parallel research + summarisation.
- `/agents/service_categorizer[/stream]` – service classification and obligation analysis.
- `/agents/main_agent[/stream]` – chat entry point with optional frontend context.
- `/health` – agent availability.

## Frontend Workflow (Next.js, `src/app/assessment/page.tsx`)

- Phase 1: `CompanyMatcher` streams candidate entities from the matcher graph.
- Phase 2: `DeepResearch` runs the researcher graph; `ResearchReview` lets users accept/override per-section findings (scope, size, service type).
- Phase 3: `ServiceClassification` posts the curated profile to the categorizer; `ComplianceDashboard` renders applicability and action items for each obligation.
- Chat sidecar (`Chatbot`) feeds `frontend_context` to the main agent so answers stay aligned with the active company and phase.

## Screens (from v0, in `pdf_v0/`, chronological)

Landing:
![Landing](pdf_v0/Screenshot%202025-12-08%20at%2011.29.58.png)

Initial CTA / flow selection:
![Flow selection](pdf_v0/Screenshot%202025-12-08%20at%2011.30.08.png)

Assessment overview:
![Assessment overview](pdf_v0/Screenshot%202025-12-08%20at%2011.31.02.png)

Research review – scope confirmation:
![Research review (scope)](pdf_v0/Screenshot%202025-12-08%20at%2011.31.32.png)

Research review – size confirmation:
![Research review (size)](pdf_v0/Screenshot%202025-12-08%20at%2011.31.55.png)

Research in progress:
![Research progress](pdf_v0/Screenshot%202025-12-08%20at%2011.36.50.png)

Research summary:
![Research summary](pdf_v0/Screenshot%202025-12-08%20at%2011.37.45.png)

Compliance dashboard – obligations list:
![Compliance dashboard (list)](pdf_v0/Screenshot%202025-12-08%20at%2011.37.56.png)

Compliance dashboard – obligation detail:
![Compliance dashboard (detail)](pdf_v0/Screenshot%202025-12-08%20at%2011.39.10.png)

Compliance dashboard – action items export:
![Compliance dashboard (actions)](pdf_v0/Screenshot%202025-12-08%20at%2011.40.15.png)

## 🏗️ Design Principles

### Prompting with Jinja Templates (brief)

Prompts live in `.jinja` files alongside each agent and are rendered with Jinja2 to inject runtime variables (company name, context, classification summaries). The code loads templates via a shared helper and renders per call; logic stays in Python, text in templates.

#### Directory Structure

```
backend/agents/
├── prompts/                          # Shared prompt utilities
│   └── __init__.py                   # load_prompt() helper
│
├── company_matcher/
│   └── src/company_matcher/
│       ├── prompts/
│       │   └── prompt.jinja          # Single-turn prompt (system + task)
│       └── graph.py
│
├── company_researcher/
│   └── src/company_researcher/
│       ├── prompts/
│       │   ├── researcher.jinja      # Single-turn prompt (system + task)
│       │   └── summarize.jinja       # Summarization prompt
│       └── graph.py
│
├── service_categorizer/
│   └── src/service_categorizer/
│       ├── prompts/
│       │   ├── classify.jinja        # Service class + territorial scope
│       │   ├── obligation.jinja      # Per-obligation analysis
│       │   └── summarize.jinja       # Final report synthesis
│       └── graph.py
└── main_agent/
    └── src/main_agent/
        ├── prompts/
        │   └── system.jinja           # Multi-turn: system prompt only
        └── graph.py                   # User messages come from state
```

#### Template notes

- Single-turn agents embed system + task in one template; main agent uses a system-only template and appends user messages from state.
- Templates take only the runtime variables they need (e.g., `company_name`, `frontend_context`, `classification_summary`).

Example single-turn template:

```jinja
{# Company Matcher - Complete Prompt #}
{#
  Variables:
    - company_name: The target company
    - max_iterations: Maximum search attempts (default: 5)
#}

You are a company matching agent.

## Guidelines
- Maximum {{ max_iterations | default(5) }} iterations allowed

## Task
Find a match for: "{{ company_name }}"
```

Example multi-turn template (system prompt only):

```jinja
{# Main Agent - System Prompt #}
{#
  Variables:
    - context: Optional frontend context
#}

You are the snip-project assistant.

## Guidelines
- Cite specific DSA articles
- Provide actionable guidance

{% if context %}
## Current Context
{{ context }}
{% endif %}
```
