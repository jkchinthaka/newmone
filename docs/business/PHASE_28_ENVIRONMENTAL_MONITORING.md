# Phase 28 — Environmental monitoring foundation

**Document status:** Technical foundation — company EM content **not** seeded  
**Phase:** 28  
**ADR:** [ADR-040-ENVIRONMENTAL-MONITORING.md](../architecture/ADR-040-ENVIRONMENTAL-MONITORING.md)

## Delivered

| Area | Status |
| --- | --- |
| MonitoringPoint (site/dept/room/line/area) | TECHNICALLY SUPPORTED |
| Versioned limit specs (no invented bounds) | TECHNICALLY SUPPORTED |
| MANUAL / LAB / SENSOR sources | TECHNICALLY SUPPORTED |
| Scheduler link for recurring readings | TECHNICALLY SUPPORTED |
| Excursion/warning evaluation | TECHNICALLY SUPPORTED |
| Auto-HOLD on excursion | Default **OFF** (APR-054) |
| Trend index | TECHNICALLY SUPPORTED |
| Device traceability on readings | Optional equipment snapshot |

## Explicit non-claims

- Does not assume Nelna uses temperature/humidity/water/swab
- Does not invent limits or monitoring frequencies
- Does not auto-HOLD stock without approved dual-gate policy

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `ENVIRONMENTAL_AUTO_HOLD_APPROVED` | `false` | Gates excursion → HoldCase creation |

## STATUS: PHASE 28 ENVIRONMENTAL MONITORING COMPLETE
