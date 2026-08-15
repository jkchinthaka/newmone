# Phase 34 — In-Process Quality Control (IPQC) workflows

**Document status:** Technical foundation — company IPQC content **not** seeded  
**Phase:** 34  
**ADR:** [ADR-045-IN-PROCESS-QUALITY-CONTROL.md](../architecture/ADR-045-IN-PROCESS-QUALITY-CONTROL.md)

## Intent

Support quality checks **during production**, separate from Finished Goods release.

## Delivered

| Area | Status |
| --- | --- |
| Configurable process-check definitions (checklist templates) | TECHNICALLY SUPPORTED |
| Triggers: time interval / shift / production order / batch / manual | TECHNICALLY SUPPORTED (shells) |
| Process context: product / line / step / shift / batch/order | TECHNICALLY SUPPORTED |
| Spec measurement + equipment trace + sampling + HACCP metadata | TECHNICALLY SUPPORTED |
| Failure without automatic line stop | TECHNICALLY SUPPORTED (dual-gate OFF) |
| Controlled NCR / HOLD escalation | TECHNICALLY SUPPORTED |
| Due / overdue / failure dashboard selectors | TECHNICALLY SUPPORTED |

## Explicit non-claims

- Does not hardcode IPQC questions or invent check frequencies
- Does not invent CCP classifications or product limits
- Does not automatically stop the line on FAIL
- Does not auto-create NCR/HOLD from FAIL
- Completing IPQC is not FG RELEASE

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED` | `false` | Gates IPQC fail → stop-production signal |

## STATUS: PHASE 34 IPQC COMPLETE
