# CLAUDE.md - Zertifikat-Wächter

## Project Overview

Enterprise TLS/SSL certificate monitoring SaaS for SMEs and IT service providers. Monitors certificate expiration, sends multi-channel alerts (Email, Slack, Teams, Webhooks), supports ACME auto-renewal, and provides compliance reporting.

## Architecture

Multi-component system with Supabase as the central backend:

```
Frontend (React/Vite)  ──►  Supabase (PostgreSQL + Auth + Edge Functions)
                                  ▲         ▲          ▲
                                  │         │          │
                              Agent (Go)  MCP Server  Worker (Python)
                                          (Node.js)
                                            │
                                          Redis
```

| Component | Tech | Location | Port |
|-----------|------|----------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind | `frontend/` | 5173 |
| Agent | Go 1.22 | `agent/` | 8080 (health) |
| Worker | Python 3.11 + Flask | `worker/` | - |
| MCP Server | Node.js 20 + Express + TypeScript | `mcp-server/` | 8787 |
| Database | PostgreSQL via Supabase (RLS enabled) | `supabase/` | - |
| Edge Functions | Deno (Supabase Functions) | `supabase/functions/` | - |

## Quick Commands

```bash
make setup            # Install all dependencies (npm, go mod, pip)
make dev              # Start frontend dev server
make frontend-dev     # Frontend on port 5173
make agent-dev        # Run Go agent (needs CONNECTOR_TOKEN)
make worker-dev       # Run Python worker
make agent-build      # Build Go agent binary
make migrate          # Push DB migrations to Supabase
make types            # Generate TypeScript types from Supabase schema
make test             # Run all tests (frontend + agent + worker)
make clean            # Clean build artifacts

# Docker
docker-compose up -d  # Full stack
```

## Project Structure

```
├── frontend/               # React SPA
│   ├── src/
│   │   ├── pages/          # 23+ page components (PascalCase)
│   │   ├── components/
│   │   │   ├── features/   # Feature-specific components
│   │   │   ├── layout/     # Sidebar, Layout wrapper
│   │   │   └── ui/         # Reusable UI primitives
│   │   ├── hooks/          # Custom hooks (useAuth, useScanDomain, etc.)
│   │   ├── lib/            # Supabase client init
│   │   ├── contexts/       # React contexts (LanguageContext)
│   │   └── utils/          # Helper functions
│   ├── vite.config.ts      # Bundler config with CSP headers
│   ├── tailwind.config.js  # Custom color scheme
│   └── tsconfig.json       # ES2020 target, path aliases
├── agent/                  # Go intranet scanner
│   ├── main.go             # Entry point, scan loop, heartbeat
│   ├── config/config.go    # Environment configuration
│   ├── scanner/            # TLS scanning, discovery, intelligence
│   └── supabase/           # Backend communication
├── worker/                 # Python background jobs
│   ├── main.py             # Flask app + async job processing
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile
├── mcp-server/             # AI-friendly REST API
│   ├── src/                # TypeScript source
│   ├── manifest.json       # MCP tools definition (8 tools)
│   └── Dockerfile
├── supabase/
│   ├── migrations/         # 24 SQL migration files (sequential)
│   └── functions/          # 10 Deno edge functions
├── docker-compose.yml      # Multi-service orchestration
├── Makefile                # Dev task automation
├── .env.example            # Dev environment template
└── .env.production.example # Production environment template
```

## Key Conventions

### Naming
- **Components/Pages**: PascalCase (`CertificateDetailsModal.tsx`, `Dashboard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`, `useScanDomain.ts`)
- **Database tables**: snake_case
- **Environment variables**: UPPER_SNAKE_CASE
- **Go files**: snake_case
- **Python files**: snake_case

### Language
- All documentation, code comments, and UI text are in **German**
- Configuration examples and environment variables in English

### Code Style
- **Frontend**: Functional React components with hooks, Zustand for state, React Query for server state
- **Agent**: Idiomatic Go with Logrus structured logging
- **Worker**: Python async with structlog JSON logging
- **MCP Server**: Express middleware pattern, Zod validation, strict TypeScript

### Security
- Row Level Security (RLS) on every PostgreSQL table
- Content Security Policy headers in Vite config
- Helmet.js + CORS + rate limiting on MCP server
- JWT + API key authentication
- PKCE auth flow via Supabase
- Multi-tenant isolation by default

## Database

24 sequential migrations in `supabase/migrations/`. Key tables: assets, certificates, alerts, integrations, connector_tokens, discovery_results, agent_logs, audit events.

Run `make migrate` to apply. Run `make types` to regenerate TypeScript types.

## Edge Functions (Supabase)

Located in `supabase/functions/`:
- `scan-certificates/` - Certificate scanning
- `scan-domain/` - Domain-specific scanning
- `send-alerts/` - Alert delivery
- `send-test-email/` - SMTP testing
- `send-webhook/` - Webhook delivery
- `generate-report/` - Report generation (PDF/CSV)
- `process-acme-orders/` - ACME order processing
- `process-webhook-queue/` - Webhook queue processing
- `ssl-health-check/` - SSL health checks
- `test-cloudflare/` - Cloudflare integration testing

## Environment Variables

Required for development (see `.env.example`):
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
CONNECTOR_TOKEN (for agent)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
```

Production adds (see `.env.production.example`):
```
JWT_SECRET, JWT_PUBLIC_KEY, JWT_ALGORITHM
API_KEY_HASH_SECRET, REDIS_URL, CORS_ORIGIN
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
```

## Testing

```bash
make test                              # All: frontend + agent + worker
cd frontend && npx vitest run          # Frontend (Vitest + React Testing Library)
cd agent && go test ./...              # Go agent (config, scanner tests)
cd worker && pytest                    # Python worker (pytest)
cd mcp-server && npx vitest run        # MCP server (Vitest)
```

## Linting & Code Quality

```bash
cd frontend && npm run lint            # ESLint (TypeScript + React)
cd agent && golangci-lint run          # Go linting (if golangci-lint installed)
cd worker && flake8                    # Python linting (if flake8 installed)
```

Config files: `frontend/.eslintrc.cjs`, `.prettierrc`, `agent/.golangci.yml`, `worker/setup.cfg`

## Docker & CI/CD

- GitHub Actions in `.github/workflows/`
- `docker-publish.yml` - Builds and publishes multi-arch images (amd64 + arm64) to `ghcr.io/techlogia-de/`
- `deploy-pages.yml` - GitHub Pages deployment
- Images: `zertifikat-waechter-agent`, `zertifikat-waechter-worker`, `zertifikat-waechter-mcp-server`

## Dependencies (Key)

| Frontend | Purpose |
|----------|---------|
| `@supabase/supabase-js` | DB and auth client |
| `zustand` | State management |
| `react-router-dom` | Routing |
| `recharts` | Dashboard charts |
| `framer-motion` | Animations |
| `tailwindcss` | Styling |

| Agent (Go) | Purpose |
|------------|---------|
| `godotenv` | .env loading |
| `logrus` | Structured logging |

| Worker (Python) | Purpose |
|-----------------|---------|
| `flask` | Web framework |
| `aiosmtplib` | Async SMTP |
| `structlog` | Logging |
| `httpx` | Async HTTP |
| `cryptography` | Encryption |

| MCP Server | Purpose |
|------------|---------|
| `express` | HTTP framework |
| `redis` | Caching |
| `jsonwebtoken` | JWT auth |
| `zod` | Validation |
| `helmet` | Security headers |
