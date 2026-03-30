package scanner

import (
	"bufio"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"sort"
	"strings"
	"time"
)

// NetworkInfo enthält CIDR-aware Netzwerk-Informationen
type NetworkInfo struct {
	Network        string   // z.B. "192.168.1"
	CIDR           string   // z.B. "192.168.1.0/24"
	Gateway        string   // z.B. "192.168.1.1" (detected or from routing table)
	SystemGateways []string // All gateways found via routing table
	OwnIP          string   // Eigene IP in diesem Netzwerk
	MaskBits       int      // CIDR mask bits (e.g. 24 for /24)
	ScanIPs        []string // Alle zu scannenden IPs (intelligent sortiert)
}

// maxScanIPs caps the number of IPs we scan per subnet to avoid
// spending hours on a /16 network.
const maxScanIPs = 1024

// getLocalNetworksWithCIDR findet lokale Netzwerke mit CIDR-Info
func getLocalNetworksWithCIDR() ([]NetworkInfo, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	// Read system routing table for accurate gateway detection
	systemGateways := readSystemGateways()

	networksMap := make(map[string]*NetworkInfo)

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.To4() == nil {
				continue
			}

			if !isPrivateIP(ipNet.IP) {
				continue
			}

			networkAddr := ipNet.IP.Mask(ipNet.Mask)
			maskBits, _ := ipNet.Mask.Size()
			networkStr := fmt.Sprintf("%s/%d", networkAddr.String(), maskBits)

			// Skip Docker/container bridge networks
			parts := strings.Split(ipNet.IP.String(), ".")
			if len(parts) != 4 {
				continue
			}
			networkKey := fmt.Sprintf("%s.%s.%s", parts[0], parts[1], parts[2])
			if isContainerNetwork(networkKey, iface.Name) {
				continue
			}

			if _, exists := networksMap[networkStr]; !exists {
				networksMap[networkStr] = &NetworkInfo{
					Network:  networkKey,
					CIDR:     networkStr,
					OwnIP:    ipNet.IP.String(),
					MaskBits: maskBits,
				}
			}
		}
	}

	networks := make([]NetworkInfo, 0, len(networksMap))
	for _, netInfo := range networksMap {
		// Match system gateways to this network
		netInfo.SystemGateways = findGatewaysForNetwork(systemGateways, netInfo.CIDR)

		// Set primary gateway
		if len(netInfo.SystemGateways) > 0 {
			netInfo.Gateway = netInfo.SystemGateways[0]
		} else {
			netInfo.Gateway = detectGateway(netInfo.Network)
		}

		// Generate scan IPs respecting actual CIDR mask
		netInfo.ScanIPs = generateCIDRAwareIPs(netInfo)

		networks = append(networks, *netInfo)
	}

	if len(networks) == 0 {
		return nil, fmt.Errorf("no valid private networks found")
	}

	return networks, nil
}

// isContainerNetwork checks if a network prefix belongs to Docker/container bridges.
func isContainerNetwork(networkKey string, ifaceName string) bool {
	// Docker default bridges
	if strings.HasPrefix(networkKey, "172.17.") || strings.HasPrefix(networkKey, "172.18.") ||
		strings.HasPrefix(networkKey, "172.19.") || strings.HasPrefix(networkKey, "172.20.") {
		return true
	}
	// Common container interface names
	if strings.HasPrefix(ifaceName, "docker") || strings.HasPrefix(ifaceName, "br-") ||
		strings.HasPrefix(ifaceName, "veth") || strings.HasPrefix(ifaceName, "cni") ||
		strings.HasPrefix(ifaceName, "flannel") || strings.HasPrefix(ifaceName, "calico") {
		return true
	}
	return false
}

// readSystemGateways reads the default gateways from /proc/net/route (Linux).
// Returns a list of gateway IPs. Falls back gracefully on non-Linux systems.
func readSystemGateways() []string {
	gateways := []string{}

	f, err := os.Open("/proc/net/route")
	if err != nil {
		return gateways
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Scan() // Skip header line

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}

		// Column 1 = Destination, Column 2 = Gateway
		dest := fields[1]
		gw := fields[2]

		// We want all routes with a non-zero gateway
		if gw == "00000000" {
			continue
		}

		gwIP := parseHexIP(gw)
		if gwIP == "" {
			continue
		}

		// Default route (destination 00000000) gets highest priority
		if dest == "00000000" {
			gateways = append([]string{gwIP}, gateways...)
		} else {
			gateways = append(gateways, gwIP)
		}
	}

	// Deduplicate
	seen := make(map[string]bool)
	unique := make([]string, 0, len(gateways))
	for _, gw := range gateways {
		if !seen[gw] {
			seen[gw] = true
			unique = append(unique, gw)
		}
	}

	return unique
}

