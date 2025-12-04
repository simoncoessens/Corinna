"""FastAPI app for Company Research agent with streaming."""
import asyncio
import json
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Add parent directory to path to import company_researcher
sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.callbacks import BaseCallbackHandler
from company_researcher.graph import company_researcher
from company_researcher.models import CompanyResearchResult, SubQuestionAnswer


class StreamingCallbackHandler(BaseCallbackHandler):
    """Callback handler that captures events for streaming."""
    
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.current_question = None
        # Track question per run_id chain - we traverse the run_id ancestry to find questions
        self.run_to_question = {}  # run_id (str) -> question
        self.run_to_parent = {}    # run_id (str) -> parent_run_id (str)
    
    def _extract_question_from_prompt(self, prompt_text: str) -> str | None:
        """Extract question from various prompt formats."""
        if not prompt_text:
            return None
        
        # Format 1: "Research question about {company}:\n\n{question}"
        if "Research question about" in prompt_text:
            lines = prompt_text.split('\n')
            for i, line in enumerate(lines):
                if "Research question about" in line:
                    # Next non-empty line is the question
                    for next_line in lines[i+1:]:
                        stripped = next_line.strip()
                        if stripped and not stripped.startswith("Use web_search"):
                            return stripped[:100]
                    break
        
        # Format 2: "QUESTION: {question}" (used in summarization)
        if "QUESTION:" in prompt_text:
            for line in prompt_text.split('\n'):
                if line.strip().startswith("QUESTION:"):
                    question = line.split(":", 1)[1].strip()
                    if question:
                        return question[:100]
        
        return None
    
    def _get_question_for_run(self, run_id, parent_run_id) -> str | None:
        """Get question for a run by traversing the run ancestry."""
        run_key = str(run_id) if run_id else None
        parent_key = str(parent_run_id) if parent_run_id else None
        
        # Store the parent relationship for future lookups
        if run_key and parent_key:
            self.run_to_parent[run_key] = parent_key
        
        # Try direct lookup on this run
        if run_key and run_key in self.run_to_question:
            return self.run_to_question[run_key]
        
        # Try parent lookup
        if parent_key and parent_key in self.run_to_question:
            # Also cache for this run_id for faster future lookups
            if run_key:
                self.run_to_question[run_key] = self.run_to_question[parent_key]
            return self.run_to_question[parent_key]
        
        # Traverse ancestry chain
        visited = set()
        current = parent_key
        while current and current not in visited:
            visited.add(current)
            if current in self.run_to_question:
                # Cache for faster lookups
                if run_key:
                    self.run_to_question[run_key] = self.run_to_question[current]
                return self.run_to_question[current]
            current = self.run_to_parent.get(current)
        
        # Fall back to most recent question
        return self.current_question
    
    def on_llm_start(self, serialized, prompts, **kwargs):
        """Called when LLM starts."""
        run_id = kwargs.get("run_id")
        parent_run_id = kwargs.get("parent_run_id")
        run_key = str(run_id) if run_id else None
        parent_key = str(parent_run_id) if parent_run_id else None
        
        # Store parent relationship
        if run_key and parent_key:
            self.run_to_parent[run_key] = parent_key
        
        # Try to extract question from prompt
        if prompts:
            prompt_text = prompts[0] if isinstance(prompts, list) else str(prompts)
            question = self._extract_question_from_prompt(prompt_text)
            
            if question:
                self.current_question = question
                if run_key:
                    self.run_to_question[run_key] = question
                # Also associate with parent for child lookups
                if parent_key:
                    self.run_to_question[parent_key] = question
    
    def on_chat_model_start(self, serialized, messages, **kwargs):
        """Called when chat model starts - handles message format."""
        run_id = kwargs.get("run_id")
        parent_run_id = kwargs.get("parent_run_id")
        run_key = str(run_id) if run_id else None
        parent_key = str(parent_run_id) if parent_run_id else None
        
        # Store parent relationship
        if run_key and parent_key:
            self.run_to_parent[run_key] = parent_key
        
        # Extract question from messages
        if messages:
            # Flatten nested message lists
            all_messages = []
            for msg_list in messages:
                if isinstance(msg_list, list):
                    all_messages.extend(msg_list)
                else:
                    all_messages.append(msg_list)
            
            # Look through all messages for question patterns
            for msg in all_messages:
                content = ""
                if hasattr(msg, 'content'):
                    content = str(msg.content)
                elif isinstance(msg, dict):
                    content = str(msg.get('content', ''))
                elif isinstance(msg, str):
                    content = msg
                
                question = self._extract_question_from_prompt(content)
                if question:
                    self.current_question = question
                    if run_key:
                        self.run_to_question[run_key] = question
                    if parent_key:
                        self.run_to_question[parent_key] = question
                    break
    
    def on_llm_new_token(self, token: str, **kwargs):
        """Called on each new LLM token."""
        run_id = kwargs.get("run_id")
        parent_run_id = kwargs.get("parent_run_id")
        question = self._get_question_for_run(run_id, parent_run_id)
        
        try:
            self.queue.put_nowait({
                "type": "token",
                "content": token,
                "question": question
            })
        except asyncio.QueueFull:
            pass
    
    def on_tool_start(self, serialized, input_str, **kwargs):
        """Called when a tool starts."""
        run_id = kwargs.get("run_id")
        parent_run_id = kwargs.get("parent_run_id")
        tool_name = serialized.get("name", "unknown")
        question = self._get_question_for_run(run_id, parent_run_id)
        
        try:
            self.queue.put_nowait({
                "type": "tool",
                "name": tool_name,
                "status": "start",
                "question": question
            })
        except asyncio.QueueFull:
            pass
    
    def on_tool_end(self, output, **kwargs):
        """Called when a tool ends."""
        run_id = kwargs.get("run_id")
        parent_run_id = kwargs.get("parent_run_id")
        question = self._get_question_for_run(run_id, parent_run_id)
        
        try:
            self.queue.put_nowait({
                "type": "tool_end",
                "question": question
            })
        except asyncio.QueueFull:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("✓ Company Research API ready")
    yield


