package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
	"github.com/zertifikat-waechter/agent/config"
	"github.com/zertifikat-waechter/agent/scanner"
	"github.com/zertifikat-waechter/agent/supabase"
)

var log = logrus.New()

func main() {
	// Load .env file
	_ = godotenv.Load()

	// Configure logging
	log.SetFormatter(&logrus.JSONFormatter{})
	log.SetOutput(os.Stdout)
	log.SetLevel(logrus.InfoLevel)

	if os.Getenv("LOG_LEVEL") == "DEBUG" {
		log.SetLevel(logrus.DebugLevel)
	}

	log.Info("Starting Zertifikat-Wächter Agent")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	log.WithFields(logrus.Fields{
		"scan_interval": cfg.ScanInterval,
		"scan_ports":    cfg.ScanPorts,
		"scan_timeout":  cfg.ScanTimeout,
		"scan_targets":  cfg.ScanTargets,
	}).Info("Configuration loaded")

	// Initialize Supabase client
	supabaseClient := supabase.NewClient(cfg.SupabaseURL, cfg.SupabaseAPIKey)

	// Validate and register with token
	ctx := context.Background()
	if cfg.ConnectorToken != "" {
		log.Info("Validating connector token...")
		connector, err := supabaseClient.ValidateAndRegisterWithToken(ctx, cfg.ConnectorToken)
		if err != nil {
			log.Fatalf("Token validation failed: %v", err)
		}
		
		log.WithFields(logrus.Fields{
			"connector_id": connector.ID,
			"tenant_id":    connector.TenantID,
			"name":         connector.Name,
		}).Info("✅ Connector authenticated successfully!")
		
		cfg.ConnectorID = connector.ID
		cfg.TenantID = connector.TenantID
	} else {
		log.Fatal("CONNECTOR_TOKEN is required! Generiere ihn über die UI (Connectors-Seite)")
	}

	// Initialize scanners
	certScanner := scanner.NewScanner(cfg.ScanTimeout, log)
	networkScanner := scanner.NewNetworkScanner(cfg.ScanTimeout, log)

	// Start health check server
	go startHealthCheckServer(cfg.HealthCheckPort, log)

	// Start config polling (liest Änderungen aus Backend)
	go startConfigPolling(ctx, supabaseClient, cfg, log)

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start scan loop
	scanTicker := time.NewTicker(cfg.ScanInterval)
	defer scanTicker.Stop()

	// Start heartbeat loop (alle 30 Sekunden)
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	// Network Discovery beim Start (wenn keine Targets konfiguriert)
	if len(cfg.ScanTargets) == 0 || (len(cfg.ScanTargets) == 1 && cfg.ScanTargets[0] == "localhost") {
		log.Info("No targets configured - running network discovery...")
		runNetworkDiscovery(ctx, networkScanner, certScanner, supabaseClient, cfg)
	} else {
		// Run initial scan mit konfigurierten Targets
		runScan(ctx, certScanner, supabaseClient, cfg)
	}

	// Periodic scanning and heartbeat
	for {
		select {
		case <-scanTicker.C:
			// Check ob Discovery oder normale Scans
			if len(cfg.ScanTargets) == 0 || (len(cfg.ScanTargets) == 1 && cfg.ScanTargets[0] == "localhost") {
				runNetworkDiscovery(ctx, networkScanner, certScanner, supabaseClient, cfg)
			} else {
				runScan(ctx, certScanner, supabaseClient, cfg)
			}
		case <-heartbeatTicker.C:
			if cfg.ConnectorID != "" {
				if err := supabaseClient.UpdateConnectorHeartbeat(ctx); err != nil {
					log.WithError(err).Warn("Failed to update heartbeat")
				} else {
					log.Debug("Heartbeat updated")
				}
			}
		case <-sigChan:
			log.Info("Shutting down gracefully...")
			// Update connector status to offline
			if cfg.ConnectorID != "" {
				log.Info("Marking connector as offline...")
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

func startConfigPolling(ctx context.Context, client *supabase.Client, cfg *config.Config, log *logrus.Logger) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Config vom Backend holen und ggf. aktualisieren
			newConfig, err := client.GetConnectorConfig(ctx, cfg.ConnectorID)
			if err != nil {
				log.WithError(err).Debug("Failed to fetch config")
				continue
			}

			// Config aktualisieren wenn geändert
			if newConfig != nil {
				if targets, ok := newConfig["scan_targets"].([]interface{}); ok {
					newTargets := make([]string, 0, len(targets))
					for _, t := range targets {
						if str, ok := t.(string); ok {
							newTargets = append(newTargets, str)
						}
					}
					if len(newTargets) > 0 {
						cfg.ScanTargets = newTargets
						log.WithField("targets", newTargets).Info("Updated scan targets from backend")
					}
				}

				if ports, ok := newConfig["scan_ports"].([]interface{}); ok {
					newPorts := make([]int, 0, len(ports))
					for _, p := range ports {
						if num, ok := p.(float64); ok {
							newPorts = append(newPorts, int(num))
						}
					}
					if len(newPorts) > 0 {
						cfg.ScanPorts = newPorts
						log.WithField("ports", newPorts).Info("Updated scan ports from backend")
					}
				}

				// Trigger-Scan prüfen
				if triggerScan, ok := newConfig["trigger_scan"].(float64); ok {
					if triggerScan > 0 {
						log.Info("Triggered scan from backend - running scan now...")
						// Lösche Trigger
						client.ClearScanTrigger(ctx, cfg.ConnectorID)
					}
				}
			}
		case <-ctx.Done():
			return
		}
	}
}

func runNetworkDiscovery(ctx context.Context, networkScanner *scanner.NetworkScanner, certScanner *scanner.Scanner, client *supabase.Client, cfg *config.Config) {
	startTime := time.Now()
	log.Info("Starting network discovery...")
	
	// Send Log zu UI
	client.SendLog(ctx, cfg.ConnectorName, "info", "🌐 Netzwerk-Scan gestartet... Scanne alle privaten IP-Bereiche", map[string]interface{}{
		"scan_mode": "auto-discovery",
	})
	
	// Progress Callback
	progressCallback := func(current, total int) {
		client.UpdateScanProgress(ctx, current, total, fmt.Sprintf("Scanne Netzwerk: %d/%d", current, total))
	}
	
	// Discover hosts im Netzwerk
	hosts, err := networkScanner.DiscoverLocalNetwork(ctx, progressCallback)
	if err != nil {
		log.WithError(err).Error("Network discovery failed")
		client.SendLog(ctx, cfg.ConnectorName, "error", fmt.Sprintf("❌ Netzwerk-Scan fehlgeschlagen: %v", err), nil)
		return
	}

	scanDuration := time.Since(startTime)
	log.WithFields(logrus.Fields{
		"hosts_found": len(hosts),
		"duration":    scanDuration,
	}).Info("Network discovery completed")
	client.SendLog(ctx, cfg.ConnectorName, "info", fmt.Sprintf("✅ Netzwerk-Scan abgeschlossen: %d Hosts in %s gefunden", len(hosts), scanDuration.Round(time.Second)), map[string]interface{}{
		"hosts_found": len(hosts),
		"duration_ms": scanDuration.Milliseconds(),
	})

	// Für jeden gefundenen Host
	successCount := 0
	failCount := 0

	for idx, host := range hosts {
		// Send Progress
		client.UpdateScanProgress(ctx, idx+1, len(hosts), fmt.Sprintf("Analysiere Hosts: %d/%d", idx+1, len(hosts)))
		
		// IMMER Discovery-Result speichern (auch ohne Zertifikat!)
		if err := client.UpsertDiscoveryResult(ctx, &host); err != nil {
			log.WithError(err).Warn("Failed to upsert discovery result")
		} else {
			// Send Log zu UI
			servicesStr := "keine Services"
			if len(host.Services) > 0 {
				servicesStr = strings.Join(host.Services, ", ")
			}
			client.SendLog(ctx, cfg.ConnectorName, "info", fmt.Sprintf("🌐 Host gefunden: %s (%d Ports: %s)", host.IPAddress, len(host.OpenPorts), servicesStr), map[string]interface{}{
				"ip":         host.IPAddress,
				"open_ports": host.OpenPorts,
				"services":   host.Services,
			})
		}

		// Scanne TLS-Zertifikate auf HTTPS/TLS Ports
		tlsPorts := []int{}
		for _, port := range host.OpenPorts {
			if port == 443 || port == 8443 || port == 636 || port == 993 || port == 995 || port == 465 {
				tlsPorts = append(tlsPorts, port)
			}
		}

		for _, port := range tlsPorts {
			cert, err := certScanner.ScanHost(ctx, host.IPAddress, port)
			if err != nil {
				log.WithFields(logrus.Fields{
					"host":  host.IPAddress,
					"port":  port,
					"error": err,
				}).Debug("TLS scan failed")
				failCount++
				continue
			}

			// Asset upserten
			assetID, err := client.UpsertAsset(ctx, host.IPAddress, port)
			if err != nil {
				log.WithError(err).Warn("Failed to upsert asset")
			} else {
				cert.AssetID = assetID
			}

			cert.TenantID = cfg.TenantID

			// Certificate upserten
			if err := client.UpsertCertificate(ctx, cert); err != nil {
				log.WithError(err).Error("Failed to upsert certificate")
				failCount++
				continue
			}

			successCount++
			log.WithFields(logrus.Fields{
				"host":        host.IPAddress,
				"port":        port,
				"subject_cn":  cert.SubjectCN,
				"fingerprint": cert.Fingerprint,
			}).Info("Certificate discovered and reported")
			
			// Send Log zu UI
			client.SendLog(ctx, cfg.ConnectorName, "info", fmt.Sprintf("🔐 Zertifikat gefunden: %s auf %s:%d", cert.SubjectCN, host.IPAddress, port), map[string]interface{}{
				"host":       host.IPAddress,
				"port":       port,
				"subject_cn": cert.SubjectCN,
			})
		}
	}

	log.WithFields(logrus.Fields{
		"hosts":   len(hosts),
		"success": successCount,
		"failed":  failCount,
	}).Info("Network discovery and certificate scan completed")
	
	// Send Final Log
	totalDuration := time.Since(startTime)
	client.SendLog(ctx, cfg.ConnectorName, "info", fmt.Sprintf("✅ Scan abgeschlossen: %d Hosts, %d Zertifikate gefunden, %d Fehler (Dauer: %s)", len(hosts), successCount, failCount, totalDuration.Round(time.Second)), map[string]interface{}{
		"hosts_found":   len(hosts),
		"certificates":  successCount,
		"errors":        failCount,
		"duration_ms":   totalDuration.Milliseconds(),
		"scan_mode":     "auto-discovery",
	})
	
	// Clear Progress
	client.UpdateScanProgress(ctx, 0, 0, "completed")
}

func startHealthCheckServer(port string, log *logrus.Logger) {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("READY"))
	})

	addr := ":" + port
	log.WithField("port", port).Info("Health check server starting")

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.WithError(err).Error("Health check server failed")
	}
}

