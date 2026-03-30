package scanner

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"net"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
)

func TestNewScanner(t *testing.T) {
	log := logrus.New()
	s := NewScanner(5*time.Second, log)

	if s == nil {
		t.Fatal("NewScanner returned nil")
	}
}

func TestScanHostInvalidHost(t *testing.T) {
	log := logrus.New()
	log.SetLevel(logrus.ErrorLevel)
	s := NewScanner(3*time.Second, log)

	ctx := context.Background()
	_, err := s.ScanHost(ctx, "invalid.host.that.does.not.exist.example", 443)
	if err == nil {
		t.Error("ScanHost should return error for invalid host")
	}
}

func TestScanHostTimeout(t *testing.T) {
	log := logrus.New()
	log.SetLevel(logrus.ErrorLevel)
	s := NewScanner(1*time.Millisecond, log)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err := s.ScanHost(ctx, "example.com", 443)
	if err == nil {
		t.Error("ScanHost should return error on timeout")
	}
}

func TestNewNetworkScanner(t *testing.T) {
	log := logrus.New()
	ns := NewNetworkScanner(5*time.Second, log)

	if ns == nil {
		t.Fatal("NewNetworkScanner returned nil")
	}
}

// Helper to create a self-signed certificate with the given key pair.
func createTestCert(t *testing.T, pubKey interface{}, privKey interface{}) *x509.Certificate {
	t.Helper()

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: "test.example.com",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(24 * time.Hour),
		DNSNames:              []string{"test.example.com", "*.example.com"},
		IPAddresses:           []net.IP{net.ParseIP("192.168.1.1")},
		EmailAddresses:        []string{"admin@example.com"},
		BasicConstraintsValid: true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, pubKey, privKey)
	if err != nil {
		t.Fatalf("failed to create test certificate: %v", err)
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		t.Fatalf("failed to parse test certificate: %v", err)
	}

	return cert
}

func TestGetKeySizeRSA(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	size := getKeySize(cert)

	if size != 2048 {
		t.Errorf("expected RSA key size 2048, got %d", size)
	}
}

func TestGetKeySizeRSA4096(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		t.Fatalf("failed to generate RSA 4096 key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	size := getKeySize(cert)

	if size != 4096 {
		t.Errorf("expected RSA key size 4096, got %d", size)
	}
}

func TestGetKeySizeECDSA256(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ECDSA P256 key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	size := getKeySize(cert)

	if size != 256 {
		t.Errorf("expected ECDSA key size 256, got %d", size)
	}
}

func TestGetKeySizeECDSA384(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ECDSA P384 key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	size := getKeySize(cert)

	if size != 384 {
		t.Errorf("expected ECDSA key size 384, got %d", size)
	}
}

func TestGetKeySizeEd25519(t *testing.T) {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate Ed25519 key: %v", err)
	}

	cert := createTestCert(t, pubKey, privKey)
	size := getKeySize(cert)

	if size != 256 {
		t.Errorf("expected Ed25519 key size 256, got %d", size)
	}
}

func TestExtractSAN(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	sans := extractSAN(cert)

	// The test cert template has 2 DNS names, 1 IP, and 1 email = 4 SANs
	if len(sans) != 4 {
		t.Errorf("expected 4 SANs, got %d: %v", len(sans), sans)
	}

	// Verify specific entries exist
	found := map[string]bool{}
	for _, s := range sans {
		found[s] = true
	}

	expected := []string{"test.example.com", "*.example.com", "192.168.1.1", "admin@example.com"}
	for _, exp := range expected {
		if !found[exp] {
			t.Errorf("expected SAN %q not found in %v", exp, sans)
		}
	}
}

func TestExtractSANEmpty(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: "bare.example.com",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(24 * time.Hour),
		BasicConstraintsValid: true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		t.Fatalf("failed to parse certificate: %v", err)
	}

	sans := extractSAN(cert)
	if len(sans) != 0 {
		t.Errorf("expected 0 SANs for bare cert, got %d: %v", len(sans), sans)
	}
}

func TestCalculateFingerprint(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	cert := createTestCert(t, &key.PublicKey, key)
	fp := calculateFingerprint(cert)

	// SHA-256 hex-encoded = 64 uppercase hex characters
	if len(fp) != 64 {
		t.Errorf("expected fingerprint length 64, got %d", len(fp))
	}

	// Should be deterministic
	fp2 := calculateFingerprint(cert)
	if fp != fp2 {
		t.Error("fingerprint is not deterministic")
	}
}

func TestScanHostCancelledContext(t *testing.T) {
	log := logrus.New()
	log.SetLevel(logrus.ErrorLevel)
	s := NewScanner(5*time.Second, log)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := s.ScanHost(ctx, "example.com", 443)
	if err == nil {
		t.Error("ScanHost should return error when context is already cancelled")
	}
}
