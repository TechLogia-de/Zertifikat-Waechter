package scanner

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

type DiscoveryResult struct {
	Host         string   `json:"host"`
	IPAddress    string   `json:"ip_address"`
	OpenPorts    []int    `json:"open_ports"`
	Services     []string `json:"services"`
	ResponseTime int64    `json:"response_time_ms"`
}

type NetworkScanner struct {
	timeout time.Duration
	log     *logrus.Logger
}

// ScanPriority für intelligente Scan-Reihenfolge
type ScanPriority int

const (
	PriorityHigh   ScanPriority = 1 // Gateway, wichtige IPs
	PriorityMedium ScanPriority = 2 // Häufige Server-IPs
	PriorityLow    ScanPriority = 3 // Restliche IPs
)

// HostProfile für adaptive Scan-Strategie
type HostProfile struct {
	IPAddress    string
	Priority     ScanPriority
	OSType       string // "linux", "windows", "network-device", "unknown"
	IsServer     bool
	ServicePorts []int // Ports basierend auf erkannten Services
}

func NewNetworkScanner(timeout time.Duration, log *logrus.Logger) *NetworkScanner {
	return &NetworkScanner{
		timeout: timeout,
		log:     log,
	}
}

// DiscoverLocalNetwork scannt ALLE lokalen Netzwerke nach Hosts mit Hacker-Intelligenz
func (ns *NetworkScanner) DiscoverLocalNetwork(ctx context.Context, progressCallback func(current, total int)) ([]DiscoveryResult, error) {
	results := []DiscoveryResult{}
	mu := &sync.Mutex{}
	
	// Hole ALLE lokalen Netzwerke mit intelligenter CIDR-Erkennung
	networkInfos, err := getLocalNetworksWithCIDR()
	if err != nil {
		return nil, fmt.Errorf("failed to get local networks: %w", err)
	}

	ns.log.WithFields(logrus.Fields{
		"networks_found": len(networkInfos),
		"networks":       networkInfos,
	}).Info("🧠 Starting INTELLIGENT network discovery (Hacker-Mode)")

	// Scanne mit intelligenter Priorisierung (parallel, aber limitiert)
	sem := make(chan struct{}, 100) // Max 100 parallel
	var wg sync.WaitGroup
	scanned := 0
	total := 0
	for _, netInfo := range networkInfos {
		total += len(netInfo.ScanIPs)
	}

	ns.log.WithFields(logrus.Fields{
		"total_ips":    total,
		"strategy":     "prioritized-scan",
		"gateway_first": true,
	}).Info("🎯 Scan-Strategie: Gateway → Server-IPs → Rest")

	for _, netInfo := range networkInfos {
		ns.log.WithFields(logrus.Fields{
			"network": netInfo.Network,
			"cidr":    netInfo.CIDR,
			"gateway": netInfo.Gateway,
			"own_ip":  netInfo.OwnIP,
		}).Info("🌐 Scanning network with Hacker-Intelligence")

		// PHASE 1: Quick Scan aller IPs (priorisiert)
		quickResults := make(map[string]*DiscoveryResult)
		quickMu := &sync.Mutex{}

		for idx, ip := range netInfo.ScanIPs {
			wg.Add(1)
			go func(targetIP string, index int) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { 
					<-sem
					mu.Lock()
					scanned++
					if progressCallback != nil && scanned%5 == 0 {
						progressCallback(scanned, total)
					}
					mu.Unlock()
				}()

				// Quick Alive-Check
				if !ns.isHostAlive(ctx, targetIP) {
					return
				}

				// Host ist erreichbar - Basic Scan
				result := ns.scanHost(ctx, targetIP)
				if len(result.OpenPorts) > 0 {
					quickMu.Lock()
					quickResults[targetIP] = &result
					quickMu.Unlock()

					ns.log.WithFields(logrus.Fields{
						"ip":         result.IPAddress,
						"open_ports": len(result.OpenPorts),
						"services":   result.Services,
					}).Info("✓ Host discovered")
				}
			}(ip, idx)
		}

		wg.Wait()

		// PHASE 2: Deep Scan für interessante Hosts (Adaptive Scanning)
		ns.log.WithField("hosts_found", len(quickResults)).Info("🔬 Starting DEEP scan for interesting hosts...")

		for ip, quickResult := range quickResults {
			// Erkenne OS-Typ
			osType := detectOSType(quickResult.OpenPorts, quickResult.Services)
			
			// Ist das ein Server? (viele Ports oder wichtige Services)
			isServer := len(quickResult.OpenPorts) >= 3

			if isServer || osType != "unknown" {
				ns.log.WithFields(logrus.Fields{
					"ip":        ip,
					"os_type":   osType,
					"is_server": isServer,
				}).Info("🎯 Interesting host → Deep scan")

				// Adaptive Port-Liste basierend auf Services
				adaptivePorts := getAdaptivePortList(quickResult.OpenPorts, quickResult.Services)
				
				// Deep Scan mit erweiterten Ports
				deepResult := ns.scanHostWithPorts(ctx, ip, adaptivePorts)
				
				// Merge Results
				if len(deepResult.OpenPorts) > len(quickResult.OpenPorts) {
					ns.log.WithFields(logrus.Fields{
						"ip":         ip,
						"new_ports":  len(deepResult.OpenPorts) - len(quickResult.OpenPorts),
						"total":      len(deepResult.OpenPorts),
					}).Info("💎 Deep scan found additional ports!")
					
					*quickResult = deepResult
				}
			}

			// Final Result speichern
			mu.Lock()
			results = append(results, *quickResult)
			mu.Unlock()
		}
	}

	wg.Wait()
	
	if progressCallback != nil {
		progressCallback(total, total) // 100%
	}
	
	ns.log.WithFields(logrus.Fields{
		"hosts_found": len(results),
		"networks_scanned": len(networkInfos),
	}).Info("🎉 Intelligent network discovery completed!")
	
	return results, nil
}

