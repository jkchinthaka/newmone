# UAT Runbook — MaintainPro

**Branch:** `maintainpro/integration-v1`  
**Version:** Phase 14  
**Date:** 2026-09-15  

For the full UAT checklist catalog see `docs/UAT_CHECKLIST.md` and `docs/uat/`.

---

## Scope

This runbook provides 20 key UAT scenarios for staging verification. Each scenario maps to the Phase 14 acceptance matrix. Testers should work from a fresh incognito session against the staging environment with realistic seed data.

Columns: **Role** = minimum role required; **Steps** = brief action sequence; **Expected** = success criteria; **PASS/FAIL** = tester fill-in.

---

## Pre-requisites

- Staging environment running with `db:push` applied and seed data loaded (`npm run db:seed`)
- At least one tenant with: 1 ADMIN, 1 MANAGER, 2 TECHNICIANs, 1 VIEWER, 1 DRIVER account
- Asset records of at least 3 domain types (FLEET_VEHICLE, PLANT_MACHINERY, FACILITY_CIVIL)
- PM plans seeded with calendar and meter triggers
- Test vehicle with registered plate and linked asset

---

## Scenario Matrix

### Section 1 — Authentication & Access Control

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-01 | Login with valid credentials | Any | Navigate to `/login`; enter correct email + password; submit | Redirected to role home dashboard; no error | |
| U-02 | Login with invalid credentials | Any | Enter wrong password 5× | Lockout warning shown after N failures; no session created | |
| U-03 | VIEWER cannot create work order | VIEWER | Login as VIEWER; navigate to Work Orders; attempt to create | "Forbidden" or create button absent | |
| U-04 | TECHNICIAN sees only own assigned WOs in queue | TECHNICIAN | Login; open Work Order queue | Only WOs assigned to this technician visible | |

---

### Section 2 — Work Order Lifecycle

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-05 | Create corrective WO from maintenance request | MANAGER | Open a pending request; click "Create Work Order"; fill required fields; submit | WO created with status OPEN; linked to request; audit entry created | |
| U-06 | Technician starts and completes WO | TECHNICIAN | Open assigned WO; click Start; perform checklist; click TECHNICIAN_COMPLETED | WO status = TECHNICIAN_COMPLETED; completion timestamp recorded | |
| U-07 | Supervisor verifies and closes WO | MANAGER | Open WO in TECHNICIAN_COMPLETED; click Verify; then Close | WO status = CLOSED; cost snapshot captured if parts issued | |
| U-08 | WO requiring approval escalates correctly | MANAGER | Create high-cost WO above approval threshold | WO status = PENDING_APPROVAL; notification sent to approver | |
| U-09 | Overdue WO appears in overdue queue | MANAGER | Set a WO due date in past; do not close it | WO appears in Overdue filter; count > 0 | |
| U-10 | Closed WO with past due date NOT in overdue count | MANAGER | Close a WO with a past due date | That WO does NOT appear in Overdue list | |

---

### Section 3 — PM / Planning

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-11 | PM plan triggers WO at calendar due date | MANAGER | Open PM Plans; locate a calendar-based plan due today/tomorrow; trigger | Auto-WO created; appears in Work Order queue | |
| U-12 | Meter-based PM fires when threshold crossed | MANAGER | Update asset meter reading to cross PM threshold in plan | WO auto-generated; `PmAutoGeneration` record created | |
| U-13 | Failed inspection creates corrective WO | TECHNICIAN | Open inspection checklist; mark a critical item FAIL; submit | Corrective WO automatically created; linked to failed inspection | |

---

### Section 4 — Parts / ERP Boundary

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-14 | Issue parts against open WO | TECHNICIAN | Open WO; go to Parts tab; issue a stocked part | Part deducted from inventory; WO parts record updated | |
| U-15 | ERP sync status shown honestly as mock (non-production) | MANAGER | Open Inventory > ERP Sync status | Status shows MOCK or NOT_CONFIGURED — never "Production Success" in mock/staging mode | |

