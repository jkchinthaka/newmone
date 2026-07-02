# Incident Response SOP — MaintainPro Production

**Document owner:** DevOps + Security  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02

Standard operating procedure for production incidents affecting MaintainPro (`maintenance.nelna.lk` and associated API).

---

## Severity definitions

| Level | Definition | Examples | Response target |
|-------|------------|----------|-----------------|
| **P0 — Critical** | Full outage, data breach, or critical security failure | All users cannot login; cross-tenant data visible; prod DB down | **15 min** acknowledge · **30 min** mitigate or rollback |
| **P1 — High** | Major feature broken for many users | WO creation fails; gate entirely broken; sustained 5xx | **30 min** acknowledge · **2 hr** mitigate |
| **P2 — Medium** | Limited degradation | Single module error; non-critical report failure | **4 hr** acknowledge · next business day fix |
| **P3 — Low** | Cosmetic / minor | UI glitch; non-blocking export issue | Backlog |

---

## Roles

| Role | Responsibility |
|------|----------------|
| **Incident commander (IC)** | Owns timeline, decisions, comms cadence |
| **DevOps on-call** | Render, Cloudflare, Atlas, env vars, rollback execution |
| **Backend on-call** | API defects, RBAC, data integrity |
| **Frontend on-call** | Web Workers, client errors |
| **QA** | Smoke re-run, UAT spot checks |
| **Security** | Auth breaches, RBAC bypass, credential rotation |
| **Product Owner** | User comms approval, business impact |
| **Communications lead** | Status updates to stakeholders |

---

## Response workflow

```
Detect → Triage → Assign IC → Investigate → Mitigate → Verify → Communicate → Close → Post-mortem
```

### 1. Detect

Sources:
- Render / Cloudflare / Atlas alerts
- `npm run smoke:deploy` failure (scheduled or manual)
- User reports via support channel
- `/health` or deployment-readiness degradation

**Immediate action:** Log incident using [incident-log-template.md](incident-log-template.md).

### 2. Triage (≤15 min for P0)

| Check | Command / action |
|-------|------------------|
| API health | `GET /health` (public) |
| Readiness | Admin `GET /api/health/deployment-readiness` |
| Recent deploy | Render + Cloudflare deploy history |
| DB status | Atlas cluster alerts; `db:backup:verify` |
| Error logs | Render logs (last 30 min) |

Assign severity per table above. Page additional roles for P0/P1.

### 3. Investigate

| Symptom | Likely cause | First checks |
|---------|--------------|--------------|
| 401 all users | JWT secret rotation mismatch, clock skew | Compare Render env `JWT_*` with deploy time |
| 500 all API | DB connection, bad deploy | Atlas status; rollback API |
| CORS errors | `CORS_ORIGIN` / `FRONTEND_URL` mismatch | Env vs actual web origin |
| RBAC bypass report | Controller missing guard | Check [backend-rbac-audit.md](../backend-rbac-audit.md); hotfix or rollback |
| Slow WO queues | DB timeout, missing index | Render metrics; queue summary endpoint latency |
| Data missing | Bad migration, wrong cluster | Confirm `PRIMARY_DATABASE_URL` cluster; snapshot restore |

**Do not** paste credentials in Slack/tickets. Use secret manager references only.

### 4. Mitigate

Choose fastest safe action:

| Option | When |
|--------|------|
| **Workers rollback** | Web/UI regression |
| **Render rollback** | API regression, compatible schema |
| **Env var restore** | Misconfigured cutover |
| **Scale to zero + maintenance page** | Active data corruption — stop writes |
| **Atlas PITR restore** | Irreversible DB corruption — see [backup-restore-plan.md](backup-restore-plan.md) |
| **Disable feature flag** | `system.featureToggles` via admin settings |
| **Rotate JWT secrets** | Suspected token compromise — forces re-login |

Follow [rollback-plan.md](rollback-plan.md) for ordered steps.

### 5. Verify

```bash
npm run smoke:deploy   # production URLs from secret manager
```

Manual checks:
- Admin login
- Manager WO list
- Security gate page
- Store keeper inventory
- Audit log write on test action (non-prod tenant if available)

### 6. Communicate

| Audience | P0 cadence | Content |
|----------|------------|---------|
| Internal stakeholders | Every 30 min until mitigated | Status, impact, ETA |
| End users | Within 60 min of P0 | Plain language; no technical jargon |
| Post-resolution | Within 24 hr | Summary + next steps |

Templates:
- **Investigating:** "We are investigating reports of [issue]. MaintainPro may be unavailable for [scope]. Updates every 30 minutes."
- **Mitigated:** "Service has been restored. Root cause under investigation."
- **Resolved:** "Incident resolved. [Brief cause]. No action required from users." *(or required actions)*

### 7. Close

- Complete incident log
- Link action items to engineering backlog
- P0/P1: schedule post-mortem within 5 business days (blameless)

---

## Security incidents

If **cross-tenant data**, **credential leak**, or **RBAC bypass** suspected:

1. Page Security immediately.
2. Preserve logs (Render, Atlas audit, application `AuditLog`).
3. Consider JWT secret rotation + forced logout (`POST /auth/logout-all` for affected users if supported).
4. Do **not** delete evidence.
5. Document in incident log; legal/compliance notification per org policy.

---

## Fraud / override spikes

If Reports → Fraud & Control shows abnormal override volume:

1. Export admin overrides CSV (admin role).
2. Notify Operations Manager + Finance.
3. Review [anti-fraud-policy.md](../anti-fraud-policy.md).
4. Not necessarily a P0 unless combined with data integrity issue.

---

## Escalation matrix

| Condition | Escalate to |
|-----------|-------------|
| P0 not mitigated in 30 min | DevOps lead + Product Owner |
| Data loss suspected | DBA + Product Owner + Security |
| Security breach confirmed | Security lead + executive per org policy |
| Vendor outage (Atlas, Render, Cloudflare) | Vendor support + status page |

---

## Post-mortem template (P0/P1)

1. **Summary** — what happened
2. **Impact** — users, duration, data
3. **Root cause** — technical + process
4. **What went well**
5. **What went poorly**
6. **Action items** — owner + due date
7. **Lessons learned**

---

## Related documents

- [incident-log-template.md](incident-log-template.md)
- [rollback-plan.md](rollback-plan.md)
- [backup-restore-plan.md](backup-restore-plan.md)
- [PILOT_ROLLOUT_PLAN.md](../../PILOT_ROLLOUT_PLAN.md)
- [responsibility-matrix.md](responsibility-matrix.md)
