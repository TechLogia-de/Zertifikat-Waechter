"""
Flask API für SMTP E-Mail Versand und Zertifikat-Scans
Start: python api.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv
import ssl
import socket
from datetime import datetime, timedelta
import hashlib
from cryptography import x509
from cryptography.hazmat.backends import default_backend

load_dotenv()

app = Flask(__name__)
CORS(app)  # Erlaube CORS für Frontend

@app.route('/send-email', methods=['POST'])
def send_email():
    try:
        data = request.json
        smtp_config = data.get('smtp_config')
        to = data.get('to')
        subject = data.get('subject', '🛡️ Test von Zertifikat-Wächter')
        body = data.get('body', 'Test-E-Mail')

        # E-Mail erstellen
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_config['from']
        msg['To'] = to

        html_body = f"""
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 20px; background-color: #F8FAFC;">
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
              <div style="background: linear-gradient(135deg, #3B82F6, #6366F1); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ Zertifikat-Wächter</h1>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 10px 10px;">
                <h2 style="color: #0F172A;">{subject}</h2>
                <p style="color: #64748B; line-height: 1.6;">{body}</p>
                <div style="margin-top: 30px; padding: 20px; background: #D1FAE5; border-radius: 8px; border-left: 4px solid #10B981;">
                  <p style="margin: 0; color: #065F46; font-weight: bold;">✅ SMTP funktioniert!</p>
                  <p style="margin: 10px 0 0 0; color: #064E3B; font-size: 14px;">
                    Server: {smtp_config['host']}:{smtp_config['port']}
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """

        msg.attach(MIMEText(body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        # SMTP-Verbindung
        if smtp_config['port'] == 465:
            server = smtplib.SMTP_SSL(smtp_config['host'], smtp_config['port'], timeout=10)
        else:
            server = smtplib.SMTP(smtp_config['host'], smtp_config['port'], timeout=10)
            server.starttls()

        server.login(smtp_config['user'], smtp_config['password'])
        server.send_message(msg)
        server.quit()

        return jsonify({
            'success': True,
            'message': f'E-Mail gesendet an {to}'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/scan-certificate', methods=['POST'])
def scan_certificate():
    """Scannt ein TLS-Zertifikat von einem Host"""
    try:
        data = request.json
        host = data.get('host')
        port = data.get('port', 443)

        if not host:
            return jsonify({
                'success': False,
                'error': 'Host parameter fehlt'
            }), 400

        print(f"🔍 Scanning certificate for {host}:{port}...")

        # TLS-Verbindung aufbauen und Zertifikat abrufen
        cert_data = get_certificate(host, port)

        return jsonify({
            'success': True,
            'certificate': cert_data
        })

    except Exception as e:
        print(f"❌ Scan failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def get_certificate(hostname, port=443, timeout=10):
    """
    Holt das TLS-Zertifikat von einem Host mit cryptography library
    
    Returns:
        dict: Zertifikat-Informationen
    """
    context = ssl.create_default_context()
    
    # Für selbst-signierte Zertifikate auch akzeptieren
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    # Socket erstellen und verbinden
    with socket.create_connection((hostname, port), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            # Zertifikat als Binary holen
            cert_binary = ssock.getpeercert(binary_form=True)
            
            if not cert_binary:
                raise Exception("Kein Zertifikat erhalten")
            
            # Parse Zertifikat mit cryptography library (zuverlässiger!)
            cert = x509.load_der_x509_certificate(cert_binary, default_backend())
            
            # Subject CN extrahieren
            try:
                subject_cn = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value
            except (IndexError, AttributeError):
                subject_cn = hostname
            
            # Issuer extrahieren - Vollständiger Name
            try:
                # Versuche Common Name
                issuer_cn = cert.issuer.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value
                
                # Wenn es eine CA-Kurzform ist (z.B. "R12"), füge Org hinzu
                if len(issuer_cn) < 5:
                    try:
                        org = cert.issuer.get_attributes_for_oid(x509.NameOID.ORGANIZATION_NAME)[0].value
                        issuer_cn = f"{org} {issuer_cn}"  # z.B. "Let's Encrypt R12"
                    except (IndexError, AttributeError):
                        pass
            except (IndexError, AttributeError):
                try:
                    issuer_cn = cert.issuer.get_attributes_for_oid(x509.NameOID.ORGANIZATION_NAME)[0].value
                except (IndexError, AttributeError):
                    issuer_cn = 'Unknown Issuer'
            
            # Subject Alternative Names (SAN)
            san_list = []
            try:
                san_ext = cert.extensions.get_extension_for_oid(x509.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
                san_list = [dns.value for dns in san_ext.value]
            except x509.ExtensionNotFound:
                san_list = [subject_cn] if subject_cn else [hostname]
            
            # Daten extrahieren
            not_before = cert.not_valid_before_utc if hasattr(cert, 'not_valid_before_utc') else cert.not_valid_before
            not_after = cert.not_valid_after_utc if hasattr(cert, 'not_valid_after_utc') else cert.not_valid_after
            
            # Fingerprint (SHA-256)
            fingerprint = hashlib.sha256(cert_binary).hexdigest()
            
            # Serial Number (als Hex)
            serial = format(cert.serial_number, 'x')
            
            # Key Info
            public_key = cert.public_key()
            key_size = public_key.key_size if hasattr(public_key, 'key_size') else 2048
            
            # Key Algorithm
            key_alg = 'RSA'
            if 'EC' in str(type(public_key)):
                key_alg = 'ECDSA'
            elif 'Ed25519' in str(type(public_key)):
                key_alg = 'Ed25519'
            
            # Prüfe ob selbst-signiert
            is_self_signed = cert.issuer == cert.subject
            
            result = {
                'fingerprint': fingerprint,
                'subject_cn': subject_cn,
                'san': san_list,
                'issuer': issuer_cn,
                'not_before': not_before.isoformat(),
                'not_after': not_after.isoformat(),
                'key_alg': key_alg,
                'key_size': key_size,
                'serial': serial,
                'is_trusted': not is_self_signed,
                'is_self_signed': is_self_signed
            }
            
            print(f"✅ Certificate scanned successfully: {result['subject_cn']}")
            print(f"   Issuer: {result['issuer']}")
            print(f"   Expires: {result['not_after']}")
            print(f"   Fingerprint: {result['fingerprint'][:16]}...")
            
            return result


@app.route('/health', methods=['GET'])
def health():
    """Health Check Endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'certificate-scanner',
        'endpoints': [
            'POST /send-email',
            'POST /scan-certificate',
            'GET /health'
        ]
    })


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Zertifikat-Wächter Worker API")
    print("=" * 60)
    print("📧 SMTP Email: POST http://localhost:5000/send-email")
    print("🔍 Cert Scanner: POST http://localhost:5000/scan-certificate")
    print("❤️  Health Check: GET http://localhost:5000/health")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)

