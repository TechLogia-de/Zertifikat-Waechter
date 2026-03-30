package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/zertifikat-waechter/agent/scanner"
)

// maxErrorBodySize limits how much of an error response body we read to avoid
// unbounded memory allocation from a misbehaving server.
const maxErrorBodySize = 4096

type Client struct {
	BaseURL     string
	APIKey      string
	client      *http.Client
	TenantID    string
	ConnectorID string
}

type ConnectorInfo struct {
	ID       string `json:"id"`
	TenantID string `json:"tenant_id"`
	Name     string `json:"name"`
	Status   string `json:"status"`
}

type AssetData struct {
	ID          string `json:"id,omitempty"`
	TenantID    string `json:"tenant_id"`
	ConnectorID string `json:"connector_id,omitempty"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Proto       string `json:"proto"`
	Status      string `json:"status"`
}

func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		client: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        20,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
				DialContext: (&net.Dialer{
					Timeout:   5 * time.Second,
					KeepAlive: 30 * time.Second,
				}).DialContext,
			},
		},
	}
}

// apiURL builds a full REST API URL for the given path.
func (c *Client) apiURL(path string) string {
	return c.BaseURL + "/rest/v1/" + path
}

// setAuthHeaders adds the common authentication headers to a request.
func (c *Client) setAuthHeaders(req *http.Request) {
	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
}

// readErrorBody reads up to maxErrorBodySize bytes from an error response.
func readErrorBody(r io.Reader) string {
	body, _ := io.ReadAll(io.LimitReader(r, maxErrorBodySize))
	return string(body)
}

// ValidateAndRegisterWithToken validiert Token und registriert Agent
func (c *Client) ValidateAndRegisterWithToken(ctx context.Context, token string) (*ConnectorInfo, error) {
	url := c.BaseURL + "/rest/v1/rpc/validate_connector_token"

	payload := map[string]interface{}{
		"p_token": token,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("token validation failed: %d - %s (Token ungültig oder abgelaufen?)", resp.StatusCode, readErrorBody(resp.Body))
	}

	// Parse response
	var results []struct {
		ConnectorID string `json:"connector_id"`
		TenantID    string `json:"tenant_id"`
		Name        string `json:"name"`
		Config      json.RawMessage `json:"config"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("token ungültig oder Connector nicht gefunden")
	}

	result := results[0]
	
	connector := &ConnectorInfo{
		ID:       result.ConnectorID,
		TenantID: result.TenantID,
		Name:     result.Name,
		Status:   "active",
	}

	c.ConnectorID = connector.ID
	c.TenantID = connector.TenantID

	return connector, nil
}

