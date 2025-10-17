"""
Zertifikat-Wächter Worker
SMTP E-Mail Versand und Alert-Jobs
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from supabase import create_client, Client
import structlog

load_dotenv()

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

supabase: Client = create_client(supabase_url, supabase_key)


def send_email_via_smtp(smtp_config: dict, to: str, subject: str, body: str) -> bool:
    """Sendet E-Mail über SMTP"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_config['from']
        msg['To'] = to

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🛡️ Zertifikat-Wächter</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #E2E8F0;">
              <h2>{subject}</h2>
              <p style="color: #64748B; line-height: 1.6;">{body}</p>
              <div style="margin-top: 30px; padding: 20px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #10B981;">
                <p style="margin: 0; color: #065F46; font-weight: bold;">✅ SMTP funktioniert!</p>
                <p style="margin: 10px 0 0 0; color: #64748B; font-size: 14px;">
                  Server: {smtp_config['host']}:{smtp_config['port']}
                </p>
              </div>
            </div>
          </body>
        </html>
        """

        msg.attach(MIMEText(body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        # SMTP Verbindung
        if smtp_config.get('secure') and smtp_config['port'] == 465:
            server = smtplib.SMTP_SSL(smtp_config['host'], smtp_config['port'])
        else:
            server = smtplib.SMTP(smtp_config['host'], smtp_config['port'])
            if smtp_config.get('secure'):
                server.starttls()

        server.login(smtp_config['user'], smtp_config['password'])
        server.send_message(msg)
        server.quit()

        logger.info("email_sent", to=to)
        return True

    except Exception as e:
        logger.error("email_failed", error=str(e), to=to)
        return False


if __name__ == "__main__":
    logger.info("worker_ready_for_smtp")
    print("Worker läuft. SMTP-Funktion bereit.")


