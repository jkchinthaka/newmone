# Pilot Rollout Plan

**Companion to:** [PRODUCTION_GO_LIVE_DECISION_PACK.md](PRODUCTION_GO_LIVE_DECISION_PACK.md)  
**Pilot environment (today):** Staging — `https://newmone.chinthakajayaweera1.workers.dev`  
**Production pilot (after cutover):** `https://maintenance.nelna.lk` — **not live until operator checklist complete**

Replace placeholder contacts with your organization directory before go-live.

---

## 1. Pilot scope

### Pilot department (recommended)

| Field | Value |
|-------|-------|
| **Primary department** | Operations / Maintenance (single-site pilot) |
| **Secondary (optional)** | Inventory / Store (read-only + issue flows) |
| **Out of scope (phase 1)** | ERP live sync, mobile offline, fleet telematics, finance BI |

**Rationale:** Maintenance workflows (work orders, assets, PM, inventory issue) are the most UAT-tested paths on staging. Expanding to all branches before prod smoke is **not recommended**.

### Pilot users (template — fill before kickoff)

| Role | Count | Purpose | Staging reference persona |
|------|-------|---------|---------------------------|
| Admin | 1 | Tenant config, system health, users | Replace `admin@maintainpro.local` |
| Manager | 1–2 | WO approve, assign, reports | Replace `manager@maintainpro.local` |
| Technician | 2–4 | Execute assigned jobs | Replace `tech@maintainpro.local` |
| Inventory keeper | 1 | Stock view, part issue | Replace `inventory@maintainpro.local` |
| Security officer | 1 | Gate UI (`/fleet/gate`) | Replace `security@maintainpro.local` |
| Viewer | 1 | Read-only dashboard | Optional |

**Production rule:** Create real users via invitation flow — **do not** copy staging passwords to production.

---

## 2. Training plan

### Session 1 — Managers & admins (90 min)

| Topic | Content |
|-------|---------|
| Login & tenant context | URL, password policy, session expiry |
| Dashboard & KPIs | Live vs roadmap labels on KPI cards |
| Work orders | Create, assign, approve/reject (role-dependent) |
| Reports | Server export from reports hub |
| System health | Provider diagnostics — what ENABLED/DISABLED means |

### Session 2 — Technicians (60 min)

| Topic | Content |
|-------|---------|
| My jobs | Assigned work orders only |
| Status updates | Start, complete, notes |
| Parts | Request/issue where permitted |
| Evidence | Upload only if storage ENABLED on prod |

### Session 3 — Security & inventory (45 min each)

| Audience | Content |
|----------|---------|
| Security officer | `/fleet/gate` — vehicle in/out; no WO access |
| Inventory keeper | Stock levels, reservations, ERP panel (read-only if ERP not live) |

### Materials

- README role table + [UAT_CHECKLIST.md](UAT_CHECKLIST.md) persona matrix
- Staging walkthrough recording (optional — capture after UAT-002/003)
- One-page quick reference PDF (operator-owned)

---

## 3. Support contact

| Role | Contact (fill in) | Hours |
|------|-------------------|-------|
| Primary support | _________________ | Business hours + cutover window |
| DevOps on-call | _________________ | Cutover T+0 to T+24h |
| QA liaison | _________________ | Business hours |
| Product Owner | _________________ | Escalation / scope decisions |

**Support channel:** Teams / WhatsApp group / ticket queue — **define one channel** for pilot users.

---

## 4. Issue escalation process

| Severity | Definition | Response target | Escalate to |
|----------|------------|-----------------|-------------|
| **P0** | System down, auth broken, data loss, RBAC bypass | 15 min acknowledge; 1h mitigation | DevOps on-call + Product Owner |
| **P1** | Core flow blocked (cannot complete WO, login flakiness) | 4h acknowledge; same-day workaround | DevOps + QA |
| **P2** | Non-blocking defect, UI glitch, export format issue | Next business day | QA backlog |
| **P3** | Enhancement, training question | Backlog | Product Owner |

**Ticket template fields:** User role · URL · Steps · Screenshot · Time · Tenant ID (if known)

---

## 5. Success criteria (pilot complete)

Pilot may expand to additional departments when **all** criteria met for **14 consecutive days**:

| # | Criterion | Measure |
|---|-----------|---------|
| S1 | Core login and navigation | ≥95% pilot users logged in successfully |
| S2 | Work order lifecycle | ≥10 WOs created → assigned → completed without P0 |
| S3 | Manager approval path | Approve/reject exercised if in scope |
| S4 | Audit trail | Sample WO mutations visible in audit log |
| S5 | Reports | At least one successful CSV export per manager |
| S6 | Provider honesty | System health indicators match configured integrations |
| S7 | Support load | No open P0; ≤2 open P1 |
| S8 | Stakeholder sign-off | Operations manager written acceptance |

---

## 6. Rollback criteria (pilot or post-cutover)

Initiate rollback per [PRODUCTION_CUTOVER_RUNBOOK.md](PRODUCTION_CUTOVER_RUNBOOK.md) if **any**:

| Trigger | Action |
|---------|--------|
| Widespread login failure after cutover | Roll back API/web deploy; verify CORS/JWT |
| Confirmed cross-tenant data visible | **Immediate** rollback + security incident |
| Critical WO data corruption | Stop writes; restore DB snapshot |
| Required integration falsely showing ENABLED | Disable mode; set to `disabled`; comms to users |
| Post-cutover smoke fails twice in 30 min | Roll back to staging URLs until fixed |

**Pilot on staging only:** Rollback = pause onboarding; no DNS action required.

---

## 7. Timeline (suggested)

| Week | Activity |
|------|----------|
| W0 | UAT-006 pack approved; operator checklist assigned |
| W1 | Prod infra provisioned (DB, Render, Cloudflare) — no DNS yet |
| W2 | DNS cutover in maintenance window; post-cutover smoke |
| W2–W3 | Training sessions; hypercare support |
| W4 | Pilot success review; go/no-go for wider rollout |

---

## 8. Honest limitations during pilot

- Access JWT in `localStorage` (CSP mitigates XSS; cookie-only access on roadmap)
- Mobile app not pilot-certified for offline mutations
- Some KPI cards show roadmap labels — see [KPI_SOURCE_MATRIX.md](KPI_SOURCE_MATRIX.md)
- WO list CSV export not shipped; use reports module export
- ERP sync may remain mock/disabled until vendor UAT signed

These do **not** block a **scoped** pilot if communicated in training.
