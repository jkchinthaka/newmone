# SOP: Management Report Review

**Document ID:** SOP-RPT-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02

---

## Purpose

Establish a regular management review of MaintainPro intelligence and control reports for operational decisions, fraud detection, and pilot success measurement.

## Responsible role

**Primary:** `MANAGER`, `OPERATIONS_MANAGER`  
**Participants:** Finance approver, `ADMIN` (data issues), `SUPER_ADMIN` (system config)

## Prerequisites

- Access to `/reports/management-intelligence` and `/reports/fraud-control`
- Pilot/production tenant with live data

---

## Steps

### Weekly review (30–45 minutes)

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open **Action Center** — note backlog KPIs | `/action-center` |
| 2 | Open **Management Intelligence** | `/reports/management-intelligence` |
| 3 | Review profitability summary, WO volumes, cost trends (UAT-021) | Dashboard widgets |
| 4 | Open **Fraud & Control** | `/reports/fraud-control` |
| 5 | Review maker-checker violations, override count, gate blocks | Control panels |
| 6 | Export CSV if audit file needed | Export — audited |
| 7 | Assign actions for anomalies (training, discipline, bug) | Action log |
| 8 | Compare to [pilot-rollout-plan.md](../pilot-rollout-plan.md) success criteria | Checklist |

### Monthly review (additional)

| Step | Action |
|------|--------|
| 9 | Trend analysis — overrides per user, cost per asset class |
| 10 | Review with finance director |
| 11 | Feed items to [change-request-process.md](../developer-protection/change-request-process.md) |

---

## Approval

Management reports are read-only — decisions (e.g. policy change) follow separate management approval outside system.

---

## Audit trail

Report exports log `report_exported` per [audit-trail-standard.md](../audit-trail-standard.md).

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Report empty (new tenant) | Expected early pilot — use WO list metrics |
| Numbers disagree with floor | Data issue ticket — do not use off-system counts as official |

---

## What NOT to do

- Do **not** share exported reports with unauthorized parties
- Do **not** ignore rising override trend
- Do **not** use reports as sole legal evidence (see anti-fraud disclaimer)
- Do **not** skip review during pilot — weekly is mandatory

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Report 403 for manager | Admin — role check |
| Suspected data breach in export | Security P0 |
| KPI mismatch bug | Engineering P2 |

---

## Related documents

- [pilot-feedback-form.md](../pilot-feedback-form.md)
- [finance-invoice-approval-sop.md](finance-invoice-approval-sop.md)
