"""Unified FastAPI app for all DSA Copilot agents with streaming support."""

import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add agents to path
backend_path = Path(__file__).resolve().parent.parent
agents_path = backend_path / "agents"
sys.path.insert(0, str(backend_path))

# Add each agent's src directory to path for imports
agent_src_paths = [
    agents_path / "company_matcher" / "src",
    agents_path / "company_researcher" / "src",
    agents_path / "service_categorizer" / "src",
    agents_path / "main_agent" / "src",
]

for path in agent_src_paths:
    if path.exists():
        sys.path.insert(0, str(path))

# Import agents
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.runnables import Runnable

# Import each agent
try:
    from company_matcher.graph import company_matcher
    from company_matcher.state import CompanyMatcherInputState
    from company_matcher.models import CompanyMatchResult
except ImportError as e:
    print(f"Warning: Could not import company_matcher: {e}")
    company_matcher = None
    CompanyMatcherInputState = None

try:
    from company_researcher.graph import company_researcher
    from company_researcher.state import CompanyResearchInputState
except ImportError as e:
    print(f"Warning: Could not import company_researcher: {e}")
    company_researcher = None
    CompanyResearchInputState = None

try:
    from service_categorizer.graph import service_categorizer
    from service_categorizer.state import ServiceCategorizerInputState
except ImportError as e:
    print(f"Warning: Could not import service_categorizer: {e}")
    service_categorizer = None
    ServiceCategorizerInputState = None

try:
    from main_agent.graph import main_agent
    from main_agent.state import MainAgentInputState
except ImportError as e:
    print(f"Warning: Could not import main_agent: {e}")
    main_agent = None
    MainAgentInputState = None


# =============================================================================
# Request/Response Models
# =============================================================================

class CompanyMatcherRequest(BaseModel):
    """Request for company matcher."""
    company_name: str


class CompanyResearcherRequest(BaseModel):
    """Request for company researcher."""
    company_name: str


class ServiceCategorizerRequest(BaseModel):
    """Request for service categorizer."""
    company_profile: Dict[str, Any]  # JSON object with company profile


class MainAgentRequest(BaseModel):
    """Request for main agent."""
    message: str
    frontend_context: Optional[str] = None


# =============================================================================
# Streaming Helper
# =============================================================================

