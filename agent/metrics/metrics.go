// Package metrics provides a lightweight, dependency-free Prometheus metrics
// exporter for the Zertifikat-Wächter agent. All values are stored using
// sync/atomic for safe concurrent access from multiple goroutines.
package metrics

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

// -----------------------------------------------------------------------
// Counters (monotonically increasing)
// -----------------------------------------------------------------------

var scansTotal int64

// IncScansTotal increments the total number of scans performed.
func IncScansTotal() { atomic.AddInt64(&scansTotal, 1) }

// GetScansTotal returns the current value.
func GetScansTotal() int64 { return atomic.LoadInt64(&scansTotal) }

// -----------------------------------------------------------------------
// Gauges (can go up and down)
// -----------------------------------------------------------------------

var (
	scanDurationSeconds int64 // stored as milliseconds, exported as seconds
	certificatesFound   int64
	hostsDiscovered     int64
	heartbeatTimestamp  int64 // unix epoch seconds
)

// SetScanDuration records the duration of the last scan.
func SetScanDuration(d time.Duration) {
	atomic.StoreInt64(&scanDurationSeconds, d.Milliseconds())
}

// SetCertificatesFound records how many certs were found in the last scan.
func SetCertificatesFound(n int) { atomic.StoreInt64(&certificatesFound, int64(n)) }

// SetHostsDiscovered records how many hosts were found in the last discovery.
func SetHostsDiscovered(n int) { atomic.StoreInt64(&hostsDiscovered, int64(n)) }

// SetHeartbeatTimestamp records the unix timestamp of the last heartbeat.
func SetHeartbeatTimestamp() {
	atomic.StoreInt64(&heartbeatTimestamp, time.Now().Unix())
}

// -----------------------------------------------------------------------
// HTTP handler – Prometheus text exposition format
// -----------------------------------------------------------------------

// Handler returns an http.HandlerFunc that writes all metrics in the
// Prometheus text exposition format (text/plain; version=0.0.4).
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		// certwatcher_agent_up (gauge, always 1)
		fmt.Fprintln(w, "# HELP certwatcher_agent_up Whether the agent is running (always 1).")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_up gauge")
		fmt.Fprintln(w, "certwatcher_agent_up 1")

		// certwatcher_agent_scans_total (counter)
		fmt.Fprintln(w, "# HELP certwatcher_agent_scans_total Total number of certificate scans performed.")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_scans_total counter")
		fmt.Fprintf(w, "certwatcher_agent_scans_total %d\n", atomic.LoadInt64(&scansTotal))

		// certwatcher_agent_scan_duration_seconds (gauge)
		durationMs := atomic.LoadInt64(&scanDurationSeconds)
		fmt.Fprintln(w, "# HELP certwatcher_agent_scan_duration_seconds Duration of the last scan in seconds.")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_scan_duration_seconds gauge")
		fmt.Fprintf(w, "certwatcher_agent_scan_duration_seconds %.3f\n", float64(durationMs)/1000.0)

		// certwatcher_agent_certificates_found (gauge)
		fmt.Fprintln(w, "# HELP certwatcher_agent_certificates_found Number of certificates found in the last scan.")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_certificates_found gauge")
		fmt.Fprintf(w, "certwatcher_agent_certificates_found %d\n", atomic.LoadInt64(&certificatesFound))

		// certwatcher_agent_hosts_discovered (gauge)
		fmt.Fprintln(w, "# HELP certwatcher_agent_hosts_discovered Number of hosts found in the last network discovery.")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_hosts_discovered gauge")
		fmt.Fprintf(w, "certwatcher_agent_hosts_discovered %d\n", atomic.LoadInt64(&hostsDiscovered))

		// certwatcher_agent_heartbeat_timestamp (gauge)
		fmt.Fprintln(w, "# HELP certwatcher_agent_heartbeat_timestamp Unix timestamp of the last successful heartbeat.")
		fmt.Fprintln(w, "# TYPE certwatcher_agent_heartbeat_timestamp gauge")
		fmt.Fprintf(w, "certwatcher_agent_heartbeat_timestamp %d\n", atomic.LoadInt64(&heartbeatTimestamp))
	}
}
