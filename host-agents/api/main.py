import sys
import os
from pathlib import Path
from fastapi import FastAPI
from langserve import add_routes
from fastapi.responses import HTMLResponse

# =============================================================================
# Path Setup
# =============================================================================
# We need to add backend paths to sys.path so imports work correctly
# Docker layout assumes: /app/backend and /app/host-agents

# Allow running locally (outside Docker) where paths might be different
# If running from repo root:
if Path("backend").exists():
    BASE_DIR = Path(".").resolve()
else:
    # Default to Docker layout
    BASE_DIR = Path("/app")

BACKEND_DIR = BASE_DIR / "backend"
AGENTS_DIR = BACKEND_DIR / "agents"

# Add backend root for shared modules (tools, knowledge_base)
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

# Add agents root for shared agent tools
if str(AGENTS_DIR) not in sys.path:
    sys.path.append(str(AGENTS_DIR))

# Add each agent's src directory to path (for their internal imports)
if AGENTS_DIR.exists():
    for agent_dir in AGENTS_DIR.iterdir():
        src_dir = agent_dir / "src"
        if src_dir.exists():
            if str(src_dir) not in sys.path:
                sys.path.append(str(src_dir))

# =============================================================================
# Import Agents
# =============================================================================
graphs = {}

# Helper to safely import agents
def register_agent(name, import_fn):
    try:
        graph = import_fn()
        graphs[name] = graph
        print(f"✓ Registered agent: {name}")
    except Exception as e:
        print(f"✗ Failed to import {name}: {e}")
        # Print stack trace for debugging
        import traceback
        traceback.print_exc()

# Register Company Researcher
register_agent("researcher", lambda: __import__("company_researcher.graph").graph.company_researcher)

# Register Main Agent
register_agent("main-agent", lambda: __import__("main_agent.graph").graph.main_agent)

# Register Company Matcher
register_agent("matcher", lambda: __import__("company_matcher.graph").graph.company_matcher)

# Register Service Categorizer
register_agent("categorizer", lambda: __import__("service_categorizer.graph").graph.service_categorizer)


# =============================================================================
# FastAPI App
# =============================================================================
app = FastAPI(
    title="SNIP Agents Host",
    description="Unified host for all SNIP agents with LangServe playgrounds",
)

# Add LangServe routes for each agent
for name, graph in graphs.items():
    add_routes(
        app,
        graph,
        path=f"/{name}",
        playground_type="chat",
    )

# Landing Page
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SNIP Agents Host</title>
        <style>
            :root { --primary: #6366f1; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; }
            body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
            h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(to right, #818cf8, #c7d2fe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            p { color: #94a3b8; margin-bottom: 2rem; font-size: 1.1rem; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            .card { background: var(--card); border: 1px solid #334155; padding: 25px; border-radius: 12px; transition: all 0.2s; display: flex; flex-direction: column; justify-content: space-between; height: 100%; }
            .card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 10px 30px -10px rgba(99, 102, 241, 0.3); }
            a { text-decoration: none; color: inherit; }
            h2 { margin: 0 0 10px 0; font-size: 1.25rem; display: flex; align-items: center; gap: 8px; }
            .badge { font-size: 0.75rem; padding: 4px 10px; background: rgba(99, 102, 241, 0.1); color: #818cf8; border-radius: 99px; font-weight: 500; }
            .arrow { margin-left: auto; opacity: 0; transition: opacity 0.2s; }
            .card:hover .arrow { opacity: 1; }
        </style>
    </head>
    <body>
        <h1>SNIP Agents Host</h1>
        <p>Select an agent to launch its LangGraph interactive playground.</p>
        
        <div class="grid">
    """
    
    # Sort keys for consistent order
    for name in sorted(graphs.keys()):
        pretty_name = name.replace('-', ' ').title()
        html_content += f"""
        <a href="/{name}/playground/" target="_blank">
            <div class="card">
                <h2>
                    {pretty_name}
                    <span class="arrow">→</span>
                </h2>
                <div>
                    <span class="badge">LangGraph</span>
                    <span class="badge">Playground</span>
                </div>
            </div>
        </a>
        """
    
    html_content += """
        </div>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    import uvicorn
    # Use environment variable for port if available
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

