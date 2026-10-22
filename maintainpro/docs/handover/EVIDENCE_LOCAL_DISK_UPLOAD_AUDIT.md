# Evidence local disk: API upload inventory (2026-10-22)

Scope: searched API controllers, services, DTOs and filesystem writes for multipart interceptors, base64, Cloudinary, file URLs, attachments, image/profile/avatar fields, and static serving. No static serving of the evidence root was found. No schema/migration or excluded auth/guard/admin/role/user/seed/catalog changes.

| API upload path | Current byte handling | This PR / follow-up |
| --- | --- | --- |
| `POST work-orders/:id/evidence/upload-request`, `POST :id/evidence/:evidenceId/content`, `POST :id/evidence/confirm`; authenticated `GET :id/evidence/:evidenceId/content` | Local provider, private DB storage key, tenant/assignment checks, declared size, magic signatures, confirmation hash, clientGeneratedId | Enabled in production only with opt-in and safe root. New tenant/year/month/UUID + MIME suffix. Existing key reads preserved. Streaming and provider size caps added. |
| `POST assets/:id/documents`; asset document download | Cloudinary when credentials exist; otherwise writes `uploads/asset-documents` under cwd; original-extension filename; existing storedName/externalUrl records | **Follow-up:** not a small safe switch. Needs record-provider versioning, old local and external URL read compatibility, byte/MIME policy for existing supported document types, cleanup and migration plan. This PR does not enable or redirect this path. It is not protected by the new work-order storage guarantees. |
| Planning inspection evidence (`POST planning/inspections/:id/evidence`) | Base64 to `persistEvidenceFileBytes`, writes cwd `var/evidence`, separate `LOCAL`/`READY` records, no shared authenticated byte-download route | **Follow-up:** migrate writer plus implement matching tenant-checked download and legacy-key/status compatibility together. Existing behavior unchanged; do not treat as production-enabled private evidence by this PR. |
| Asset tag import preview/apply | CSV/XLSX multipart, memory parser → database | Import data, not persistent attachment bytes; unchanged. |
| Bulk import `:entity/preview` and confirm | Memory multipart, parsed staging/DB records and error exports | Unchanged; does not need attachment storage. |
| Inventory import preview and `erp-import/upload` | Memory CSV/XLSX parsing, DB staging/audit | Unchanged; does not need attachment storage. |
| ERP integration import batches | Structured JSON batch payloads | Unchanged; no uploaded file bytes. |
| Vehicle documents create/update | Caller-supplied `fileUrl`, DB metadata; “uploaded” response does not store bytes | Follow-up for a real upload/download contract; unchanged. |
| Accidents evidence | Caller-supplied `fileUrl` metadata | URL-only; follow-up for owned private bytes. |
| Work order legacy `:id/attachments`, maintenance attachments | Caller-supplied URL arrays/attachmentUrl | URL-only; unchanged, not automatically copied to disk. |
| Warranty and maintenance-supply documents | Caller-supplied documentUrls | URL-only; unchanged. |
| Vendor quotation submission | Quotation number/amount/currency/date JSON | Named upload internally, but no binary upload. |
| Asset/vehicle images and user profile images | No separate multipart/base64 byte-ingestion handler found in these modules | Existing metadata fields do not become a new upload route. Users module left untouched. |

Cloudinary is used directly only by asset-document uploads in the API search. Work-order mock/cloud modes remain unable to transfer real bytes. The inspection writer and asset fallback are the two separate filesystem upload writers found outside the work-order provider; neither is silently redirected. Their production remediation remains explicit follow-up work.

Validation uses temporary private OS folders and in-memory Prisma fixtures; no database tests or production operations were run. No temporary stack was started. The allowed DB for any future DB tests is `maintainpro_e2e_cursor`; temporary stack ports are 3060/3061 only.
