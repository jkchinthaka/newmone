# ERP Integration (Bileeta)

## Architecture

- Provider interfaces under `erp-integration`
- Bileeta adapter + mock contract
- Stock check / reserve / issue flows in inventory
- Sync history + **exception center** (`/erp/exceptions`) with sanitized errors
- Retry / idempotency keys on outbound operations
- Core maintenance remains available when ERP is down (degraded mode)

## External dependency

Live Bileeta base URL, credentials, and production API contracts are **EXTERNAL_DEPENDENCY**.

Everything else (adapter, DTOs, mappings, mock, exception UI, retries, redaction) is implemented in-repo.

Do **not** invent production Bileeta endpoints beyond the mock contract.
