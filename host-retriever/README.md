# DSA Knowledge Base - Hosted Retriever

This folder contains everything needed to host the DSA Knowledge Base retriever for external users.

## Structure

```
host-retriever/
├── api/              # FastAPI application
│   ├── main.py      # API endpoints
│   └── templates/   # HTML UI
├── knowledge_base/   # Knowledge base code (copied from backend)
├── Dockerfile       # Container definition
├── requirements.txt # Python dependencies
└── render.yaml      # Render deployment config
```

## How It Works

- **Qdrant runs in the same container** as the API (no separate service needed)
- The startup script starts Qdrant first, then the API
- Qdrant data is stored in `/tmp/qdrant_storage` (persists in Render's disk)

## Deployment to Render

1. Push code to GitHub
2. Connect repo to Render
3. Render will detect `render.yaml` and deploy automatically
4. Set environment variable: `OPENAI_API_KEY`

## Local Testing

```bash
cd host-retriever
docker build -t dsa-retriever .
docker run -p 8000:8000 -e OPENAI_API_KEY=your-key dsa-retriever
```

## Data Ingestion

Before first use, you need to ingest the DSA data. You can do this by:

1. Running the ingestion script locally and pushing data to Qdrant Cloud, OR
2. Adding an ingestion step to the Dockerfile startup (for first-time setup)

The knowledge base data needs to be in Qdrant before the API can serve queries.
