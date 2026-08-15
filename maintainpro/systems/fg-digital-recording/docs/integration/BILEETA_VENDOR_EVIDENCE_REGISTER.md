# Bileeta Vendor Evidence Register

**Document status:** Living gate checklist — **not** vendor API documentation  
**Related:** APR-011, APR-012, APR-016, ASM-014, ADR-029

Code mirror: `apps.integrations.vendor_evidence.VENDOR_EVIDENCE_REGISTER`

| Code | Evidence required | Current status | Owner |
| --- | --- | --- | --- |
| API_DOCS | Versioned Bileeta/ERP API docs | MISSING | IT / Vendor |
| SANDBOX | Sandbox URL + access procedure | MISSING | IT / Vendor |
| AUTH_METHOD | Auth scheme (OAuth/API key/mTLS/…) | MISSING | IT / Vendor |
| BASE_URL | Approved sandbox + production base URLs | MISSING | IT / Vendor |
| BATCH_PRODUCT_ENDPOINTS | Exact batch/product paths + field map | MISSING | IT / Vendor |
| RATE_LIMITS | Throttle / quota policy | MISSING | IT / Vendor |
| ERROR_FORMAT | Error body schema | MISSING | IT / Vendor |
| SUPPORT_OWNER | Poison-message / failure operational owner | MISSING | IT / Production (APR-016) |

**Rule:** Do not mark PRESENT without a durable artefact path recorded in [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md). Chat silence is not evidence.

When complete, update this table, ADR-029 consequences, and reopen live client enablement under change control.
