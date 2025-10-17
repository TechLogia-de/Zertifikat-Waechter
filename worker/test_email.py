"""
Standalone SMTP Test Script
"""

import os
import sys
from main import send_email_via_smtp, supabase

# SMTP Config aus Supabase holen oder von .env
smtp_config = {
    'host': os.getenv('SMTP_HOST', 'smtp.gmail.com'),
    'port': int(os.getenv('SMTP_PORT', '587')),
    'user': os.getenv('SMTP_USER'),
    'password': os.getenv('SMTP_PASSWORD'),
    'from': os.getenv('SMTP_FROM'),
    'secure': True
}

if len(sys.argv) < 2:
    print("Usage: python test_email.py <empfaenger@email.de>")
    sys.exit(1)

recipient = sys.argv[1]

print(f"Sende Test-E-Mail an {recipient}...")
print(f"Server: {smtp_config['host']}:{smtp_config['port']}")

success = send_email_via_smtp(
    smtp_config=smtp_config,
    to=recipient,
    subject='🛡️ Test von Zertifikat-Wächter',
    body='Dies ist eine Test-E-Mail. Deine SMTP-Konfiguration funktioniert!'
)

if success:
    print(f"✅ E-Mail erfolgreich gesendet an {recipient}")
    print("Prüfe dein Postfach!")
else:
    print("❌ E-Mail-Versand fehlgeschlagen")
    print("Prüfe deine SMTP-Einstellungen in worker/.env")