// parseHexIP converts a little-endian hex IP from /proc/net/route to dotted-decimal.
func parseHexIP(hexStr string) string {
	if len(hexStr) != 8 {
		return ""
	}
	b, err := hex.DecodeString(hexStr)
	if err != nil || len(b) != 4 {
		return ""
	}
	// /proc/net/route stores IPs as host-order uint32 printed in hex.
	// LittleEndian.Uint32 recovers the integer; extract octets MSB-first.
	ip := binary.LittleEndian.Uint32(b)
	return fmt.Sprintf("%d.%d.%d.%d", byte(ip>>24), byte(ip>>16), byte(ip>>8), byte(ip))
}

// findGatewaysForNetwork returns gateways that belong to the given CIDR.
func findGatewaysForNetwork(gateways []string, cidr string) []string {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil
	}

	matched := make([]string, 0, 2)
	for _, gw := range gateways {
		gwIP := net.ParseIP(gw)
		if gwIP != nil && ipNet.Contains(gwIP) {
			matched = append(matched, gw)
		}
	}
	return matched
}

// detectGateway versucht Gateway zu finden (Fallback wenn /proc/net/route nicht verfügbar)
func detectGateway(networkPrefix string) string {
	possibleGateways := []string{
		fmt.Sprintf("%s.1", networkPrefix),
		fmt.Sprintf("%s.254", networkPrefix),
	}

	for _, gateway := range possibleGateways {
		for _, port := range []int{80, 443, 53, 8080, 161} {
			address := fmt.Sprintf("%s:%d", gateway, port)
			conn, err := net.DialTimeout("tcp", address, 200*time.Millisecond)
			if err == nil {
				conn.Close()
				return gateway
			}
		}
	}

	return fmt.Sprintf("%s.1", networkPrefix)
}

// generateCIDRAwareIPs generates IPs for the actual CIDR range, not just /24.
// For large subnets (/16, /20, etc.) it caps at maxScanIPs and prioritizes
// likely server/gateway addresses.
func generateCIDRAwareIPs(netInfo *NetworkInfo) []string {
	_, ipNet, err := net.ParseCIDR(netInfo.CIDR)
	if err != nil {
		// Fallback to /24 behavior
		return generateFallbackIPs(netInfo)
	}

	// Calculate total hosts in this subnet
	maskBits, totalBits := ipNet.Mask.Size()
	hostBits := totalBits - maskBits
	if hostBits <= 0 || hostBits > 24 {
		// /32 or unreasonably large (>16M hosts) - fallback
		return generateFallbackIPs(netInfo)
	}
	totalHosts := (1 << hostBits) - 2 // Exclude network + broadcast

	type ipWithPriority struct {
		ip       string
		priority ScanPriority
	}

	allIPs := make([]ipWithPriority, 0, min(totalHosts, maxScanIPs))

	// Iterate through all IPs in the CIDR range
	ip := make(net.IP, 4)
	copy(ip, ipNet.IP.To4())

	for i := 1; i <= totalHosts && i <= maxScanIPs*2; i++ {
		// Increment IP
		incIP(ip)

		currentIP := ip.String()

		// Skip own IP
		if currentIP == netInfo.OwnIP {
			continue
		}

		// Skip broadcast
		if !ipNet.Contains(ip) {
			break
		}

		priority := prioritizeIP(currentIP, netInfo, i)
		allIPs = append(allIPs, ipWithPriority{ip: currentIP, priority: priority})
	}

	// Sort by priority
	sort.Slice(allIPs, func(i, j int) bool {
		return allIPs[i].priority < allIPs[j].priority
	})

	// Cap at maxScanIPs
	if len(allIPs) > maxScanIPs {
		allIPs = allIPs[:maxScanIPs]
	}

	result := make([]string, len(allIPs))
	for i, item := range allIPs {
		result[i] = item.ip
	}

	return result
}

// incIP increments an IPv4 address by 1.
func incIP(ip net.IP) {
	for j := len(ip) - 1; j >= 0; j-- {
		ip[j]++
		if ip[j] != 0 {
			break
		}
	}
}

// prioritizeIP assigns a scan priority based on the IP's position and gateway info.
func prioritizeIP(ip string, netInfo *NetworkInfo, offset int) ScanPriority {
	// Known gateways get highest priority
	if ip == netInfo.Gateway {
		return PriorityHigh
	}
	for _, gw := range netInfo.SystemGateways {
		if ip == gw {
			return PriorityHigh
		}
	}

	// Parse last octet for heuristics
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return PriorityLow
	}

	// Common gateway/server positions
	lastOctet := parts[3]
	switch lastOctet {
	case "1", "254":
		return PriorityHigh
	case "2", "3", "10", "20", "50", "100", "200", "250":
		return PriorityMedium
	}

	// First 50 IPs in a subnet are often servers (DHCP range usually starts higher)
	if offset <= 50 {
		return PriorityMedium
	}

	return PriorityLow
}