// UpsertAsset erstellt oder aktualisiert einen Asset-Eintrag
func (c *Client) UpsertAsset(ctx context.Context, host string, port int) (string, error) {
	asset := AssetData{
		TenantID:    c.TenantID,
		ConnectorID: c.ConnectorID,
		Host:        host,
		Port:        port,
		Proto:       "tls",
		Status:      "active",
	}

	data, err := json.Marshal(asset)
	if err != nil {
		return "", fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL("assets"), bytes.NewBuffer(data))
	if err != nil {
		return "", fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation,resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	var assets []AssetData
	if err := json.NewDecoder(resp.Body).Decode(&assets); err != nil {
		return "", fmt.Errorf("decode failed: %w", err)
	}

	if len(assets) == 0 {
		return "", fmt.Errorf("no asset returned")
	}

	return assets[0].ID, nil
}

// UpsertCertificate sendet Zertifikat-Daten an Supabase
func (c *Client) UpsertCertificate(ctx context.Context, cert *scanner.CertificateData) error {
	if cert.TenantID == "" {
		cert.TenantID = c.TenantID
	}

	data, err := json.Marshal(cert)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL("certificates"), bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// BatchUpsertCertificates sends multiple certificates in a single request.
func (c *Client) BatchUpsertCertificates(ctx context.Context, certs []*scanner.CertificateData) error {
	if len(certs) == 0 {
		return nil
	}

	for _, cert := range certs {
		if cert.TenantID == "" {
			cert.TenantID = c.TenantID
		}
	}

	data, err := json.Marshal(certs)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL("certificates"), bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// UpdateConnectorHeartbeat aktualisiert last_seen des Connectors
func (c *Client) UpdateConnectorHeartbeat(ctx context.Context) error {
	if c.ConnectorID == "" {
		return fmt.Errorf("connector not registered")
	}

	url := c.apiURL(fmt.Sprintf("connectors?id=eq.%s", c.ConnectorID))

	payload := map[string]interface{}{
		"last_seen": time.Now().UTC().Format(time.RFC3339),
		"status":    "active",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// UpdateConnectorStatus sets the connector's status (e.g. "active", "inactive").
func (c *Client) UpdateConnectorStatus(ctx context.Context, connectorID, status string) error {
	url := c.apiURL(fmt.Sprintf("connectors?id=eq.%s", connectorID))

	payload := map[string]interface{}{
		"status":    status,
		"last_seen": time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// GetConnectorConfig holt aktuelle Config vom Backend
func (c *Client) GetConnectorConfig(ctx context.Context, connectorID string) (map[string]interface{}, error) {
	url := c.apiURL(fmt.Sprintf("connectors?id=eq.%s&select=config", connectorID))

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error: %d", resp.StatusCode)
	}

	var results []struct {
		Config map[string]interface{} `json:"config"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	if len(results) == 0 {
		return nil, nil
	}

	return results[0].Config, nil
}

// ClearScanTrigger löscht Scan-Trigger aus Config
func (c *Client) ClearScanTrigger(ctx context.Context, connectorID string) error {
	config, err := c.GetConnectorConfig(ctx, connectorID)
	if err != nil {
		return err
	}

	delete(config, "trigger_scan")

	url := c.apiURL(fmt.Sprintf("connectors?id=eq.%s", connectorID))

	payload := map[string]interface{}{
		"config": config,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// UpsertDiscoveryResult speichert Network-Discovery-Ergebnisse via merge-duplicates
func (c *Client) UpsertDiscoveryResult(ctx context.Context, result *scanner.DiscoveryResult) error {
	payload := map[string]interface{}{
		"tenant_id":     c.TenantID,
		"connector_id":  c.ConnectorID,
		"host":          result.Host,
		"ip_address":    result.IPAddress,
		"open_ports":    result.OpenPorts,
		"services":      result.Services,
		"response_time": result.ResponseTime,
		"discovered_at": time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL("discovery_results"), bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// SendLog sendet Log-Eintrag an Supabase für UI-Anzeige.
// Returns an error on failure instead of silently swallowing it, so the caller
// can decide whether to log the problem.
func (c *Client) SendLog(ctx context.Context, connectorName, level, message string, metadata map[string]interface{}) error {
	payload := map[string]interface{}{
		"tenant_id":      c.TenantID,
		"connector_id":   c.ConnectorID,
		"connector_name": connectorName,
		"level":          level,
		"message":        message,
		"metadata":       metadata,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL("agent_logs"), bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("send log failed: %d - %s", resp.StatusCode, readErrorBody(resp.Body))
	}

	return nil
}

// UpdateScanProgress aktualisiert Scan-Fortschritt
func (c *Client) UpdateScanProgress(ctx context.Context, current, total int, status string) error {
	if c.ConnectorID == "" {
		return nil
	}

	config, err := c.GetConnectorConfig(ctx, c.ConnectorID)
	if err != nil {
		return err
	}

	if config == nil {
		config = make(map[string]interface{})
	}

	config["scanning"] = current < total
	config["scan_progress"] = map[string]interface{}{
		"current": current,
		"total":   total,
		"status":  status,
	}

	url := c.apiURL(fmt.Sprintf("connectors?id=eq.%s", c.ConnectorID))

	payload := map[string]interface{}{
		"config": config,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}


