# Final Go-Live Checklist — MaintainPro

**UAT phase:** UAT-023  
**Document owner:** DevOps + QA Lead  
**Last updated:** 2026-07-02  
**Use:** Complete all sections before production cutover. Pilot may start when sections A–C and F are complete; sections D–E required for full production.

**Verdict options per section:** ✅ Complete · ⚠️ Complete with waiver · ❌ Incomplete

---

## Section A — Program & governance

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | UAT-017 through UAT-021 signed off | QA | | |
| ☐ | UAT-022 security pack complete | Security | | |
| ☐ | [pilot-rollout-plan.md](pilot-rollout-plan.md) approved | Product Owner | | |
| ☐ | [management-sign-off.md](management-sign-off.md) signed | Sponsor | | |
| ☐ | Anti-fraud policy communicated to pilot users | Ops Manager | | |
| ☐ | Change freeze window communicated | DevOps | | |
| ☐ | Rollback plan reviewed with on-call | DevOps | | |

**Section A verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section B — Technical deployment

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | Production Render service provisioned (isolated from staging) | DevOps | | |
| ☐ | Cloudflare Workers production route / custom domain | DevOps | | |
| ☐ | Production MongoDB Atlas cluster (not staging) | DBA | | |
| ☐ | `npm run build` PASS on release commit | Engineering | | |
| ☐ | `npm run uat:021:validate` PASS | QA | | |
| ☐ | `npm run smoke:deploy` PASS against target env | QA | | |
| ☐ | `/health` and `/health/readiness` return 200 | DevOps | | |
| ☐ | `/system-health` shows deployment-readiness green | Admin | | |
| ☐ | CORS and `FRONTEND_URL` match production web URL | DevOps | | |
| ☐ | Redis configured (or graceful degradation verified) | DevOps | | |
| ☐ | Evidence storage enabled (Cloudinary/MinIO) if required | DevOps | | |

**Section B verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section C — Security & access

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | Production JWT secrets unique (not staging) | Security | | |
| ☐ | [security-review-report.md](security-review-report.md) approved | Security | | |
| ☐ | Pilot/production users provisioned with correct roles | Admin | | |
| ☐ | No `SUPER_ADMIN` assigned to floor staff | Admin | | |
| ☐ | Finance users have `purchase_orders.approve_finance` only as needed | Admin | | |
| ☐ | `security-rbac-audit.spec.ts` PASS | QA | | |
| ☐ | Staging seed accounts removed from production DB | DBA | | |
| ☐ | Secrets not in git or documentation | Security | | |

**Section C verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section D — Data & backup

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | Atlas automated backup enabled on production | DBA | | |
| ☐ | Pre-cutover manual snapshot taken (ID in ticket) | DBA | | |
| ☐ | Restore drill completed per [backup-restore-test-report.md](backup-restore-test-report.md) | DBA | | |
| ☐ | `db:backup:verify` PASS post-cutover | DevOps | | |
| ☐ | Production data migration / seed plan executed (if any) | DBA | | |
| ☐ | Object storage backup policy for evidence files | DevOps | | |
| ☐ | Audit retention policy configured | Admin | | |

**Section D verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section E — Performance & capacity

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | [performance-test-report.md](performance-test-report.md) smoke PASS | QA | | |
| ☐ | WO list / queue endpoints PASS at smoke scale | QA | | |
| ☐ | 1000+ WO load test (if required) | QA | ☐ N/A for pilot | |
| ☐ | Render tier adequate for pilot headcount | DevOps | | |
| ☐ | Cold start mitigation documented | DevOps | | |
| ☐ | Rate limits / WAF rules on Cloudflare (if applicable) | DevOps | | |

**Section E verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section F — People, training & SOPs

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | All [training/](training/) packs distributed | Training | | |
| ☐ | All [sop/](sop/) documents published | Ops Manager | | |
| ☐ | ≥ 80% role holders completed training sign-off | Training | | |
| ☐ | [pilot-support-process.md](pilot-support-process.md) active | Ops Manager | | |
| ☐ | Super-users identified per department | Ops Manager | | |
| ☐ | [pilot-feedback-form.md](pilot-feedback-form.md) distributed | QA | | |
| ☐ | Kick-off briefing completed | Maintenance Manager | | |

**Section F verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section G — Cutover execution

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | [cutover-plan.md](cutover-plan.md) stages 1–10 executed | DevOps | | |
| ☐ | DNS / domain cutover verified | DevOps | | |
| ☐ | Post-cutover smoke: login, WO list, action center | QA | | |
| ☐ | Post-cutover smoke: parts issue test case | Store | | |
| ☐ | Post-cutover smoke: supervisor verification | Supervisor | | |
| ☐ | War room / comms channel active during cutover | Ops Manager | | |
| ☐ | Rollback criteria documented and understood | DevOps | | |

**Section G verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Section H — Post go-live monitoring

| ☐ | Item | Owner | Verdict | Notes |
|---|------|-------|---------|-------|
| ☐ | [live-monitoring-plan.md](live-monitoring-plan.md) day-1 checklist started | DevOps | | |
| ☐ | Incident log template ready | DevOps | | |
| ☐ | Day-1 support roster staffed | Ops Manager | | |
| ☐ | Fraud control report reviewed (day 1) | Manager | | |
| ☐ | Pilot feedback collected (week 1) | QA | | |
| ☐ | Day-7 retrospective scheduled | Product Owner | | |
| ☐ | Hypercare period end date set | Ops Manager | | |

**Section H verdict:** ☐ ✅ · ☐ ⚠️ · ☐ ❌

---

## Overall checklist verdict

| Criterion | Required for |
|-----------|--------------|
| Sections A, C, F all ✅ or ⚠️ with waiver | **Pilot start** |
| Sections A–H all ✅ or ⚠️ with signed waiver | **Full production** |
| Any section ❌ with no waiver | **NO-GO** |

| Overall decision | Select one |
|------------------|------------|
| ☐ **GO — Pilot** |
| ☐ **GO — Production** |
| ☐ **GO WITH CONDITIONS** (list below) |
| ☐ **NO-GO** |

### Conditions / waivers

| Section | Waiver reason | Approved by | Date |
|---------|---------------|-------------|------|
| | | | |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| DevOps Lead | | | |
| Operations Manager | | | |
| Product Owner | | | |
