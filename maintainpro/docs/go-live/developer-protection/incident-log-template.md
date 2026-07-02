# Incident Log Template — MaintainPro

**Document owner:** DevOps on-call  
**UAT phase:** UAT-022

Copy this template for each production incident. Store completed logs in the org ticket system — not in git if they contain PII.

---

## Incident record

| Field | Value |
|-------|-------|
| **Incident ID** | INC-YYYY-MM-DD-### |
| **Title** | *(short description)* |
| **Severity** | P0 / P1 / P2 / P3 |
| **Status** | Open / Investigating / Mitigated / Resolved / Post-mortem complete |
| **Detected at** | YYYY-MM-DD HH:MM UTC |
| **Detected by** | Monitoring / User report / QA / DevOps |
| **Resolved at** | YYYY-MM-DD HH:MM UTC |
| **Total downtime** | *(minutes)* |
| **Environment** | Production / Staging |
| **Affected URL(s)** | `https://maintenance.nelna.lk` · API host |
| **Release commit** | *(git SHA if deploy-related)* |
| **Incident commander** | *(name)* |
| **Communications lead** | *(name)* |

---

## Summary

*(2–3 sentences: what happened, user impact, current state)*

---

## Timeline (UTC)

| Time | Event | Actor |
|------|-------|-------|
| HH:MM | Incident detected — *(how)* | |
| HH:MM | Incident commander assigned | |
| HH:MM | Investigation started — *(initial hypothesis)* | |
| HH:MM | Mitigation applied — *(action)* | |
| HH:MM | Service restored — *(verification)* | |
| HH:MM | Stakeholders notified | |
| HH:MM | Incident closed | |

---

## Impact assessment

| Dimension | Details |
|-----------|---------|
| **Users affected** | All / Admin only / Single tenant / Role-specific |
| **Tenants affected** | *(tenant names or IDs — ticket only)* |
| **Data impact** | None / Read-only degradation / Data loss / Integrity issue |
| **Security impact** | None / Suspected breach / Confirmed RBAC bypass |
| **Financial impact** | *(if applicable)* |

---

## Technical details

### Symptoms

- 
- 

### Root cause

*(Confirmed after investigation — not speculation)*

### Contributing factors

- 
- 

### Resolution steps

1. 
2. 
3. 

### Rollback performed?

| ☐ Yes — see rollback-plan.md | ☐ No |

If yes: layer rolled back (Web / API / DNS / DB), version/commit restored.

---

## Detection & response gaps

| Question | Answer |
|----------|--------|
| Was monitoring sufficient? | |
| Was runbook followed? | [incident-response-sop.md](incident-response-sop.md) |
| Was rollback plan adequate? | [rollback-plan.md](rollback-plan.md) |
| Escalation delays? | |

---

## Action items (post-incident)

| ID | Action | Owner | Due date | Status |
|----|--------|-------|----------|--------|
| AI-1 | | | | Open |
| AI-2 | | | | Open |

---

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Incident commander | | | |
| DevOps lead | | | |
| Product Owner (P0/P1) | | | |
| Security (if security-related) | | | |

---

## References

- Related CR: 
- Related deploy ticket: 
- Atlas snapshot ID (if DB restore): *(ticket only)*
- Slack/Teams thread: 
