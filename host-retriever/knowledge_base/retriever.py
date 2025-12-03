"""Qdrant-based retriever for DSA knowledge base."""
import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
)
from openai import OpenAI

from .models import ArticleChunk


COLLECTION_NAME = "dsa_articles"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


class DSARetriever:
    """Retriever for DSA legal content using Qdrant."""

    def __init__(
        self,
        qdrant_url: str | None = None,
        qdrant_api_key: str | None = None,
        openai_api_key: str | None = None,
    ):
        self.qdrant = QdrantClient(
            url=qdrant_url or os.getenv("QDRANT_URL", "http://localhost:6333"),
            api_key=qdrant_api_key or os.getenv("QDRANT_API_KEY") or None,
            check_compatibility=False,  # Disable version check (client 1.16.1, server 1.11.0)
        )
        self.openai = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))

    def is_ready(self) -> bool:
        """Check if the knowledge base is ready for queries."""
        return self.collection_has_data()

    def collection_exists(self) -> bool:
        """Check if the collection exists."""
        try:
            self.qdrant.get_collection(COLLECTION_NAME)
            return True
        except Exception:
            return False

    def collection_has_data(self) -> bool:
        """Check if the collection has indexed data."""
        if not self.collection_exists():
            return False
        try:
            info = self.qdrant.get_collection(COLLECTION_NAME)
            return info.points_count > 0
        except Exception:
            return False

    def create_collection(self, force: bool = False) -> None:
        """
        Create Qdrant collection for DSA articles.
        
        Args:
            force: If True, recreate collection even if it exists.
        """
        if force or not self.collection_exists():
            self.qdrant.recreate_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )

    def _embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for texts."""
        response = self.openai.embeddings.create(model=EMBEDDING_MODEL, input=texts)
        return [item.embedding for item in response.data]

    def index_chunks(self, chunks: list[ArticleChunk], batch_size: int = 32) -> None:
        """Index article chunks into Qdrant."""
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = [chunk.to_text() for chunk in batch]
            embeddings = self._embed(texts)

            points = [
                PointStruct(
                    id=hash(chunk.id) % (2**63),
                    vector=embedding,
                    payload={
                        "id": chunk.id,
                        "article_number": chunk.article_number,
                        "title": chunk.title,
                        "content": chunk.content,
                        "section": chunk.section,
                        "category": chunk.category,
                        "chunk_type": chunk.chunk_type,
                    },
                )
                for chunk, embedding in zip(batch, embeddings)
            ]

            self.qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

    def get_dsa_context(
        self,
        query: str,
        limit: int = 5,
        category: str | None = None,
        chunk_type: str | None = None,
    ) -> list[dict]:
        """
        Retrieve relevant DSA context for a query.

        Args:
            query: The search query
            limit: Maximum number of results
            category: Filter by service category (e.g., "VLOP/VLOSE")
            chunk_type: Filter by type ("article", "recital", "definition")

        Returns:
            List of relevant chunks with scores
        """
        query_embedding = self._embed([query])[0]

        # Build filter if specified
        filter_conditions = []
        if category:
            filter_conditions.append(
                FieldCondition(key="category", match=MatchValue(value=category))
            )
        if chunk_type:
            filter_conditions.append(
                FieldCondition(key="chunk_type", match=MatchValue(value=chunk_type))
            )

        search_filter = Filter(must=filter_conditions) if filter_conditions else None

        # Try query_points first (Qdrant 1.11.0+), fallback to search for compatibility
        try:
            response = self.qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=query_embedding,
                limit=limit,
                query_filter=search_filter,
            )
            results = response.points
        except (AttributeError, Exception):
            # Fallback to search method for older Qdrant versions
            results = self.qdrant.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                limit=limit,
                query_filter=search_filter,
            )

        return [
            {
                "id": str(hit.id),
                "title": hit.payload.get("title", "") if isinstance(hit.payload, dict) else "",
                "content": hit.payload.get("content", "") if isinstance(hit.payload, dict) else "",
                "section": hit.payload.get("section", "") if isinstance(hit.payload, dict) else "",
                "category": hit.payload.get("category", "") if isinstance(hit.payload, dict) else "",
                "chunk_type": hit.payload.get("chunk_type", "") if isinstance(hit.payload, dict) else "",
                "score": float(hit.score),
            }
            for hit in results
        ]