// generateFallbackIPs generates IPs for a /24 network (fallback).
func generateFallbackIPs(netInfo *NetworkInfo) []string {
	type ipWithPriority struct {
		ip       string
		priority ScanPriority
	}

	ips := make([]ipWithPriority, 0, 254)

	for i := 1; i < 255; i++ {
		ip := fmt.Sprintf("%s.%d", netInfo.Network, i)

		if ip == netInfo.OwnIP {
			continue
		}

		priority := PriorityLow
		if ip == netInfo.Gateway {
			priority = PriorityHigh
		} else if i == 1 || i == 254 {
			priority = PriorityHigh
		} else if i <= 50 {
			priority = PriorityMedium
		}

		ips = append(ips, ipWithPriority{ip: ip, priority: priority})
	}

	sort.Slice(ips, func(i, j int) bool {
		return ips[i].priority < ips[j].priority
	})

	result := make([]string, len(ips))
	for i, item := range ips {
		result[i] = item.ip
	}

	return result
}

// getAdaptivePortList gibt Port-Liste basierend auf erkannten Services zurück
func getAdaptivePortList(initialPorts []int, services []string) []int {
	adaptivePorts := make(map[int]bool, len(initialPorts)+20)

	for _, port := range initialPorts {
		adaptivePorts[port] = true
	}

	for _, service := range services {
		switch service {
		case "HTTP", "HTTPS", "HTTP-Proxy", "HTTPS-Alt":
			// Web server - check alternative web ports
			for _, p := range []int{80, 443, 3000, 4443, 7443, 8000, 8080, 8081, 8443, 8888, 9090, 9443, 10000} {
				adaptivePorts[p] = true
			}
		case "SSH":
			// Linux server - check common Linux services
			for _, p := range []int{3306, 5432, 6379, 9200, 27017, 2049, 5000, 6443, 8006, 9090, 9100} {
				adaptivePorts[p] = true
			}
		case "RDP", "SMB/CIFS", "MSRPC", "NetBIOS":
			// Windows server
			for _, p := range []int{135, 139, 445, 1433, 3389, 5985, 5986} {
				adaptivePorts[p] = true
			}
		case "LDAP", "LDAPS", "Kerberos":
			// Active Directory
			for _, p := range []int{88, 389, 464, 636, 3268} {
				adaptivePorts[p] = true
			}
		case "SMTP", "SMTPS", "IMAP", "IMAPS", "POP3", "POP3S", "SMTP-Submission":
			// Mail server
			for _, p := range []int{25, 110, 143, 465, 587, 993, 995} {
				adaptivePorts[p] = true
			}
		case "DNS":
			// DNS server - might be a router or resolver
			for _, p := range []int{53, 80, 161, 443, 500, 8080, 8443, 1900} {
				adaptivePorts[p] = true
			}
		case "SNMP":
			// Managed network device
			for _, p := range []int{22, 23, 53, 80, 161, 179, 443, 500, 8080, 8443} {
				adaptivePorts[p] = true
			}
		case "UPnP/SSDP":
			// Likely a router or media device
			for _, p := range []int{53, 80, 443, 161, 500, 8080} {
				adaptivePorts[p] = true
			}
		case "LPD-Print", "IPP-Print", "RAW-Print":
			// Printer
			for _, p := range []int{80, 443, 515, 631, 9100} {
				adaptivePorts[p] = true
			}
		case "MQTT", "MQTT-TLS":
			// IoT device
			for _, p := range []int{80, 443, 1883, 8080, 8883} {
				adaptivePorts[p] = true
			}
		case "IKE/VPN", "OpenVPN", "PPTP-VPN":
			// VPN gateway - likely a firewall/router
			for _, p := range []int{53, 80, 443, 500, 1194, 1723, 4443, 8080, 8443} {
				adaptivePorts[p] = true
			}
		case "Proxmox":
			for _, p := range []int{22, 80, 443, 3128, 8006} {
				adaptivePorts[p] = true
			}
		}
	}

	result := make([]int, 0, len(adaptivePorts))
	for port := range adaptivePorts {
		result = append(result, port)
	}

	return result
}

// detectOSType versucht OS-Typ zu erraten basierend auf Ports/Services
func detectOSType(ports []int, services []string) string {
	hasSSH := false
	hasRDP := false
	hasSMB := false
	hasHTTP := false

	for _, service := range services {
		switch service {
		case "SSH":
			hasSSH = true
		case "RDP":
			hasRDP = true
		case "SMB/CIFS":
			hasSMB = true
		case "HTTP", "HTTPS":
			hasHTTP = true
		}
	}

	if hasRDP || (hasSMB && !hasSSH) {
		return "windows"
	} else if hasSSH {
		return "linux"
	} else if hasHTTP && len(ports) < 5 {
		return "network-device"
	}

	return "unknown"
}

// getMaskBits berechnet CIDR-Bits aus Maske
func getMaskBits(mask net.IPMask) int {
	ones, _ := mask.Size()
	return ones
}

// isPrivateIP prüft ob IP privat ist
func isPrivateIP(ip net.IP) bool {
	for _, cidr := range privateNetworks {
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

// privateNetworks is parsed once at package init time.
var privateNetworks []*net.IPNet

func init() {
	for _, cidr := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"} {
		_, n, _ := net.ParseCIDR(cidr)
		privateNetworks = append(privateNetworks, n)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
