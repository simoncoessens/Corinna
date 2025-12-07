# SNIP Agents Host

This service hosts all SNIP agents using [LangServe](https://github.com/langchain-ai/langserve), providing interactive playgrounds and APIs for each agent.

## Available Agents

- **Company Researcher**: `/researcher`
- **Main Agent**: `/main-agent`
- **Company Matcher**: `/matcher`
- **Service Categorizer**: `/categorizer`

Each agent has a playground at `/{agent-name}/playground/`.

## Local Development

1. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

   (Make sure you also have backend dependencies installed)

2. **Run Server**:

   ```bash
   # Run from the repository root
   uvicorn host-agents.api.main:app --reload --port 8000
   ```

3. **Open Browser**:
   Navigate to [http://localhost:8000](http://localhost:8000)

## Docker / Deployment

The Dockerfile is designed to be built from the **repository root** to access the shared `backend/` code.

```bash
# Build from repo root
docker build -f host-agents/Dockerfile -t snip-agents-host .

# Run
docker run -p 8000:8000 --env-file .env snip-agents-host
```
