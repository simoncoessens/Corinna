"""Script to ingest DSA document into Qdrant (one-time setup)."""
import sys
import argparse
from pathlib import Path

from dotenv import load_dotenv

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from knowledge_base.dsa_parser import download_dsa_html, parse_dsa_document
from knowledge_base.retriever import DSARetriever


def main():
    """Download DSA, parse it, and index into Qdrant."""
    parser = argparse.ArgumentParser(description="Ingest DSA document into Qdrant")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-indexing even if collection already exists",
    )
    args = parser.parse_args()

    load_dotenv()

    print("Initializing Qdrant retriever...")
    retriever = DSARetriever()

    # Check if already indexed
    if retriever.collection_has_data() and not args.force:
        print("Collection already exists with data. Use --force to re-index.")
        return

    print("Downloading DSA document from EUR-Lex...")
    html = download_dsa_html()
    print(f"Downloaded {len(html):,} bytes")

    print("Parsing document into chunks...")
    chunks = parse_dsa_document(html)
    print(f"Parsed {len(chunks)} chunks")

    # Summary by type
    by_type = {}
    for chunk in chunks:
        by_type[chunk.chunk_type] = by_type.get(chunk.chunk_type, 0) + 1
    for chunk_type, count in by_type.items():
        print(f"  - {chunk_type}: {count}")

    print("Creating collection...")
    retriever.create_collection(force=args.force)

    print("Indexing chunks...")
    retriever.index_chunks(chunks)

    print("Done! Knowledge base ready.")


if __name__ == "__main__":
    main()

