# Pilot Support Process — MaintainPro

**UAT phase:** UAT-023  
**Document owner:** Operations Manager + IT Helpdesk  
**Last updated:** 2026-07-02  
**Hours:** Pilot business hours — **TBD** (extend for cutover weekend per [cutover-plan.md](cutover-plan.md))

---

## 1. Purpose

Define how pilot users report issues, how support triages and resolves them, and when to escalate to engineering or management. This process applies during the pilot period and the first **14 days** of production hypercare.

**Policy reminder:** *No system record = No official company action.* Support must not advise users to complete official work outside MaintainPro.

---

## 2. Support channels

| Channel | Use for | Response target |
|---------|---------|-----------------|
| **Floor super-user** | How-to, navigation, first-line triage | 15 minutes |
| **Teams / WhatsApp pilot channel** | Quick questions, screenshots | 30 minutes |
| **Email: TBD@company** | Formal tickets, audit trail | 4 business hours |
| **Phone: TBD** | P0 only during cutover window | Immediate |

Do **not** post passwords, JWT tokens, or connection strings in any channel.

---

## 3. Severity definitions (P0–P3)

### P0 — Critical (business stopped)

**Definition:** Production/pilot unusable for majority of users; data loss suspected; security breach; complete inability to create/complete work orders.

**Examples:**

- API returns 5xx for all authenticated requests
- Login impossible for all pilot users
- Database unavailable with no graceful message
- Suspected unauthorized access or credential leak
- Accidental mass delete or data corruption

**Response:** Immediate  
**Resolution target:** 2 hours (workaround) / 8 hours (fix or rollback)  
**Escalation:** DevOps on-call + Engineering lead + Operations Manager immediately

---

### P1 — High (major workflow blocked)

**Definition:** Core pilot workflow blocked for a role or site; no acceptable workaround.

**Examples:**

- Technicians cannot update WO status
- Store cannot issue approved parts
- Supervisor verification endpoint fails
- Finance cannot approve invoices
- Gate module blocks all exits incorrectly

**Response:** 30 minutes  
**Resolution target:** 4 business hours  
**Escalation:** L2 Admin → L3 Engineering if not resolved in 2 hours

---

### P2 — Medium (degraded or workaround exists)

**Definition:** Feature impaired; users can continue with manual workaround documented in ticket.

**Examples:**

- Slow page load (Render cold start)
- Report export fails but on-screen data correct
- Single user cannot log in (others OK)
- Evidence upload fails; can retry later
- Notification email delayed

**Response:** 4 business hours  
**Resolution target:** 2 business days  
**Escalation:** L2 Admin; Engineering next business day

---

### P3 — Low (cosmetic, training, enhancement)

**Definition:** UI cosmetic issue, documentation typo, feature request, training question.

**Examples:**

- Label wording unclear
- Request for additional report filter
- How to assign multiple technicians
- Mobile layout minor overlap

**Response:** 1 business day  
**Resolution target:** Next sprint / training refresh  
**Escalation:** Product backlog; no engineering escalation unless pattern emerges

---

## 4. Support tiers

| Tier | Role | Responsibilities |
|------|------|------------------|
| **L0** | End user | Submit ticket with role, route, screenshot, time, WO ID if applicable |
| **L1** | Floor super-user | Answer how-to; verify reproduction; filter P3 |
| **L2** | MaintainPro admin | User unlock, role check, tenant ID, clear cache, known-issue KB |
| **L3** | Engineering / DevOps | API logs, Render/Cloudflare, DB, deploy, rollback |
| **L4** | Vendor | Atlas, Render, Cloudflare support tickets |

---

## 5. Escalation matrix

| Condition | Escalate to | Action |
|-----------|-------------|--------|
| P0 declared | DevOps on-call + Ops Manager | War room; consider [rollback-plan.md](developer-protection/rollback-plan.md) |
| P1 open > 2 hours | Engineering lead | Assign developer |
| Same P2 issue ≥ 3 users in 24 h | Engineering lead | Treat as P1 |
| Security suspicion | Security / IT | Disable affected accounts; preserve logs |
| Data discrepancy (WO vs physical) | Maintenance Manager | Process issue — not L3 unless system bug |
| Override abuse pattern | Manager + Finance | Review fraud control report |
| Atlas / Render / Cloudflare outage | DevOps L4 | Vendor status page + support ticket |

**DevOps on-call:** Contact in secret manager (not in this document).

---

## 6. Ticket required information

Every L2+ ticket must include:

1. **Reporter name and role** (e.g. TECHNICIAN, INVENTORY_KEEPER)
2. **Date/time** (timezone: **TBD**)
3. **URL/route** (e.g. `/work-orders/abc123`)
4. **Work order / part request ID** if applicable
5. **Expected vs actual behaviour**
6. **Screenshot or screen recording** (no passwords in image)
7. **Severity** (P0–P3) — L1 proposes, L2 confirms
8. **Browser** (Chrome/Edge version)

Use [pilot-feedback-form.md](pilot-feedback-form.md) for structured weekly feedback; use incident log for P0/P1 per [developer-protection/incident-log-template.md](developer-protection/incident-log-template.md).

---

## 7. Known issues (link during pilot)

| Issue | Severity | Workaround |
|-------|----------|------------|
| Render cold start after idle | P2 | Wait 30 s; retry; warm ping before shift |
| Staging evidence storage disabled | P2 | Attach description in notes until storage enabled |
| FINANCE role mapping | P2 | Use user with `purchase_orders.approve_finance` permission |

Update this table weekly from support log.

---

## 8. Communication templates

### User acknowledgment (auto or L1)

> Your ticket **[ID]** has been received. Severity: **[P0–P3]**. We will respond within **[SLA]**. Do not perform official parts issues, completions, or payments outside MaintainPro while this issue is open.

### P0 all-pilot broadcast

> MaintainPro pilot: We are investigating **[brief issue]**. Please pause new work order completions until cleared. Existing data is safe. Updates every 30 minutes in **[channel]**.

---

## 9. Hypercare schedule

| Period | Coverage | Focus |
|--------|----------|-------|
| Cutover day | Extended hours + DevOps on-call | Smoke, P0/P1 |
| Days 1–3 | Business hours + admin on-call | Training gaps, config |
| Days 4–14 | Business hours | P1/P2, feedback |
| Day 15+ | Standard IT support | Steady state |

---

## 10. Metrics (weekly review)

| Metric | Target |
|--------|--------|
| P0 count | 0 |
| P1 mean time to resolve | &lt; 4 hours |
| Tickets per 100 users | Trending down week over week |
| Repeat tickets (same root cause) | &lt; 5% |
| User satisfaction (feedback form) | ≥ 3.5 / 5 |

---

## 11. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Operations Manager | | | |
| IT Helpdesk Lead | | | |
| MaintainPro Admin | | | |
