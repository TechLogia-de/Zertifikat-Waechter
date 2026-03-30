package scanner

import (
	"net"
	"testing"
)

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{"10.0.0.0/8 range start", "10.0.0.1", true},
		{"10.0.0.0/8 range middle", "10.100.50.25", true},
		{"10.0.0.0/8 range end", "10.255.255.254", true},
		{"172.16.0.0/12 range start", "172.16.0.1", true},
		{"172.16.0.0/12 range middle", "172.20.5.100", true},
		{"172.16.0.0/12 range end", "172.31.255.254", true},
		{"172.32.x.x is public", "172.32.0.1", false},
		{"192.168.0.0/16 range start", "192.168.0.1", true},
		{"192.168.0.0/16 range middle", "192.168.100.50", true},
		{"192.168.0.0/16 range end", "192.168.255.254", true},
		{"public IP 8.8.8.8", "8.8.8.8", false},
		{"public IP 1.1.1.1", "1.1.1.1", false},
		{"public IP 203.0.113.1", "203.0.113.1", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ip := net.ParseIP(tc.ip)
			if ip == nil {
				t.Fatalf("failed to parse IP %s", tc.ip)
			}
			result := isPrivateIP(ip)
			if result != tc.expected {
				t.Errorf("isPrivateIP(%s) = %v, want %v", tc.ip, result, tc.expected)
			}
		})
	}
}

func TestGenerateCIDRAwareIPs_24(t *testing.T) {
	netInfo := &NetworkInfo{
		Network:  "192.168.1",
		CIDR:     "192.168.1.0/24",
		OwnIP:    "192.168.1.50",
		Gateway:  "192.168.1.1",
		MaskBits: 24,
	}

	ips := generateCIDRAwareIPs(netInfo)

	// Should generate 253 IPs (1-254 minus own IP)
	if len(ips) != 253 {
		t.Errorf("expected 253 IPs, got %d", len(ips))
	}

	// Own IP should be excluded
	for _, ip := range ips {
		if ip == "192.168.1.50" {
			t.Error("own IP should not be in scan list")
		}
	}

	// Gateway should be first (highest priority)
	if ips[0] != "192.168.1.1" {
		t.Errorf("expected gateway 192.168.1.1 to be first, got %s", ips[0])
	}

	// .254 should also be high priority (in the first few entries)
	found254 := false
	for i := 0; i < 5; i++ {
		if ips[i] == "192.168.1.254" {
			found254 = true
			break
		}
	}
	if !found254 {
		t.Error("expected .254 to be in first 5 entries as high priority")
	}
}

func TestGenerateCIDRAwareIPs_PriorityOrder(t *testing.T) {
	netInfo := &NetworkInfo{
		Network:  "10.0.0",
		CIDR:     "10.0.0.0/24",
		OwnIP:    "10.0.0.200",
		Gateway:  "10.0.0.1",
		MaskBits: 24,
	}

	ips := generateCIDRAwareIPs(netInfo)

	posMap := map[string]int{}
	for i, ip := range ips {
		posMap[ip] = i
	}

	posGateway := posMap["10.0.0.1"]
	posMedium := posMap["10.0.0.10"]
	posLow := posMap["10.0.0.150"]

	if posGateway >= posMedium {
		t.Errorf("gateway (pos %d) should come before medium priority IP (pos %d)", posGateway, posMedium)
	}
	if posMedium >= posLow {
		t.Errorf("medium priority IP (pos %d) should come before low priority IP (pos %d)", posMedium, posLow)
	}
}

func TestGenerateCIDRAwareIPs_LargeSubnet(t *testing.T) {
	netInfo := &NetworkInfo{
		Network:  "10.0.0",
		CIDR:     "10.0.0.0/20",
		OwnIP:    "10.0.1.50",
		Gateway:  "10.0.0.1",
		MaskBits: 20,
	}

	ips := generateCIDRAwareIPs(netInfo)

	// /20 has 4094 hosts, should be capped at maxScanIPs
	if len(ips) > maxScanIPs {
		t.Errorf("expected at most %d IPs, got %d", maxScanIPs, len(ips))
	}

	// Gateway should still be prioritized
	if len(ips) > 0 && ips[0] != "10.0.0.1" {
		t.Errorf("expected gateway 10.0.0.1 to be first, got %s", ips[0])
	}
}

func TestClassifyDevice(t *testing.T) {
	tests := []struct {
		name       string
		result     DiscoveryResult
		gateways   map[string]bool
		wantType   string
		wantGW     bool
	}{
		{
			name: "Router by gateway IP",
			result: DiscoveryResult{
				IPAddress: "192.168.1.1",
				OpenPorts: []int{53, 80, 443},
				Services:  []string{"DNS", "HTTP", "HTTPS"},
			},
			gateways: map[string]bool{"192.168.1.1": true},
			wantType: "router",
			wantGW:   true,
		},
		{
			name: "Printer by ports",
			result: DiscoveryResult{
				IPAddress: "192.168.1.100",
				OpenPorts: []int{80, 631, 9100},
				Services:  []string{"HTTP", "IPP-Print", "RAW-Print"},
			},
			gateways: map[string]bool{},
			wantType: "printer",
			wantGW:   false,
		},
		{
			name: "Linux server",
			result: DiscoveryResult{
				IPAddress: "192.168.1.10",
				OpenPorts: []int{22, 80, 443, 3306},
				Services:  []string{"SSH", "HTTP", "HTTPS", "MySQL"},
			},
			gateways: map[string]bool{},
			wantType: "server",
			wantGW:   false,
		},
		{
			name: "MikroTik router by banner",
			result: DiscoveryResult{
				IPAddress:  "192.168.1.1",
				OpenPorts:  []int{80, 443},
				Services:   []string{"HTTP", "HTTPS"},
				BannerInfo: "MikroTik HttpProxy",
			},
			gateways: map[string]bool{},
			wantType: "router",
			wantGW:   false,
		},
		{
			name: "Windows server",
			result: DiscoveryResult{
				IPAddress: "10.0.0.5",
				OpenPorts: []int{135, 445, 3389},
				Services:  []string{"MSRPC", "SMB/CIFS", "RDP"},
			},
			gateways: map[string]bool{},
			wantType: "server",
			wantGW:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			classifyDevice(&tc.result, tc.gateways)
			if tc.result.DeviceType != tc.wantType {
				t.Errorf("classifyDevice() DeviceType = %q, want %q", tc.result.DeviceType, tc.wantType)
			}
			if tc.result.IsGateway != tc.wantGW {
				t.Errorf("classifyDevice() IsGateway = %v, want %v", tc.result.IsGateway, tc.wantGW)
			}
		})
	}
}

