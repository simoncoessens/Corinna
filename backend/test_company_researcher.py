"""Test script to run company researcher with Telenet."""

import asyncio
import json
import os
import sys
from pathlib import Path

# Load .env file from root directory
try:
    from dotenv import load_dotenv
    # Get root directory (2 levels up from backend/)
    root_path = Path(__file__).resolve().parent.parent
    env_path = root_path / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✓ Loaded .env from {env_path}")
    else:
        load_dotenv()  # Try current directory
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")

# Add backend to path
backend_path = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_path))

# Add agents to path
agents_path = backend_path / "agents"
sys.path.insert(0, str(agents_path))

# Add each agent's src directory to path for imports
agent_src_paths = [
    agents_path / "company_researcher" / "src",
]

for path in agent_src_paths:
    if path.exists():
        sys.path.insert(0, str(path))

from langchain_core.messages import HumanMessage


async def main():
    """Test the company researcher agent with Telenet."""
    print("=" * 60)
    print("TESTING COMPANY RESEARCHER AGENT")
    print("Company: Telenet")
    print("=" * 60)
    print()
    
    # Check for API keys
    has_openai_key = bool(os.getenv("OPENAI_API_KEY"))
    has_tavily_key = bool(os.getenv("TAVILY_API_KEY"))
    
    if not has_openai_key:
        print("⚠️  WARNING: OPENAI_API_KEY not set (needed for LLM calls)")
    if not has_tavily_key:
        print("⚠️  WARNING: TAVILY_API_KEY not set (needed for web searches)")
    
    if not has_openai_key or not has_tavily_key:
        print("\nNote: The agent will run but research will fail without API keys.")
        print("Set environment variables or add them to the .env file in the root directory.")
        print()
    
    # Import after path setup
    from company_researcher.graph import company_researcher
    from company_researcher.state import CompanyResearchInputState
    
    # Create input state
    input_state: CompanyResearchInputState = {
        "messages": [HumanMessage(content="Telenet")]
    }
    
    print("Starting research...")
    print("This may take a few minutes as it researches multiple questions...")
    print("(Processing 17 questions with max 2 concurrent searches)")
    print()
    
    # Run the agent
    result = await company_researcher.ainvoke(input_state)
    
    # Print final report
    print()
    print("=" * 60)
    print("RESEARCH COMPLETE")
    print("=" * 60)
    print()
    
    final_report = result.get("final_report", "")
    if final_report:
        try:
            # Try to parse and pretty print JSON
            report_data = json.loads(final_report)
            
            # Print summary
            print(f"Company: {report_data.get('company_name', 'Unknown')}")
            print(f"Total Questions: {len(report_data.get('answers', []))}")
            print()
            
            # Count answers by section
            sections = {}
            for answer in report_data.get("answers", []):
                section = answer.get("section", "Unknown")
                sections[section] = sections.get(section, 0) + 1
            
            print("Questions by Section:")
            for section, count in sections.items():
                print(f"  - {section}: {count}")
            print()
            
            # Show sample answers
            print("Sample Answers (first 3):")
            print("-" * 60)
            for i, answer in enumerate(report_data.get("answers", [])[:3], 1):
                print(f"\n{i}. [{answer.get('section', 'Unknown')}]")
                print(f"   Q: {answer.get('question', 'Unknown')}")
                print(f"   A: {answer.get('answer', 'N/A')}")
                print(f"   Source: {answer.get('source', 'N/A')}")
                print(f"   Confidence: {answer.get('confidence', 'N/A')}")
            
            print("\n" + "=" * 60)
            print("Full JSON Report:")
            print("=" * 60)
            print(json.dumps(report_data, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            # If not JSON, just print as is
            print(final_report)
    else:
        print("No final report generated")
        print("\nState keys:", list(result.keys()))
        print("\nCompleted answers:", len(result.get("completed_answers", [])))
        
        # Print some sample answers
        answers = result.get("completed_answers", [])
        if answers:
            print("\nSample answers:")
            for i, answer in enumerate(answers[:3], 1):
                print(f"\n{i}. {answer.get('question', 'Unknown question')}")
                print(f"   Answer: {answer.get('answer', 'N/A')}")
                print(f"   Source: {answer.get('source', 'N/A')}")
                print(f"   Confidence: {answer.get('confidence', 'N/A')}")


if __name__ == "__main__":
    asyncio.run(main())