// isHostAlive prüft schnell ob Host erreichbar ist
func (ns *NetworkScanner) isHostAlive(ctx context.Context, ip string) bool {
	// Versuche TCP-Connect auf gängige Ports (schneller als ICMP)
	// Erweiterte Port-Liste für bessere Erkennung
	quickPorts := []int{80, 443, 22, 3389, 445, 8080, 8443, 21, 25, 23} // HTTP, HTTPS, SSH, RDP, SMB, Alt-HTTP, FTP, SMTP, Telnet
	
	for _, port := range quickPorts {
		address := fmt.Sprintf("%s:%d", ip, port)
		// Schnellerer Timeout für Alive-Check (300ms statt 500ms)
		conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
		if err == nil {
			conn.Close()
			return true
		}
	}
	
	return false
}

// scanHost scannt einen einzelnen Host nach offenen Ports und Services (Standard-Ports)
func (ns *NetworkScanner) scanHost(ctx context.Context, ip string) DiscoveryResult {
	// Standard-Ports für Quick Scan
	portsToScan := []int{
		21,   // FTP
		22,   // SSH
		23,   // Telnet
		25,   // SMTP
		53,   // DNS
		80,   // HTTP
		110,  // POP3
		143,  // IMAP
		389,  // LDAP
		443,  // HTTPS
		445,  // SMB
		465,  // SMTPS
		587,  // SMTP (Submission)
		636,  // LDAPS
		993,  // IMAPS
		995,  // POP3S
		3306, // MySQL
		3389, // RDP
		5432, // PostgreSQL
		5900, // VNC
		6379, // Redis
		8080, // HTTP-Alt
		8443, // HTTPS-Alt
		9200, // Elasticsearch
		27017, // MongoDB
	}
	
	return ns.scanHostWithPorts(ctx, ip, portsToScan)
}

// scanHostWithPorts scannt mit custom Port-Liste (für adaptive Scans)
func (ns *NetworkScanner) scanHostWithPorts(ctx context.Context, ip string, portsToScan []int) DiscoveryResult {
	result := DiscoveryResult{
		Host:      ip,
		IPAddress: ip,
		OpenPorts: []int{},
		Services:  []string{},
	}

	startTime := time.Now()
	
	// Scanne Ports parallel
	sem := make(chan struct{}, 10) // Max 10 parallel für Deep Scan
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, port := range portsToScan {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if ns.isPortOpen(ip, p) {
				service := identifyService(p)
				
				mu.Lock()
				result.OpenPorts = append(result.OpenPorts, p)
				if service != "" && !contains(result.Services, service) {
					result.Services = append(result.Services, service)
				}
				mu.Unlock()
			}
		}(port)
	}

	wg.Wait()
	result.ResponseTime = time.Since(startTime).Milliseconds()

	return result
}

// contains prüft ob String in Slice vorhanden
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// isPortOpen prüft ob Port offen ist
func (ns *NetworkScanner) isPortOpen(ip string, port int) bool {
	address := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", address, ns.timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// identifyService identifiziert Service anhand Port
func identifyService(port int) string {
	services := map[int]string{
		21:    "FTP",
		22:    "SSH",
		23:    "Telnet",
		25:    "SMTP",
		53:    "DNS",
		80:    "HTTP",
		110:   "POP3",
		143:   "IMAP",
		389:   "LDAP",
		443:   "HTTPS",
		445:   "SMB/CIFS",
		465:   "SMTPS",
		587:   "SMTP-Submission",
		636:   "LDAPS",
		993:   "IMAPS",
		995:   "POP3S",
		3306:  "MySQL",
		3389:  "RDP",
		5432:  "PostgreSQL",
		5900:  "VNC",
		6379:  "Redis",
		8080:  "HTTP-Proxy",
		8443:  "HTTPS-Alt",
		9200:  "Elasticsearch",
		27017: "MongoDB",
	}
	
	if service, ok := services[port]; ok {
		return service
	}
	return fmt.Sprintf("TCP/%d", port)
}

// Alte Funktionen entfernt - jetzt in intelligence.go mit CIDR-Support!

