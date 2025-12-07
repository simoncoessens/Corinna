FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and install Qdrant binary (matching client version compatibility)
RUN curl -L https://github.com/qdrant/qdrant/releases/download/v1.11.0/qdrant-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz && \
    mv qdrant /usr/local/bin/qdrant && \
    chmod +x /usr/local/bin/qdrant

# Install Python dependencies
COPY host-retriever/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY host-retriever/api/ ./api/
# Copy backend knowledge base package (includes dsa.html)
COPY backend/knowledge_base/ ./backend/knowledge_base/
# Create backend package init if it doesn't get copied (we only copied knowledge_base subdirectory)
RUN touch backend/__init__.py

# Create Qdrant storage directory
RUN mkdir -p /app/qdrant_storage

# Copy startup scripts
COPY host-retriever/startup.py ./startup.py
COPY host-retriever/start.sh ./start.sh
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 8000

# Use startup script
CMD ["/app/start.sh"]
