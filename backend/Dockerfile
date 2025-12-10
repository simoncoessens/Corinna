# Backend Dockerfile for DSA Copilot API
# Multi-stage build for optimization

FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy agent directories
COPY agents/ ./agents/

# Install each agent package
RUN cd agents/company_matcher && pip install --no-cache-dir -e . && \
    cd ../company_researcher && pip install --no-cache-dir -e . && \
    cd ../service_categorizer && pip install --no-cache-dir -e . && \
    cd ../main_agent && pip install --no-cache-dir -e .

# Production stage
FROM python:3.11-slim

# Install runtime dependencies (including curl for health checks)
RUN apt-get update && apt-get install -y \
    libxml2 \
    libxslt1.1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

# Expose port (Render will set PORT env var)
EXPOSE $PORT

# Health check (using curl which is lightweight)
# Note: Render also has its own health check mechanism
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8001}

