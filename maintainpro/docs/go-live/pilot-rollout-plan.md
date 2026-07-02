# Pilot Rollout Plan — MaintainPro

**UAT phase:** UAT-023  
**Document owner:** Product Owner + Operations Manager  
**Last updated:** 2026-07-02  
**Policy anchor:** *No system record = No official company action.*

---

## 1. Executive summary

This plan defines a controlled pilot rollout of MaintainPro for the **Maintenance Department** and supporting functions (Store, Supervisor, Manager) before company-wide production cutover. The pilot validates real-world workflows on the certified staging stack (Render API + Cloudflare web + MongoDB Atlas) with a limited user cohort, defined success criteria, and documented support escalation.

**Staging reference (pilot rehearsal):**

| Layer | URL |
|-------|-----|
| Web | `https://newmone.chinthakajayaweera1.workers.dev` |
| API | `https://newmone.onrender.com/api` |
| Health | `https://newmone.onrender.com/health` |

Credentials and tenant IDs are stored in the company secret manager only — never in this document or git.

---

## 2. Pilot scope

### 2.1 In scope (pilot departments)

| Department / function | Primary roles | Core modules |
|----------------------|---------------|--------------|
| **Maintenance operations** | `MANAGER`, `TECHNICIAN`, `SUPERVISOR` | Work orders, assignment, completion, supervisor verification, action center |
| **Store / inventory** | `INVENTORY_KEEPER` | Part requests, issue/return, stock movements, operational PO approval |
| **Supervision** | `SUPERVISOR` | Supervisor verification queue, high-risk queue, cleaning sign-off (if applicable) |
| **Management oversight** | `MANAGER` | Dashboard, reports, fraud control, management intelligence, gate override approval |
| **Finance (limited)** | Users with `purchase_orders.approve_finance` | Finance invoice approval on vendor repairs and POs |
| **Security (limited)** | `SECURITY_OFFICER` | Gate in/out, vehicle block visibility |
| **Platform admin** | `ADMIN`, `SUPER_ADMIN` | User provisioning, system health, incident response |

### 2.2 Out of scope (pilot phase)

- Farm module full rollout
- Full fleet geofence / live map operations
- ERP sync to production ERP (mock or disabled unless explicitly enabled)
- Mobile app (Flutter) — web pilot only unless separately scheduled
- Company-wide HR/payroll integration
- Production DNS cutover (`maintenance.nelna.lk` or equivalent) — see [cutover-plan.md](cutover-plan.md)

### 2.3 Pilot routes (must be exercised)

| Route | Purpose |
|-------|---------|
| `/work-orders` | Create, assign, complete, verify work orders |
| `/action-center` | Role-based queues and morning briefing |
| `/reports/management-intelligence` | Profitability and operational KPIs |
| `/reports/fraud-control` | Maker-checker violations, overrides, control metrics |
| `/system-health` | Deployment readiness and API health (admin only) |

---

## 3. Pilot cohort

| Role | Target headcount | Selection criteria |
|------|------------------|-------------------|
| Maintenance Manager | 1–2 | Owns pilot sign-off and daily stand-up |
| Supervisor | 2–4 | Covers building/zone verification workload |
| Technician | 8–15 | Mix of senior and junior; includes at least one vendor-repair case |
| Store Keeper | 2–3 | Primary and backup during shift overlap |
| Finance approver | 1 | Holds `purchase_orders.approve_finance` |
| Security Officer | 1–2 | Gate restriction test cases |
| Admin | 1 | User support and override governance |
| **Total** | **~20–30 users** | |

All pilot users receive role-appropriate training per [training/](training/) before go-live day 1.

---

## 4. Timeline (placeholders — confirm with management)

| Milestone | Target date | Owner | Status |
|-----------|-------------|-------|--------|
| UAT-017 through UAT-022 sign-off complete | **TBD** | QA Lead | Completed (UAT-022 in progress) |
| Training materials published | **TBD** | Product + Ops | In progress (UAT-023) |
| Pilot user accounts provisioned | **TBD** | Admin | Not started |
| Pilot kick-off briefing | **TBD** | Operations Manager | Not started |
| Pilot week 1 (core WO lifecycle) | **TBD** | Maintenance Manager | Not started |
| Pilot week 2 (parts + vendor + finance) | **TBD** | Maintenance Manager | Not started |
| Pilot week 3 (reports + exceptions) | **TBD** | Maintenance Manager | Not started |
| Pilot retrospective + go/no-go | **TBD** | Product Owner | Not started |
| Production cutover | **TBD** | DevOps | Not started |

