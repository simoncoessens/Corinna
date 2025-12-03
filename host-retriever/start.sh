#!/bin/bash
set -e

# Start Qdrant in background (bind to localhost only so Render doesn't detect it)
echo "Starting Qdrant..."
export QDRANT__STORAGE__STORAGE_PATH=/app/qdrant_storage
export QDRANT__SERVICE__HTTP_PORT=6333
export QDRANT__SERVICE__GRPC_PORT=6334
export QDRANT__SERVICE__HOST=127.0.0.1
qdrant > /tmp/qdrant.log 2>&1 &
QDRANT_PID=$!
echo "Qdrant started with PID $QDRANT_PID"

# Wait for Qdrant to be ready
echo "Waiting for Qdrant to be ready..."
QDRANT_READY=false
for i in $(seq 1 60); do
    if curl -s http://localhost:6333/health > /dev/null 2>&1; then
        echo "✓ Qdrant is ready!"
        QDRANT_READY=true
        break
    fi
    if [ $((i % 5)) -eq 0 ]; then
        echo "Still waiting for Qdrant... (${i}s)"
        echo "Qdrant logs:"
        tail -5 /tmp/qdrant.log 2>/dev/null || echo "No logs yet"
    fi
    sleep 1
done

if [ "$QDRANT_READY" = false ]; then
    echo "✗ Qdrant failed to start. Logs:"
    cat /tmp/qdrant.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Ensure knowledge base is populated
echo "Checking knowledge base..."
python startup.py || echo "⚠ Ingestion had issues, continuing anyway..."

# Start the API
echo "Starting API server..."
exec uvicorn api.main:app --host 0.0.0.0 --port 8000

