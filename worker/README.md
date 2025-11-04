# Zertifikat-Wächter Worker

Python Worker für komplexe Background-Jobs (optional).

## Features

- ACME Auto-Renewal (Let's Encrypt)
- PDF Report Generation
- Alert Notifications (E-Mail, Slack, Teams)
- Bulk Certificate Scanning

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Konfiguriere Supabase und SMTP Credentials
python main.py
```

## Jobs

- `check_expiring_certificates()` - Prüft ablaufende Zertifikate
- `send_pending_alerts()` - Sendet ausstehende Alerts
- `renew_acme_certificates()` - ACME Renewals (TODO)
- `generate_reports()` - PDF/CSV Generierung (TODO)

## Deployment

### Docker

```bash
docker build -t certwatcher-worker .
docker run -d --env-file .env certwatcher-worker
```

### Docker Compose

```bash
docker-compose up -d worker
```

## Hinweis

Für MVP können viele Jobs als Supabase Edge Functions laufen.
Dieser Worker ist optional für komplexere Anforderungen.


# Supabase Configuration
VITE_SUPABASE_URL=https://***REMOVED***
VITE_SUPABASE_ANON_KEY=***REMOVED***

# Worker API URL
# Development: http://localhost:5000
# Production: /api (Nginx Reverse Proxy)
VITE_WORKER_API_URL=http://localhost:5000

                               # Supabase Configuration
SUPABASE_URL=https://***REMOVED***
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***

# SMTP Configuration
SMTP_HOST=mail.techlogia.de
SMTP_PORT=587
SMTP_USER=***REMOVED***
SMTP_PASSWORD=***REMOVED***
SMTP_FROM=***REMOVED***

# Slack Configuration (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL=#alerts

# Teams Configuration (optional)
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...

# Worker Configuration
WORKER_INTERVAL=300
LOG_LEVEL=INFO

