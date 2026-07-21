# Structured Logging and Request IDs

## Request IDs

`RequestIdMiddleware`:

- accepts inbound `X-Request-Id` when it matches `[A-Za-z0-9\-_.]{1,128}`
- otherwise generates a UUID
- sets response header `X-Request-Id`
- stores `requestId` on the request and in `requestContext`

Error responses include `error.requestId`.

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [],
    "fieldErrors": {},
    "requestId": "..."
  }
}
```

Stable codes include validation, auth, CSRF, tenant, permission, conflict, rate limit, dependency, and internal errors.

## Logging (current)

Nest `Logger` lines for failures include method, URL, status, code, and requestId. Full Pino JSON logging rollout remains tracked.