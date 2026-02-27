"""Main LangGraph workflow for the Corinna Main Agent.

ReAct agent with web search and DSA knowledge base retrieval.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from main_agent.configuration import Configuration
from main_agent.state import MainAgentInputState, MainAgentState
from main_agent.tools import get_all_tools

from tools.prompt_loader import create_prompt_loader


# =============================================================================
# Prompt Loading
# =============================================================================

load_prompt = create_prompt_loader(Path(__file__).resolve().parent / "prompts")


# =============================================================================
# Graph Nodes
# =============================================================================

async def agent(state: MainAgentState, config: RunnableConfig | None = None) -> dict:
    """Main ReAct agent node."""
    from api.model_config import get_chat_model

    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    model = get_chat_model("chat_model", config=config)

    tools = get_all_tools()
    model_with_tools = model.bind_tools(tools)

    # Build context from frontend state
    context = ""
    if state.get("frontend_context"):
        context = state["frontend_context"]

    # Get explicit context mode if provided
    context_mode = state.get("context_mode", "general")

    # Load system prompt from Jinja template
    system_prompt = load_prompt("system.jinja", context=context, context_mode=context_mode)

    system_msg = SystemMessage(content=system_prompt)
    messages = [system_msg] + list(state.get("messages", []))

    # Warn the model on the last allowed iteration
    iterations = state.get("iterations", 0)
    if iterations >= cfg.max_iterations - 1:
        warning = (
            f"\n\n⚠️ CRITICAL: This is your LAST iteration (iteration {iterations + 1} "
            f"of {cfg.max_iterations}). You MUST provide your final answer now. "
            f"Do NOT make any more tool calls."
        )
        messages.append(HumanMessage(content=warning))

    response = await model_with_tools.ainvoke(messages, config=config)

    return {"messages": [response]}


async def finalize(state: MainAgentState, config: RunnableConfig | None = None) -> dict:
    """Pass-through finalize node so LangGraph Dev shows a terminal step."""
    return {}


# =============================================================================
# Conditional edge: iteration-guarded tool routing
# =============================================================================

def should_continue(state: MainAgentState, config: RunnableConfig | None = None) -> Literal["tools", "finalize"]:
    """Route to tools or finalize, enforcing an iteration limit."""
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    iterations = state.get("iterations", 0)

    messages = state.get("messages", [])
    if not messages:
        return "finalize"

    last_message = messages[-1]

    # If the model didn't request any tool calls, we're done
    if isinstance(last_message, AIMessage):
        if not last_message.tool_calls:
            return "finalize"
        # Enforce iteration ceiling
        if iterations >= cfg.max_iterations:
            return "finalize"
        return "tools"

    return "finalize"


async def tools_with_counter(state: MainAgentState, config: RunnableConfig | None = None) -> dict:
    """Execute tools and increment the iteration counter."""
    tools = get_all_tools()
    tool_node = ToolNode(tools)

    result = await tool_node.ainvoke(state, config)

    current_iterations = state.get("iterations", 0)
    return {
        **result,
        "iterations": current_iterations + 1,
    }


# =============================================================================
# Graph Construction
# =============================================================================

_builder = StateGraph(
    MainAgentState,
    input=MainAgentInputState,
    config_schema=Configuration,
)

_builder.add_node("agent", agent)
_builder.add_node("tools", tools_with_counter)
_builder.add_node("finalize", finalize)

_builder.add_edge(START, "agent")
_builder.add_conditional_edges(
    "agent",
    should_continue,
    {"tools": "tools", "finalize": "finalize"},
)
_builder.add_edge("tools", "agent")
_builder.add_edge("finalize", END)

# Export
main_agent = _builder.compile()
