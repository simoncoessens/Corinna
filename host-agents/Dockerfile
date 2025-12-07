FROM python:3.11-slim

WORKDIR /app

# 1. Install Backend Dependencies
# We copy the backend requirements first to leverage caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 2. Install Host Dependencies (LangServe, etc.)
COPY host-agents/requirements.txt /app/host-agents/requirements.txt
RUN pip install --no-cache-dir -r /app/host-agents/requirements.txt

# 3. Copy Application Code
# We copy the entire backend folder so agents can import tools/knowledge_base
COPY backend /app/backend
COPY host-agents /app/host-agents

# 4. Environment Setup
# We set PYTHONPATH to include backend and agents so imports work
ENV PYTHONPATH=/app/backend:/app/backend/agents
ENV PORT=8000

# 5. Run
EXPOSE 8000
CMD ["uvicorn", "host-agents.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

