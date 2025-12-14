# DSA Knowledge Base

Legal knowledge base for the Digital Services Act (DSA) using Qdrant vector search.

## Setup

### 1. Start Qdrant (Docker)

```bash
# From project root
cd infra
docker-compose up -d qdrant redis
```

Qdrant will be available at `http://localhost:6333`
Redis will be available at `redis://localhost:6379`

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables

Create a `.env` file:

```bash
OPENAI_API_KEY=your-openai-api-key
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379/0
```

### 4. Ingest DSA Document

Run the ingestion script (one-time setup):

```bash
python -m knowledge_base.ingest
```

This will:

- Download the DSA from EUR-Lex
- Parse it into article chunks
- Generate embeddings
- Index into Qdrant

## Usage

```python
from knowledge_base import DSARetriever

retriever = DSARetriever()

# Check if ready
if retriever.is_ready():
    # Query the knowledge base
    results = retriever.get_dsa_context(
        "transparency reporting obligations",
        limit=5
    )

    # Filter by service category
    results = retriever.get_dsa_context(
        "content moderation",
        category="VLOP/VLOSE",
        limit=3
    )
```

## Development

- Qdrant runs in Docker for consistency
- Data persists in Docker volume `qdrant_storage`
- To reset: `docker-compose down -v` then re-run ingestion