async def stream_agent_events(
    graph: Runnable,
    input_state: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream all events from a LangGraph agent, including subagents.
    
    Uses astream_events to capture all tokens, tool calls, and node executions.
    This captures events from all nested agents and subgraphs.
    """
    try:
        # Stream events with version="v2" to get all nested events including subagents
        async for event in graph.astream_events(
            input_state,
            version="v2",
            config=config or {},
        ):
            # Filter for relevant events
            event_type = event.get("event")
            event_name = event.get("name")
            node = event.get("node", "unknown")
            
            # Stream LLM tokens - capture all chat model streaming events
            if event_type == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk", {})
                if chunk:
                    # Handle different chunk formats
                    content = None
                    if hasattr(chunk, "content"):
                        content = chunk.content
                    elif isinstance(chunk, dict):
                        content = chunk.get("content", "")
                    
                    if content:
                        token_data = {
                            'type': 'token',
                            'content': content,
                            'node': node,
                            'agent': event_name or 'unknown',
                        }
                        yield f"data: {json.dumps(token_data, ensure_ascii=False)}\n\n"
            
            # Stream LLM start events
            elif event_type == "on_chat_model_start":
                llm_start_data = {
                    'type': 'llm_start',
                    'node': node,
                    'agent': event_name or 'unknown',
                }
                yield f"data: {json.dumps(llm_start_data)}\n\n"
            
            # Stream tool calls
            elif event_type == "on_tool_start":
                tool_input = event.get("data", {}).get("input", {})
                input_str = str(tool_input)[:200] if tool_input else ""
                tool_start_data = {
                    'type': 'tool_start',
                    'name': event_name or 'unknown',
                    'node': node,
                    'input': input_str,
                }
                yield f"data: {json.dumps(tool_start_data)}\n\n"
            
            elif event_type == "on_tool_end":
                output = event.get("data", {}).get("output", "")
                output_str = str(output)
                
                # Extract URLs from search results for web_search tool
                sources = []
                if event_name == "web_search" and output_str:
                    import re
                    # Find URLs in the output
                    url_pattern = r'https?://[^\s\n]+'
                    urls = re.findall(url_pattern, output_str)
                    # Also try to extract titles (format: "**Title**\n   URL")
                    title_pattern = r'\*\*([^*]+)\*\*\n\s+(https?://[^\s\n]+)'
                    title_matches = re.findall(title_pattern, output_str)
                    if title_matches:
                        sources = [{"title": t.strip(), "url": u.strip()} for t, u in title_matches[:8]]
                    elif urls:
                        sources = [{"url": u.strip()} for u in urls[:8]]
                
                tool_end_data = {
                    'type': 'tool_end',
                    'name': event_name or 'unknown',
                    'node': node,
                    'output_length': len(output_str),
                    'sources': sources,
                }
                yield f"data: {json.dumps(tool_end_data)}\n\n"
            
            # Stream node transitions (when entering/exiting graph nodes)
            elif event_type == "on_chain_start":
                chain_name = event.get("name", "")
                if chain_name and ("Graph" in chain_name or "Sequence" in chain_name):
                    node_start_data = {
                        'type': 'node_start',
                        'node': node,
                        'chain': chain_name,
                    }
                    yield f"data: {json.dumps(node_start_data)}\n\n"
            
            elif event_type == "on_chain_end":
                chain_name = event.get("name", "")
                if chain_name and ("Graph" in chain_name or "Sequence" in chain_name):
                    node_end_data = {
                        'type': 'node_end',
                        'node': node,
                        'chain': chain_name,
                    }
                    yield f"data: {json.dumps(node_end_data)}\n\n"
        
        # Send completion signal
        done_data = {'type': 'done'}
        yield f"data: {json.dumps(done_data)}\n\n"
        
    except Exception as e:
        error_msg = str(e)[:500]
        error_data = {
            'type': 'error',
            'message': error_msg,
        }
        yield f"data: {json.dumps(error_data)}\n\n"
        yield f"data: {json.dumps(done_data)}\n\n"


async def stream_with_final_result(
    graph: Runnable,
    input_state: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
    extract_result: Optional[Callable[[Dict[str, Any]], Optional[Dict[str, Any]]]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream agent events and include final result.
    
    Args:
        graph: The compiled LangGraph
        input_state: Input state for the graph
        config: Optional configuration
        extract_result: Optional function to extract result from final state
    """
    result_queue: asyncio.Queue = asyncio.Queue(maxsize=1)
    
    async def run_agent():
        try:
            result = await graph.ainvoke(input_state, config=config or {})
            await result_queue.put(("success", result))
        except Exception as e:
            await result_queue.put(("error", str(e)))
    
    task = asyncio.create_task(run_agent())
    
    # Stream events while agent runs
    async for chunk in stream_agent_events(graph, input_state, config):
        yield chunk
    
    # Wait for final result
    try:
        status, result = await asyncio.wait_for(result_queue.get(), timeout=300.0)
        if status == "success":
            if extract_result:
                extracted = extract_result(result)
                if extracted is not None:
                    result_data = {
                        'type': 'result',
                        'data': extracted,
                    }
                    yield f"data: {json.dumps(result_data)}\n\n"
        else:
            error_data = {
                'type': 'error',
                'message': result,
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    except asyncio.TimeoutError:
        timeout_data = {
            'type': 'error',
            'message': 'Timeout waiting for result',
        }
        yield f"data: {json.dumps(timeout_data)}\n\n"
    except Exception as e:
        exception_data = {
            'type': 'error',
            'message': str(e)[:500],
        }
        yield f"data: {json.dumps(exception_data)}\n\n"


# =============================================================================
# FastAPI App
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("✓ DSA Copilot API ready")
    print(f"  - Company Matcher: {'✓' if company_matcher else '✗'}")
    print(f"  - Company Researcher: {'✓' if company_researcher else '✗'}")
    print(f"  - Service Categorizer: {'✓' if service_categorizer else '✗'}")
    print(f"  - Main Agent: {'✓' if main_agent else '✗'}")
    yield


app = FastAPI(
    title="DSA Copilot API",
    description="Unified API for all DSA Copilot agents with streaming support",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agents": {
            "company_matcher": company_matcher is not None,
            "company_researcher": company_researcher is not None,
            "service_categorizer": service_categorizer is not None,
            "main_agent": main_agent is not None,
        }
    }


# =============================================================================
# Company Matcher Endpoints
# =============================================================================

@app.post("/agents/company_matcher/stream")
async def company_matcher_stream(request: CompanyMatcherRequest):
    """Stream company matching results."""
    if not company_matcher:
        raise HTTPException(status_code=503, detail="Company matcher not available")
    
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    input_state: CompanyMatcherInputState = {
        "messages": [HumanMessage(content=request.company_name.strip())]
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        match_result = result.get("match_result", "")
        if match_result:
            try:
                return json.loads(match_result)
            except json.JSONDecodeError:
                return None
        return None
    
    stream = stream_with_final_result(company_matcher, input_state, extract_result=extract_result)
    
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/agents/company_matcher")
async def company_matcher_invoke(request: CompanyMatcherRequest):
    """Non-streaming company matching."""
    if not company_matcher:
        raise HTTPException(status_code=503, detail="Company matcher not available")
    
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    try:
        input_state: CompanyMatcherInputState = {
            "messages": [HumanMessage(content=request.company_name.strip())]
        }
        result = await company_matcher.ainvoke(input_state)
        match_result = result.get("match_result", "")
        
        if match_result:
            return json.loads(match_result)
        else:
            raise HTTPException(status_code=500, detail="No match result generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Company Researcher Endpoints
# =============================================================================

@app.post("/agents/company_researcher/stream")
async def company_researcher_stream(request: CompanyResearcherRequest):
    """Stream company research results."""
    if not company_researcher:
        raise HTTPException(status_code=503, detail="Company researcher not available")
    
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    input_state: CompanyResearchInputState = {
        "messages": [HumanMessage(content=request.company_name.strip())]
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        final_report = result.get("final_report", "")
        if final_report:
            try:
                return json.loads(final_report)
            except json.JSONDecodeError:
                return None
        return None
    
    stream = stream_with_final_result(company_researcher, input_state, extract_result=extract_result)
    
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/agents/company_researcher")
async def company_researcher_invoke(request: CompanyResearcherRequest):
    """Non-streaming company research."""
    if not company_researcher:
        raise HTTPException(status_code=503, detail="Company researcher not available")
    
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    try:
        input_state: CompanyResearchInputState = {
            "messages": [HumanMessage(content=request.company_name.strip())]
        }
        result = await company_researcher.ainvoke(input_state)
        final_report = result.get("final_report", "")
        
        if final_report:
            return json.loads(final_report)
        else:
            raise HTTPException(status_code=500, detail="No report generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Service Categorizer Endpoints
# =============================================================================

@app.post("/agents/service_categorizer/stream")
async def service_categorizer_stream(request: ServiceCategorizerRequest):
    """Stream service categorization results."""
    if not service_categorizer:
        raise HTTPException(status_code=503, detail="Service categorizer not available")
    
    input_state: ServiceCategorizerInputState = {
        "messages": [HumanMessage(content=json.dumps(request.company_profile))]
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        final_report = result.get("final_report", "")
        if final_report:
            try:
                return json.loads(final_report)
            except json.JSONDecodeError:
                return None
        return None
    
    stream = stream_with_final_result(service_categorizer, input_state, extract_result=extract_result)
    
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/agents/service_categorizer")
async def service_categorizer_invoke(request: ServiceCategorizerRequest):
    """Non-streaming service categorization."""
    if not service_categorizer:
        raise HTTPException(status_code=503, detail="Service categorizer not available")
    
    try:
        input_state: ServiceCategorizerInputState = {
            "messages": [HumanMessage(content=json.dumps(request.company_profile))]
        }
        result = await service_categorizer.ainvoke(input_state)
        final_report = result.get("final_report", "")
        
        if final_report:
            return json.loads(final_report)
        else:
            raise HTTPException(status_code=500, detail="No report generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main Agent Endpoints
# =============================================================================

@app.post("/agents/main_agent/stream")
async def main_agent_stream(request: MainAgentRequest):
    """Stream main agent responses."""
    if not main_agent:
        raise HTTPException(status_code=503, detail="Main agent not available")
    
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    
    input_state: MainAgentInputState = {
        "messages": [HumanMessage(content=request.message.strip())],
        "frontend_context": request.frontend_context,
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        messages = result.get("messages", [])
        if messages:
            last_message = messages[-1]
            content = last_message.content if hasattr(last_message, "content") else str(last_message)
            return {"response": content}
        return None
    
    stream = stream_with_final_result(main_agent, input_state, extract_result=extract_result)
    
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/agents/main_agent")
async def main_agent_invoke(request: MainAgentRequest):
    """Non-streaming main agent."""
    if not main_agent:
        raise HTTPException(status_code=503, detail="Main agent not available")
    
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    
    try:
        input_state: MainAgentInputState = {
            "messages": [HumanMessage(content=request.message.strip())],
            "frontend_context": request.frontend_context,
        }
        result = await main_agent.ainvoke(input_state)
        messages = result.get("messages", [])
        
        if messages:
            last_message = messages[-1]
            content = last_message.content if hasattr(last_message, "content") else str(last_message)
            return {"response": content}
        else:
            raise HTTPException(status_code=500, detail="No response generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Root
# =============================================================================

@app.get("/")
def root():
    """API root endpoint."""
    return {
        "name": "DSA Copilot API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "company_matcher": {
                "stream": "/agents/company_matcher/stream",
                "invoke": "/agents/company_matcher",
            },
            "company_researcher": {
                "stream": "/agents/company_researcher/stream",
                "invoke": "/agents/company_researcher",
            },
            "service_categorizer": {
                "stream": "/agents/service_categorizer/stream",
                "invoke": "/agents/service_categorizer",
            },
            "main_agent": {
                "stream": "/agents/main_agent/stream",
                "invoke": "/agents/main_agent",
            },
        }
    }


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

