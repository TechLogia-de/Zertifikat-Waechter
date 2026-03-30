package scanner

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
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
	AssetID             string    `json:"asset_id,omitempty"`
	TenantID            string    `json:"tenant_id,omitempty"`
	Fingerprint         string    `json:"fingerprint"`
	SubjectCN           string    `json:"subject_cn"`
	SAN                 []string  `json:"san,omitempty"`
	Issuer              string    `json:"issuer"`
	NotBefore           time.Time `json:"not_before"`
	NotAfter            time.Time `json:"not_after"`
	KeyAlgorithm        string    `json:"key_algorithm"`
	KeySize             int       `json:"key_size,omitempty"`
	SerialNumber        string    `json:"serial_number"`
	SignatureAlg        string    `json:"signature_algorithm"`
	ChainLength         int       `json:"chain_length,omitempty"`
	IsCA                bool      `json:"is_ca,omitempty"`
	OCSPServers         []string  `json:"ocsp_servers,omitempty"`
	CRLDistPoints       []string  `json:"crl_distribution_points,omitempty"`
	ExtKeyUsage         []string  `json:"ext_key_usage,omitempty"`
	KeyAlg              string    `json:"key_alg,omitempty"`
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
		Fingerprint:   calculateFingerprint(cert),
		SubjectCN:     cert.Subject.CommonName,
		SAN:           extractSAN(cert),
		Issuer:        cert.Issuer.CommonName,
		NotBefore:     cert.NotBefore,
		NotAfter:      cert.NotAfter,
		KeyAlgorithm:  cert.PublicKeyAlgorithm.String(),
		KeyAlg:        cert.PublicKeyAlgorithm.String(),
		KeySize:       getKeySize(cert),
		SerialNumber:  fmt.Sprintf("%X", cert.SerialNumber),
		SignatureAlg:  cert.SignatureAlgorithm.String(),
		ChainLength:   len(connState.PeerCertificates),
		IsCA:          cert.IsCA,
		OCSPServers:   cert.OCSPServer,
		CRLDistPoints: cert.CRLDistributionPoints,
		ExtKeyUsage:   extKeyUsageStrings(cert.ExtKeyUsage),
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
	totalLen := len(cert.DNSNames) + len(cert.IPAddresses) + len(cert.EmailAddresses) + len(cert.URIs)
	if totalLen == 0 {
		return nil
	}

	san := make([]string, 0, totalLen)
	san = append(san, cert.DNSNames...)
	for _, ip := range cert.IPAddresses {
		san = append(san, ip.String())
	}
	san = append(san, cert.EmailAddresses...)
	for _, uri := range cert.URIs {
		san = append(san, uri.String())
	}

	return san
}

// getKeySize ermittelt Key-Size in Bits (für RSA/ECDSA/Ed25519)
func getKeySize(cert *x509.Certificate) int {
	switch key := cert.PublicKey.(type) {
	case *rsa.PublicKey:
		return key.N.BitLen()
	case *ecdsa.PublicKey:
		return key.Curve.Params().BitSize
	case ed25519.PublicKey:
		return 256
	default:
		return 0
	}
}

// extKeyUsageStrings converts x509.ExtKeyUsage values to readable strings.
func extKeyUsageStrings(usages []x509.ExtKeyUsage) []string {
	if len(usages) == 0 {
		return nil
	}
	names := map[x509.ExtKeyUsage]string{
		x509.ExtKeyUsageServerAuth:      "ServerAuth",
		x509.ExtKeyUsageClientAuth:      "ClientAuth",
		x509.ExtKeyUsageCodeSigning:     "CodeSigning",
		x509.ExtKeyUsageEmailProtection: "EmailProtection",
		x509.ExtKeyUsageOCSPSigning:     "OCSPSigning",
		x509.ExtKeyUsageTimeStamping:    "TimeStamping",
	}
	result := make([]string, 0, len(usages))
	for _, u := range usages {
		if name, ok := names[u]; ok {
			result = append(result, name)
		} else {
			result = append(result, fmt.Sprintf("Unknown(%d)", u))
		}
	}
	return result
}


