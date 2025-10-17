#!/usr/bin/env python3
"""
Direkt SMTP Test-Mail senden
Usage: python send_test_mail.py
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# SMTP Config aus ENV
smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
smtp_port = int(os.getenv('SMTP_PORT', '587'))
smtp_user = os.getenv('SMTP_USER')
smtp_password = os.getenv('SMTP_PASSWORD')
smtp_from = os.getenv('SMTP_FROM')

# Test-Mail Empfänger
test_recipient = input("Empfänger E-Mail: ").strip() or smtp_user

if not all([smtp_host, smtp_user, smtp_password, smtp_from]):
    print("❌ Fehler: SMTP-Konfiguration fehlt in worker/.env")
    print("\nBitte setze:")
    print("  SMTP_HOST=smtp.gmail.com")
    print("  SMTP_PORT=587")
    print("  SMTP_USER=deine@email.de")
    print("  SMTP_PASSWORD=dein-app-passwort")
    print("  SMTP_FROM=deine@email.de")
    exit(1)

print(f"\n📧 Sende Test-E-Mail...")
print(f"   Von: {smtp_from}")
print(f"   An: {test_recipient}")
print(f"   Server: {smtp_host}:{smtp_port}")
print()

try:
    # E-Mail erstellen
    msg = MIMEMultipart('alternative')
    msg['Subject'] = '🛡️ Test von Zertifikat-Wächter'
    msg['From'] = smtp_from
    msg['To'] = test_recipient

    text_body = """
    Hallo,

    Dies ist eine Test-E-Mail von deinem Zertifikat-Wächter!

    Deine SMTP-Konfiguration funktioniert einwandfrei.

    Server: {}:{}

    Mit freundlichen Grüßen,
    Dein Zertifikat-Wächter Team
    """.format(smtp_host, smtp_port)

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 20px; background-color: #F8FAFC; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🛡️ Zertifikat-Wächter</h1>
            <p style="color: #E0E7FF; margin: 10px 0 0 0;">SSL/TLS Monitoring</p>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0F172A;">Test-E-Mail</h2>
            <p style="color: #64748B; line-height: 1.6; font-size: 16px;">
              Hallo,<br><br>
              Dies ist eine Test-E-Mail von deinem Zertifikat-Wächter!
            </p>
            <div style="margin-top: 30px; padding: 20px; background: #D1FAE5; border-radius: 8px; border-left: 4px solid #10B981;">
              <p style="margin: 0; color: #065F46; font-weight: bold; font-size: 16px;">✅ SMTP funktioniert perfekt!</p>
              <p style="margin: 10px 0 0 0; color: #064E3B; font-size: 14px;">
                Server: {smtp_host}:{smtp_port}<br>
                Absender: {smtp_from}
              </p>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 20px;">
              Diese E-Mail wurde von Zertifikat-Wächter gesendet.
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    # SMTP-Verbindung aufbauen
    print("📡 Verbinde mit SMTP-Server...")
    
    if smtp_port == 465:
        # SSL
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
    else:
        # TLS
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()

    print("🔐 Authentifiziere...")
    server.login(smtp_user, smtp_password)

    print("📧 Sende E-Mail...")
    server.send_message(msg)
    server.quit()

    print()
    print("✅ E-Mail erfolgreich gesendet!")
    print(f"   Prüfe dein Postfach: {test_recipient}")
    print()

except smtplib.SMTPAuthenticationError as e:
    print()
    print("❌ Authentifizierung fehlgeschlagen!")
    print(f"   Fehler: {e}")
    print()
    print("💡 Tipps:")
    print("   - Gmail: Verwende ein App-Passwort, nicht dein normales Passwort")
    print("   - https://myaccount.google.com/apppasswords")
    print("   - Office 365: Normales Passwort OK")
    print()
    
except smtplib.SMTPException as e:
    print()
    print("❌ SMTP-Fehler!")
    print(f"   Fehler: {e}")
    print()
    
except Exception as e:
    print()
    print("❌ Fehler beim Senden!")
    print(f"   Fehler: {e}")
    print()

