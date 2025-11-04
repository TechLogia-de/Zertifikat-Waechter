package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/zertifikat-waechter/agent/scanner"
)

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
		},
	}
}

// ValidateAndRegisterWithToken validiert Token und registriert Agent
func (c *Client) ValidateAndRegisterWithToken(ctx context.Context, token string) (*ConnectorInfo, error) {
	// Call RPC function to validate token
	url := fmt.Sprintf("%s/rest/v1/rpc/validate_connector_token", c.BaseURL)
	
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

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token validation failed: %d - %s (Token ungültig oder abgelaufen?)", resp.StatusCode, string(body))
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
	url := fmt.Sprintf("%s/rest/v1/assets", c.BaseURL)

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

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return "", fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation,resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase error: %d - %s", resp.StatusCode, string(body))
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
	// Setze TenantID und AssetID falls noch nicht gesetzt
	if cert.TenantID == "" {
		cert.TenantID = c.TenantID
	}

	url := fmt.Sprintf("%s/rest/v1/certificates", c.BaseURL)

	data, err := json.Marshal(cert)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// UpdateConnectorHeartbeat aktualisiert last_seen des Connectors
func (c *Client) UpdateConnectorHeartbeat(ctx context.Context) error {
	if c.ConnectorID == "" {
		return fmt.Errorf("connector not registered")
	}

	url := fmt.Sprintf("%s/rest/v1/connectors?id=eq.%s", c.BaseURL, c.ConnectorID)

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

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetConnectorConfig holt aktuelle Config vom Backend
func (c *Client) GetConnectorConfig(ctx context.Context, connectorID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/rest/v1/connectors?id=eq.%s&select=config", c.BaseURL, connectorID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

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
	// Hole aktuelle Config
	config, err := c.GetConnectorConfig(ctx, connectorID)
	if err != nil {
		return err
	}

	// Entferne trigger_scan
	delete(config, "trigger_scan")

	// Update Config
	url := fmt.Sprintf("%s/rest/v1/connectors?id=eq.%s", c.BaseURL, connectorID)

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

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// UpsertDiscoveryResult speichert Network-Discovery-Ergebnisse
func (c *Client) UpsertDiscoveryResult(ctx context.Context, result *scanner.DiscoveryResult) error {
	// Erst versuchen zu UPDATE, falls nicht existiert dann INSERT
	// Check ob Eintrag existiert
	checkURL := fmt.Sprintf("%s/rest/v1/discovery_results?connector_id=eq.%s&ip_address=eq.%s&select=id", 
		c.BaseURL, c.ConnectorID, result.IPAddress)
	
	checkReq, err := http.NewRequestWithContext(ctx, "GET", checkURL, nil)
	if err != nil {
		return fmt.Errorf("create check request failed: %w", err)
	}
	checkReq.Header.Set("apikey", c.APIKey)
	checkReq.Header.Set("Authorization", "Bearer "+c.APIKey)
	
	checkResp, err := c.client.Do(checkReq)
	if err != nil {
		return fmt.Errorf("check request failed: %w", err)
	}
	defer checkResp.Body.Close()
	
	var existingRecords []map[string]interface{}
	json.NewDecoder(checkResp.Body).Decode(&existingRecords)
	
	payload := map[string]interface{}{
		"tenant_id":      c.TenantID,
		"connector_id":   c.ConnectorID,
		"host":           result.Host,
		"ip_address":     result.IPAddress,
		"open_ports":     result.OpenPorts,
		"services":       result.Services,
		"response_time":  result.ResponseTime,
		"discovered_at":  time.Now().UTC().Format(time.RFC3339),
	}
	
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}
	
	var url string
	var method string
	
	if len(existingRecords) > 0 {
		// UPDATE existierenden Eintrag
		url = fmt.Sprintf("%s/rest/v1/discovery_results?connector_id=eq.%s&ip_address=eq.%s", 
			c.BaseURL, c.ConnectorID, result.IPAddress)
		method = "PATCH"
	} else {
		// INSERT neuen Eintrag
		url = fmt.Sprintf("%s/rest/v1/discovery_results", c.BaseURL)
		method = "POST"
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendLog sendet Log-Eintrag an Supabase für UI-Anzeige
func (c *Client) SendLog(ctx context.Context, connectorName, level, message string, metadata map[string]interface{}) error {
	url := fmt.Sprintf("%s/rest/v1/agent_logs", c.BaseURL)

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

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Ignoriere Fehler beim Log-Senden (soll nicht Agent crashen)
	if resp.StatusCode >= 400 {
		return nil // Silent fail
	}

	return nil
}

// UpdateScanProgress aktualisiert Scan-Fortschritt
func (c *Client) UpdateScanProgress(ctx context.Context, current, total int, status string) error {
	if c.ConnectorID == "" {
		return nil
	}

	// Hole aktuelle Config
	config, err := c.GetConnectorConfig(ctx, c.ConnectorID)
	if err != nil {
		return err
	}

	if config == nil {
		config = make(map[string]interface{})
	}

	// Update Progress
	config["scanning"] = current < total
	config["scan_progress"] = map[string]interface{}{
		"current": current,
		"total":   total,
		"status":  status,
	}

	// Update in DB
	url := fmt.Sprintf("%s/rest/v1/connectors?id=eq.%s", c.BaseURL, c.ConnectorID)

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

	req.Header.Set("apikey", c.APIKey)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}


