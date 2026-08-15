# Monitoring and Alerts — Phase 19

## Actionable alerts

| Alert | Signal | Severity | Owner |
| --- | --- | --- | --- |
| App down | `/health/live/` failing | Sev1 | SRE / Platform (TBC) |
| DB unavailable | `/health/ready/` postgresql≠ok | Sev1 | Database / SRE (TBC) |
| Queue stuck | Celery backlog / broker down | Sev2 | SRE (TBC) |
| Integration failures | `INTEGRATION_*` audit spike / report | Sev2 | Integration owner (TBC) |
| Error spikes | 5xx rate | Sev2 | App owner (TBC) |
| Latency | p95 health or app routes | Sev3 | Performance (TBC) |
| Storage/disk | evidence volume / node disk | Sev2 | Platform (TBC) |
| Backup failure | job status / missing checksum | Sev2 | Backup operator (TBC) |

Owners marked TBC remain **OWNER TO BE CONFIRMED**. Wire alerts into the company monitoring stack when hosting is approved (APR-021).
