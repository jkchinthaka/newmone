# UAT Sign-Off Template — MaintainPro

**Document owner:** QA Lead  
**UAT phase:** *(e.g. UAT-022)*  
**Environment:** Staging / Production pilot / Production

---

## Release identification

| Field | Value |
|-------|-------|
| **UAT ID** | UAT-0XX |
| **Phase name** | |
| **Release commit** | `git SHA` |
| **API deploy** | Render deploy ID / date |
| **Web deploy** | Cloudflare Workers version / date |
| **Validation command** | `npm run uat:0XX:validate` |
| **Test date range** | YYYY-MM-DD to YYYY-MM-DD |

---

## Scope

### In scope

- 
- 

### Out of scope

- 
- 

---

## Test summary

| Category | Result | Evidence |
|----------|--------|----------|
| Automated validation (`uat:0XX:validate`) | PASS / FAIL / PARTIAL | *(log link)* |
| Unit / integration tests | PASS / FAIL | `npm run test` |
| Typecheck / lint / build | PASS / FAIL | CI or local |
| Hosted smoke (`smoke:deploy`) | PASS / FAIL | |
| Manual exploratory | PASS / FAIL / N/A | |
| RBAC spot check | PASS / FAIL | [permission-matrix.md](../permission-matrix.md) |
| Security regression | PASS / FAIL | `security-rbac-audit.spec.ts` |

---

## Defects & waivers

| ID | Severity | Description | Status | Waiver approved by |
|----|----------|-------------|--------|-------------------|
| | P0/P1/P2/P3 | | Open / Fixed / Waived | |

**Open P0/P1 defects:** ☐ None · ☐ Listed above (blocks sign-off if unresolved)

---

## Partial pass items (if applicable)

| Item | Risk | Mitigation | Accepted? |
|------|------|------------|-----------|
| | | | ☐ Yes ☐ No |

Reference: [known-limitations.md](known-limitations.md)

---

## Sign-off decision

| Decision | ☐ **PASS** · ☐ **PARTIAL PASS** · ☐ **FAIL** |

### Conditions (PARTIAL PASS only)

1. 
2. 

---

## Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Product Owner | | | |
| DevOps / Release Manager | | | |
| Backend Lead (if API-heavy UAT) | | | |
| Security (if RBAC/security UAT) | | | |
| Operations Manager (if workflow UAT) | | | |

---

## Post sign-off actions

| ☐ | Action | Owner | Due |
|---|--------|-------|-----|
| ☐ | Update [uat-index.md](../uat-index.md) status | QA | |
| ☐ | File change request for production deploy | DevOps | |
| ☐ | Publish release notes | Product | |
| ☐ | Operator checklist assignment | DevOps | |

---

## UAT-022 specific checklist (Security RBAC & Go-Live Pack)

| ☐ | Deliverable | Complete |
|---|-------------|----------|
| ☐ | [permission-matrix.md](../permission-matrix.md) | |
| ☐ | [backend-rbac-audit.md](../backend-rbac-audit.md) regenerated | |
| ☐ | [audit-trail-standard.md](../audit-trail-standard.md) | |
| ☐ | [anti-fraud-policy.md](../anti-fraud-policy.md) | |
| ☐ | Developer protection pack (this folder) | |
| ☐ | 24 TODO routes reviewed — exceptions documented | |
| ☐ | `security-rbac-audit.spec.ts` PASS | |
