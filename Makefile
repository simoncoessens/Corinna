.PHONY: install dev test backend frontend

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

backend:
	cd backend && uvicorn api.main:app --reload --port 8001

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend (port 8001) and frontend (port 3000)..."
	@make -j2 backend frontend

test:
	cd backend && python -m pytest tests/ -v
	cd frontend && npx tsc --noEmit
