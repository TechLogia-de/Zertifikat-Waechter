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
from urllib.parse import urlparse
from functools import wraps
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
CORS(app)  # Erlaube CORS für Frontend

# Supabase Client
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key)
else:
    supabase = None
    print("⚠️  Supabase not configured - API endpoints will be limited")

# API-Key-Validierung Decorator
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # API-Key aus Header holen
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        # Format: "Bearer cw_..."
        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != 'Bearer':
            return jsonify({'error': 'Invalid Authorization format. Use: Bearer <api_key>'}), 401
        
        api_key = parts[1]
        
        if not supabase:
            return jsonify({'error': 'API not configured'}), 503
        
        # API-Key validieren
        try:
            # Hash den API-Key
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            
            # Suche in DB
            result = supabase.table('api_keys').select('*').eq('key_hash', key_hash).eq('is_active', True).execute()
            
            if not result.data or len(result.data) == 0:
                return jsonify({'error': 'Invalid or inactive API key'}), 401
            
            key_data = result.data[0]
            
            # Prüfe Ablauf
            if key_data.get('expires_at'):
                expires_at = datetime.fromisoformat(key_data['expires_at'].replace('Z', '+00:00'))
                if datetime.now(expires_at.tzinfo) > expires_at:
                    return jsonify({'error': 'API key expired'}), 401
            
            # Update usage
            supabase.table('api_keys').update({
                'usage_count': key_data['usage_count'] + 1,
                'last_used_at': datetime.utcnow().isoformat()
            }).eq('id', key_data['id']).execute()
            
            # Füge tenant_id zum Request hinzu
            request.tenant_id = key_data['tenant_id']
            request.api_key_permissions = key_data.get('permissions', [])
            
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"API-Key validation error: {e}")
            return jsonify({'error': 'Authentication failed'}), 401
    
    return decorated_function

