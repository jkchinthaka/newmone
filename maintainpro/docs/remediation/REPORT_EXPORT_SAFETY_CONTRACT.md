# Report Export Safety Contract (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`

Aligns with `docs/security/export-and-bulk-action-policy.md` and adds Phase 5D concrete rules for reports, management intelligence, audit, and category exports.

## Formula injection neutralization

Before CSV/XLSX serialization, neutralize cell values that begin with:

| Prefix | Examples |
| --- | --- |
| `=` | `=cmd|` |
| `+` | `+1+1` |
| `-` | `-1+1` |
| `@` | `@SUM` |
| Tab (`U+0009`) | spreadsheet formula smuggling |
| CR (`U+000D`) | formula / breakout |

**Policy:** Prefix dangerous text with a single quote (`'`) **or** escape per documented helper so spreadsheet apps treat content as text. Keep CSV quoting correct (`"` doubled). Numeric cells remain numeric types in XLSX where practical.

Apply to user-controlled fields including supplier names, work-order titles, notes, and part descriptions. Fixtures must include malicious strings (E2E-REPORT export tests).

## Authorization

1. Module view permission + `reports.export` (see `REPORT_ACCESS_MATRIX.md`).
2. Tenant scope server-enforced.
3. Field allowlist + sensitive-data redaction before serialize.
4. Platform exports require platform scope + SUPER_ADMIN.

## Bounds

| Limit | Default (interactive) |
| --- | --- |
| Max rows | Explicit constant (document in API; e.g. aligned with MAX_PAGE_SIZE / export cap) |
| Max date range | 366 days (same as report contract) |
| Max generation time | Soft timeout; fail safe with 503/400 documented |
| Memory | No unbounded full-collection materialization when aggregate/stream possible |

## Truncation metadata (mandatory)

Do **not** silently export only the first N rows as if complete.

When truncated:

```json
{
  "truncated": true,
  "exportedRowCount": 100,
  "totalMatchedCount": 1542,
  "message": "Export truncated to configured maximum rows."
}
```

UI/download headers or sidecar metadata must surface the same facts for CSV/XLSX/PDF.

## Audit

Every export writes an audit/security event:

- actorId, tenantId, module, format, filters hash/summary, exportedRowCount, totalMatchedCount, truncated, requestId, outcome

`GET /audit-logs/export` also emits `audit.export`.

## Filenames and headers

- Filenames from allowlisted module keys + timestamp (no user-controlled path segments).
- `Content-Disposition` must be header-injection safe.
- No insecure direct object URLs without re-authz.

## Currency / time

- Include `currencyCode` (LKR default) in export metadata or columns.
- Timestamps exported in documented TZ (`Asia/Colombo` display columns and/or ISO UTC with TZ column).

## Test IDs

- E2E-REPORT-020 formula neutralization (=+ -@ tab CR)
- E2E-REPORT-021 export requires module+export permissions
- E2E-REPORT-022 truncation metadata present when capped
- E2E-REPORT-023 export audit event written
- E2E-AUDIT-004 audit export audited
