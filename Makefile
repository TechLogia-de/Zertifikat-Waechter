.PHONY: help dev setup migrate types test clean agent-build frontend-dev worker-dev

help:
	@echo "Verfügbare Targets:"
	@echo "  make setup           - Initiales Projekt Setup"
	@echo "  make dev             - Starte lokale Entwicklungsumgebung"
	@echo "  make migrate         - Push Datenbank Migrations zu Supabase"
	@echo "  make types           - Generiere TypeScript Types aus Supabase Schema"
	@echo "  make test            - Führe alle Tests aus"
	@echo "  make agent-build     - Baue Agent Binary"
	@echo "  make frontend-dev    - Starte Frontend Dev Server"
	@echo "  make worker-dev      - Starte Worker (Python)"
	@echo "  make clean           - Räume Build-Artefakte auf"

setup:
	@echo "📦 Installiere Dependencies..."
	@cd frontend && npm install
	@cd agent && go mod download
	@cd worker && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	@echo "✅ Setup abgeschlossen! Führe 'make dev' aus zum Starten."

dev: frontend-dev

frontend-dev:
	@echo "🚀 Starte Frontend..."
	@cd frontend && npm run dev

agent-build:
	@echo "🔨 Baue Agent..."
	@cd agent && go build -o agent .

agent-dev:
	@echo "🤖 Starte Agent..."
	@cd agent && go run main.go

worker-dev:
	@echo "⚙️ Starte Worker..."
	@cd worker && . venv/bin/activate && python main.py

migrate:
	@echo "📊 Pushe Migrations zu Supabase..."
	@cd supabase && supabase db push

types:
	@echo "🔧 Generiere TypeScript Types..."
	@supabase gen types typescript --project-id $(PROJECT_ID) > frontend/src/types/database.types.ts

test:
	@echo "🧪 Führe Tests aus..."
	@cd frontend && npm test
	@cd agent && go test ./...
	@cd worker && . venv/bin/activate && pytest

clean:
	@echo "🧹 Räume auf..."
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@rm -rf agent/agent
	@rm -rf worker/venv
	@find . -name "__pycache__" -type d -exec rm -rf {} +
	@echo "✅ Aufgeräumt!"


