"""Test script to run service categorizer with Telenet profile."""

import asyncio
import json
import os
import sys
from pathlib import Path

# Load .env file from root directory
try:
    from dotenv import load_dotenv
    # Get root directory (4 levels up from examples/)
    root_path = Path(__file__).resolve().parent.parent.parent.parent
    env_path = root_path / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✓ Loaded .env from {env_path}")
    else:
        load_dotenv()  # Try current directory
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from langchain_core.messages import HumanMessage


async def main():
    """Test the service categorizer agent with Telenet profile."""
    print("=" * 60)
    print("TESTING SERVICE CATEGORIZER AGENT")
    print("Company: Telenet")
    print("=" * 60)
    print()
    
    # Check for API keys
    has_openai_key = bool(os.getenv("OPENAI_API_KEY"))
    
    if not has_openai_key:
        print("⚠️  ERROR: OPENAI_API_KEY not set (required for LLM calls)")
        print("\nPlease set the OPENAI_API_KEY environment variable or add it to the .env file")
        print("in the root directory of the project.")
        print("\nExample .env file:")
        print("  OPENAI_API_KEY=your-api-key-here")
        print("  OPENAI_BASE_URL=https://api.deepseek.com  # Optional, for DeepSeek")
        return
    
    # Load example profile
    profile_path = Path(__file__).parent / "telenet_profile.json"
    with open(profile_path) as f:
        profile = json.load(f)
    
    # Import after path setup
    from service_categorizer import service_categorizer
    
    print("Starting service categorization...")
    print("This may take a few minutes...")
    print()
    
    # Run the agent
    result = await service_categorizer.ainvoke({
        "messages": [HumanMessage(content=json.dumps(profile))]
    })
    
    # Print final report
    print()
    print("=" * 60)
    print("TELENET DSA COMPLIANCE ASSESSMENT")
    print("=" * 60)
    print()
    
    final_report = result.get("final_report", "No report generated")
    if final_report and final_report != "No report generated":
        try:
            # Try to parse and pretty print JSON
            report_data = json.loads(final_report)
            print(json.dumps(report_data, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            # If not JSON, just print as is
            print(final_report)
    else:
        print(final_report)


if __name__ == "__main__":
    asyncio.run(main())

