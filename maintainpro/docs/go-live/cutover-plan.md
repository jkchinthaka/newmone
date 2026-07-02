# Cutover Plan — MaintainPro Production

**UAT phase:** UAT-023  
**Document owner:** DevOps + Release Manager  
**Last updated:** 2026-07-02  
**Cutover window:** **TBD** (recommend low-traffic weekend + 2 h rollback buffer)  
**Policy:** *No system record = No official company action.* Cutover weekend: freeze off-system official work except life-safety emergencies (document separately).

---

## 1. Prerequisites (before stage 1)

| ☐ | Item | Owner |
|---|------|-------|
| ☐ | [final-go-live-checklist.md](final-go-live-checklist.md) sections A–F complete | QA + DevOps |
| ☐ | [management-sign-off.md](management-sign-off.md) GO decision | Sponsor |
| ☐ | Rollback plan reviewed | DevOps |
| ☐ | War room channel and roster active | Ops Manager |
| ☐ | Atlas pre-cutover snapshot scheduled | DBA |

---

## 2. Cutover stages (10)

### Stage 1 — Change control & communication freeze

| Item | Detail |
|------|--------|
| **Owner** | Release Manager |
| **Duration** | T−48 h to T−24 h |
| **Actions** | Open change ticket; notify pilot users and IT; freeze non-emergency deploys to staging/production |
| **Verification** | Change ticket approved; comms sent |
| **Rollback** | N/A |

---

### Stage 2 — Production infrastructure verification

| Item | Detail |
|------|--------|
| **Owner** | DevOps |
| **Duration** | T−24 h |
| **Actions** | Verify Render production service, Cloudflare route, Atlas production cluster isolated; confirm env vars in secret manager (no staging URLs) |
| **Verification** | Checklist in [developer-protection/deployment-checklist.md](developer-protection/deployment-checklist.md) |
| **Rollback** | N/A |

---

### Stage 3 — Database snapshot & backup gate

| Item | Detail |
|------|--------|
| **Owner** | DBA |
| **Duration** | T−4 h |
| **Actions** | Manual Atlas snapshot; record snapshot ID in change ticket; run `db:backup:verify` if replication enabled |
| **Verification** | Snapshot status **Completed** in Atlas |
| **Rollback** | N/A — snapshot is safety net |

**Gate:** Do not proceed to stage 5 if snapshot fails.

---

### Stage 4 — Deploy API to Render (production)

| Item | Detail |
|------|--------|
| **Owner** | DevOps |
| **Duration** | T−2 h |
| **Actions** | Deploy approved release commit to Render production; run `npm run db:push` only if schema change approved; verify `/health` and `/health/readiness` |
| **Verification** | Health 200; readiness shows DB connected |
| **Rollback** | Redeploy previous Render image (see [rollback-plan.md](developer-protection/rollback-plan.md)) |

---

### Stage 5 — Deploy web to Cloudflare Workers

| Item | Detail |
|------|--------|
| **Owner** | DevOps |
| **Duration** | T−1 h |
| **Actions** | `npm run cloudflare:build` + deploy from approved commit; bind production API URL in env |
| **Verification** | Workers deployment active; login page loads |
| **Rollback** | Cloudflare deployment rollback to previous version |

**Gate:** Stages 4 and 5 must pass smoke before DNS cutover.

---

### Stage 6 — Pre-cutover smoke (production URLs, pre-DNS)

| Item | Detail |
|------|--------|
| **Owner** | QA + Admin |
| **Duration** | T−30 min |
| **Actions** | Login as MANAGER, TECHNICIAN, INVENTORY_KEEPER; hit `/work-orders`, `/action-center`, `/system-health`; create **test** WO tagged `CUTOVER-SMOKE` |
| **Verification** | All smokes PASS per [live-monitoring-plan.md](live-monitoring-plan.md) |
| **Rollback** | If FAIL — stop; rollback stages 4–5 |

---

### Stage 7 — DNS / traffic cutover

| Item | Detail |
|------|--------|
| **Owner** | DevOps |
| **Duration** | T0 (cutover start) |
| **Actions** | Update DNS (CNAME/A) to Cloudflare Workers production route; lower TTL pre-cutover if needed; disable or redirect old maintenance URL |
| **Verification** | `dig` / browser from external network resolves new target; SSL valid |
| **Rollback** | Revert DNS to previous target; TTL may delay full rollback 5–60 min |

---

### Stage 8 — Production data activation

| Item | Detail |
|------|--------|
| **Owner** | DBA + Admin |
| **Duration** | T0 + 15 min |
| **Actions** | Enable production tenant; disable staging test accounts on prod if any; verify `X-Tenant-Id` for pilot users; enable evidence storage if required |
| **Verification** | Pilot users login to production tenant only |
| **Rollback** | Disable prod tenant flag; revert to staging URL comms (emergency only) |

---

### Stage 9 — Business go-live & floor validation

| Item | Detail |
|------|--------|
| **Owner** | Maintenance Manager + Ops Manager |
| **Duration** | T0 + 30 min to T0 + 4 h |
| **Actions** | Announce go-live; supervisors monitor first real WO create → assign → complete → verify; store tests one part issue; security tests gate read |
| **Verification** | At least one full WO lifecycle on production; zero P0 |
| **Rollback** | Ops Manager calls rollback if P0 &gt; 30 min unresolved |

---

### Stage 10 — Hypercare handoff & retrospective schedule

| Item | Detail |
|------|--------|
| **Owner** | Product Owner + QA |
| **Duration** | T0 + 4 h to T+1 day |
| **Actions** | Start daily [live-monitoring-plan.md](live-monitoring-plan.md); log incidents; collect day-1 feedback; schedule day-7 retrospective |
| **Verification** | Monitoring log started; support roster confirmed |
| **Rollback** | N/A |

---

## 3. Rollback decision criteria

Invoke rollback if any of:

- Login failure for all users &gt; 15 min
- Data corruption suspected
- Sustained API 5xx &gt; 50% for 10 min
- Critical security issue (credential leak, tenant crossover)
- Sponsor / Ops Manager no-go call

**Authority:** DevOps executes rollback; Sponsor approves communication.

---

## 4. Communication plan

| When | Audience | Message |
|------|----------|---------|
| T−48 h | All pilot users | Cutover window and freeze |
| T−1 h | Floor supervisors | Stand by for go-live |
| T0 | All users | System live on new URL |
| T0 + issue | All users | Status updates every 30 min (P0) |
| T+1 day | Management | Cutover summary |

---

## 5. RACI (cutover)

| Activity | DevOps | DBA | QA | Ops Mgr | Maint Mgr | Sponsor |
|----------|--------|-----|-----|---------|-----------|---------|
| Stages 1–3 | A | R | C | C | I | I |
| Stages 4–5 | R/A | C | C | I | I | I |
| Stage 6 | C | I | R | C | C | I |
| Stage 7 | R/A | I | C | C | I | C |
| Stages 8–9 | C | R | C | R | R | I |
| Stage 10 | C | I | R | A | C | C |

R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 6. Post-cutover verification matrix

| Check | Route / API | Expected |
|-------|-------------|----------|
| Health | `/health` | 200 |
| Login | `/login` | Success |
| WO list | `/work-orders` | Data loads |
| Action center | `/action-center` | Role widgets |
| Fraud report | `/reports/fraud-control` | Manager access |
| System health | `/system-health` | Admin green |

---

## 7. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps / Release Manager | | | |
| DBA | | | |
| QA Lead | | | |
| Operations Manager | | | |
| Product Owner | | | |

**Cutover completed:** ☐ Yes · ☐ Rolled back  
**Completion date/time:** _______________
