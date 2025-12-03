"""Test script to verify DSA retrieval after ingestion."""
import sys
from pathlib import Path

from dotenv import load_dotenv

# Ensure we can import from knowledge_base
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load .env from project root
env_path = backend_dir.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

from knowledge_base.retriever import DSARetriever


def main():
    """Test retrieval functionality."""
    load_dotenv()

    print("Initializing retriever...")
    retriever = DSARetriever()

    # Check if ready
    if not retriever.is_ready():
        print("❌ Knowledge base not ready. Run ingestion first:")
        print("   python -m knowledge_base.ingest")
        return

    print("✓ Knowledge base ready\n")

    # Test queries
    test_queries = [
        "transparency reporting obligations",
        "content moderation requirements for VLOPs",
        "notice and action mechanism",
        "definition of online platform",
    ]

    print("=" * 80)
    print("Testing Retrieval")
    print("=" * 80)

    for query in test_queries:
        print(f"\nQuery: '{query}'")
        print("-" * 80)
        results = retriever.get_dsa_context(query, limit=3)

        for i, result in enumerate(results, 1):
            print(f"\n{i}. {result['title']}")
            print(f"   Section: {result['section']} | Category: {result['category']}")
            print(f"   Score: {result['score']:.4f}")
            print(f"   Preview: {result['content'][:200]}...")

    # Test filtered query
    print("\n" + "=" * 80)
    print("Testing Filtered Query (VLOP/VLOSE only)")
    print("=" * 80)
    results = retriever.get_dsa_context(
        "risk assessment requirements",
        category="VLOP/VLOSE",
        limit=2
    )
    print(f"\nFound {len(results)} results for VLOP/VLOSE category:")
    for result in results:
        print(f"  - {result['title']} (Article {result.get('id', 'N/A')})")


if __name__ == "__main__":
    main()

