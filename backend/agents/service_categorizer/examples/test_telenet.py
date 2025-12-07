"""Test script to run service categorizer with Telenet profile."""

import asyncio
import json
from pathlib import Path

# Add src to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from langchain_core.messages import HumanMessage


async def main():
    # Load example profile
    profile_path = Path(__file__).parent / "telenet_profile.json"
    with open(profile_path) as f:
        profile = json.load(f)
    
    # Import after path setup
    from service_categorizer import service_categorizer
    
    # Run the agent
    result = await service_categorizer.ainvoke({
        "messages": [HumanMessage(content=json.dumps(profile))]
    })
    
    # Print final report
    print("=" * 60)
    print("TELENET DSA COMPLIANCE ASSESSMENT")
    print("=" * 60)
    print(result.get("final_report", "No report generated"))


if __name__ == "__main__":
    asyncio.run(main())

