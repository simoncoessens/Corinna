**snip-project** is an intelligent application designed to help digital service providers navigate the complex regulatory landscape of the European Union's Digital Services Act (DSA).

The DSA introduces a tiered system of obligations based on a company's size and role in the digital ecosystem—ranging from "Intermediary Services" to "Very Large Online Platforms" (VLOPs). Determining exact categorization and specific compliance duties can be legally dense and time-consuming.

**snip-project** automates this initial assessment. By combining **Deep Research Agents** with a **Legal RAG (Retrieval-Augmented Generation)** engine, the application autonomously builds an organization's profile, classifies its service type, and generates a personalized compliance roadmap.

## 🚀 Key Features

### 1. Autonomous Organization Profiling

Instead of asking users to fill out endless forms, the application employs a **Deep Research Agent**.

- **Input:** Users provide only the company name.
- **Process:** The agent scrapes public data (Terms of Service, "About Us" pages) to infer critical metrics like monthly active users (MAU), monetization models (ads/subscriptions), and content recommendation systems.
- **Verification:** Users review the AI-generated profile and apply corrections via a "JSON Patch" mechanism for seamless data updates.

### 2. Intelligent Service Categorization

The core "Assessment Brain" determines where a service fits within the DSA's regulatory pyramid:

- **Intermediary Service:** Mere conduit, caching, or domain services.
- **Hosting Service:** Cloud providers and web hosting.
- **Online Platform:** Social networks, marketplaces, and app stores.
- **VLOP/VLOSE:** Platforms with >45 million monthly active users in the EU.

### 3. Personalized Compliance Roadmap

Users receive a tailored dashboard identifying specifically which Articles of the DSA apply to them.

- **Obligation Mapping:** Links specific legal articles (e.g., _Article 15: Transparency Reporting_, _Article 16: Notice & Action_) directly to the user's business model.
- **Action Items:** Translates "legalese" into actionable steps (e.g., "Implement a mechanism for users to flag illegal content").
- **Export:** Generates a comprehensive PDF/Markdown compliance report.

### 4. Interactive Legal Q&A

A context-aware chatbot sits within the dashboard to answer follow-up questions. It uses RAG (Retrieval-Augmented Generation) grounded in the official DSA legal text to minimize hallucinations and provide citation-backed answers.

---

## 🏗️ Design Principles

### Structured Prompt Engineering with Jinja Templates

All AI agents in this application follow a **template-driven prompt architecture** using Jinja2. This approach provides:

- **Separation of Concerns:** Prompts are stored in `.jinja` files, separate from Python logic
- **Version Control:** Easy to track prompt changes and iterate on wording
- **Configurability:** Template variables allow dynamic prompt customization
- **Consistency:** Standardized structure across all agents

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
└── main_agent/
    └── src/main_agent/
        ├── prompts/
        │   └── system.jinja           # Multi-turn: system prompt only
        └── graph.py                   # User messages come from state
```

#### Usage Example

```python
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

_jinja_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    trim_blocks=True,
    lstrip_blocks=True,
)

def load_prompt(template_name: str, **kwargs) -> str:
    """Load and render a Jinja2 prompt template."""
    template = _jinja_env.get_template(template_name)
    return template.render(**kwargs)

# Usage (single-turn agent)
prompt = load_prompt(
    "prompt.jinja",
    company_name="Acme Corp",
    max_iterations=5,
)

# Usage (multi-turn agent - system prompt only)
system_prompt = load_prompt("system.jinja", context=frontend_context)
```

#### Template Conventions

1. **Header Comments:** Each template starts with a Jinja comment block describing its purpose and variables
2. **Markdown Formatting:** Prompts use Markdown for structure (headers, lists, code blocks)
3. **Default Values:** Use `{{ var | default(value) }}` for optional parameters
4. **Conditional Sections:** Use `{% if %}` blocks for context-dependent content
5. **Single vs Multi-Turn:**

   - **Single-turn agents** (company_matcher, company_researcher): Use one combined prompt template
   - **Multi-turn agents** (main_agent): Separate system prompt from user messages

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
