# Rollback Plan — MaintainPro Production

**Document owner:** DevOps on-call  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02  
**Target domain:** `maintenance.nelna.lk`

---

## Purpose

Define fast, ordered rollback actions when a production deployment causes unacceptable risk. Rollback prioritises **restore service** over **preserve new data** unless data loss risk is lower than continued outage.

---

## Rollback triggers

Initiate rollback if **any** of the following occur within **30 minutes** of cutover (or anytime post-cutover for critical defects):

| Severity | Trigger | Example |
|----------|---------|---------|
| **P0** | Auth-wide failure | All users receive 401/500 on login |
| **P0** | Cross-tenant data exposure | User A sees User B tenant records |
| **P0** | Critical RBAC bypass | Technician approves own part request in prod |
| **P0** | Data corruption | Widespread duplicate or null records after deploy |
| **P0** | Failed post-cutover smoke | `smoke:deploy` fails on production URLs |
| **P1** | Sustained 5xx >5 min | API error rate >10% |
| **P1** | Schema migration failure | `db:push` partially applied |
| **P1** | CORS/login broken on prod domain | Users cannot authenticate |

**Decision authority:** DevOps on-call may execute technical rollback immediately for P0. Product Owner confirms communication. Security leads on RBAC/data exposure incidents.

---

## Rollback layers (execute in order)

| Order | Layer | Action | Owner | Est. time | Notes |
|-------|-------|--------|-------|-----------|-------|
| 1 | **Web (Cloudflare Workers)** | Roll back to previous Workers deployment version in Cloudflare dashboard → Deployments → Rollback | DevOps | 5–15 min | Fastest user-visible fix |
| 2 | **API (Render)** | Render dashboard → Service → Deploys → Rollback to prior **live** commit | DevOps | 5–10 min + warm-up | Match web/API compatibility |
| 3 | **DNS** | Revert `maintenance.nelna.lk` CNAME/A to previous target (staging or last-known-good) | DevOps | TTL dependent (5–60 min) | Only if DNS change caused issue |
| 4 | **Environment variables** | Restore previous env group snapshot in Render/Cloudflare | DevOps | 5 min | If bad env caused failure |
| 5 | **Database** | Restore MongoDB Atlas snapshot (pre-cutover or pre-deploy) | DevOps + DBA | RTO per [backup-restore-plan.md](backup-restore-plan.md) | **Last resort** — data loss since snapshot |

---

## Detailed procedures

### A. Cloudflare Workers rollback

1. Log in to Cloudflare dashboard → Workers & Pages → MaintainPro project.
2. Open **Deployments** tab.
3. Select last known-good deployment (record version ID in ticket).
4. Click **Rollback to this deployment**.
5. Verify `https://maintenance.nelna.lk` loads and admin login works.
6. Confirm `NEXT_PUBLIC_API_URL` still points to correct API (rollback does not change env — verify separately).

### B. Render API rollback

1. Log in to Render dashboard → production API service.
2. Open **Events** / **Deploys**.
3. Select previous successful deploy (commit hash from change ticket).
4. Click **Rollback**.
5. Wait until status = **Live**.
6. Verify `GET https://<prod-api>/health` returns 200.
7. Run admin login + one authenticated API call.

### C. DNS rollback

1. Open DNS provider (Cloudflare DNS or registrar).
2. Restore previous CNAME/A record for `maintenance.nelna.lk`.
3. Wait for TTL propagation (document start/end time).
4. Verify resolution: `nslookup maintenance.nelna.lk`.

### D. Database rollback (Atlas snapshot restore)

**Use only when:** schema corruption or irreversible data defect; app rollback insufficient.

1. Identify snapshot ID from pre-cutover checklist.
2. Follow [backup-restore-plan.md](backup-restore-plan.md) — restore to **new** cluster or replace with Atlas point-in-time restore.
3. Update `PRIMARY_DATABASE_URL` in Render to restored cluster (secret manager).
4. Redeploy API.
5. Accept data loss window since snapshot — document in incident log.
6. Notify Product Owner and affected tenants.

---

## Post-rollback verification

| ☐ | Check | Pass criteria |
|---|-------|---------------|
| ☐ | `GET /health` | HTTP 200 |
| ☐ | Admin login on rolled-back URL | Success |
| ☐ | `npm run smoke:deploy` on rolled-back URLs | PASS |
| ☐ | No elevated 5xx in Render metrics | Stable 15 min |
| ☐ | User comms sent | Rollback announced |
| ☐ | Incident log filed | [incident-log-template.md](incident-log-template.md) |
| ☐ | Root cause ticket created | Engineering backlog |

---

## Rollback vs forward-fix decision matrix

| Situation | Recommended action |
|-----------|-------------------|
| UI-only regression | Workers rollback |
| API logic bug, compatible schema | Render rollback |
| Bad env var | Restore env snapshot + redeploy |
| Schema migration broke reads | DB restore + API rollback |
| Minor non-blocking defect | Forward-fix in next release |

---

## Contacts

| Role | Responsibility |
|------|----------------|
| DevOps on-call | Execute rollback steps 1–4 |
| DBA / DevOps | Atlas snapshot restore |
| QA Lead | Re-run smoke + spot UAT |
| Product Owner | User communication, go/no-go |
| Security | RBAC/data exposure incidents |

*(Replace with org directory before production cutover.)*

---

## Related documents

- [deployment-checklist.md](deployment-checklist.md)
- [backup-restore-plan.md](backup-restore-plan.md)
- [incident-response-sop.md](incident-response-sop.md)
- [PRODUCTION_CUTOVER_RUNBOOK.md](../../PRODUCTION_CUTOVER_RUNBOOK.md)
