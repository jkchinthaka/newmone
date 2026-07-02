# Maintenance Manager Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `MANAGER` (Maintenance Manager)  
**Duration:** 3 hours classroom + 1 hour hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

The Maintenance Manager owns the full work order lifecycle, workforce assignment, operational and finance approvals (where permitted), gate overrides, management reporting, and pilot compliance. You enforce: **No system record = No official company action.**

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| Full work order CRUD (no delete) | `/work-orders` |
| Create, assign, approve, reject WOs | WO detail + bulk actions |
| Workforce planning and assignment | Workforce module |
| Manage assets (create/update) | `/assets` |
| Inventory manage + stock issue | `/inventory` |
| Operational + finance PO approval | `purchase_orders.approve_*` |
| Part request operational/finance approve | Part requests |
| Gate override approval | Fleet / gate |
| View/export reports | `/reports` |
| Management intelligence | `/reports/management-intelligence` |
| Fraud & control reports | `/reports/fraud-control` |
| Predictive AI actions (WO create/assign) | Predictive module |
| Action center — high-risk queue | `/action-center` |
| Settings (read-only) | `/settings` |
| Users (view only) | User list |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| `system.configure` / super-admin settings | `SUPER_ADMIN` only |
| Admin console tenant management | `ADMIN` |
| System health deployment controls | `ADMIN` / `SUPER_ADMIN` |
| Delete work orders | Restricted — admin |
| Audit log export (unless granted) | No `audit.view` in default seed |
| Approve same part request you created | Maker-checker |
| Silent overrides | Reason required — fraud report |
| Bypass supervisor verification for closure | Governance unless documented override |

---

## 4. Daily workflow

### Morning briefing

1. **Action Center** → review KPIs, high-risk queue, overdue verifications.
2. **Management intelligence** → cost and backlog trends (weekly deep dive).

[Screenshot: Action center manager view]

### Work planning

3. Create WOs from requests, inspections, or predictive alerts.
4. Assign technicians — check leave/capacity (UAT-007).
5. Prioritize critical and emergency jobs.

[Screenshot: Work order create and assign]

### Governance

6. Monitor supervisor verification aging.
7. Review **Fraud & Control** for overrides and maker-checker violations.
8. Approve vendor quotations and escalate invoices to finance as needed.
9. Approve gate overrides with documented reason.

[Screenshot: Fraud control dashboard]

### End of day

10. Spot-check: random sample of closed WOs vs physical reality.
11. Address support escalations; sign off pilot feedback themes.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Assigning without WO in system | Create WO first |
| Self-approving part requests | Delegate approval |
| Ignoring fraud dashboard | Weekly mandatory review |
| Bulk status change without review | UAT-019 — confirm selection |
| Finance approval without verification | Wait for supervisor verify |
| Off-system "emergency" repairs | Create emergency WO + override reason |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| P0 system outage | DevOps — [pilot-support-process.md](../pilot-support-process.md) |
| Repeated override by same user | Finance + HR review |
| High-cost vendor dispute | Finance director |
| RBAC / access wrong | Admin |
| Production cutover issues | Ops Manager + DevOps |

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Operations Manager | **TBD** |
| DevOps on-call | Secret manager |
| Finance approver | **TBD** |

---

## 8. Related SOPs

- [work-order-create-sop.md](../sop/work-order-create-sop.md)
- [work-order-assignment-sop.md](../sop/work-order-assignment-sop.md)
- [management-report-review-sop.md](../sop/management-report-review-sop.md)
- [admin-override-sop.md](../sop/admin-override-sop.md)
- [gate-restriction-sop.md](../sop/gate-restriction-sop.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| End-to-end WO exercise | ☐ Yes |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I am accountable for pilot compliance with system-recorded official actions.
