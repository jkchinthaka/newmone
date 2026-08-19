# Business decisions required

Safe reversible defaults are in code. Change these only with an explicit operations decision.

| Decision | Default in code | Why |
|---|---|---|
| PM schedule advance | `ACTUAL_COMPLETION` unless `MaintenanceSchedule.advancePolicy=FIXED_SCHEDULE` | Avoid inventing a calendar that the org did not approve |
| Part compatibility UNKNOWN | Warning / allow | Do not treat missing master data as incompatible |
| Part compatibility INCOMPATIBLE | Block unless authorized override + reason | Fail-closed for known mismatches |
| ERP variance | Create a case; never auto-adjust stock | Stock mutation requires a human resolution |
| Sample ERP mismatches | Off unless `ERP_SEED_SAMPLE_MISMATCHES=1` | Dashboards must not show invented variances |
| SLA warning / breach / escalate | 75% / 100% / 125% (`ENTERPRISE_SLA_*_PCT`) | No org chart was approved |
| Health score | Management decision support only | Gate-out stays on explicit hard rules |
| Procurement | Recommendation only; convert to existing PO when supplier exists | Do not invent a second ERP |
| Warranty hit | Exception + notification; do not auto-PO | Replacement may be a claim, not a purchase |
| Meter impossible future | >1 day ahead rejected | Prevents obvious bad readings |
| SLA calendar | Weekends excluded unless `enterprise.policy.weekendsCountAsBusiness` | No holiday calendar was supplied |
| Permit-to-work | `ptwStrict=false` → warn/allow with `BUSINESS_APPROVAL_REQUIRED` | Do not invent Nelna isolation/PPE limits |
| Budget control | No configured `enterprise.budget.YYYY-MM` → INSUFFICIENT_DATA, do not block | Emergency may bypass if policy allows |
| PO invoice 3-way | Invoice side INSUFFICIENT_DATA | Vendor invoices are repair-case scoped, not PO-line scoped |
| Vendor contracts | Eligibility uses active/blacklist only | Contract/insurance expiry fields are not on Supplier |

## Remaining human / external blockers

- FG CL18/CL30 independent-occurrence tokens are implemented in Django Daily Records / JSON API on this branch (`ensure_controlled_daily_task` + `POST /api/v1/records/open`). Next.js sends `occurrenceToken`. `FG_NEXTJS_UI_ENABLED` stays off until FG E2E and production smoke are signed.
- Combined-Release branch `release/fg-erp-combined-candidate` remains diverged from its origin (Mongo bootstrap commits). That branch was not force-pushed. Occurrence-token Django changes were extracted onto `fix/live-production-remediation`.
- Production Mongo `db push` for new inventory/enterprise collections is a release-engineer action on a disposable production-shaped DB first. Prior disposable Mongo evidence predates later Prisma schema commits (`51bba3fc`, `20d7061f`).
