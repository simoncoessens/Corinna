"""Startup script to ensure knowledge base is populated."""
import os
import sys
from pathlib import Path

# Add repo root to path
sys.path.append(str(Path(__file__).parent.parent))

from backend.knowledge_base import DSARetriever
from backend.knowledge_base.dsa_parser import download_dsa_html, parse_dsa_document


def ensure_knowledge_base_populated():
    """Check if knowledge base has data, ingest if empty."""
    retriever = DSARetriever()
    
    if retriever.collection_has_data():
        print("✓ Knowledge base already populated")
        return
    
    print("Knowledge base is empty. Starting ingestion...")
    
    try:
        # Download and parse
        print("Downloading DSA document...")
        html = download_dsa_html()
        chunks = parse_dsa_document(html)
        print(f"Parsed {len(chunks)} chunks")
        
        # Create collection and index
        print("Creating collection...")
        retriever.create_collection()
        
        print("Indexing chunks (this may take a few minutes)...")
        retriever.index_chunks(chunks)
        
        print("✓ Knowledge base populated successfully!")
    except Exception as e:
        print(f"⚠ Error during ingestion: {e}")
        print("API will start but queries may fail until data is ingested")


if __name__ == "__main__":
    ensure_knowledge_base_populated()

