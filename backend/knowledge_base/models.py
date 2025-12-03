"""Data models for DSA knowledge base."""
from pydantic import BaseModel


class ArticleChunk(BaseModel):
    """A chunk of the DSA document, typically an article or recital."""

    id: str
    article_number: str | None = None
    title: str
    content: str
    section: str
    category: str
    chunk_type: str  # "article", "recital", "definition"

    def to_text(self) -> str:
        """Convert chunk to text for embedding."""
        return f"{self.title}\n\n{self.content}"

