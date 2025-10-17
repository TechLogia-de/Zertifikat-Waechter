package scanner

import (
	"context"
	"fmt"
	"net"
	"strings"
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

func NewNetworkScanner(timeout time.Duration, log *logrus.Logger) *NetworkScanner {
	return &NetworkScanner{
		timeout: timeout,
		log:     log,
	}
}

// DiscoverLocalNetwork scannt ALLE lokalen Netzwerke nach Hosts
func (ns *NetworkScanner) DiscoverLocalNetwork(ctx context.Context, progressCallback func(current, total int)) ([]DiscoveryResult, error) {
	results := []DiscoveryResult{}
	mu := &sync.Mutex{}
	
	// Hole ALLE lokalen Netzwerke
	networks, err := getAllLocalNetworks()
	if err != nil {
		return nil, fmt.Errorf("failed to get local networks: %w", err)
	}

	ns.log.WithFields(logrus.Fields{
		"networks_found": len(networks),
		"networks":       networks,
	}).Info("Starting network discovery on ALL networks")

	// Scanne alle IPs in ALLEN Netzwerken (parallel, aber limitiert)
	sem := make(chan struct{}, 50) // Max 50 parallel für schnelleres Scanning
	var wg sync.WaitGroup
	scanned := 0
	total := len(networks) * 254

	for _, network := range networks {
		for i := 1; i < 255; i++ {
			ip := fmt.Sprintf("%s.%d", network, i)
		
			wg.Add(1)
			go func(targetIP string, index int) {
				defer wg.Done()
				sem <- struct{}{}        // Acquire
				defer func() { 
					<-sem // Release
					mu.Lock()
					scanned++
					if progressCallback != nil && scanned%10 == 0 {
						progressCallback(scanned, total)
					}
					mu.Unlock()
				}()

				// Quick Ping-Check (ICMP oder TCP)
				if !ns.isHostAlive(ctx, targetIP) {
					return
				}

				// Host ist erreichbar - scanne Ports
				result := ns.scanHost(ctx, targetIP)
				if len(result.OpenPorts) > 0 {
					mu.Lock()
					results = append(results, result)
					mu.Unlock()

					ns.log.WithFields(logrus.Fields{
						"host":       result.Host,
						"ip":         result.IPAddress,
						"open_ports": result.OpenPorts,
						"services":   result.Services,
					}).Info("Host discovered")
				}
			}(ip, i)
		}
	}

	wg.Wait()
	
	if progressCallback != nil {
		progressCallback(total, total) // 100%
	}
	
	ns.log.WithFields(logrus.Fields{
		"hosts_found": len(results),
		"networks_scanned": len(networks),
	}).Info("Network discovery completed on ALL networks")
	
	return results, nil
}

// isHostAlive prüft schnell ob Host erreichbar ist
func (ns *NetworkScanner) isHostAlive(ctx context.Context, ip string) bool {
	// Versuche TCP-Connect auf gängige Ports (schneller als ICMP)
	quickPorts := []int{80, 443, 22, 3389, 445} // HTTP, HTTPS, SSH, RDP, SMB
	
	for _, port := range quickPorts {
		address := fmt.Sprintf("%s:%d", ip, port)
		conn, err := net.DialTimeout("tcp", address, 500*time.Millisecond)
		if err == nil {
			conn.Close()
			return true
		}
	}
	
	return false
}

// scanHost scannt einen einzelnen Host nach offenen Ports und Services
func (ns *NetworkScanner) scanHost(ctx context.Context, ip string) DiscoveryResult {
	result := DiscoveryResult{
		Host:      ip,
		IPAddress: ip,
		OpenPorts: []int{},
		Services:  []string{},
	}

	// Wichtige Ports für IT-Infrastruktur
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

	startTime := time.Now()
	
	// Scanne Ports parallel
	sem := make(chan struct{}, 5) // Max 5 parallel pro Host
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
				if service != "" {
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

// getAllLocalNetworks findet ALLE privaten Netzwerke (nicht nur eins!)
func getAllLocalNetworks() ([]string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil, err
	}

	networksMap := make(map[string]bool)

	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok || ipNet.IP.IsLoopback() {
			continue
		}

		// IPv4 Adressen
		if ipNet.IP.To4() != nil {
			ip := ipNet.IP.String()
			
			// Prüfe ob private IP
			if isPrivateIP(ipNet.IP) {
				// Ermittle Netzwerk-Prefix (z.B. 192.168.1)
				parts := strings.Split(ip, ".")
				if len(parts) == 4 {
					network := fmt.Sprintf("%s.%s.%s", parts[0], parts[1], parts[2])
					
					// Ignoriere Docker-Netzwerke (bekannte Ranges)
					if !strings.HasPrefix(network, "172.17.") && // Docker default
					   !strings.HasPrefix(network, "172.18.") && // Docker custom
					   !strings.HasPrefix(network, "192.168.65.") { // Docker Desktop
						networksMap[network] = true
					}
				}
			}
		}
	}

	// Konvertiere Map zu Slice
	networks := make([]string, 0, len(networksMap))
	for network := range networksMap {
		networks = append(networks, network)
	}

	if len(networks) == 0 {
		return nil, fmt.Errorf("no valid private networks found (filtered Docker networks)")
	}

	return networks, nil
}

// isPrivateIP prüft ob IP privat ist
func isPrivateIP(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
	}

	for _, cidr := range privateRanges {
		_, subnet, _ := net.ParseCIDR(cidr)
		if subnet.Contains(ip) {
			return true
		}
	}
	
	return false
}

