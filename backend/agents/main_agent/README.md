# Corinna - Main Agent

ReAct agent for helping users understand and comply with the EU's Digital Services Act.

## Tools

- **web_search**: Search the web via Tavily
- **retrieve_dsa_knowledge**: Query the DSA legal knowledge base

## Usage

```python
from main_agent import main_agent
from langchain_core.messages import HumanMessage

# Simple query
result = await main_agent.ainvoke({
    "messages": [HumanMessage(content="What are the transparency requirements for online platforms?")]
})

# With frontend context (string for now, will be refined later)
result = await main_agent.ainvoke({
    "messages": [HumanMessage(content="Which articles apply to us?")],
    "frontend_context": "Company: TikTok, Category: VLOP, Page: compliance_roadmap"
})
```

## Streaming

```python
async for event in main_agent.astream_events({
    "messages": [HumanMessage(content="Explain Article 15")]
}, version="v2"):
    print(event)
```

## Configuration

| Variable         | Default                |
| ---------------- | ---------------------- |
| `MAIN_MODEL`     | `openai:deepseek-chat` |
| `MAX_ITERATIONS` | `10`                   |

## LangGraph Studio

```bash
cd backend/agents/main_agent
langgraph dev
```
