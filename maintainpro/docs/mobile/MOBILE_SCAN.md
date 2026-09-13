# Mobile Universal Scan

Phase 5 slice — camera + manual entry with Nest-authenticated lookup.

## Primary contract

| Operation | Endpoint | Permission |
|-----------|----------|------------|
| Scan lookup | `POST /operations/scan-lookup` `{ code }` | `operations.scan_lookup` + role |

Response includes authoritative `target` with `type`, `id`, `route`, `title`, `subtitle`.

Supported target types: `ASSET`, `VEHICLE`, `DRIVER`, `WORK_ORDER`.

## Mobile behavior

- **Camera**: `mobile_scanner` with torch toggle, debounce (~1.8s duplicate suppression).
- **Manual entry**: same resolver path as camera.
- **Offline**: lookup blocked with user message (no client-side authority).
- **403 / missing permission**: falls back to legacy `searchVehicles` + `GET /assets/validate-tag`.
- **404**: shows unknown code message.
- **Security officer**: `VEHICLE` targets route to `/gate/vehicle/:id`; others use fleet paths.

## Security

- QR payload is never trusted as authority — always resolved via authenticated Nest API.
- No secrets in scanned content handling.

## Tests

- `test/features/scan/scan_models_test.dart` — route mapping unit tests.