app = FastAPI(
    title="Company Research Agent",
    description="Research companies for DSA compliance",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    company_name: str


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy", "ready": True}


async def stream_research(company_name: str) -> AsyncGenerator[str, None]:
    """Stream research progress as Server-Sent Events."""
    
    # Create a queue for streaming events
    event_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
    callback_handler = StreamingCallbackHandler(event_queue)
    
    # Send initial message
    yield f"data: {json.dumps({'type': 'status', 'message': f'Starting research for {company_name}...'})}\n\n"
    
    final_result = None
    research_task = None
    research_error = None
    
    try:
        # Run the research in a background task
        input_state = {"messages": [HumanMessage(content=company_name)]}
        config = {"callbacks": [callback_handler]}
        
        async def run_research():
            nonlocal final_result, research_error
            try:
                final_result = await company_researcher.ainvoke(input_state, config=config)
            except Exception as e:
                research_error = str(e)
                print(f"Research error: {e}")
                import traceback
                traceback.print_exc()
        
        research_task = asyncio.create_task(run_research())
        
        questions_seen = set()
        last_status = ""
        
        # Stream events while research is running
        while not research_task.done():
            try:
                # Wait for events with timeout
                event = await asyncio.wait_for(event_queue.get(), timeout=0.1)
                
                if event["type"] == "token":
                    question = event.get("question", "")
                    if question and question not in questions_seen:
                        questions_seen.add(question)
                        yield f"data: {json.dumps({'type': 'question_start', 'question': question, 'count': len(questions_seen)})}\n\n"
                    
                    # Stream the token WITH the question so frontend can route it correctly
                    yield f"data: {json.dumps({'type': 'token', 'content': event['content'], 'question': question})}\n\n"
                
                elif event["type"] == "tool":
                    tool_name = event.get("name", "unknown")
                    question = event.get("question", "")
                    msg = f"🔍 Searching: {question[:60]}..." if question else f"🔧 Running {tool_name}..."
                    if msg != last_status:
                        last_status = msg
                        yield f"data: {json.dumps({'type': 'status', 'message': msg})}\n\n"
                    # Include question so frontend can route to correct block
                    yield f"data: {json.dumps({'type': 'tool', 'name': tool_name, 'status': 'start', 'question': question})}\n\n"
                
                elif event["type"] == "tool_end":
                    question = event.get("question", "")
                    yield f"data: {json.dumps({'type': 'tool', 'name': 'web_search', 'status': 'end', 'question': question})}\n\n"
                    
            except asyncio.TimeoutError:
                # No events, check if task is still running
                continue
            except Exception as e:
                print(f"Event processing error: {e}")
                continue
        
        # Wait for research to complete and get any exception
        try:
            await research_task
        except Exception as e:
            research_error = str(e)
            print(f"Task await error: {e}")
        
        # Check for errors
        if research_error:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Research error: {research_error}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return
        
        # Send final result
        if final_result:
            final_report = final_result.get("final_report", "")
            if final_report:
                yield f"data: {json.dumps({'type': 'status', 'message': '📊 Compiling results...'})}\n\n"
                await asyncio.sleep(0.2)  # Small delay for UX
                try:
                    result_data = json.loads(final_report)
                    # Keep full raw_research - no truncation
                    
                    # Use ensure_ascii=False to handle unicode properly
                    # Use separators=(',', ':') for compact JSON to reduce size
                    result_json = json.dumps(
                        {'type': 'result', 'data': result_data}, 
                        ensure_ascii=False,
                        separators=(',', ':')  # Compact JSON without extra spaces
                    )
                    
                    # Log the size for debugging
                    result_size = len(result_json)
                    print(f"Result JSON size: {result_size} bytes")
                    
                    # Send the full result - no truncation
                    yield f"data: {result_json}\n\n"
                except (json.JSONDecodeError, UnicodeEncodeError) as e:
                    print(f"JSON encoding error: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Invalid result format: {str(e)[:100]}'})}\n\n"
                except Exception as e:
                    print(f"Unexpected error sending result: {e}")
                    import traceback
                    traceback.print_exc()
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Error sending results: {str(e)[:100]}'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No report generated'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Research returned no result'})}\n\n"
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
    except Exception as e:
        print(f"Stream error: {e}")
        import traceback
        traceback.print_exc()
        if research_task and not research_task.done():
            research_task.cancel()
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"


@app.post("/research/stream")
async def research_stream(request: ResearchRequest):
    """Stream research results for a company."""
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    return StreamingResponse(
        stream_research(request.company_name.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/research")
async def research(request: ResearchRequest):
    """Non-streaming research endpoint."""
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    
    try:
        input_state = {"messages": [HumanMessage(content=request.company_name.strip())]}
        result = await company_researcher.ainvoke(input_state)
        final_report = result.get("final_report", "")
        
        if final_report:
            return json.loads(final_report)
        else:
            raise HTTPException(status_code=500, detail="No report generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
def home():
    """Serve the research UI."""
    template_path = Path(__file__).parent / "templates" / "index.html"
    with open(template_path, "r") as f:
        return HTMLResponse(content=f.read())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
