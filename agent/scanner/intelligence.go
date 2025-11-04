package scanner

import (
	"fmt"
	"net"
	"sort"
	"strings"
	"time"
)

// NetworkInfo enthält CIDR-aware Netzwerk-Informationen
type NetworkInfo struct {
	Network    string   // z.B. "192.168.1"
	CIDR       string   // z.B. "192.168.1.0/24"
	Gateway    string   // z.B. "192.168.1.1" oder "192.168.1.254"
	OwnIP      string   // Eigene IP in diesem Netzwerk
	ScanIPs    []string // Alle zu scannenden IPs (intelligent sortiert)
}

// getLocalNetworksWithCIDR findet lokale Netzwerke mit CIDR-Info
func getLocalNetworksWithCIDR() ([]NetworkInfo, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	networksMap := make(map[string]*NetworkInfo)

	for _, iface := range interfaces {
		// Überspringe Loopback und Down-Interfaces
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

			// Nur private IPs
			if !isPrivateIP(ipNet.IP) {
				continue
			}

			// Netzwerk-Prefix ermitteln
			networkAddr := ipNet.IP.Mask(ipNet.Mask)
			networkStr := fmt.Sprintf("%s/%d", networkAddr.String(), getMaskBits(ipNet.Mask))
			
			// Network-Key (z.B. "192.168.1")
			parts := strings.Split(ipNet.IP.String(), ".")
			if len(parts) != 4 {
				continue
			}
			networkKey := fmt.Sprintf("%s.%s.%s", parts[0], parts[1], parts[2])

			// Ignoriere Docker-Bridge-Netzwerke
			if strings.HasPrefix(networkKey, "172.17.") || strings.HasPrefix(networkKey, "172.18.") {
				continue
			}

			if _, exists := networksMap[networkKey]; !exists {
				networksMap[networkKey] = &NetworkInfo{
					Network: networkKey,
					CIDR:    networkStr,
					OwnIP:   ipNet.IP.String(),
				}
			}
		}
	}

	// Konvertiere Map zu Slice und berechne Scan-IPs
	networks := make([]NetworkInfo, 0, len(networksMap))
	for _, netInfo := range networksMap {
		// Gateway detectieren
		netInfo.Gateway = detectGateway(netInfo.Network)
		
		// Scan-IPs mit Hacker-Priorisierung generieren
		netInfo.ScanIPs = generatePrioritizedIPs(netInfo)
		
		networks = append(networks, *netInfo)
	}

	if len(networks) == 0 {
		return nil, fmt.Errorf("no valid private networks found")
	}

	return networks, nil
}

// detectGateway versucht Gateway zu finden (meist .1 oder .254)
func detectGateway(networkPrefix string) string {
	// Versuche übliche Gateway-IPs
	possibleGateways := []string{
		fmt.Sprintf("%s.1", networkPrefix),
		fmt.Sprintf("%s.254", networkPrefix),
	}
	
	// Quick-Check auf Port 80 oder 443
	for _, gateway := range possibleGateways {
		for _, port := range []int{80, 443} {
			address := fmt.Sprintf("%s:%d", gateway, port)
			conn, err := net.DialTimeout("tcp", address, 200*time.Millisecond)
			if err == nil {
				conn.Close()
				return gateway
			}
		}
	}
	
	// Default: .1
	return fmt.Sprintf("%s.1", networkPrefix)
}

// generatePrioritizedIPs generiert IP-Liste mit Hacker-Prioritäten
func generatePrioritizedIPs(netInfo *NetworkInfo) []string {
	type ipWithPriority struct {
		ip       string
		priority ScanPriority
	}
	
	ips := []ipWithPriority{}
	
	for i := 1; i < 255; i++ {
		ip := fmt.Sprintf("%s.%d", netInfo.Network, i)
		
		// Eigene IP überspringen
		if ip == netInfo.OwnIP {
			continue
		}
		
		// Priorisierung nach Hacker-Strategie
		priority := PriorityLow // Default
		
		if ip == netInfo.Gateway {
			priority = PriorityHigh // Gateway ist wichtig!
		} else if i == 1 || i == 254 {
			priority = PriorityHigh // Übliche Gateways
		} else if i == 10 || i == 20 || i == 100 || i == 200 || i == 250 {
			priority = PriorityMedium // Häufige Server-IPs
		} else if i >= 2 && i <= 50 {
			priority = PriorityMedium // Frühe IPs oft Server
		}
		
		ips = append(ips, ipWithPriority{ip: ip, priority: priority})
	}
	
	// Sortiere nach Priorität (High → Medium → Low)
	sort.Slice(ips, func(i, j int) bool {
		return ips[i].priority < ips[j].priority
	})
	
	// Extrahiere nur IPs
	result := make([]string, len(ips))
	for i, item := range ips {
		result[i] = item.ip
	}
	
	return result
}

// getAdaptivePortList gibt Port-Liste basierend auf erkannten Services zurück
func getAdaptivePortList(initialPorts []int, services []string) []int {
	adaptivePorts := make(map[int]bool)
	
	// Basis-Ports hinzufügen
	for _, port := range initialPorts {
		adaptivePorts[port] = true
	}
	
	// Service-basierte Expansion (Hacker-Logik!)
	for _, service := range services {
		switch service {
		case "HTTP", "HTTPS":
			// Web-Server erkannt → teste alternative Web-Ports
			adaptivePorts[8080] = true
			adaptivePorts[8443] = true
			adaptivePorts[8000] = true
			adaptivePorts[3000] = true
			
		case "SSH":
			// Linux-Server erkannt → teste Linux-Services
			adaptivePorts[3306] = true  // MySQL
			adaptivePorts[5432] = true  // PostgreSQL
			adaptivePorts[6379] = true  // Redis
			adaptivePorts[27017] = true // MongoDB
			adaptivePorts[9200] = true  // Elasticsearch
			
		case "RDP", "SMB/CIFS":
			// Windows-Server erkannt → teste Windows-Services
			adaptivePorts[135] = true  // RPC
			adaptivePorts[139] = true  // NetBIOS
			adaptivePorts[5985] = true // WinRM HTTP
			adaptivePorts[5986] = true // WinRM HTTPS
			adaptivePorts[1433] = true // MSSQL
			
		case "LDAP", "LDAPS":
			// Directory Service → teste AD-Ports
			adaptivePorts[88] = true   // Kerberos
			adaptivePorts[464] = true  // Kerberos Change/Set
			adaptivePorts[3268] = true // Global Catalog
			
		case "SMTP", "SMTPS", "IMAP", "IMAPS", "POP3", "POP3S":
			// Mail-Server → teste Mail-Ports
			adaptivePorts[25] = true   // SMTP
			adaptivePorts[465] = true  // SMTPS
			adaptivePorts[587] = true  // SMTP Submission
			adaptivePorts[993] = true  // IMAPS
			adaptivePorts[995] = true  // POP3S
		}
	}
	
	// Konvertiere Map zu Slice
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
	
	// Heuristik für OS-Erkennung
	if hasRDP || (hasSMB && !hasSSH) {
		return "windows"
	} else if hasSSH {
		return "linux"
	} else if hasHTTP && len(ports) < 5 {
		return "network-device" // Router/Switch
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

