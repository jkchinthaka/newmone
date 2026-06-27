# MaintainPro — Portfolio Case Study

## Elevator pitch

MaintainPro is a **multi-tenant enterprise operations platform** that unifies maintenance work orders, fleet gate compliance, inventory, facilities, and reporting — replacing fragmented Excel/WhatsApp/ERP workflows with accountable, auditable, role-based operations software.

## Problem statement

Mid-size and enterprise operators struggle with:

- Unplanned downtime and unclear job ownership
- Stock leakage and untracked spare-part usage
- Gate compliance failures (expired documents)
- No single audit trail across maintenance and fleet
- Management reports assembled manually from multiple systems

## Solution

MaintainPro provides:

1. **Single workflow** from asset register → work order → parts → completion → audit
2. **Multi-tenant SaaS** architecture for group companies and branches
3. **RBAC** with 15+ roles including dedicated **Security Officer** for gate operations
4. **Integration readiness** for email, SMS, ERP (Bileeta), and object storage — honestly env-gated
5. **Operational visibility** via role dashboards, system health, and reports

## Architecture highlights (portfolio talking points)

| Topic | Demonstration |
|-------|---------------|
| Modular monolith | 20+ NestJS domain modules, clean boundaries |
| MongoDB + Prisma | Single schema, tenant-scoped models |
| Dual-DB replication | Async outbox to backup MongoDB |
| Auth hardening | JWT + HttpOnly refresh + CSRF + lockout |
| Real-time | Socket.IO for fleet and notifications |
| Background jobs | Bull queues with graceful Redis degrade |
| Web | Next.js App Router, role nav, live KPI dashboards |
| Mobile | Flutter + offline queue foundation |
| DevOps | Render + Cloudflare + Atlas + smoke tests |
| Test discipline | 500+ API tests, Playwright e2e |

## Business value delivered

| Stakeholder | Value |
|-------------|-------|
| Operations | Fewer missed jobs, SLA visibility, action center |
| Maintenance | WO lifecycle, technician assignment, evidence |
| Security | Gate in/out with document compliance checks |
| Stores | Inventory, part requests, ERP sync readiness |
| Management | Dashboard KPIs, reports, cost on work orders |
| IT / DevOps | Health/readiness, deployment smoke, env validation |

## MVP workflow (implemented scope)

```text
Register → Work Order → Assign → Parts → Execute → Evidence → Complete → Audit → Report
```

Partial steps (approval builder, signature, full mobile offline) are documented in the roadmap — not oversold.

## Honest limitations (evaluator transparency)

- Push notifications: noop/mock unless HTTP live provider configured
- ERP sync: mock by default; read sync when credentials provided
- Access JWT stored in localStorage on web (CSP + documented migration path)
- **UAT-001 PASS** (hosted login + smoke)
- **UAT-002 PARTIAL PASS** — browser personas + hosted API on staging
- **UAT-003 PARTIAL PASS** — hosted MVP lifecycle API verified
- **UAT-004 PARTIAL PASS** — WO approve/reject, audit completeness, `/fleet/gate`, evidence readiness indicators
- **UAT-005 PASS** — staging synced on `e366196`; provider diagnostics + cutover docs; full `uat:005:validate` green
- **UAT-006 PASS (docs)** — go-live decision pack, operator checklist, pilot plan; **cutover NO-GO** until infra complete
- Notification providers **DISABLED** on staging (EMAIL_/SMS_/PUSH_ indicators honest)
- Production custom domain not yet live — see `PRODUCTION_GO_LIVE_DECISION_PACK.md`

## Tech stack

NestJS · TypeScript · Prisma · MongoDB · Redis · Next.js · Flutter · Docker · GitHub Actions

## Deployment proof

- Staging web: Cloudflare Workers
- Staging API: Render
- Automated smoke: `npm run smoke:deploy`
- Browser UAT: `npm run test:e2e:staging:uat002` · `npm run test:e2e:staging:uat003` · `npm run uat:005:validate`
- MVP lifecycle API: `npm run uat:003:validate`
- Portfolio screenshots: `docs/screenshots/staging/` (UAT-003 warm capture, 2026-06-27)

## Suggested interview narrative

1. **Why multi-tenant monolith?** — Faster delivery with clear module seams; can extract hot paths later
2. **How do you enforce security?** — Layered guards, permission aliases, audit middleware, env-gated mocks
3. **How do you know it's deployable?** — Health/readiness, smoke scripts, 500+ tests, staging URLs
4. **What would you do next?** — Operator cutover checklist, prod smoke, cookie-only tokens, Sentry, predictive rules

## Repository

https://github.com/jkchinthaka/newmone

Application root: `maintainpro/`
