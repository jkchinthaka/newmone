# Backup Manifest Contract

**Schema version:** `1.0`  
**Phase:** 6A  
**E2E default:** `productionApproved: false`

## Purpose

Safe, shareable metadata describing a MongoDB backup archive (and optional object-storage manifest reference) without credentials or document payloads.

## Required fields (`schemaVersion` 1.0)

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Always `"1.0"` for this contract |
| `backupId` | string | Unique backup identifier (alias, not URI) |
| `runId` | string | E2E/workflow run correlation (`E2E_RUN_ID`) |
| `createdAt` | string (ISO-8601 UTC) | Archive creation timestamp |
| `applicationCommit` | string | Git SHA of tested application image |
| `sourceDatabaseAlias` | string | Safe DB alias only (e.g. `maintainpro_e2e_<runId>`) — **never URI** |
| `archiveFormat` | string | e.g. `mongodump-archive` |
| `compression` | string | e.g. `gzip` |
| `checksumAlgorithm` | string | `sha256` |
| `archiveChecksum` | string | Hex SHA-256 of archive file |
| `archiveSizeBytes` | number | Must be > 0 |
| `collectionCount` | number | Count of collections in manifest |
| `collectionDocumentCounts` | object | Map collection name → document count (safe counts only) |
| `objectStorageManifestRef` | string \| null | Reference to companion object manifest ID, if any |
| `toolVersions` | object | e.g. `mongodump`, `mongorestore` versions |
| `encryptionStatus` | string | e.g. `none_e2e`, `encrypted_at_rest_operator` |
| `productionApproved` | boolean | **false** for all Phase 6A / CI E2E manifests |
| `restoreTestRequired` | boolean | **true** — restore test must pass before production reliance |

## Reference implementation

`scripts/recovery/lib/recovery-safety.mjs` — `buildSafeManifest()`, `assertManifestSafe()`.

## Forbidden content (never include)

- Database URI or connection string
- Username, password, root credential
- JWT / CSRF / MinIO / SMTP / ERP secrets or keys
- Encryption keys
- Raw document content, PII payloads
- Tokens, cookies, `Authorization` values
- Signed URLs

## Validation rules

1. `assertManifestSafe` must pass before upload or persistence.
2. Zero-byte archive → fail (`DR-INTEGRITY-003`).
3. Checksum mismatch → fail restore start (`DR-INTEGRITY-006`).
4. `backupId` in manifest must match caller context (`DR-INTEGRITY-005`).
5. CI may upload **manifest JSON only** — never raw `.archive` / `.gz` (`DR-E2E-019`).

## Example shape (synthetic, no secrets)

```json
{
  "schemaVersion": "1.0",
  "backupId": "e2e-backup-ci-12345",
  "runId": "ci-12345",
  "createdAt": "2026-08-02T04:49:00.000Z",
  "applicationCommit": "5836bc330cc03e7a3f658ed9cee5f334649f3091",
  "sourceDatabaseAlias": "maintainpro_e2e_ci-12345",
  "archiveFormat": "mongodump-archive",
  "compression": "gzip",
  "checksumAlgorithm": "sha256",
  "archiveChecksum": "<64-char-hex>",
  "archiveSizeBytes": 1234567,
  "collectionCount": 16,
  "collectionDocumentCounts": { "Tenant": 2, "User": 8 },
  "objectStorageManifestRef": null,
  "toolVersions": { "mongodump": "100.9.0" },
  "encryptionStatus": "none_e2e",
  "productionApproved": false,
  "restoreTestRequired": true
}
```

## Production promotion

Setting `productionApproved: true` requires operator evidence: off-host encrypted storage, `MANAGEMENT_APPROVAL_REQUIRED` retention sign-off, and successful counted restore drill — **outside** Phase 6A E2E scope.

## Persistence decision (Phase 6A)

Phase 6A uses **signed external / file-based manifests** for E2E recovery evidence (rtifacts/e2e-logs/recovery-rehearsal-summary.json and temporary work-dir manifests).

A Prisma `RecoveryEvidence` model was **not** added: the safe summary + readiness env metadata are sufficient for rehearsal and readiness separation without storing archive bytes or URIs in MongoDB.

