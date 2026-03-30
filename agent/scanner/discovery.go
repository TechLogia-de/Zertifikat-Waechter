package scanner

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

type DiscoveryResult struct {
	Host         string   `json:"host"`
	IPAddress    string   `json:"ip_address"`
	Hostname     string   `json:"hostname,omitempty"`
	OpenPorts    []int    `json:"open_ports"`
	Services     []string `json:"services"`
	DeviceType   string   `json:"device_type,omitempty"`
	OSType       string   `json:"os_type,omitempty"`
	IsGateway    bool     `json:"is_gateway,omitempty"`
	BannerInfo   string   `json:"banner_info,omitempty"`
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

// serviceMap maps well-known ports to service names (package-level, allocated once).
var serviceMap = map[int]string{
	21:    "FTP",
	22:    "SSH",
	23:    "Telnet",
	25:    "SMTP",
	53:    "DNS",
	80:    "HTTP",
	88:    "Kerberos",
	110:   "POP3",
	111:   "RPCBind",
	135:   "MSRPC",
	139:   "NetBIOS",
	143:   "IMAP",
	161:   "SNMP",
	179:   "BGP",
	389:   "LDAP",
	443:   "HTTPS",
	445:   "SMB/CIFS",
	465:   "SMTPS",
	500:   "IKE/VPN",
	515:   "LPD-Print",
	587:   "SMTP-Submission",
	631:   "IPP-Print",
	636:   "LDAPS",
	993:   "IMAPS",
	995:   "POP3S",
	1194:  "OpenVPN",
	1433:  "MSSQL",
	1723:  "PPTP-VPN",
	1883:  "MQTT",
	1900:  "UPnP/SSDP",
	2049:  "NFS",
	3000:  "Grafana/Dev",
	3268:  "LDAP-GC",
	3306:  "MySQL",
	3389:  "RDP",
	4443:  "HTTPS-Alt",
	5000:  "Docker-Registry",
	5060:  "SIP",
	5432:  "PostgreSQL",
	5900:  "VNC",
	5985:  "WinRM-HTTP",
	5986:  "WinRM-HTTPS",
	6379:  "Redis",
	6443:  "K8s-API",
	7443:  "HTTPS-Alt",
	8006:  "Proxmox",
	8080:  "HTTP-Proxy",
	8081:  "HTTP-Alt",
	8443:  "HTTPS-Alt",
	8883:  "MQTT-TLS",
	9090:  "Prometheus",
	9100:  "RAW-Print",
	9200:  "Elasticsearch",
	9443:  "HTTPS-Alt",
	10000: "Webmin",
	27017: "MongoDB",
}

// TLS-capable ports for certificate scanning
var tlsPortSet = map[int]bool{
	443: true, 4443: true, 636: true, 993: true, 995: true, 465: true,
	5986: true, 6443: true, 7443: true, 8443: true, 8883: true, 9443: true,
}

// Ports that indicate a router/firewall/network device
var routerPorts = map[int]bool{
	53: true, 80: true, 161: true, 179: true, 443: true, 500: true,
	1723: true, 1194: true, 1900: true, 8080: true, 8443: true,
}

// Ports that indicate a printer
var printerPorts = map[int]bool{
	515: true, 631: true, 9100: true,
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
	}).Info("Starting intelligent network discovery")

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
	}).Info("Scan strategy: Gateway > Server IPs > Rest")

	for _, netInfo := range networkInfos {
		ns.log.WithFields(logrus.Fields{
			"network": netInfo.Network,
			"cidr":    netInfo.CIDR,
			"gateway": netInfo.Gateway,
			"own_ip":  netInfo.OwnIP,
		}).Info("Scanning network")

		// PHASE 1: Quick Scan aller IPs (priorisiert)
		quickResults := make(map[string]*DiscoveryResult)
		quickMu := &sync.Mutex{}

		for _, ip := range netInfo.ScanIPs {
			wg.Add(1)
			go func(ctx context.Context, targetIP string) {
				defer wg.Done()

				// Check context before acquiring semaphore
				select {
				case <-ctx.Done():
					return
				case sem <- struct{}{}:
				}
				defer func() {
					<-sem
					mu.Lock()
					scanned++
					if progressCallback != nil && scanned%5 == 0 {
						progressCallback(scanned, total)
					}
					mu.Unlock()
				}()

				if !ns.isHostAlive(ctx, targetIP) {
					return
				}

				result := ns.scanHost(ctx, targetIP)
				if len(result.OpenPorts) > 0 {
					quickMu.Lock()
					quickResults[targetIP] = &result
					quickMu.Unlock()

					ns.log.WithFields(logrus.Fields{
						"ip":         result.IPAddress,
						"open_ports": len(result.OpenPorts),
						"services":   result.Services,
					}).Info("Host discovered")
				}
			}(ctx, ip)
		}

		wg.Wait()

		// Build gateway IP set for this network
		gatewayIPs := make(map[string]bool)
		if netInfo.Gateway != "" {
			gatewayIPs[netInfo.Gateway] = true
		}
		// Also check system-detected gateways
		for _, gw := range netInfo.SystemGateways {
			gatewayIPs[gw] = true
		}

		// PHASE 2: Deep Scan + Classification
		ns.log.WithField("hosts_found", len(quickResults)).Info("Starting deep scan and device classification")

		for ip, quickResult := range quickResults {
			osType := detectOSType(quickResult.OpenPorts, quickResult.Services)
			isServer := len(quickResult.OpenPorts) >= 3

			if isServer || osType != "unknown" {
				ns.log.WithFields(logrus.Fields{
					"ip":        ip,
					"os_type":   osType,
					"is_server": isServer,
				}).Info("Interesting host, running deep scan")

				adaptivePorts := getAdaptivePortList(quickResult.OpenPorts, quickResult.Services)
				deepResult := ns.scanHostWithPorts(ctx, ip, adaptivePorts)

				if len(deepResult.OpenPorts) > len(quickResult.OpenPorts) {
					ns.log.WithFields(logrus.Fields{
						"ip":        ip,
						"new_ports": len(deepResult.OpenPorts) - len(quickResult.OpenPorts),
						"total":     len(deepResult.OpenPorts),
					}).Info("Deep scan found additional ports")

					*quickResult = deepResult
				}
			}

			// Reverse DNS lookup
			quickResult.Hostname = resolveHostname(ip)

			// HTTP banner grabbing on web ports
			for _, port := range quickResult.OpenPorts {
				if port == 80 || port == 443 || port == 8080 || port == 8443 || port == 4443 || port == 8006 || port == 10000 {
					if banner := grabHTTPBanner(ip, port); banner != "" {
						quickResult.BannerInfo = banner
						break
					}
				}
			}

			// Classify the device
			classifyDevice(quickResult, gatewayIPs)

			ns.log.WithFields(logrus.Fields{
				"ip":          ip,
				"hostname":    quickResult.Hostname,
				"device_type": quickResult.DeviceType,
				"os_type":     quickResult.OSType,
				"is_gateway":  quickResult.IsGateway,
				"banner":      quickResult.BannerInfo,
				"ports":       len(quickResult.OpenPorts),
			}).Info("Device classified")

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
	}).Info("Network discovery completed")
	
	return results, nil
}

