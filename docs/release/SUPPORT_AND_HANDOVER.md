# Phase 21 — Support model and handover

## Support model (fill with real names only)

| Role | Name / team | Contact | Status |
| --- | --- | --- | --- |
| Support owner | | | **OWNER REQUIRED** |
| App / platform on-call | | | **OWNER REQUIRED** |
| Database owner | | | **OWNER REQUIRED** |
| Security contact | | | **OWNER REQUIRED** |
| Vendor contact (hosting / Bileeta / email) | | | **OWNER REQUIRED** |

### Severity / escalation (proposed process — owners must confirm)

| Sev | Example | Initial response target | Escalate to |
| --- | --- | --- | --- |
| 1 | Plant-wide recording down; suspected data loss | **DECISION REQUIRED** | Support owner + IT + QA |
| 2 | Single-site outage; backup failure | **DECISION REQUIRED** | Support owner |
| 3 | Degraded latency; non-critical noise | **DECISION REQUIRED** | App owner |

Incident process reference: [../operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md)

## Handover deliverable checklist

| Deliverable | Location | Handover complete? |
| --- | --- | --- |
| Architecture documentation | `docs/architecture/` | Package available; **prod handover NOT COMPLETE** |
| Deployment / env strategy | `docs/operations/` | Docs exist; **prod deploy NOT DONE** |
| Backup / restore runbook | `docs/operations/BACKUP_RESTORE_RUNBOOK.md` | Docs exist; **prod custody NOT PROVEN** |
| Incident / DR / monitoring | `docs/operations/` | Docs exist; owners TBC |
| Admin / configuration guides | `docs/` (module + ops) | Available as technical docs |
| User guides | Operator UX docs | Sinhala UAT still blocked (DEBT-01C-R-NOTO) |
| Integration guide | Phase 17 / `apps.integrations` docs | Live connector still evidence-gated |
| Security notes | `docs/security/` + Phase 19 runbook | Available; prod attestation open |
| Release procedure | this `docs/release/` pack | Gate **CLOSED** |

**Handover completed:** **No**
