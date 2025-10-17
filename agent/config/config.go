package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	SupabaseURL      string
	SupabaseAPIKey   string
	ConnectorToken   string // Token für Connector-Registration
	ConnectorName    string
	TenantID         string // Wird nach Registration gesetzt
	ConnectorID      string // Wird nach Registration gesetzt
	ScanTargets      []string
	ScanPorts        []int
	ScanInterval     time.Duration
	ScanTimeout      time.Duration
	HealthCheckPort  string
}

func Load() (*Config, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		return nil, fmt.Errorf("SUPABASE_URL is required")
	}

	connectorToken := os.Getenv("CONNECTOR_TOKEN")
	if connectorToken == "" {
		return nil, fmt.Errorf("CONNECTOR_TOKEN is required (generiere ihn über die UI)")
	}

	// Anon Key für Initial-Auth (wird nach Token-Validierung nicht mehr benötigt)
	supabaseAPIKey := os.Getenv("SUPABASE_ANON_KEY")
	if supabaseAPIKey == "" {
		supabaseAPIKey = os.Getenv("SUPABASE_SERVICE_ROLE_KEY") // Fallback für alte Setups
		if supabaseAPIKey == "" {
			return nil, fmt.Errorf("SUPABASE_ANON_KEY is required")
		}
	}

	connectorName := os.Getenv("CONNECTOR_NAME")
	if connectorName == "" {
		connectorName = "agent-" + time.Now().Format("20060102-150405")
	}

	// Parse scan targets
	targetsStr := os.Getenv("SCAN_TARGETS")
	if targetsStr == "" {
		targetsStr = "localhost"
	}
	scanTargets := strings.Split(targetsStr, ",")
	// Trim spaces
	for i := range scanTargets {
		scanTargets[i] = strings.TrimSpace(scanTargets[i])
	}

	// Parse scan ports
	portsStr := os.Getenv("SCAN_PORTS")
	if portsStr == "" {
		portsStr = "443,8443,636"
	}
	portStrs := strings.Split(portsStr, ",")
	scanPorts := make([]int, 0, len(portStrs))
	for _, portStr := range portStrs {
		port, err := strconv.Atoi(strings.TrimSpace(portStr))
		if err != nil {
			return nil, fmt.Errorf("invalid port: %s", portStr)
		}
		scanPorts = append(scanPorts, port)
	}

	// Parse scan interval (in seconds)
	intervalStr := os.Getenv("SCAN_INTERVAL")
	if intervalStr == "" {
		intervalStr = "3600" // 1 Stunde
	}
	intervalSec, err := strconv.Atoi(intervalStr)
	if err != nil {
		return nil, fmt.Errorf("invalid SCAN_INTERVAL: %s", intervalStr)
	}

	// Parse scan timeout (in seconds)
	timeoutStr := os.Getenv("SCAN_TIMEOUT")
	if timeoutStr == "" {
		timeoutStr = "5"
	}
	timeoutSec, err := strconv.Atoi(timeoutStr)
	if err != nil {
		return nil, fmt.Errorf("invalid SCAN_TIMEOUT: %s", timeoutStr)
	}

	healthCheckPort := os.Getenv("HEALTH_CHECK_PORT")
	if healthCheckPort == "" {
		healthCheckPort = "8080"
	}

	return &Config{
		SupabaseURL:     supabaseURL,
		SupabaseAPIKey:  supabaseAPIKey,
		ConnectorToken:  connectorToken,
		ConnectorName:   connectorName,
		ScanTargets:     scanTargets,
		ScanPorts:       scanPorts,
		ScanInterval:    time.Duration(intervalSec) * time.Second,
		ScanTimeout:     time.Duration(timeoutSec) * time.Second,
		HealthCheckPort: healthCheckPort,
	}, nil
}


