"""Main LangGraph workflow for the DSA Copilot Main Agent.

ReAct agent with web search and DSA knowledge base retrieval.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from main_agent.configuration import Configuration
from main_agent.state import MainAgentInputState, MainAgentState
from main_agent.tools import get_all_tools


# =============================================================================
# Prompt Loading
# =============================================================================

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


# =============================================================================
# API Credentials
# =============================================================================

def _get_api_credentials(config: RunnableConfig | None):
    """Get API key and base URL for DeepSeek."""
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        api_key = api_keys.get("OPENAI_API_KEY") or api_key
        base_url = api_keys.get("OPENAI_BASE_URL") or base_url
    
    return api_key, base_url


# =============================================================================
# Graph Nodes
# =============================================================================

async def agent(state: MainAgentState, config: RunnableConfig | None = None) -> dict:
    """Main ReAct agent node."""
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    api_key, base_url = _get_api_credentials(config)
    
    # Build model params, only including non-None values
    model_params = {
        "model": "deepseek-chat",
        "max_tokens": cfg.max_tokens,
    }
    if api_key:
        model_params["api_key"] = api_key
    if base_url:
        model_params["base_url"] = base_url
    
    model = ChatOpenAI(**model_params)
    
    tools = get_all_tools()
    model_with_tools = model.bind_tools(tools)
    
    # Build context from frontend state
    context = ""
    if state.get("frontend_context"):
        context = state["frontend_context"]
    
    # Load system prompt from Jinja template
    system_prompt = load_prompt("system.jinja", context=context)
    
    system_msg = SystemMessage(content=system_prompt)
    messages = [system_msg] + list(state.get("messages", []))
    
    response = await model_with_tools.ainvoke(messages)
    
    return {"messages": [response]}


# =============================================================================
# Routing
# =============================================================================

def should_continue(state: MainAgentState) -> Literal["tools", "end"]:
    """Check if we should continue to tools or end."""
    messages = state.get("messages", [])
    if not messages:
        return "end"
    
    last_msg = messages[-1]
    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        return "tools"
    return "end"


# =============================================================================
# Graph Construction
# =============================================================================

tools = get_all_tools()
tool_node = ToolNode(tools)

_builder = StateGraph(
    MainAgentState,
    input=MainAgentInputState,
    config_schema=Configuration,
)

_builder.add_node("agent", agent)
_builder.add_node("tools", tool_node)

_builder.add_edge(START, "agent")
_builder.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
_builder.add_edge("tools", "agent")

# Export
main_agent = _builder.compile()
