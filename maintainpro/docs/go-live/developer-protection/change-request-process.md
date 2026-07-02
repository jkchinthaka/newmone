# Change Request Process — MaintainPro Production

**Document owner:** Product + DevOps  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02

Governance for changes to production MaintainPro (application, infrastructure, database, DNS).

---

## Change categories

| Type | Definition | Approval required | Example |
|------|------------|-------------------|---------|
| **Standard** | Pre-approved, low risk, documented procedure | DevOps | Weekly dependency patch (non-breaking) |
| **Normal** | Planned release or config change | Product + DevOps + QA | UAT-certified release deploy |
| **Emergency** | Fix active P0/P1 incident | IC + DevOps (retroactive PO sign-off within 24h) | Hotfix rollback, JWT rotation |

---

## Change request (CR) fields

| Field | Required | Notes |
|-------|----------|-------|
| CR ID | Yes | `CR-YYYY-MM-DD-###` |
| Title | Yes | Short description |
| Type | Yes | Standard / Normal / Emergency |
| Requestor | Yes | |
| Business justification | Yes | Why now |
| Risk level | Yes | Low / Medium / High |
| Affected systems | Yes | API, Web, Atlas, DNS, integrations |
| Release commit | Yes (Normal) | Git SHA |
| UAT evidence | Yes (Normal) | `uat:0XX:validate` output or ticket link |
| Rollback plan | Yes | Link to [rollback-plan.md](rollback-plan.md) |
| Backup snapshot ID | Yes (DB changes) | Atlas snapshot — ticket only |
| Maintenance window | Yes (Normal) | Start/end UTC |
| Approvers | Yes | See below |

---

## Approval matrix

| Change type | Approvers | Minimum |
|-------------|-----------|---------|
| Standard | DevOps | 1 |
| Normal — application | Product Owner, DevOps, QA Lead | 3 |
| Normal — database schema | Product Owner, DevOps, Backend Lead | 3 |
| Normal — DNS / domain | Product Owner, DevOps, Security | 3 |
| Emergency | Incident commander + DevOps | 2 (retroactive PO within 24h) |

**No-go:** Any open P0 defect in release scope; failed `uat:021:validate` on release commit.

---

## Workflow

### 1. Request

1. Requestor creates CR in ticket system.
2. Attach: release notes draft, UAT index entry, known limitations review.
3. Link related engineering tickets / PRs.

### 2. Review (Normal changes — minimum 24h before window)

| Reviewer | Checks |
|----------|--------|
| **QA** | UAT validation PASS; regression scope documented |
| **Backend** | RBAC audit reviewed; schema migration plan |
| **DevOps** | Env checklist; backup snapshot scheduled |
| **Security** | No secrets in CR; permission changes reviewed |
| **Product** | Business readiness; comms plan |

### 3. Implement

Follow [deployment-checklist.md](deployment-checklist.md):

1. Pre-deploy checks
2. Cutover window execution
3. Post-deploy smoke
4. Go/no-go or rollback

### 4. Close

| ☐ | Task |
|---|------|
| ☐ | Post-deploy smoke PASS recorded |
| ☐ | CR updated with actual deploy time + commit |
| ☐ | [release-notes-template.md](release-notes-template.md) published (if user-facing) |
| ☐ | [uat-sign-off-template.md](uat-sign-off-template.md) updated (if UAT phase close) |
| ☐ | Known limitations register updated if new gaps found |
| ☐ | Emergency CR: post-mortem linked within 5 days |

---

## Freeze periods

| Period | Policy |
|--------|--------|
| Month-end close (if finance uses system) | No Normal CR without Finance approval |
| Public holidays | Emergency only unless pre-approved |
| Active P0 incident | Freeze Normal CR until mitigated |

---

## Database change rules

1. **Always** take Atlas snapshot before `db:push` on production.
2. Prefer backward-compatible schema (additive fields, optional relations).
3. Destructive changes require: dry-run on staging, rollback plan, DBA review.
4. Never run `npm run db:seed` on production.

---

## Configuration change rules

1. Env var changes via Render/Cloudflare secret manager — not git.
2. New env vars must be added to `apps/api/src/config/env.validation.ts` before deploy.
3. Integration mode changes (`EMAIL_MODE`, `STORAGE_MODE`, etc.) must match readiness policy — no silent mock in production.

---

## Related documents

- [deployment-checklist.md](deployment-checklist.md)
- [change-request-process.md](change-request-process.md) *(this document)*
- [uat-index.md](../uat-index.md)
- [PRODUCTION_GO_LIVE_DECISION_PACK.md](../../PRODUCTION_GO_LIVE_DECISION_PACK.md)
- [responsibility-matrix.md](responsibility-matrix.md)
