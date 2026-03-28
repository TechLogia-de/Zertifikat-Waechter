package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Set required env vars
	os.Setenv("SUPABASE_URL", "https://test.supabase.co")
	os.Setenv("SUPABASE_ANON_KEY", "test-key")
	os.Setenv("CONNECTOR_TOKEN", "test-token")
	defer func() {
		os.Unsetenv("SUPABASE_URL")
		os.Unsetenv("SUPABASE_ANON_KEY")
		os.Unsetenv("CONNECTOR_TOKEN")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.SupabaseURL != "https://test.supabase.co" {
		t.Errorf("SupabaseURL = %q, want %q", cfg.SupabaseURL, "https://test.supabase.co")
	}

	if cfg.ConnectorToken != "test-token" {
		t.Errorf("ConnectorToken = %q, want %q", cfg.ConnectorToken, "test-token")
	}

	// Check defaults
	if cfg.HealthCheckPort != "8080" {
		t.Errorf("HealthCheckPort = %q, want %q", cfg.HealthCheckPort, "8080")
	}
}

func TestLoadMissingRequired(t *testing.T) {
	os.Unsetenv("SUPABASE_URL")
	os.Unsetenv("SUPABASE_ANON_KEY")
	os.Unsetenv("CONNECTOR_TOKEN")

	_, err := Load()
	if err == nil {
		t.Error("Load() should return error when required vars missing")
	}
}

func TestLoadScanTargets(t *testing.T) {
	os.Setenv("SUPABASE_URL", "https://test.supabase.co")
	os.Setenv("SUPABASE_ANON_KEY", "test-key")
	os.Setenv("CONNECTOR_TOKEN", "test-token")
	os.Setenv("SCAN_TARGETS", "example.com,test.com,demo.org")
	defer func() {
		os.Unsetenv("SUPABASE_URL")
		os.Unsetenv("SUPABASE_ANON_KEY")
		os.Unsetenv("CONNECTOR_TOKEN")
		os.Unsetenv("SCAN_TARGETS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if len(cfg.ScanTargets) != 3 {
		t.Errorf("ScanTargets length = %d, want 3", len(cfg.ScanTargets))
	}

	if cfg.ScanTargets[0] != "example.com" {
		t.Errorf("ScanTargets[0] = %q, want %q", cfg.ScanTargets[0], "example.com")
	}
}

func TestLoadScanPorts(t *testing.T) {
	os.Setenv("SUPABASE_URL", "https://test.supabase.co")
	os.Setenv("SUPABASE_ANON_KEY", "test-key")
	os.Setenv("CONNECTOR_TOKEN", "test-token")
	os.Setenv("SCAN_PORTS", "443,8443,636")
	defer func() {
		os.Unsetenv("SUPABASE_URL")
		os.Unsetenv("SUPABASE_ANON_KEY")
		os.Unsetenv("CONNECTOR_TOKEN")
		os.Unsetenv("SCAN_PORTS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if len(cfg.ScanPorts) != 3 {
		t.Errorf("ScanPorts length = %d, want 3", len(cfg.ScanPorts))
	}
}
