# Bileeta Integration Readiness

**PostgreSQL remains the authoritative System of Record.**
**Do NOT implement a fake live ERP integration.**
**Never directly modify the Bileeta database.**

## Technical boundary (prepared / verify in code)

| Concern | Status |
| --- | --- |
| Adapter / service boundary | Present as gated integration surface |
| DTO / schema | Keep contract-driven; no invented fields |
| Authentication configuration boundary | Env vars only; secrets not in frontend |
| Timeout | `BILEETA_HTTP_TIMEOUT_SECONDS` |
| TLS verify | `BILEETA_VERIFY_TLS` |
| Retry / idempotency | Must remain safe; no duplicate ERP side-effects |
| Error logging | No credentials in logs |
| Reconciliation / manual retry | Operational process required |
| Audit trail | Required for outbound attempts when enabled |
| Live enable flag | `BILEETA_LIVE_ENABLED=False` until approved |

## External evidence required

| Item | Status |
| --- | --- |
| API base URL | **EXTERNAL** |
| Sandbox | **EXTERNAL** |
| Authentication method | **EXTERNAL** |
| Credentials | **EXTERNAL** — never invent |
| Product mapping | **EXTERNAL** |
| Batch mapping | **EXTERNAL** |
| Dispatch mapping | **EXTERNAL** |
| Field contract | **EXTERNAL** |
| Error codes | **EXTERNAL** |
| Rate limit | **EXTERNAL** |
| Vendor sign-off | **EXTERNAL** |

## Current classification

```text
BILEETA LIVE INTEGRATION BLOCKED — EXTERNAL CONTRACT/CREDENTIALS REQUIRED
```

Related: `docs/handover/ERP_INTEGRATION_STATUS.md`
