"""FastAPI app for DSA Knowledge Base retrieval."""
from contextlib import asynccontextmanager
from pathlib import Path
import time
import httpx
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Add repo root to path to allow importing backend
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.knowledge_base import DSARetriever

# Global retriever instance
retriever: DSARetriever | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize retriever on startup with retry logic."""
    global retriever
    
    # Retry connecting to Qdrant (it might still be starting)
    max_retries = 15
    for attempt in range(max_retries):
        try:
            # First check if Qdrant is responding
            try:
                httpx.get("http://localhost:6333/health", timeout=1.0)
            except:
                if attempt < max_retries - 1:
                    print(f"⚠ Qdrant not responding yet (attempt {attempt + 1}/{max_retries}), waiting...")
                    time.sleep(2)
                    continue
                else:
                    raise Exception("Qdrant is not responding")
            
            # Now try to initialize retriever
            retriever = DSARetriever()
            print(f"✓ Retriever initialized (attempt {attempt + 1})")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠ Retriever init failed (attempt {attempt + 1}/{max_retries}): {e}, retrying...")
                time.sleep(2)
            else:
                print(f"✗ Failed to initialize retriever after {max_retries} attempts: {e}")
                # Don't raise - let it try to work anyway, health endpoint will show status
                retriever = None
    
    yield


app = FastAPI(
    title="DSA Knowledge Base",
    description="Search the Digital Services Act",
    lifespan=lifespan,
)


class QueryRequest(BaseModel):
    query: str
    limit: int = 5
    category: str | None = None
    chunk_type: str | None = None


class SearchResult(BaseModel):
    id: str
    title: str
    content: str
    section: str
    category: str
    chunk_type: str
    score: float


class QueryResponse(BaseModel):
    query: str
    results: list[SearchResult]
    count: int


@app.get("/health")
def health():
    """Check if the knowledge base is ready."""
    if not retriever:
        return {"status": "unhealthy", "ready": False, "error": "Retriever not initialized"}
    try:
        if retriever.is_ready():
            return {"status": "healthy", "ready": True}
        return {"status": "unhealthy", "ready": False, "error": "Knowledge base not populated"}
    except Exception as e:
        return {"status": "unhealthy", "ready": False, "error": str(e)}


@app.post("/query", response_model=QueryResponse)
def query_dsa(request: QueryRequest):
    """Query the DSA knowledge base."""
    if not retriever:
        raise Exception("Retriever not initialized")
    
    try:
        results = retriever.get_dsa_context(
            query=request.query,
            limit=request.limit,
            category=request.category if request.category else None,
            chunk_type=request.chunk_type if request.chunk_type else None,
        )
        return QueryResponse(
            query=request.query,
            results=[SearchResult(**r) for r in results],
            count=len(results),
        )
    except Exception as e:
        print(f"Error querying: {e}")
        raise Exception(f"Failed to query knowledge base: {str(e)}")


@app.get("/", response_class=HTMLResponse)
def home():
    """Serve the search UI."""
    with open(Path(__file__).parent / "templates" / "index.html", "r") as f:
        return HTMLResponse(content=f.read())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

