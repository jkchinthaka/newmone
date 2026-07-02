# Known Limitations — MaintainPro Go-Live

**Document owner:** Engineering + Product  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02

This register documents accepted limitations at pilot/production cutover. Review quarterly or before major releases.

---

## Limitation register

| Limitation | Risk | Mitigation | Future action | Owner |
|------------|------|------------|---------------|-------|
| JWT access token stored in `localStorage` (web) | XSS could exfiltrate session | Strict CSP, sanitised inputs, short TTL; refresh via httpOnly cookie where configured | Cookie-only access token roadmap | Security |
| 24 API routes lack explicit `@Roles`/`@Permissions` (notifications, predictive-ai conversations, billing webhooks) | Authenticated users may access broader than intended | Global `JwtAuthGuard` + tenant scope; document exceptions in [backend-rbac-audit.md](../backend-rbac-audit.md); tighten before public API expansion | Add permission keys per route (UAT-022 TODO) | Backend |
| `FINANCE_APPROVER` is a string role on select endpoints, not a Prisma `RoleName` enum | Finance users may need manual role assignment mapping | Grant `purchase_orders.approve_finance` + `part_requests.approve_finance` to MANAGER/OPERATIONS_MANAGER; map FINANCE_APPROVER in JWT for report endpoints | Add `FINANCE` to `RoleName` enum or formal finance role seed | Backend |
| Evidence storage disabled on staging (`STORAGE_MODE=disabled`) | Production cutover without live storage blocks byte upload UAT | Honest readiness indicators; enable Cloudinary/MinIO before go-live if evidence required | Live presigned upload UAT on prod | DevOps |
| SMTP/SMS/push disabled on staging | Operators cannot UAT live notification delivery | Readiness panel shows `EMAIL_DISABLED` / `SMS_DISABLED`; UAT email/SMS test endpoints admin-only | Configure live providers per [deployment-checklist.md](deployment-checklist.md) | DevOps |
| Work order list CSV/PDF export not shipped | Users export via Reports module only | `GET /reports/:module/export` server export; client export on assets/inventory | REP-004 WO bulk export | Product |
| Mobile Flutter offline parity incomplete | Field technicians may work off-system without queue | Web UAT covers technician flows; mobile separate release train | Mobile offline queue certification | Mobile |
| Roster CRUD UI partial (UAT-007) | Workforce planning relies on API/seed | `EmployeeRosterEntry` / `EmployeeLeaveRequest` models exist; assignment API enforces leave | Full roster UI sprint | Product |
| Legacy FMS data in browser `localStorage` | History tab may miss pre-migration rows not in API | Admin-only raw archive `(fms)` route; WO History API for asset/vehicle context | Data migration to API | Backend |
| Dual-database replication lag (async outbox) | Backup DB may trail primary during outages | `npm run db:backup:verify`; replication status on System Health; primary Atlas is source of truth | DR drill + RPO/RTO sign-off | DevOps |
| Redis optional at boot | Bull queues degrade if Redis unreachable | API boots with swallowed `ECONNREFUSED`; queue-dependent features no-op | Production Redis for notifications/ERP jobs | DevOps |
| ERP sync mock/disabled by default | Inventory counts not live-synced to ERP | `inventory/erp/readiness` honest mode; dry-run sync admin-only | Vendor sandbox UAT | Integrations |
| Predictive AI / copilot env-gated | AI features unavailable without RapidAPI keys | Feature toggles in `system.featureToggles`; graceful empty states | Enterprise AI contract | Product |
| APM/Sentry not wired | Incidents detected via health/smoke only | `/health`, `/health/readiness`, deployment-readiness; incident SOP | PRO-007 observability | DevOps |
| Production DNS not cut over | Users on staging URLs only | Document staging reference; operator checklist for `maintenance.nelna.lk` | Execute domain cutover | DevOps |
| Default seed must not run on production | Staging personas in prod DB | Bootstrap via invitation flow only; `MAINTAINPRO_SEED_PASSWORD` never in prod env | Production tenant onboarding runbook | DevOps |
| Risk scores are rule-based, not ML fraud detection | Management may over-interpret scores | Disclaimer in [anti-fraud-policy.md](../anti-fraud-policy.md) | Optional ML layer (roadmap) | Product |
| Swagger may be exposed if not configured | API surface enumeration | Disable or basic-auth protect in production `NODE_ENV` | Security review at cutover | Security |
| Cloudflare Wrangler local deploy OAuth scope | Local web deploy blocked; staging web may lag API | Deploy via CI or dashboard; verify Workers version matches release | Re-auth Wrangler with account scope | DevOps |

---

## Review cadence

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Limitation register review | Each release / UAT phase close | Product |
| RBAC audit regeneration | Each sprint touching controllers | Backend |
| Backup verify | Weekly (staging), daily (prod post-cutover) | DevOps |
| Fraud override report review | Weekly operations meeting | Operations Manager |

---

## Related documents

- [backend-rbac-audit.md](../backend-rbac-audit.md)
- [permission-matrix.md](../permission-matrix.md)
- [PRODUCTION_READINESS_REPORT.md](../../PRODUCTION_READINESS_REPORT.md)
- [ENTERPRISE_ROADMAP.md](../ENTERPRISE_ROADMAP.md)
