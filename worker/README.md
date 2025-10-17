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


