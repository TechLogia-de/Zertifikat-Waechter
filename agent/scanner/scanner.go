package scanner

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

type Scanner struct {
	timeout time.Duration
	log     *logrus.Logger
}

type CertificateData struct {
	AssetID      string    `json:"asset_id,omitempty"`
	TenantID     string    `json:"tenant_id,omitempty"`
	Fingerprint  string    `json:"fingerprint"`
	SubjectCN    string    `json:"subject_cn"`
	SAN          []string  `json:"san,omitempty"`
	Issuer       string    `json:"issuer"`
	NotBefore    time.Time `json:"not_before"`
	NotAfter     time.Time `json:"not_after"`
	KeyAlgorithm string    `json:"key_algorithm"`
	KeySize      int       `json:"key_size,omitempty"`
	SerialNumber string    `json:"serial_number"`
	SignatureAlg string    `json:"signature_algorithm"`
}

func NewScanner(timeout time.Duration, log *logrus.Logger) *Scanner {
	return &Scanner{
		timeout: timeout,
		log:     log,
	}
}

// ScanHost scannt einen einzelnen Host:Port nach TLS-Zertifikat
func (s *Scanner) ScanHost(ctx context.Context, host string, port int) (*CertificateData, error) {
	address := fmt.Sprintf("%s:%d", host, port)

	// TLS-Config mit InsecureSkipVerify (wir wollen nur Cert-Metadaten)
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
	}

	// Dialer mit Timeout
	dialer := &net.Dialer{
		Timeout: s.timeout,
	}

	// TLS-Connection öffnen
	conn, err := tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("TLS handshake failed: %w", err)
	}
	defer conn.Close()

	// Connection State holen
	connState := conn.ConnectionState()
	if len(connState.PeerCertificates) == 0 {
		return nil, fmt.Errorf("no certificates found")
	}

	// End-Entity-Zertifikat (erstes in der Chain)
	cert := connState.PeerCertificates[0]

	// Parse Zertifikat-Daten
	certData := &CertificateData{
		Fingerprint:  calculateFingerprint(cert),
		SubjectCN:    cert.Subject.CommonName,
		SAN:          extractSAN(cert),
		Issuer:       cert.Issuer.CommonName,
		NotBefore:    cert.NotBefore,
		NotAfter:     cert.NotAfter,
		KeyAlgorithm: cert.PublicKeyAlgorithm.String(),
		KeySize:      getKeySize(cert),
		SerialNumber: cert.SerialNumber.String(),
		SignatureAlg: cert.SignatureAlgorithm.String(),
	}

	return certData, nil
}

// calculateFingerprint berechnet SHA-256 Fingerprint
func calculateFingerprint(cert *x509.Certificate) string {
	hash := sha256.Sum256(cert.Raw)
	return strings.ToUpper(hex.EncodeToString(hash[:]))
}

// extractSAN extrahiert Subject Alternative Names
func extractSAN(cert *x509.Certificate) []string {
	san := []string{}

	// DNS Names
	for _, name := range cert.DNSNames {
		san = append(san, name)
	}

	// IP Addresses
	for _, ip := range cert.IPAddresses {
		san = append(san, ip.String())
	}

	// Email Addresses
	for _, email := range cert.EmailAddresses {
		san = append(san, email)
	}

	// URIs
	for _, uri := range cert.URIs {
		san = append(san, uri.String())
	}

	return san
}

// getKeySize ermittelt Key-Size (für RSA/ECDSA)
func getKeySize(cert *x509.Certificate) int {
	switch key := cert.PublicKey.(type) {
	case *interface{ Size() int }:
		return (*key).Size() * 8 // Bytes → Bits
	default:
		return 0
	}
}


