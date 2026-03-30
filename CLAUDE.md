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
│   │   ├── hooks/          # Custom hooks (useAuth, useTenantId, useUserRole, useToast, useConfirm, useScanDomain)
│   │   ├── lib/            # Supabase client init
│   │   ├── types/          # TypeScript interfaces (database.ts)
│   │   ├── contexts/       # React contexts (LanguageContext)
│   │   └── utils/          # Helpers (auditLogger, hashUtils, dateUtils, reportHtmlGenerator, etc.)
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
│   ├── migrations/         # 28 SQL migration files (sequential)
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
- UI text in **German**
- Code comments in **English**
- Configuration examples and environment variables in English

### Code Style
- **Frontend**: Functional React components with hooks, Zustand for state, React Query for server state
- **Agent**: Idiomatic Go with Logrus structured logging
- **Worker**: Python async with structlog JSON logging
- **MCP Server**: Express middleware pattern, Zod validation, strict TypeScript

### Security
- Row Level Security (RLS) on every PostgreSQL table (including agent_logs, discovery_results)
- Content Security Policy headers in Vite config
- Helmet.js + CORS (configurable origin) + rate limiting on MCP server
- JWT + API key authentication (HMAC-SHA256 hashed keys)
- PKCE auth flow via Supabase
- Multi-tenant isolation by default
- RBAC via `useUserRole` hook (owner, admin, member, viewer)
- Soft-delete support (deleted_at columns + partial indexes)
- XSS prevention (HTML escaping in reports)
- SSRF protection (DNS resolution + private IP blocking in webhooks)
- Rate limiting on worker endpoints (10/min email, 30/min scan)
- SMTP certificate validation (ssl.create_default_context)

## Database

28 sequential migrations in `supabase/migrations/`. Key tables: assets, certificates, alerts, integrations, connectors, discovery_results, agent_logs, events (audit), acme_accounts, acme_orders, api_keys, ssl_checks, webhook_deliveries, policies.

Notable migrations:
- `00025` - Enables RLS on agent_logs + discovery_results
- `00026` - Performance indexes (6 composite indexes)
- `00027` - Soft-delete support (deleted_at + partial indexes)
- `00028` - Configurable alert_interval_hours per tenant

Run `make migrate` to apply. Run `make types` to regenerate TypeScript types.

## Edge Functions (Supabase)

Located in `supabase/functions/`:
- `scan-certificates/` - Real TLS scanning with DER/ASN.1 X.509 parsing
- `scan-domain/` - Domain-specific TLS scanning with ALPN detection
- `send-alerts/` - Multi-channel delivery (SMTP, Slack, Teams, Webhooks)
- `send-test-email/` - SMTP connection testing
- `send-webhook/` - HMAC-signed webhook delivery with retry + SSRF protection
- `generate-report/` - HTML/CSV report generation with hash-chain verification
- `process-acme-orders/` - ACME DNS-01 (Cloudflare) + HTTP-01 challenge processing
- `process-webhook-queue/` - Webhook delivery queue processor
- `ssl-health-check/` - Deep TLS analysis (ALPN, ciphers, chain validation, scoring)
- `test-cloudflare/` - Cloudflare API token + zone verification

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
cd agent && go test ./...              # Go agent (config, scanner, discovery tests)
cd worker && pytest                    # Python worker (pytest)
cd mcp-server && npx vitest run        # MCP server (Vitest)

## Key Frontend Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state, login/logout, session management |
| `useTenantId` | Cached tenant_id lookup (shared across all pages) |
| `useUserRole` | RBAC role check (owner/admin/member/viewer) |
| `useToast` | Toast notifications (max 5, auto-dismiss) |
| `useConfirm` | Modal-based confirmation dialogs |
| `useScanDomain` | Domain TLS scanning via edge function |
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
- `docker-publish.yml` - Runs tests + builds multi-arch images (amd64 + arm64) to `ghcr.io/techlogia-de/`
- `deploy-pages.yml` - GitHub Pages deployment
- Images: `zertifikat-waechter-agent`, `zertifikat-waechter-worker`, `zertifikat-waechter-mcp-server`, `zertifikat-waechter-frontend`

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