@app.route('/send-email', methods=['POST'])
def send_email():
    try:
        data = request.json
        use_system_smtp = data.get('use_system_smtp', False)
        to = data.get('to')
        subject = data.get('subject', '🛡️ Test von Zertifikat-Wächter')
        body = data.get('body', 'Test-E-Mail')

        # ✅ System-SMTP oder User-SMTP?
        if use_system_smtp:
            # Verwende System-SMTP aus .env
            smtp_config = {
                'host': os.getenv('SMTP_HOST'),
                'port': int(os.getenv('SMTP_PORT', 587)),
                'user': os.getenv('SMTP_USER'),
                'password': os.getenv('SMTP_PASSWORD'),
                'from': os.getenv('SMTP_FROM'),
                'secure': True
            }
            
            # Validiere dass System-SMTP konfiguriert ist
            if not all([smtp_config['host'], smtp_config['user'], smtp_config['password'], smtp_config['from']]):
                raise Exception('System-SMTP ist nicht vollständig konfiguriert. Bitte .env prüfen.')
            
            smtp_mode = 'System-SMTP (Zertifikat-Wächter)'
        else:
            # Verwende User-SMTP
            smtp_config = data.get('smtp_config')
            if not smtp_config:
                raise Exception('smtp_config fehlt')
            smtp_mode = f"Eigener SMTP ({smtp_config.get('host', 'Unknown')})"

        # E-Mail erstellen mit unterschiedlichen Templates
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_config['from']
        msg['To'] = to

        # ✅ Unterschiedliche Designs basierend auf Modus
        if use_system_smtp:
            # 🛡️ System-SMTP Design (Grün/Blau)
            gradient_color = "linear-gradient(135deg, #10B981, #14B8A6)"
            icon = "🛡️"
            badge_bg = "#D1FAE5"
            badge_border = "#10B981"
            badge_text_color = "#065F46"
            mode_label = "System-Benachrichtigung"
        else:
            # ⚙️ Eigener SMTP Design (Blau/Lila)
            gradient_color = "linear-gradient(135deg, #3B82F6, #6366F1)"
            icon = "⚙️"
            badge_bg = "#DBEAFE"
            badge_border = "#3B82F6"
            badge_text_color = "#1E40AF"
            mode_label = "Eigener SMTP-Server"

        html_body = f"""
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 20px; background-color: #F8FAFC;">
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif;">
              <!-- Header mit unterschiedlichem Gradient -->
              <div style="background: {gradient_color}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: white; margin: 0; font-size: 28px;">{icon} Zertifikat-Wächter</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">{mode_label}</p>
              </div>
              
              <!-- Content -->
              <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h2 style="color: #0F172A; margin-top: 0;">{subject}</h2>
                <p style="color: #64748B; line-height: 1.8; font-size: 15px;">{body}</p>
                
                <!-- Success Badge mit unterschiedlichen Farben -->
                <div style="margin-top: 30px; padding: 20px; background: {badge_bg}; border-radius: 10px; border-left: 5px solid {badge_border};">
                  <p style="margin: 0; color: {badge_text_color}; font-weight: bold; font-size: 16px;">✅ {'E-Mail-Benachrichtigung aktiv!' if use_system_smtp else 'SMTP-Verbindung erfolgreich!'}</p>
                  <p style="margin: 12px 0 0 0; color: {badge_text_color}; font-size: 14px; opacity: 0.9;">
                    {'<strong>✅ Deine E-Mail-Benachrichtigungen sind eingerichtet!</strong><br>Alle Zertifikat-Warnungen werden automatisch an dich versendet.' if use_system_smtp else f'<strong>Modus:</strong> {smtp_mode}<br><strong>Server:</strong> {smtp_config["host"]}:{smtp_config["port"]}<br><strong>Von:</strong> {smtp_config["from"]}'}
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E2E8F0; text-align: center;">
                  <p style="color: #94A3B8; font-size: 12px; margin: 0;">
                    Diese E-Mail wurde automatisch generiert von Zertifikat-Wächter<br>
                    {'🛡️ System-SMTP aktiv' if use_system_smtp else '⚙️ Eigener SMTP-Server konfiguriert'}
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """

        # Plain-Text Version (unterschiedlich je nach Modus)
        if use_system_smtp:
            plain_body = f"""
{icon} Zertifikat-Wächter - {mode_label}
{'='*50}

{subject}

{body}

✅ E-Mail-Benachrichtigung aktiv!
----------------------------------
✅ Deine E-Mail-Benachrichtigungen sind eingerichtet!
Alle Zertifikat-Warnungen werden automatisch an dich versendet.

🛡️ System-SMTP aktiv
            """
        else:
            plain_body = f"""
{icon} Zertifikat-Wächter - {mode_label}
{'='*50}

{subject}

{body}

✅ SMTP-Verbindung erfolgreich!
----------------------------------
Modus: {smtp_mode}
Server: {smtp_config['host']}:{smtp_config['port']}
Von: {smtp_config['from']}

⚙️ Eigener SMTP-Server konfiguriert
            """

        msg.attach(MIMEText(plain_body, 'plain'))
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

        print(f"✅ E-Mail erfolgreich gesendet via {smtp_mode}")
        
        return jsonify({
            'success': True,
            'message': f'E-Mail gesendet an {to} via {smtp_mode}'
        })

    except Exception as e:
        print(f"❌ E-Mail-Versand fehlgeschlagen: {str(e)}")
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

        # ✅ URL-Parsing: Entferne Protokoll und Pfad
        host = parse_hostname(host)
        
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


def parse_hostname(host: str) -> str:
    """
    Extrahiert den Hostnamen aus einer URL oder gibt den Host direkt zurück
    
    Beispiele:
        https://example.com/path -> example.com
        http://example.com:8080 -> example.com
        example.com -> example.com
    """
    # Entferne Whitespace
    host = host.strip()
    
    # Wenn es wie eine URL aussieht (mit Protokoll)
    if '://' in host:
        parsed = urlparse(host)
        return parsed.hostname or parsed.netloc.split(':')[0]
    
    # Entferne Pfad wenn vorhanden
    if '/' in host:
        host = host.split('/')[0]
    
    # Entferne Port wenn vorhanden
    if ':' in host:
        host = host.split(':')[0]
    
    return host


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