// isHostAlive prüft schnell ob Host erreichbar ist (parallel auf mehreren Ports)
func (ns *NetworkScanner) isHostAlive(ctx context.Context, ip string) bool {
	// Parallel probe on common ports - returns as soon as ANY port responds
	quickPorts := []int{80, 443, 22, 53, 3389, 445, 8080, 8443, 161, 21, 23, 25, 631, 9100}

	found := make(chan struct{}, 1)
	done := make(chan struct{})

	var wg sync.WaitGroup
	for _, port := range quickPorts {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			address := fmt.Sprintf("%s:%d", ip, p)
			conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
			if err == nil {
				conn.Close()
				select {
				case found <- struct{}{}:
				default:
				}
			}
		}(port)
	}

	// Close done channel when all goroutines finish
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-found:
		return true
	case <-done:
		return false
	case <-ctx.Done():
		return false
	}
}

// scanHost scannt einen einzelnen Host nach offenen Ports und Services
func (ns *NetworkScanner) scanHost(ctx context.Context, ip string) DiscoveryResult {
	portsToScan := []int{
		21,    // FTP
		22,    // SSH
		23,    // Telnet
		25,    // SMTP
		53,    // DNS
		80,    // HTTP
		88,    // Kerberos
		110,   // POP3
		111,   // RPCBind
		135,   // MSRPC
		139,   // NetBIOS
		143,   // IMAP
		161,   // SNMP
		179,   // BGP
		389,   // LDAP
		443,   // HTTPS
		445,   // SMB
		465,   // SMTPS
		500,   // IKE/VPN
		515,   // LPD Print
		587,   // SMTP Submission
		631,   // IPP Print
		636,   // LDAPS
		993,   // IMAPS
		995,   // POP3S
		1194,  // OpenVPN
		1433,  // MSSQL
		1723,  // PPTP
		1883,  // MQTT
		1900,  // UPnP
		2049,  // NFS
		3306,  // MySQL
		3389,  // RDP
		4443,  // HTTPS-Alt
		5000,  // Docker Registry
		5060,  // SIP
		5432,  // PostgreSQL
		5900,  // VNC
		5985,  // WinRM
		5986,  // WinRM-HTTPS
		6379,  // Redis
		6443,  // K8s API
		8006,  // Proxmox
		8080,  // HTTP-Alt
		8443,  // HTTPS-Alt
		8883,  // MQTT-TLS
		9090,  // Prometheus
		9100,  // RAW Print
		9200,  // Elasticsearch
		9443,  // HTTPS-Alt
		10000, // Webmin
		27017, // MongoDB
	}

	return ns.scanHostWithPorts(ctx, ip, portsToScan)
}

