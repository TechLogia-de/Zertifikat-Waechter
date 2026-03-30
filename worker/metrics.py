"""
Lightweight, dependency-free Prometheus metrics for the Zertifikat-Wächter worker.

All counters are plain integers protected by a threading lock.
The /metrics endpoint returns the standard Prometheus text exposition format.
"""

import threading
import time

_lock = threading.Lock()

_counters: dict[str, int] = {
    "emails_sent": 0,
    "emails_failed": 0,
    "scans": 0,
    "rate_limited": 0,
}

# Startup timestamp used for the _up gauge
_start_time = time.time()


def inc(name: str, value: int = 1) -> None:
    """Increment a counter by *value* (default 1)."""
    with _lock:
        _counters[name] = _counters.get(name, 0) + value


def get(name: str) -> int:
    """Return the current value of a counter."""
    with _lock:
        return _counters.get(name, 0)


def render() -> str:
    """Return all metrics in Prometheus text exposition format."""
    with _lock:
        snapshot = dict(_counters)

    lines: list[str] = []

    # certwatcher_worker_up (gauge, always 1)
    lines.append("# HELP certwatcher_worker_up Whether the worker is running (always 1).")
    lines.append("# TYPE certwatcher_worker_up gauge")
    lines.append("certwatcher_worker_up 1")

    # certwatcher_worker_emails_sent_total
    lines.append("# HELP certwatcher_worker_emails_sent_total Total emails sent successfully.")
    lines.append("# TYPE certwatcher_worker_emails_sent_total counter")
    lines.append(f"certwatcher_worker_emails_sent_total {snapshot['emails_sent']}")

    # certwatcher_worker_emails_failed_total
    lines.append("# HELP certwatcher_worker_emails_failed_total Total emails that failed to send.")
    lines.append("# TYPE certwatcher_worker_emails_failed_total counter")
    lines.append(f"certwatcher_worker_emails_failed_total {snapshot['emails_failed']}")

    # certwatcher_worker_scans_total
    lines.append("# HELP certwatcher_worker_scans_total Total certificate scans performed.")
    lines.append("# TYPE certwatcher_worker_scans_total counter")
    lines.append(f"certwatcher_worker_scans_total {snapshot['scans']}")

    # certwatcher_worker_rate_limited_total
    lines.append("# HELP certwatcher_worker_rate_limited_total Total requests rejected by rate limiting.")
    lines.append("# TYPE certwatcher_worker_rate_limited_total counter")
    lines.append(f"certwatcher_worker_rate_limited_total {snapshot['rate_limited']}")

    # Trailing newline expected by Prometheus
    lines.append("")
    return "\n".join(lines)