func runScan(ctx context.Context, scanner *scanner.Scanner, client *supabase.Client, cfg *config.Config) {
	log.Info("Starting certificate scan")
	successCount := 0
	failCount := 0

	for _, target := range cfg.ScanTargets {
		for _, port := range cfg.ScanPorts {
			log.WithFields(logrus.Fields{
				"host": target,
				"port": port,
			}).Debug("Scanning target")

			cert, err := scanner.ScanHost(ctx, target, port)
			if err != nil {
				log.WithFields(logrus.Fields{
					"host":  target,
					"port":  port,
					"error": err,
				}).Warn("Scan failed")
				failCount++
				continue
			}

			// Upsert Asset first (wenn TenantID verfügbar)
			var assetID string
			if cfg.TenantID != "" && cfg.ConnectorID != "" {
				assetID, err = client.UpsertAsset(ctx, target, port)
				if err != nil {
					log.WithFields(logrus.Fields{
						"host":  target,
						"port":  port,
						"error": err,
					}).Warn("Failed to upsert asset (continuing without asset_id)")
				} else {
					cert.AssetID = assetID
					log.WithFields(logrus.Fields{
						"asset_id": assetID,
						"host":     target,
						"port":     port,
					}).Debug("Asset upserted")
				}
			}

			// Setze TenantID
			if cfg.TenantID != "" {
				cert.TenantID = cfg.TenantID
			}

			// Send certificate to Supabase
			if err := client.UpsertCertificate(ctx, cert); err != nil {
				log.WithFields(logrus.Fields{
					"host":        target,
					"port":        port,
					"fingerprint": cert.Fingerprint,
					"error":       err,
				}).Error("Failed to upsert certificate")
				failCount++
				continue
			}

			successCount++
			log.WithFields(logrus.Fields{
				"host":        target,
				"port":        port,
				"subject_cn":  cert.SubjectCN,
				"fingerprint": cert.Fingerprint,
				"not_after":   cert.NotAfter,
				"asset_id":    assetID,
			}).Info("Certificate scanned and reported")
		}
	}

	log.WithFields(logrus.Fields{
		"success": successCount,
		"failed":  failCount,
		"total":   successCount + failCount,
	}).Info("Certificate scan completed")
}


