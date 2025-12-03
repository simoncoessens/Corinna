"""FastAPI app for DSA Knowledge Base retrieval."""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from knowledge_base import DSARetriever

# Global retriever instance
retriever: DSARetriever | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize retriever on startup."""
    global retriever
    retriever = DSARetriever()
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
    if retriever and retriever.is_ready():
        return {"status": "healthy", "ready": True}
    return {"status": "unhealthy", "ready": False}


@app.post("/query", response_model=QueryResponse)
def query_dsa(request: QueryRequest):
    """Query the DSA knowledge base."""
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


@app.get("/", response_class=HTMLResponse)
def home():
    """Serve the search UI."""
    with open(Path(__file__).parent / "templates" / "index.html", "r") as f:
        return HTMLResponse(content=f.read())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

