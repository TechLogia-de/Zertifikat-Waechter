package scanner

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"fmt"
	"net"
	"time"

	"github.com/sirupsen/logrus"
)

type Scanner struct {
	timeout time.Duration
	log     *logrus.Logger
}

type CertificateData struct {
	TenantID    string    `json:"tenant_id,omitempty"`
	AssetID     string    `json:"asset_id,omitempty"`
	Fingerprint string    `json:"fingerprint"`
	SubjectCN   string    `json:"subject_cn"`
	SAN         []string  `json:"san,omitempty"`
	Issuer      string    `json:"issuer"`
	NotBefore   time.Time `json:"not_before"`
	NotAfter    time.Time `json:"not_after"`
	KeyAlg      string    `json:"key_alg"`
	KeySize     int       `json:"key_size,omitempty"`
	Serial      string    `json:"serial"`
	IsTrusted   bool      `json:"is_trusted"`
}

func NewScanner(timeout time.Duration, log *logrus.Logger) *Scanner {
	return &Scanner{
		timeout: timeout,
		log:     log,
	}
}

func (s *Scanner) ScanHost(ctx context.Context, host string, port int) (*CertificateData, error) {
	dialer := &net.Dialer{
		Timeout: s.timeout,
	}

	address := fmt.Sprintf("%s:%d", host, port)
	
	conn, err := tls.DialWithDialer(
		dialer,
		"tcp",
		address,
		&tls.Config{
			InsecureSkipVerify: true,
			ServerName:         host,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("tls dial failed: %w", err)
	}
	defer conn.Close()

	certs := conn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return nil, fmt.Errorf("no certificates found")
	}

	// Parse the leaf certificate (first in chain)
	cert := certs[0]
	
	return parseCertificate(cert), nil
}

func parseCertificate(cert *x509.Certificate) *CertificateData {
	// Calculate fingerprint (SHA-256)
	fingerprint := sha256.Sum256(cert.Raw)
	fingerprintHex := hex.EncodeToString(fingerprint[:])

	// Extract SAN (Subject Alternative Names)
	san := make([]string, 0)
	san = append(san, cert.DNSNames...)
	for _, ip := range cert.IPAddresses {
		san = append(san, ip.String())
	}

	// Get key algorithm and size
	keyAlg := cert.PublicKeyAlgorithm.String()
	keySize := 0
	// TODO: Extract actual key size based on algorithm

	return &CertificateData{
		Fingerprint: fingerprintHex,
		SubjectCN:   cert.Subject.CommonName,
		SAN:         san,
		Issuer:      cert.Issuer.CommonName,
		NotBefore:   cert.NotBefore,
		NotAfter:    cert.NotAfter,
		KeyAlg:      keyAlg,
		KeySize:     keySize,
		Serial:      cert.SerialNumber.String(),
		IsTrusted:   false, // Will be determined by backend
	}
}


