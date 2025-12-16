"""Unified FastAPI app for all DSA Copilot agents with streaming support."""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

# Reconnectable streaming hub (does not depend on DB)
from api.stream_hub import stream_hub, StreamJob

# Logger (uvicorn will pick this up)
logger = logging.getLogger("dsa_copilot.api")

# Load environment variables from root .env file (project-wide config)
root_path = Path(__file__).resolve().parent.parent.parent
root_env_path = root_path / ".env"
if root_env_path.exists():
    load_dotenv(root_env_path, override=False)

# Also load backend-specific .env if it exists (for overrides)
backend_env_path = Path(__file__).resolve().parent.parent / ".env"
if backend_env_path.exists():
    load_dotenv(backend_env_path, override=True)

# Add backend to path for database imports
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

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
# Database and Session Tracking
# =============================================================================

try:
    from database import init_db
    from api.admin import router as admin_router
    from api.session_tracker import tracker, StepContext
    from database.models import SessionStatus, StepType
    DB_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Database not available: {e}")
    DB_AVAILABLE = False
    admin_router = None
    tracker = None


# =============================================================================
# Request/Response Models
# =============================================================================

class CompanyMatcherRequest(BaseModel):
    """Request for company matcher."""
    company_name: str
    country_of_establishment: str
    session_id: Optional[str] = None  # Optional session tracking


class CompanyResearcherRequest(BaseModel):
    """Request for company researcher."""
    company_name: str
    top_domain: Optional[str] = None
    summary_long: Optional[str] = None
    session_id: Optional[str] = None  # Optional session tracking


class ServiceCategorizerRequest(BaseModel):
    """Request for service categorizer."""
    company_profile: Dict[str, Any]  # JSON object with company profile
    top_domain: Optional[str] = None
    summary_long: Optional[str] = None
    session_id: Optional[str] = None  # Optional session tracking


class MainAgentRequest(BaseModel):
    """Request for main agent."""
    message: str
    frontend_context: Optional[str] = None
    context_mode: Optional[str] = None  # "review_findings", "obligations", or "general"
    session_id: Optional[str] = None  # Optional session tracking


# =============================================================================
# Streaming Helper
# =============================================================================

