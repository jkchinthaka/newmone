# Incident Response — Phase 19

## Severity

| Sev | Example |
| --- | --- |
| 1 | Recording unavailable plant-wide; data loss risk |
| 2 | Single-site outage; backup failure; auth lockout storm |
| 3 | Degraded latency; non-critical integration noise |

## Procedure

1. Detect via alert or user report; capture correlation id
2. Triage with `/health/live/` and `/health/ready/`
3. Contain (revoke sessions, disable live integration flags, scale)
4. Eradicate / restore from approved backup if required
5. Recover and monitor
6. Post-incident review within agreed SLA (**DECISION REQUIRED**)

Never paste passwords, tokens, Mongo URIs, or checklist free-text into tickets.
