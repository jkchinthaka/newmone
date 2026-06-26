# Enterprise Roadmap

Prioritized enhancements for MaintainPro portfolio and production evolution. **Do not treat all items as committed delivery dates.**

## Priority 1 — Near-term (MVP polish)

| Item | Status | Notes |
|------|--------|-------|
| Maintenance cost analytics (asset/dept/month) | Partial | WO cost fields exist; expand reports |
| ERP sync dashboard (mode badge, dry-run, errors) | Partial | System health + inventory ERP panel |
| Audit explorer UI | Partial | API + settings audit tab |
| Management report export | Partial | Reports module |
| SLA escalation visibility | Partial | Facility aging / SLA detection |
| Document expiry automation | Partial | Vehicle documents + compliance |
| Inventory auto-reservation on WO | Partial | Part requests panel |
| Align staging smoke credentials | **DONE** | UAT-001 PASS |
| Complete UAT-001 sign-off | **DONE** | Hosted login + smoke |
| Complete UAT-002 browser/API verification | **PARTIAL** | Multi-role Playwright + gate API |
| Complete UAT-003 MVP lifecycle certification | **PARTIAL** | Hosted API lifecycle PASS; WO approval + live evidence open |
| Manager WO create/assign RBAC alignment | **DONE** | `MANAGER` on create/assign/notes (commit `c36af83`) |
| Dedicated `/fleet/gate` route | **DONE** (UAT-004) | Security officer gate page at `/fleet/gate` |
| Production domain cutover | **NOT STARTED** | `maintenance.nelna.lk` |

## Priority 2 — Post-MVP

| Item | Description |
|------|-------------|
| Supplier performance score | Vendor reliability KPIs |
| Approval workflow builder | Configurable WO/PO approvals |
| QR asset scan (web + mobile parity) | Extend existing QR modules |
| Compliance certificate tracker | Expiry dashboards |
| Calibration tracker | Link to assets |
| Spare-part reorder suggestions | Rules from min stock |
| Technician productivity analytics | Jobs/day, MTTR contribution |
| Dedicated `/fleet/gate` route | Security officer landing |
| Cookie-only access token (web) | Reduce localStorage XSS risk |
| Sentry integration | Error tracking |
| IT ops dashboard | Queue failures, version, backup lag |

## Priority 3 — Advanced

| Item | Description |
|------|-------------|
| Rules-based predictive maintenance | Risk score from overdue + repeat failure + cost trend |
| Failure pattern detection | Same asset N failures in window |
| Replacement recommendation | Cost threshold rules |
| Budget forecasting | Dept/month projection |
| BI export API | CSV/JSON for external BI |
| AI maintenance history assistant | Copilot integration (RapidAPI hook exists) |
| Approval workflow builder (visual) | Enterprise admin |
| Mobile signature capture | Supervisor sign-off |
| Full offline mutation parity | Flutter Hive queue coverage |

## Predictive maintenance (rules-first)

**Risk score components (planned):**

```text
Risk = f(service overdue, breakdown frequency, repair cost trend, criticality, spare availability)
```

Example rules:

- Service overdue > X days → high risk badge
- Same asset 3+ breakdowns in 30 days → repeat failure flag
- Repair cost > threshold → replacement review queue
- Critical asset + zero spare stock → operational risk alert
- Meter reading exceeds service interval → PM due

Implementation anchor: `modules/predictive-ai/` + dashboard cards.

## Role dashboard expansion

| Persona | Planned dashboard focus |
|---------|-------------------------|
| Operations Manager | SLA breaches, branch performance, downtime |
| Branch Manager | Branch assets, cost, inventory issues |
| Maintenance Manager | PM schedule, repeat breakdowns, MTTR |
| Store Keeper | Low stock, reservations, cycle count |
| Finance | Maintenance cost vs budget |
| IT Manager | Health, queues, integration status |

MaintainPro stays focused on **operations/maintenance** — HR/payroll/recruitment remain integration references only.

## Mobile roadmap

1. Today’s jobs (technician)
2. QR scan → asset/WO context
3. Start / pause / complete job
4. Photo evidence upload
5. Offline queue status + sync reason
6. Security gate scan flow
7. Driver vehicle checklist

## Integration roadmap

| Integration | Current | Target |
|-------------|---------|--------|
| Email | SMTP live mode | Production SMTP + templates |
| SMS | HTTP generic | Approved gateway contract |
| Push | HTTP / noop | FCM or approved provider |
| ERP | Mock + HTTP read | Signed Bileeta mapping + apply UAT |
| Storage | Cloudinary/MinIO | Presigned upload UAT |
| BI | Reports export | Scheduled export API |

## Documentation maintenance

When shipping a roadmap item:

1. Update README readiness table
2. Update PRODUCTION_READINESS_REPORT
3. Add UAT checklist rows
4. Add tests for business rules