async def stream_agent_events(
    graph: Runnable,
    input_state: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
    *,
    include_done: bool = True,
    on_event: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream all events from a LangGraph agent, including subagents.
    
    Uses astream_events to capture all tokens, tool calls, and node executions.
    This captures events from all nested agents and subgraphs.
    """
    done_data = {'type': 'done'}
    try:
        # Stream events with version="v2" to get all nested events including subagents
        async for event in graph.astream_events(
            input_state,
            version="v2",
            config=config or {},
        ):
            if on_event is not None:
                try:
                    on_event(event)
                except Exception:
                    # Never let event observers break streaming
                    pass
            # Filter for relevant events
            event_type = event.get("event")
            event_name = event.get("name")
            metadata = event.get("metadata") or {}
            # LangGraph exposes node info in metadata, not as a top-level "node" key.
            node = (
                metadata.get("langgraph_node")
                or event.get("node")
                or "unknown"
            )
            
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
                    def clean_url(u: str) -> str:
                        u = (u or "").strip()
                        # Sometimes tool outputs are stringified with escaped newlines.
                        u = u.replace("\\n", "").replace("\\t", "")
                        # Strip common trailing punctuation/quotes.
                        return u.rstrip(").,;]}>\"'")
                    # Find URLs in the output
                    url_pattern = r'https?://[^\s\n]+'
                    urls = re.findall(url_pattern, output_str)
                    # Also try to extract titles (format: "**Title**\n   URL")
                    title_pattern = r'\*\*([^*]+)\*\*\n\s+(https?://[^\s\n]+)'
                    title_matches = re.findall(title_pattern, output_str)
                    if title_matches:
                        sources = [{"title": t.strip(), "url": clean_url(u)} for t, u in title_matches[:8]]
                    elif urls:
                        sources = [{"url": clean_url(u)} for u in urls[:8]]
                
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
                chain_name = event.get("name", "") or ""
                # Emit node transitions for actual LangGraph nodes (identified via metadata).
                # Fall back to emitting the top-level graph start for visibility.
                if metadata.get("langgraph_node") or chain_name == "LangGraph":
                    node_start_data = {
                        'type': 'node_start',
                        'node': node,
                        'chain': chain_name,
                    }
                    yield f"data: {json.dumps(node_start_data)}\n\n"
            
            elif event_type == "on_chain_end":
                chain_name = event.get("name", "") or ""
                if metadata.get("langgraph_node") or chain_name == "LangGraph":
                    node_end_data = {
                        'type': 'node_end',
                        'node': node,
                        'chain': chain_name,
                    }
                    yield f"data: {json.dumps(node_end_data)}\n\n"
        
        # Send completion signal (optional; stream_with_final_result controls ordering)
        if include_done:
            yield f"data: {json.dumps(done_data)}\n\n"
        
    except Exception as e:
        # Make sure we log server-side errors even if the client only sees a generic UI error.
        logger.exception("Streaming error while running agent events")
        error_msg = str(e)[:500]
        error_data = {
            'type': 'error',
            'message': error_msg,
        }
        yield f"data: {json.dumps(error_data)}\n\n"
        if include_done:
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
    # IMPORTANT:
    # - graph.astream_events() already executes the graph.
    # - Running graph.ainvoke() in parallel would execute the graph a second time.
    # We therefore capture the final output from the events stream and emit it once.

    final_output: Optional[Dict[str, Any]] = None

    def observe_event(event: Dict[str, Any]) -> None:
        nonlocal final_output
        # Prefer the top-level LangGraph output (root run has no parent_ids)
        if event.get("event") == "on_chain_end" and not event.get("parent_ids"):
            output = event.get("data", {}).get("output")
            if isinstance(output, dict):
                final_output = output

    # Stream events first (without done), so we can emit result before done.
    async for chunk in stream_agent_events(
        graph,
        input_state,
        config,
        include_done=False,
        on_event=observe_event,
    ):
        yield chunk

    # Emit final structured result if we managed to capture it.
    if extract_result and final_output is not None:
        try:
            extracted = extract_result(final_output)
            if extracted is not None:
                result_data = {
                    'type': 'result',
                    'data': extracted,
                }
                yield f"data: {json.dumps(result_data)}\n\n"
        except Exception as e:
            logger.exception("Failed to extract/emit final result for stream")
            exception_data = {
                'type': 'error',
                'message': str(e)[:500],
            }
            yield f"data: {json.dumps(exception_data)}\n\n"

    # Always finish with a completion signal
    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# =============================================================================
# FastAPI App
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Initialize database
    global DB_AVAILABLE, tracker
    if DB_AVAILABLE:
        try:
            from database.connection import DATABASE_URL, engine
            from sqlalchemy import text
            # Test connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Log which database is being used
            if DATABASE_URL.startswith("postgresql://"):
                # Mask password in log
                masked_url = DATABASE_URL.split("@")[1] if "@" in DATABASE_URL else "Supabase"
                print(f"✓ Database: PostgreSQL/Supabase ({masked_url})")
            elif DATABASE_URL.startswith("sqlite://"):
                print(f"⚠ Database: SQLite (local development only)")
                print("  Note: Set DATABASE_URL to use Supabase in production")
            else:
                print(f"✓ Database: {DATABASE_URL[:30]}...")
            
            init_db()
            print("✓ Database initialized and connected")
        except Exception as e:
            print(f"✗ Database initialization failed: {e}")
            import traceback
            traceback.print_exc()
            # Disable tracking for this process to avoid silent failures later on.
            DB_AVAILABLE = False
            tracker = None
    
    print("✓ DSA Copilot API ready")
    print(f"  - Company Matcher: {'✓' if company_matcher else '✗'}")
    print(f"  - Company Researcher: {'✓' if company_researcher else '✗'}")
    print(f"  - Service Categorizer: {'✓' if service_categorizer else '✗'}")
    print(f"  - Main Agent: {'✓' if main_agent else '✗'}")
    print(f"  - Session Tracking: {'✓' if DB_AVAILABLE else '✗'}")
    print(f"  - Admin Dashboard: {'✓' if admin_router else '✗'}")
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

# Include admin router
if admin_router:
    app.include_router(admin_router)


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
    """Stream company matching results. Supports reconnection via session_id."""
    if not company_matcher:
        raise HTTPException(status_code=503, detail="Company matcher not available")
    
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")

    if not request.country_of_establishment.strip():
        raise HTTPException(
            status_code=400, detail="Country of establishment is required"
        )
    
    session_id = request.session_id
    
    input_state: CompanyMatcherInputState = {
        "messages": [HumanMessage(content=request.company_name.strip())],
        "country_of_establishment": request.country_of_establishment.strip(),
    }
    
    # If we have a session_id, use reconnectable streaming via the hub
    if session_id:
        # Build a stable key for this matching job
        job_key = f"matcher:{session_id}:{request.company_name.strip().lower()}:{request.country_of_establishment.strip().lower()}"
        
        async def run_job(job: StreamJob) -> None:
            """Run the company matcher and buffer events in the job."""
            step_id: Optional[str] = None
            llm_calls = 0
            search_calls = 0
            sources_collected: List[Dict] = []
            error_occurred: Optional[str] = None

            if DB_AVAILABLE and tracker:
                # Ensure session exists and record that we're matching
                tracker.get_or_create_session(
                    session_id,
                    company_name=request.company_name.strip(),
                    country=request.country_of_establishment.strip(),
                )
                step_id = tracker.start_step(
                    session_id,
                    StepType.COMPANY_MATCHER,
                    {
                        "company_name": request.company_name,
                        "country": request.country_of_establishment,
                    },
                )

            def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                match_result = result.get("match_result", "")
                if match_result:
                    try:
                        parsed = json.loads(match_result)
                        # Update session with matched company info
                        if DB_AVAILABLE and tracker:
                            exact = parsed.get("exact_match")
                            if exact:
                                tracker.update_session(
                                    session_id,
                                    company_name=exact.get("name"),
                                    company_domain=exact.get("top_domain"),
                                    status=SessionStatus.COMPANY_MATCHED,
                                )
                            if step_id:
                                tracker.complete_step(step_id, parsed)
                        return parsed
                    except json.JSONDecodeError:
                        if step_id and tracker:
                            tracker.complete_step(
                                step_id,
                                error_message="Failed to parse result",
                            )
                        return None
                return None

            stream = stream_with_final_result(
                company_matcher,
                input_state,
                extract_result=extract_result,
            )

            try:
                async for chunk in stream:
                    # Collect metrics (best effort)
                    if chunk.startswith("data: "):
                        try:
                            event_data = json.loads(chunk[6:])
                            event_type = event_data.get("type")
                            if event_type == "llm_start":
                                llm_calls += 1
                            elif event_type == "tool_end":
                                name = event_data.get("name", "")
                                if "search" in name.lower():
                                    search_calls += 1
                                    sources = event_data.get("sources", [])
                                    if sources:
                                        sources_collected.extend(sources)
                        except json.JSONDecodeError:
                            pass

                    await job.append(chunk)
            except Exception as e:
                error_occurred = str(e)
                logger.exception("Company matcher job failed")
                error_chunk = f"data: {json.dumps({'type': 'error', 'message': str(e)[:500]})}\n\n"
                await job.append(error_chunk)
            finally:
                # Flush metrics once at the end
                if step_id and tracker:
                    try:
                        if llm_calls or search_calls or sources_collected:
                            tracker.update_step_metrics(
                                step_id,
                                llm_calls=llm_calls,
                                search_calls=search_calls,
                                sources=sources_collected if sources_collected else None,
                            )
                        if error_occurred:
                            tracker.complete_step(step_id, error_message=error_occurred)
                    except Exception:
                        # Never let tracking errors break streaming
                        pass

                await job.finish()
        
        job = await stream_hub.get_or_create(job_key, run_job)
        
        async def reconnectable_stream():
            async for chunk in job.subscribe():
                yield chunk
        
        return StreamingResponse(
            reconnectable_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    
    # Fallback: no session_id, run without reconnection support
    stream = stream_with_final_result(
        company_matcher, 
        input_state, 
        extract_result=extract_result,
    )
    
    # Wrap stream to collect metrics (non-blocking) and update DB at the end
    async def tracked_stream():
        llm_calls = 0
        search_calls = 0
        sources_collected: List[Dict] = []
        error_occurred = None
        
        try:
            async for chunk in stream:
                # Parse events to collect metrics (without DB calls during streaming)
                if chunk.startswith("data: "):
                    try:
                        event_data = json.loads(chunk[6:])
                        event_type = event_data.get("type")
                        if event_type == "llm_start":
                            llm_calls += 1
                        elif event_type == "tool_end" and "search" in event_data.get("name", "").lower():
                            search_calls += 1
                            sources = event_data.get("sources", [])
                            if sources:
                                sources_collected.extend(sources)
                    except json.JSONDecodeError:
                        pass
                yield chunk
        except Exception as e:
            error_occurred = str(e)
            raise
        finally:
            # Update DB once at the end (not during streaming)
            if step_id and tracker:
                try:
                    if llm_calls or search_calls or sources_collected:
                        tracker.update_step_metrics(
                            step_id, 
                            llm_calls=llm_calls, 
                            search_calls=search_calls,
                            sources=sources_collected if sources_collected else None
                        )
                    if error_occurred:
                        tracker.complete_step(step_id, error_message=error_occurred)
                except Exception:
                    pass  # Don't let tracking errors break the response
    
    return StreamingResponse(
        tracked_stream(),
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

    if not request.country_of_establishment.strip():
        raise HTTPException(
            status_code=400, detail="Country of establishment is required"
        )
    
    try:
        input_state: CompanyMatcherInputState = {
            "messages": [HumanMessage(content=request.company_name.strip())],
            "country_of_establishment": request.country_of_establishment.strip(),
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

    session_id = request.session_id

    # If we have a session id, make the stream reconnectable:
    # - first caller starts the background job
    # - refresh/reconnect replays buffered SSE chunks and continues live
    if session_id:
        payload = {
            "company_name": request.company_name.strip(),
            "top_domain": (request.top_domain or "").strip(),
            # summary_long can be big; include it for uniqueness but hash the full payload anyway
            "summary_long": (request.summary_long or "").strip(),
            "session_id": session_id,
        }
        key = "company_researcher:" + hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode("utf-8")
        ).hexdigest()

        async def runner(job):  # type: ignore[no-redef]
            step_id = None
            try:
                if DB_AVAILABLE and tracker:
                    tracker.update_session(session_id, status=SessionStatus.RESEARCHING)
                    step_id = tracker.start_step(
                        session_id,
                        StepType.COMPANY_RESEARCHER,
                        {
                            "company_name": payload["company_name"],
                            "top_domain": payload["top_domain"] or None,
                        },
                    )

                input_state: CompanyResearchInputState = {
                    "messages": [HumanMessage(content=payload["company_name"])],
                    "company_name": payload["company_name"],
                    "top_domain": payload["top_domain"] or None,
                    "summary_long": payload["summary_long"] or None,
                }

                def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                    final_report = result.get("final_report", "")
                    if final_report:
                        try:
                            parsed = json.loads(final_report)
                            if DB_AVAILABLE and tracker:
                                try:
                                    tracker.update_session(
                                        session_id, status=SessionStatus.RESEARCH_COMPLETE
                                    )
                                    if step_id:
                                        tracker.complete_step(step_id, parsed)
                                except Exception:
                                    logger.exception(
                                        "Session tracking failed while saving research result"
                                    )
                            return parsed
                        except json.JSONDecodeError:
                            if step_id and tracker:
                                try:
                                    tracker.complete_step(
                                        step_id,
                                        error_message="Failed to parse result",
                                    )
                                except Exception:
                                    logger.exception(
                                        "Session tracking failed while saving parse error"
                                    )
                            return None
                    return None

                stream = stream_with_final_result(
                    company_researcher,
                    input_state,
                    extract_result=extract_result,
                )

                llm_calls = 0
                search_calls = 0
                sources_collected: List[Dict] = []
                error_occurred = None

                try:
                    async for chunk in stream:
                        # Collect metrics (best effort)
                        if chunk.startswith("data: "):
                            try:
                                event_data = json.loads(chunk[6:])
                                event_type = event_data.get("type")
                                if event_type == "llm_start":
                                    llm_calls += 1
                                elif event_type == "tool_end":
                                    name = event_data.get("name", "")
                                    if "search" in name.lower():
                                        search_calls += 1
                                        sources = event_data.get("sources", [])
                                        if sources:
                                            sources_collected.extend(sources)
                            except json.JSONDecodeError:
                                pass

                        await job.append(chunk)
                except Exception as e:
                    error_occurred = str(e)
                    logger.exception("Error while running company research job")
                    # Emit an error event for subscribers
                    try:
                        await job.append(
                            f"data: {json.dumps({'type': 'error', 'message': error_occurred[:500]})}\n\n"
                        )
                        await job.append(f"data: {json.dumps({'type': 'done'})}\n\n")
                    except Exception:
                        pass
                finally:
                    if step_id and tracker:
                        try:
                            if llm_calls or search_calls or sources_collected:
                                tracker.update_step_metrics(
                                    step_id,
                                    llm_calls=llm_calls,
                                    search_calls=search_calls,
                                    sources=sources_collected
                                    if sources_collected
                                    else None,
                                )
                            if error_occurred:
                                tracker.complete_step(
                                    step_id, error_message=error_occurred
                                )
                        except Exception:
                            pass
            finally:
                await job.finish()

        job = await stream_hub.get_or_create(key, runner)

        return StreamingResponse(
            job.subscribe(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # No session id → fall back to direct streaming (no resume on refresh)
    input_state: CompanyResearchInputState = {
        "messages": [HumanMessage(content=request.company_name.strip())],
        "company_name": request.company_name.strip(),
        "top_domain": (request.top_domain or "").strip() or None,
        "summary_long": (request.summary_long or "").strip() or None,
    }

    stream = stream_with_final_result(company_researcher, input_state)

    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
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
            "messages": [HumanMessage(content=request.company_name.strip())],
            "company_name": request.company_name.strip(),
            "top_domain": (request.top_domain or "").strip() or None,
            "summary_long": (request.summary_long or "").strip() or None,
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
    
    # Session tracking
    session_id = request.session_id
    step_id = None
    if session_id and DB_AVAILABLE and tracker:
        tracker.update_session(session_id, status=SessionStatus.CLASSIFYING)
        step_id = tracker.start_step(
            session_id,
            StepType.SERVICE_CATEGORIZER,
            {"company_profile": request.company_profile},
        )
    
    input_state: ServiceCategorizerInputState = {
        "messages": [HumanMessage(content=json.dumps(request.company_profile))],
        "top_domain": (request.top_domain or "").strip() or None,
        "summary_long": (request.summary_long or "").strip() or None,
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        final_report = result.get("final_report", "")
        if final_report:
            try:
                parsed = json.loads(final_report)
                # Update session with classification results
                if session_id and DB_AVAILABLE and tracker:
                    classification = parsed.get("classification", {})
                    svc = classification.get("service_classification", {})
                    scope = classification.get("territorial_scope", {})
                    size = classification.get("size_designation", {})
                    obligations = parsed.get("obligations", [])
                    
                    applicable = len([o for o in obligations if o.get("applies", False)])
                    
                    tracker.update_session(
                        session_id,
                        service_category=svc.get("service_category"),
                        is_in_scope=scope.get("is_in_scope"),
                        is_vlop=size.get("is_vlop_vlose"),
                        applicable_obligations_count=applicable,
                        total_obligations_count=len(obligations),
                        compliance_report=parsed,
                    )
                    tracker.complete_session(session_id)
                    if step_id:
                        tracker.complete_step(step_id, parsed)
                return parsed
            except json.JSONDecodeError:
                if step_id and tracker:
                    tracker.complete_step(step_id, error_message="Failed to parse result")
                return None
        return None
    
    stream = stream_with_final_result(service_categorizer, input_state, extract_result=extract_result)
    
    # Wrap stream to collect metrics (non-blocking) and update DB at the end
    async def tracked_stream():
        llm_calls = 0
        error_occurred = None
        
        try:
            async for chunk in stream:
                # Parse events to collect metrics (without DB calls during streaming)
                if chunk.startswith("data: "):
                    try:
                        event_data = json.loads(chunk[6:])
                        event_type = event_data.get("type")
                        if event_type == "llm_start":
                            llm_calls += 1
                    except json.JSONDecodeError:
                        pass
                yield chunk
        except Exception as e:
            error_occurred = str(e)
            raise
        finally:
            # Update DB once at the end (not during streaming)
            if step_id and tracker:
                try:
                    if llm_calls:
                        tracker.update_step_metrics(step_id, llm_calls=llm_calls)
                    if error_occurred:
                        tracker.complete_step(step_id, error_message=error_occurred)
                except Exception:
                    pass  # Don't let tracking errors break the response
    
    return StreamingResponse(
        tracked_stream(),
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
            "messages": [HumanMessage(content=json.dumps(request.company_profile))],
            "top_domain": (request.top_domain or "").strip() or None,
            "summary_long": (request.summary_long or "").strip() or None,
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
    
    # Session tracking - record user message
    session_id = request.session_id
    start_time = time.time()
    tools_used: List[str] = []
    sources_cited: List[Dict] = []
    
    if session_id and DB_AVAILABLE and tracker:
        tracker.add_chat_message(
            session_id,
            role="user",
            content=request.message.strip(),
            frontend_context=request.frontend_context,
            context_mode=request.context_mode,
        )
    
    input_state: MainAgentInputState = {
        "messages": [HumanMessage(content=request.message.strip())],
        "frontend_context": request.frontend_context,
        "context_mode": request.context_mode,
    }
    
    def extract_result(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        messages = result.get("messages", [])
        if messages:
            last_message = messages[-1]
            content = last_message.content if hasattr(last_message, "content") else str(last_message)
            
            # Record assistant response
            if session_id and DB_AVAILABLE and tracker:
                duration = time.time() - start_time
                tracker.add_chat_message(
                    session_id,
                    role="assistant",
                    content=content,
                    duration_seconds=duration,
                    tools_used=tools_used if tools_used else None,
                    sources_cited=sources_cited if sources_cited else None,
                )
            
            return {"response": content}
        return None
    
    stream = stream_with_final_result(main_agent, input_state, extract_result=extract_result)
    
    # Wrap stream to track tools and sources
    async def tracked_stream():
        async for chunk in stream:
            if chunk.startswith("data: ") and session_id:
                try:
                    event_data = json.loads(chunk[6:])
                    event_type = event_data.get("type")
                    if event_type == "tool_start":
                        tool_name = event_data.get("name", "")
                        if tool_name and tool_name not in tools_used:
                            tools_used.append(tool_name)
                    elif event_type == "tool_end":
                        sources = event_data.get("sources", [])
                        if sources:
                            sources_cited.extend(sources)
                except json.JSONDecodeError:
                    pass
            yield chunk
    
    return StreamingResponse(
        tracked_stream(),
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
            "context_mode": request.context_mode,
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

