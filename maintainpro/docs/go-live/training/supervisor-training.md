# Supervisor Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `SUPERVISOR` (includes `MAINTENANCE_SUPERVISOR`)  
**Duration:** 2 hours classroom + 45 minutes hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Supervisors verify technician completions, approve/reject work quality, manage high-risk queues, and may sign off cleaning or facility issues. You are the **quality gate** before work orders close. **No supervisor verification = No closure** per company policy.

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| View dashboard and action center | `/action-center` |
| View all work orders (read) | `/work-orders` |
| Access supervisor verification queue | `/action-center` · High-risk queue |
| Verify or reject technician completion | WO detail → Verify |
| Approve/reject work orders (governance) | WO governance actions |
| Override QR mismatch **with reason** | WO detail → Override |
| View cleaning modules (if assigned) | `/cleaning` |
| Report / manage facility issues | Facility issues |
| View audit logs (read-only) | `/audit` |
| View reports (read-only subset) | `/reports` |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Create work orders (unless also MANAGER) | Typically manager function |
| Assign technicians | `work_orders.manage` / workforce |
| Issue parts from store | `INVENTORY_KEEPER` |
| Finance approve POs/invoices | Finance permission |
| Access system health / admin | Admin roles only |
| Management intelligence / fraud control | Manager / Finance roles |
| Verify your own completion | Segregation — another supervisor/manager |
| Silent overrides without reason | Audit requirement (min 3 characters) |

---

## 4. Daily workflow

### Morning

1. Log in → **Action Center** → **Supervisor Verification** queue.
2. Review overnight completions and high-risk queue.
3. Brief technicians on rejections/rework from previous day.

[Screenshot: Supervisor verification queue in action center]

### Verification cycle

4. Open WO in **Pending Verification** status.
5. Review evidence (before/after), notes, parts used, QR status.
6. **Approve verification** → allows manager/finance next steps OR **Reject** → REWORK_REQUIRED with clear reason.

[Screenshot: Supervisor verify / reject dialog]

### High-risk and exceptions

7. Monitor high-risk queue (critical priority, emergency, high cost).
8. For QR mismatch: investigate on site; if override justified, enter reason (appears in fraud report).
9. Escalate repeated technician errors to Maintenance Manager.

### End of day

10. Clear verification backlog target: standard WOs within 24 hours.
11. Submit [pilot-feedback-form.md](../pilot-feedback-form.md) weekly.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Verifying without viewing evidence | Open all attachments — audit trail |
| Closing WO from verification screen incorrectly | Follow status workflow in SOP |
| Approving own team's work without spot checks | Random site visits |
| Blank or vague rejection reasons | Specific rework instructions |
| Bypassing system for "quick" sign-off | Only in-system verification counts |
| Ignoring fraud flags on WO | Review fraud tab before verify |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| High-cost WO without evidence | Manager — hold verification |
| Vendor repair without quotation | Manager |
| Suspected parts fraud | Manager + Finance |
| System cannot verify | Admin support P1 |
| Safety incident | Manager + incident SOP immediately |

Reference: [supervisor-verification-sop.md](../sop/supervisor-verification-sop.md) · [incident-reporting-sop.md](../sop/incident-reporting-sop.md)

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Maintenance Manager | **TBD** |
| MaintainPro admin | **TBD** |
| Support channel | **TBD** |

---

## 8. Related SOPs

- [supervisor-verification-sop.md](../sop/supervisor-verification-sop.md)
- [technician-completion-sop.md](../sop/technician-completion-sop.md)
- [admin-override-sop.md](../sop/admin-override-sop.md)
- [incident-reporting-sop.md](../sop/incident-reporting-sop.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Verified sample WO in training | ☐ Yes — WO ID: ______ |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I will not certify work that is not properly recorded and evidenced in MaintainPro.