---

## 5. Success criteria

Pilot is considered **successful** when all criteria below are met for **two consecutive business weeks**:

### 5.1 Operational

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | ≥ 95% of maintenance jobs created in MaintainPro (not off-system) | Manager weekly audit sample (n ≥ 30 WOs) |
| 2 | Zero unapproved parts issues without documented emergency override | Fraud control report + store audit |
| 3 | ≥ 90% technician completions include required evidence on first submission | WO governance metrics |
| 4 | Supervisor verification within 24 hours for standard priority WOs | Queue aging in action center |
| 5 | Finance approvals only on supervisor-verified WOs with attachments | Finance spot-check (n ≥ 10) |

### 5.2 Technical

| # | Criterion | Measurement |
|---|-----------|-------------|
| 6 | API availability ≥ 99% during business hours | [live-monitoring-plan.md](live-monitoring-plan.md) |
| 7 | P0 incidents resolved within SLA (see [pilot-support-process.md](pilot-support-process.md)) | Incident log |
| 8 | No open P0/P1 defects blocking core WO lifecycle | Defect tracker |
| 9 | RBAC spot-check: no unauthorized page/API access for pilot roles | [security-review-report.md](security-review-report.md) |

### 5.3 People & process

| # | Criterion | Measurement |
|---|-----------|-------------|
| 10 | ≥ 80% pilot users complete role training sign-off | Training attendance sheet |
| 11 | ≤ 5% repeat support tickets for same issue (same user, same topic) | Support log |
| 12 | Management sign-off on [management-sign-off.md](management-sign-off.md) | Signed document |

---

## 6. Governance during pilot

1. **Single source of truth:** All official maintenance actions (WO create, assign, complete, verify, parts issue, vendor repair, finance approval) must exist as system records.
2. **Maker-checker:** Requester cannot approve the same transaction (enforced by API per [anti-fraud-policy.md](anti-fraud-policy.md)).
3. **Overrides:** All overrides require reason (≥ 3 characters) and appear in fraud control reports.
4. **Change freeze:** No production deploys during pilot week 1 except P0 hotfixes (see [developer-protection/change-request-process.md](developer-protection/change-request-process.md)).
5. **Feedback loop:** All users submit [pilot-feedback-form.md](pilot-feedback-form.md) weekly.

---

## 7. Support model

| Channel | Hours | Contact |
|---------|-------|---------|
| **L1 — Floor support** | Pilot business hours | Designated super-user per role (names in kick-off pack) |
| **L2 — MaintainPro admin** | Pilot business hours | Admin on-call (secret manager) |
| **L3 — Engineering / DevOps** | P0/P1 only | See [pilot-support-process.md](pilot-support-process.md) |

Support desk location: **TBD** (maintenance office / Teams channel).

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users revert to paper/WhatsApp workflows | Audit gap, fraud exposure | Manager daily compliance check; policy reinforcement |
| Staging data not representative | False confidence | Seed realistic WO volume before pilot; manager creates live-like jobs |
| Render cold start latency | Perceived slowness | Document expected warm-up; use smoke tests before shift start |
| Evidence storage disabled on staging | Cannot test photo upload end-to-end | Enable Cloudinary/MinIO before pilot week 2 or document waiver |
| Finance role mapping (`FINANCE_APPROVER` vs permission) | Wrong approver access | Assign `purchase_orders.approve_finance` explicitly; verify in security review |

---

## 9. Deliverables (UAT-023)

| Artifact | Path |
|----------|------|
| Pilot rollout plan | This document |
| Performance test report | [performance-test-report.md](performance-test-report.md) |
| Backup/restore test report | [backup-restore-test-report.md](backup-restore-test-report.md) |
| Security review report | [security-review-report.md](security-review-report.md) |
| Management sign-off | [management-sign-off.md](management-sign-off.md) |
| Final go-live checklist | [final-go-live-checklist.md](final-go-live-checklist.md) |
| Pilot support process | [pilot-support-process.md](pilot-support-process.md) |
| Pilot feedback form | [pilot-feedback-form.md](pilot-feedback-form.md) |
| Live monitoring plan | [live-monitoring-plan.md](live-monitoring-plan.md) |
| Cutover plan | [cutover-plan.md](cutover-plan.md) |
| Role training packs | [training/](training/) |
| Standard operating procedures | [sop/](sop/) |

---

## 10. Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Operations Manager | | | |
| Maintenance Manager | | | |
| IT / DevOps Lead | | | |
| QA Lead | | | |