---

### Section 5 — Fleet Lifecycle

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-16 | Fleet vehicle gate-out blocked when overdue for service | DRIVER/SECURITY | Attempt gate-out for vehicle with overdue service job | Gate-out blocked; reason shown; override path available for MANAGER | |
| U-17 | MANAGER overrides gate block with reason | MANAGER | On blocked gate-out; click Override; enter reason; confirm | Override recorded with audit fields (approvedBy, reason, timestamp); gate-out proceeds | |
| U-18 | Accident reported → repair WO created | MANAGER | Go to Fleet > Accidents; report new accident for vehicle | Accident record created; repair WO linked | |

---

### Section 6 — Admin Governance

| # | Scenario | Role | Steps | Expected | PASS/FAIL |
|---|----------|------|-------|----------|-----------|
| U-19 | Admin cannot deactivate last active admin account | SUPER_ADMIN | Go to Admin > Users; attempt to deactivate the only active ADMIN | Error: "Last critical admin must not be deactivated" | |
| U-20 | Audit log shows all key mutations | ADMIN | Perform create/update/close actions; open Admin > Audit | Audit entries visible with actor, action, timestamp, tenant | |

---

## Post-UAT Sign-off Checklist

- [ ] All 20 scenarios above tested and PASS recorded
- [ ] No P0/P1 defects open
- [ ] Responsive layout verified on: iPhone SE, iPad, desktop 1280px
- [ ] Backup/restore drill evidence provided (see item 33 / `PRODUCTION_READINESS_REPORT.md`)
- [ ] UAT sign-off by: ___________________________ Date: ___________

---

## Phase 15A / SQL Server UAT attempt (2026-09-15)

**Environment:** local disposable `MaintainProDev` + Nest API on SQL (not company staging).  
**Tester:** automated agent (no business sign-off).

| Test ID | Role | Preconditions | Steps | Expected | Actual | Evidence | Tester | Date | Result | Defect |
|---------|------|---------------|-------|----------|--------|----------|--------|------|--------|--------|
| U-SQL-01 | ADMIN | Fixture user bcrypt-updated | Login `/api/auth/login` | JWT issued | Login successful | API response success | agent | 2026-09-15 | PASS | |
| U-SQL-02 | TECHNICIAN | Fixture tech user | Login | JWT issued | Login successful | API response success | agent | 2026-09-15 | PASS | |
| U-SQL-03 | ADMIN | Valid JWT + X-Tenant-Id | GET assets/requests/WOs/vehicles/PM/KPIs | 200 | `TENANT_ACCESS_DENIED` | error code TENANT_ACCESS_DENIED | agent | 2026-09-15 | FAIL | Tenant middleware rejects fixture tenant after SQL login |
| U-01…U-20 | Matrix roles | Staging seed + web | Full runbook scenarios | PASS | **NOT EXECUTED** | — | — | — | NOT EXECUTED | Gate 1 blocked |
| Responsive phone/tablet/desktop | — | Staging web | Emulation/device | PASS | **NOT EXECUTED** | — | — | — | NOT EXECUTED | |
| Human UAT sign-off | — | Critical journeys PASS | Signature | Obtained | **PENDING** | — | — | — | PENDING | Do not invent |

**Gate 1 overall:** FAIL — see `docs/V1_FINAL_VALIDATION_GATE_STATUS.md`.

---

## Related Docs

- `docs/V1_FINAL_VALIDATION_GATE_STATUS.md` — Gates 0–6 status for V1 completion
- `docs/UAT_CHECKLIST.md` — full checklist catalog (130+ items)
- `docs/uat/` — domain-specific UAT guides
- `docs/FINAL_UAT_AND_CUTOVER_CHECKLIST.md` — cutover checklist
- `docs/GO_LIVE_CHECKLIST.md` — go-live gates
- `docs/PRODUCTION_READINESS_REPORT.md` — readiness verdict
