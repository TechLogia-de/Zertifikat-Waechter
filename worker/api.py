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
    app.run(host='0.0.0.0', port=5000, debug=True)