func TestParseHexIP(t *testing.T) {
	tests := []struct {
		hex      string
		expected string
	}{
		{"0101A8C0", "192.168.1.1"},    // 192.168.1.1 in little-endian hex
		{"00000000", "0.0.0.0"},
		{"", ""},
		{"ZZZZZZZZ", ""},
	}

	for _, tc := range tests {
		result := parseHexIP(tc.hex)
		if result != tc.expected {
			t.Errorf("parseHexIP(%q) = %q, want %q", tc.hex, result, tc.expected)
		}
	}
}

func TestContainsAny(t *testing.T) {
	// containsAny is case-sensitive; classifyDevice lowercases before calling it
	if !containsAny("mikrotik httpproxy", "mikrotik") {
		t.Error("should match mikrotik")
	}
	if containsAny("apache httpd", "mikrotik", "ubiquiti") {
		t.Error("should not match")
	}
	if !containsAny("ubiquiti edgeos", "ubiquiti", "edgeos") {
		t.Error("should match ubiquiti or edgeos")
	}
}

func TestIdentifyService(t *testing.T) {
	tests := []struct {
		port     int
		expected string
	}{
		{22, "SSH"},
		{80, "HTTP"},
		{443, "HTTPS"},
		{3306, "MySQL"},
		{5432, "PostgreSQL"},
		{3389, "RDP"},
		{9999, "TCP/9999"},
	}

	for _, tc := range tests {
		result := identifyService(tc.port)
		if result != tc.expected {
			t.Errorf("identifyService(%d) = %q, want %q", tc.port, result, tc.expected)
		}
	}
}

func TestIsTLSPort(t *testing.T) {
	if !IsTLSPort(443) {
		t.Error("IsTLSPort(443) should return true")
	}
	if !IsTLSPort(8443) {
		t.Error("IsTLSPort(8443) should return true")
	}
	if IsTLSPort(80) {
		t.Error("IsTLSPort(80) should return false")
	}
	if IsTLSPort(22) {
		t.Error("IsTLSPort(22) should return false")
	}
}

func TestDetectOSType(t *testing.T) {
	tests := []struct {
		name     string
		ports    []int
		services []string
		expected string
	}{
		{"Windows with RDP", []int{3389, 445}, []string{"RDP", "SMB/CIFS"}, "windows"},
		{"Windows SMB only", []int{445}, []string{"SMB/CIFS"}, "windows"},
		{"Linux with SSH", []int{22, 80}, []string{"SSH", "HTTP"}, "linux"},
		{"Network device HTTP only", []int{80, 443}, []string{"HTTP", "HTTPS"}, "network-device"},
		{"Unknown no services", []int{}, []string{}, "unknown"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := detectOSType(tc.ports, tc.services)
			if result != tc.expected {
				t.Errorf("detectOSType(%v, %v) = %q, want %q", tc.ports, tc.services, result, tc.expected)
			}
		})
	}
}

func TestGetAdaptivePortList(t *testing.T) {
	// Starting with SSH detected should add Linux-related ports
	initialPorts := []int{22, 80}
	services := []string{"SSH", "HTTP"}

	result := getAdaptivePortList(initialPorts, services)

	// Should contain initial ports
	resultMap := map[int]bool{}
	for _, p := range result {
		resultMap[p] = true
	}

	if !resultMap[22] {
		t.Error("result should contain initial port 22")
	}
	if !resultMap[80] {
		t.Error("result should contain initial port 80")
	}

	// SSH triggers database ports
	if !resultMap[3306] {
		t.Error("SSH service should trigger MySQL port 3306")
	}
	if !resultMap[5432] {
		t.Error("SSH service should trigger PostgreSQL port 5432")
	}

	// HTTP triggers alternative web ports
	if !resultMap[8080] {
		t.Error("HTTP service should trigger alt HTTP port 8080")
	}
	if !resultMap[8443] {
		t.Error("HTTP service should trigger alt HTTPS port 8443")
	}
}

func TestGetMaskBits(t *testing.T) {
	tests := []struct {
		mask     net.IPMask
		expected int
	}{
		{net.CIDRMask(24, 32), 24},
		{net.CIDRMask(16, 32), 16},
		{net.CIDRMask(8, 32), 8},
		{net.CIDRMask(32, 32), 32},
	}

	for _, tc := range tests {
		result := getMaskBits(tc.mask)
		if result != tc.expected {
			t.Errorf("getMaskBits(%v) = %d, want %d", tc.mask, result, tc.expected)
		}
	}
}