// scanHostWithPorts scannt mit custom Port-Liste (für adaptive Scans)
func (ns *NetworkScanner) scanHostWithPorts(ctx context.Context, ip string, portsToScan []int) DiscoveryResult {
	result := DiscoveryResult{
		Host:      ip,
		IPAddress: ip,
		OpenPorts: make([]int, 0, len(portsToScan)/4),
		Services:  make([]string, 0, 8),
	}

	startTime := time.Now()

	sem := make(chan struct{}, 10)
	var mu sync.Mutex
	var wg sync.WaitGroup
	seenServices := make(map[string]bool)

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
				if service != "" && !seenServices[service] {
					seenServices[service] = true
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
	if closeErr := conn.Close(); closeErr != nil {
		ns.log.WithError(closeErr).WithField("address", address).Debug("Failed to close connection during port check")
	}
	return true
}

// identifyService identifiziert Service anhand Port
func identifyService(port int) string {
	if service, ok := serviceMap[port]; ok {
		return service
	}
	return fmt.Sprintf("TCP/%d", port)
}

// IsTLSPort returns true if the port typically carries TLS traffic.
func IsTLSPort(port int) bool {
	return tlsPortSet[port]
}

// resolveHostname performs reverse DNS lookup for an IP address.
func resolveHostname(ip string) string {
	names, err := net.LookupAddr(ip)
	if err != nil || len(names) == 0 {
		return ""
	}
	// Remove trailing dot from FQDN
	hostname := strings.TrimSuffix(names[0], ".")
	return hostname
}

// grabHTTPBanner tries to read the Server header from an HTTP(S) response.
// This helps identify routers (e.g. "MikroTik", "DD-WRT"), NAS devices
// (e.g. "Synology"), printers, and other network equipment.
func grabHTTPBanner(ip string, port int) string {
	scheme := "http"
	if tlsPortSet[port] || port == 443 || port == 8443 || port == 4443 {
		scheme = "https"
	}

	client := &http.Client{
		Timeout: 2 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		// Don't follow redirects - we just want the initial response header
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	url := fmt.Sprintf("%s://%s:%d/", scheme, ip, port)
	resp, err := client.Get(url)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	// Collect useful header info
	parts := make([]string, 0, 3)
	if server := resp.Header.Get("Server"); server != "" {
		parts = append(parts, server)
	}
	if powered := resp.Header.Get("X-Powered-By"); powered != "" {
		parts = append(parts, powered)
	}
	if realm := resp.Header.Get("WWW-Authenticate"); realm != "" {
		// Many routers return a realm like "MikroTik" or "NETGEAR"
		parts = append(parts, realm)
	}

	return strings.Join(parts, " | ")
}

// classifyDevice determines the device type based on open ports, services,
// hostname, and HTTP banner information.
func classifyDevice(result *DiscoveryResult, gatewayIPs map[string]bool) {
	portSet := make(map[int]bool, len(result.OpenPorts))
	for _, p := range result.OpenPorts {
		portSet[p] = true
	}

	serviceSet := make(map[string]bool, len(result.Services))
	for _, s := range result.Services {
		serviceSet[s] = true
	}

	banner := strings.ToLower(result.BannerInfo)
	hostname := strings.ToLower(result.Hostname)

	// 1. Check if this is a known gateway
	if gatewayIPs[result.IPAddress] {
		result.IsGateway = true
		result.DeviceType = "router"
	}

	// 2. Banner-based detection (most reliable)
	if banner != "" {
		switch {
		case containsAny(banner, "mikrotik", "routeros"):
			result.DeviceType = "router"
			result.OSType = "routeros"
		case containsAny(banner, "ubiquiti", "unifi", "edgeos", "ubnt"):
			result.DeviceType = "router"
			result.OSType = "ubiquiti"
		case containsAny(banner, "openwrt", "dd-wrt", "tomato", "lede"):
			result.DeviceType = "router"
			result.OSType = "openwrt"
		case containsAny(banner, "netgear", "tp-link", "tplink", "linksys", "dlink", "d-link", "asus rt-", "fritz"):
			result.DeviceType = "router"
		case containsAny(banner, "pfsense", "opnsense", "fortinet", "fortigate", "sophos", "watchguard", "paloalto", "sonicwall"):
			result.DeviceType = "firewall"
		case containsAny(banner, "synology", "qnap", "truenas", "freenas", "unraid", "drobo", "readynas"):
			result.DeviceType = "nas"
		case containsAny(banner, "proxmox"):
			result.DeviceType = "hypervisor"
			result.OSType = "proxmox"
		case containsAny(banner, "hp-", "epson", "canon", "brother", "xerox", "ricoh", "kyocera", "lexmark", "konica", "cups"):
			result.DeviceType = "printer"
		case containsAny(banner, "esxi", "vmware", "vcenter"):
			result.DeviceType = "hypervisor"
			result.OSType = "vmware"
		case containsAny(banner, "idrac", "ilo", "ipmi", "bmc"):
			result.DeviceType = "management-controller"
		}
	}

	// 3. Hostname-based detection
	if result.DeviceType == "" && hostname != "" {
		switch {
		case containsAny(hostname, "router", "gateway", "gw", "fw", "firewall"):
			result.DeviceType = "router"
		case containsAny(hostname, "switch", "sw-"):
			result.DeviceType = "switch"
		case containsAny(hostname, "printer", "print", "prn"):
			result.DeviceType = "printer"
		case containsAny(hostname, "nas", "storage", "backup"):
			result.DeviceType = "nas"
		case containsAny(hostname, "srv", "server", "dc", "mail", "web", "db"):
			result.DeviceType = "server"
		case containsAny(hostname, "ap-", "wlan", "wifi", "accesspoint"):
			result.DeviceType = "access-point"
		case containsAny(hostname, "cam", "ipcam", "nvr", "dvr"):
			result.DeviceType = "camera"
		}
	}

	// 4. Port-based heuristics (fallback)
	if result.DeviceType == "" {
		printerScore := 0
		for p := range printerPorts {
			if portSet[p] {
				printerScore++
			}
		}
		if printerScore >= 2 || (printerScore == 1 && portSet[9100]) {
			result.DeviceType = "printer"
		}
	}

	if result.DeviceType == "" {
		routerScore := 0
		for p := range routerPorts {
			if portSet[p] {
				routerScore++
			}
		}
		hasSSH := portSet[22]
		hasRDP := portSet[3389]
		hasSMB := portSet[445]
		hasDNS := portSet[53]
		hasSNMP := portSet[161]
		hasBGP := portSet[179]
		hasVPN := portSet[500] || portSet[1194] || portSet[1723]
		hasHTTP := portSet[80] || portSet[443] || portSet[8080] || portSet[8443]

		switch {
		case hasBGP || (hasDNS && hasVPN):
			result.DeviceType = "router"
		case hasSNMP && hasHTTP && !hasSSH && !hasRDP && len(result.OpenPorts) <= 6:
			result.DeviceType = "router"
		case result.IsGateway && hasHTTP:
			result.DeviceType = "router"
		case hasDNS && hasHTTP && !hasSSH && !hasSMB && len(result.OpenPorts) <= 5:
			result.DeviceType = "router"
		case hasRDP || (hasSMB && !hasSSH):
			result.DeviceType = "server"
			result.OSType = "windows"
		case hasSSH && (portSet[3306] || portSet[5432] || portSet[6379] || portSet[9200] || portSet[27017]):
			result.DeviceType = "server"
			result.OSType = "linux"
		case hasSSH && len(result.OpenPorts) >= 3:
			result.DeviceType = "server"
			result.OSType = "linux"
		case portSet[8006]:
			result.DeviceType = "hypervisor"
			result.OSType = "proxmox"
		case portSet[6443]:
			result.DeviceType = "server"
			result.OSType = "kubernetes"
		case hasHTTP && len(result.OpenPorts) <= 3 && !hasSSH && !hasRDP:
			result.DeviceType = "network-device"
		case portSet[5060]:
			result.DeviceType = "voip-device"
		default:
			if routerScore >= 3 {
				result.DeviceType = "network-device"
			}
		}
	}

	// 5. OS-type if not set yet
	if result.OSType == "" {
		result.OSType = detectOSType(result.OpenPorts, result.Services)
	}

	// 6. Default
	if result.DeviceType == "" {
		if len(result.OpenPorts) >= 3 {
			result.DeviceType = "server"
		} else {
			result.DeviceType = "unknown"
		}
	}
}

// containsAny checks if s contains any of the substrings.
func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

