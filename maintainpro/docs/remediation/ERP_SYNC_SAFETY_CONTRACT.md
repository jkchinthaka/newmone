# ERP Sync Safety Contract

- E2E/test modes fail closed on live provider.
- Idempotency key service-enforced; SUCCESS blocks unless forceResync.
- PENDING concurrency blocked; retry honors nextRetryAt (15m) unless override.
- Max 5 attempts.
- Sanitize errorMessage/errorCode; store safe request/response only (poNumber, totalAmount, lineCount).