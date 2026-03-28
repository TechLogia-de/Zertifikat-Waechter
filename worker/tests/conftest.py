"""Pytest configuration and fixtures"""
import pytest
import os
import sys

# Add worker directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@pytest.fixture
def sample_smtp_config():
    return {
        'host': 'smtp.example.com',
        'port': 587,
        'user': 'testuser',
        'password': 'testpass',
        'from': 'noreply@example.com',
        'secure': True
    }

@pytest.fixture
def sample_certificate_data():
    return {
        'fingerprint': 'abc123def456',
        'subject_cn': 'example.com',
        'san': ['example.com', 'www.example.com'],
        'issuer': "Let's Encrypt R12",
        'not_before': '2025-01-01T00:00:00Z',
        'not_after': '2025-12-31T23:59:59Z',
        'key_alg': 'RSA',
        'key_size': 2048,
        'serial': 'abc123',
        'is_trusted': True,
        'is_self_signed': False
    }
