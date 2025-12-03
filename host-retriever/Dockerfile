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
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api/ ./api/
COPY knowledge_base/ ./knowledge_base/

# Create Qdrant storage directory
RUN mkdir -p /app/qdrant_storage

# Copy startup scripts
COPY startup.py ./startup.py
COPY start.sh ./start.sh
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 8000

# Use startup script
CMD ["/app/start.sh"]
