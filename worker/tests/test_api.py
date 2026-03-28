"""Tests for the Worker API"""
import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestEmailValidation:
    """Tests for email validation and sanitization"""

    def test_validate_email_valid(self):
        from api import validate_email
        assert validate_email('test@example.com') is True
        assert validate_email('user.name@domain.org') is True
        assert validate_email('user+tag@example.co.uk') is True

    def test_validate_email_invalid(self):
        from api import validate_email
        assert validate_email('') is False
        assert validate_email(None) is False
        assert validate_email('not-an-email') is False
        assert validate_email('@domain.com') is False
        assert validate_email('user@') is False

    def test_sanitize_header_removes_crlf(self):
        from api import sanitize_header
        assert sanitize_header('normal subject') == 'normal subject'
        assert sanitize_header('evil\r\nBcc: attacker@evil.com') == 'evilBcc: attacker@evil.com'
        assert sanitize_header('evil\nBcc: attacker@evil.com') == 'evilBcc: attacker@evil.com'
        assert sanitize_header('  trimmed  ') == 'trimmed'

    def test_sanitize_header_non_string(self):
        from api import sanitize_header
        assert sanitize_header(123) == ''
        assert sanitize_header(None) == ''


class TestHostnameParsing:
    """Tests for hostname parsing utility"""

    def test_parse_hostname_simple(self):
        from api import parse_hostname
        assert parse_hostname('example.com') == 'example.com'

    def test_parse_hostname_with_protocol(self):
        from api import parse_hostname
        assert parse_hostname('https://example.com') == 'example.com'
        assert parse_hostname('http://example.com') == 'example.com'

    def test_parse_hostname_with_port(self):
        from api import parse_hostname
        assert parse_hostname('example.com:8443') == 'example.com'

    def test_parse_hostname_with_path(self):
        from api import parse_hostname
        assert parse_hostname('example.com/path/to/page') == 'example.com'

    def test_parse_hostname_full_url(self):
        from api import parse_hostname
        assert parse_hostname('https://example.com:8443/path') == 'example.com'

    def test_parse_hostname_whitespace(self):
        from api import parse_hostname
        assert parse_hostname('  example.com  ') == 'example.com'


class TestHealthEndpoint:
    """Tests for health check endpoint"""

    @patch('api.supabase', MagicMock())
    def test_health_returns_ok(self):
        from api import app
        client = app.test_client()
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'
        assert data['service'] == 'certificate-scanner'

    @patch('api.supabase', MagicMock())
    def test_health_shows_endpoints(self):
        from api import app
        client = app.test_client()
        response = client.get('/health')
        data = response.get_json()
        assert 'endpoints' in data
        assert 'api_v1' in data['endpoints']


class TestSendEmailEndpoint:
    """Tests for email sending endpoint"""

    @patch('api.supabase', MagicMock())
    def test_send_email_invalid_address(self):
        from api import app
        client = app.test_client()
        response = client.post('/send-email', json={
            'to': 'not-an-email',
            'subject': 'Test',
            'body': 'Test body'
        })
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    @patch('api.supabase', MagicMock())
    def test_send_email_missing_smtp_config(self):
        from api import app
        client = app.test_client()
        response = client.post('/send-email', json={
            'to': 'test@example.com',
            'subject': 'Test',
            'body': 'Test body',
            'use_system_smtp': False
        })
        assert response.status_code == 500

    @patch('api.supabase', MagicMock())
    def test_scan_certificate_missing_host(self):
        from api import app
        client = app.test_client()
        response = client.post('/scan-certificate', json={})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
