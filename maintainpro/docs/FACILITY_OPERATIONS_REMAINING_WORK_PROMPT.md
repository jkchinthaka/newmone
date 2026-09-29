# Facility Operations — Remaining Work Prompt

**Replaces:** obsolete PR #4 `MASTER_IMPLEMENTATION_PROMPT.md` (June 2026).  
**Why replaced:** that prompt asked agents to rebuild security, branding, login, and most CMMS foundations that are already shipped; following it would regress current MaintainPro, FG integration, ERP work, and production remediation.

Use this document only for **remaining facility-operations gaps**. For product vision and status matrix, see [FACILITY_OPERATIONS_WORKFLOW_BLUEPRINT.md](FACILITY_OPERATIONS_WORKFLOW_BLUEPRINT.md).

## How to use

Copy the prompt below into a coding agent. Require **one phase at a time**. Do not ask the agent to “implement the entire facility platform.”

```text
Use FACILITY_OPERATIONS_REMAINING_WORK_PROMPT.md.
Start with Phase A only.
Inspect existing facilities/cleaning/work-orders modules before coding.
Do not modify fix/live-production-remediation, production configs/secrets,
FG unified Mongo behavior, or ERP integration design unless explicitly asked.
```

---

# Copy-paste prompt

You are a senior full-stack engineer on MaintainPro (`jkchinthaka/newmone`), working in `maintainpro/`.

## Stack (current)

- API: NestJS + Prisma MongoDB (`apps/api`, `prisma/schema.prisma`)
- Web: Next.js App Router (`apps/web`)
- Mobile: Flutter (`apps/mobile`)
- Auth: JWT + tenant context + roles + permissions
- Facility-related modules already present: `facilities`, `cleaning`, `work-orders`, `assets`, `inventory`, `utilities`, `procurement`

## Hard rules

1. Inspect before inventing. Prefer extending models/modules that already exist.  
2. Do not duplicate Work Order, Asset, Inventory, or Tenant masters.  
3. Keep tenant isolation and RBAC intact.  
4. Do not overwrite README branding/architecture with old June 2026 docs.  
5. Do not touch `fix/live-production-remediation`, production databases, or secrets.  
6. Do not change FG Digital Recording Mongo cutover / `fg_*` ownership as part of facility work.  
7. Do not redesign ERP stock sync / Excel import here.  
8. Small PRs; loading/empty/error/success states on UI; tests for API changes.  
9. Mark DONE vs FUTURE honestly against [FACILITY_OPERATIONS_WORKFLOW_BLUEPRINT.md](FACILITY_OPERATIONS_WORKFLOW_BLUEPRINT.md).

## Already done (do not rebuild)

- Property → Building → Floor → Room hierarchy  
- Facility issues + SLA fields + categories + photos  
- Issue → Work Order bridge  
- Facilities dashboard / aging / reports surfaces  
- Cleaning visits, QR, checklists, analytics  
- Core work-order / inventory / procurement / utilities foundations  
- Multi-tenant JWT RBAC and audit patterns  

## Phases (remaining only)

### Phase A — Audit and gap list

- Diff blueprint status matrix vs code.  
- List concrete gaps with file paths.  
- Propose ordered tickets. Stop for approval.

### Phase B — Facility UX / data polish

- Hierarchy CRUD UX gaps, issue filters, duplicate detection polish.  
- Report/export completeness for facility KPIs.  
- Keep cleaning routes coherent (`/facilities` vs `/cleaning/issues`).

### Phase C — Work-order bridge maturity

- Evidence, parts, assignment, and status clarity for facility-origin WOs.  
- No second WO engine.

### Phase D — Vendor participation (optional)

- UX on existing `VendorRepairCase` / quotation / invoice models.  
- No public unauthenticated vendor portal without explicit security design.

### Phase E — Preventive maintenance depth (optional)

- Extend maintenance scheduling; calendar/meter compliance reports.  
- Auto-create WOs only with clear feature flags and tests.

### Phase F — Requester intake (optional)

- Authenticated requester flow first.  
- Public portal only with rate limits, abuse controls, and tenant binding.

## Out of scope forever for this prompt

- Power BI native productization  
- Full budgeting ERP  
- Predictive AI product rewrite  
- FG SSO  
- Production DNS/cutover execution  

## Required output each phase

- Files changed  
- Tests/commands run  
- Remaining risks  
- What is still FUTURE  

---

## Historical note

PR #4 also added a long “Phase 0–9 master prompt” covering login security, branding, and greenfield facility modules. That content is **retired** here because the platform has moved on. Security and readiness live in `docs/SECURITY_CHECKLIST.md`, `docs/ENTERPRISE_ROADMAP.md`, and production-remediation docs — not in this facility prompt.
