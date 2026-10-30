# Evidence local disk: API upload inventory (2026-10-22)

Scope: searched API controllers, services, DTOs and filesystem writes for multipart interceptors, base64, Cloudinary, file URLs, attachments, image/profile/avatar fields, and static serving. No static serving of the evidence root was found. No schema/migration or excluded auth/guard/admin/role/user/seed/catalog changes.

| API upload path | Current byte handling | This PR / follow-up |
| --- | --- | --- |
| `POST work-orders/:id/evidence/upload-request`, `POST :id/evidence/:evidenceId/content`, `POST :id/evidence/confirm`; authenticated `GET :id/evidence/:evidenceId/content` | Local provider, private DB storage key, tenant/assignment checks, declared size, magic signatures, confirmation hash, clientGeneratedId | Enabled in production only with opt-in and safe root. New tenant/year/month/UUID + MIME suffix. Existing key reads preserved. Streaming and provider size caps added. |
| `POST assets/:id/documents`; authenticated `GET assets/:id/documents/:documentId` | When `STORAGE_MODE=local` is configured (production also needs `STORAGE_LOCAL_PRODUCTION` and a private absolute root), bytes go through the work-order provider: server-generated name, magic-byte MIME check, size limit, SHA-256, traversal checks. Download stays on the authenticated tenant-scoped route. Cloudinary, then the cwd `uploads/asset-documents` fallback, remains when storage is not local. Existing `storedName` and `externalUrl` records stay readable. | Implemented on `fix/asset-inspection-storage`, stacked on #128. |
| Planning inspection evidence (`POST planning/inspections/:id/evidence`; authenticated `GET planning/inspections/:id/evidence/:evidenceId/content`) | Same private provider when local storage is configured. Server-generated object name. Legacy cwd `var/evidence` keys remain readable. The previous writer is unchanged when storage is not local. | Implemented on `fix/asset-inspection-storage`, stacked on #128. |
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
