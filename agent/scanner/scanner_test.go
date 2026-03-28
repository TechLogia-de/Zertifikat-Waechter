package scanner

import (
	"context"
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