# =====================================================
# RESTful API Endpoints (mit API-Key Auth)
# =====================================================

@app.route('/api/v1/certificates', methods=['GET'])
@require_api_key
def get_certificates():
    """Liste alle Zertifikate des Tenants"""
    try:
        if not supabase:
            return jsonify({'error': 'Database not configured'}), 503
        
        # Query-Parameter
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        status = request.args.get('status')  # active, expiring, expired
        days_until_expiry = request.args.get('days_until_expiry')
        
        # Limit begrenzen
        limit = min(limit, 100)
        
        # Query bauen
        query = supabase.table('certificates').select('*').eq('tenant_id', request.tenant_id)
        
        # Filter anwenden
        if status == 'active':
            query = query.gte('not_after', datetime.utcnow().isoformat())
        elif status == 'expired':
            query = query.lt('not_after', datetime.utcnow().isoformat())
        elif status == 'expiring' or days_until_expiry:
            days = int(days_until_expiry) if days_until_expiry else 30
            threshold = (datetime.utcnow() + timedelta(days=days)).isoformat()
            query = query.lte('not_after', threshold).gte('not_after', datetime.utcnow().isoformat())
        
        # Execute mit Pagination
        result = query.range(offset, offset + limit - 1).execute()
        
        # Total count (für Pagination)
        count_result = supabase.table('certificates').select('id', count='exact').eq('tenant_id', request.tenant_id).execute()
        total = count_result.count if count_result.count else 0
        
        return jsonify({
            'data': result.data,
            'total': total,
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        print(f"Error fetching certificates: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/certificates/<cert_id>', methods=['GET'])
@require_api_key
def get_certificate(cert_id):
    """Hole ein spezifisches Zertifikat"""
    try:
        if not supabase:
            return jsonify({'error': 'Database not configured'}), 503
        
        result = supabase.table('certificates').select('*').eq('id', cert_id).eq('tenant_id', request.tenant_id).execute()
        
        if not result.data or len(result.data) == 0:
            return jsonify({'error': 'Certificate not found'}), 404
        
        return jsonify(result.data[0])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/alerts', methods=['GET'])
@require_api_key
def get_alerts():
    """Liste alle Alerts des Tenants"""
    try:
        if not supabase:
            return jsonify({'error': 'Database not configured'}), 503
        
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        acknowledged = request.args.get('acknowledged')  # true/false
        
        limit = min(limit, 100)
        
        query = supabase.table('alerts').select('*, certificate:certificates(*)').eq('tenant_id', request.tenant_id)
        
        if acknowledged == 'false':
            query = query.is_('acknowledged_at', 'null')
        elif acknowledged == 'true':
            query = query.not_.is_('acknowledged_at', 'null')
        
        result = query.range(offset, offset + limit - 1).order('first_triggered_at', desc=True).execute()
        
        return jsonify({
            'data': result.data,
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health Check Endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'certificate-scanner',
        'version': '1.0.0',
        'supabase_configured': supabase is not None,
        'endpoints': {
            'public': [
                'GET /health'
            ],
            'internal': [
                'POST /send-email',
                'POST /scan-certificate'
            ],
            'api_v1': [
                'GET /api/v1/certificates',
                'GET /api/v1/certificates/{id}',
                'GET /api/v1/alerts'
            ]
        }
    })


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Zertifikat-Wächter Worker API")
    print("=" * 60)
    print("📧 SMTP Email: POST http://localhost:5000/send-email")
    print("🔍 Cert Scanner: POST http://localhost:5000/scan-certificate")
    print("🔑 REST API v1:  GET  http://localhost:5000/api/v1/certificates")
    print("❤️  Health Check: GET http://localhost:5000/health")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5001, debug=True)

