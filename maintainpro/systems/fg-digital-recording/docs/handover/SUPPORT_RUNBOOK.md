# Support Runbook

## Current posture

Support documentation exists, but production support ownership is not yet named.

## Core references

- [../release/SUPPORT_AND_HANDOVER.md](../release/SUPPORT_AND_HANDOVER.md)
- [../operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md)
- [../operations/DR_RUNBOOK.md](../operations/DR_RUNBOOK.md)
- [../operations/MONITORING_AND_ALERTS.md](../operations/MONITORING_AND_ALERTS.md)
- [../operations/SECURITY_RUNBOOK.md](../operations/SECURITY_RUNBOOK.md)

## First-response checklist

1. Confirm whether the issue is local-only, environment-wide, or data-related.
2. Check application liveness and readiness endpoints.
3. Preserve logs, correlation IDs, and security audit trails.
4. Determine whether PostgreSQL, Redis, or background processing is impaired.
5. If security impact is suspected, follow the security runbook and incident response steps.
6. If data integrity is in doubt, stop speculative fixes and preserve evidence first.

## Operational ownership

The following remain `OWNER REQUIRED`:

- support owner
- application/platform on-call
- database owner
- security incident owner
- vendor contact for Bileeta or hosting

## Alert themes documented in the repo

- app down
- database unavailable
- queue stuck
- integration failures
- error spikes
- latency regressions
- storage or disk risk
- backup failure

## Handover limitation

This runbook supports technical continuity, but it is not a signed production support model. Named owners and escalation targets must be completed by the receiving organization.
