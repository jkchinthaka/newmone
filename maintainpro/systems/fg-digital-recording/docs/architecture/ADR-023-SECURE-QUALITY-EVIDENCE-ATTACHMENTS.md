# ADR-023 — Secure quality evidence attachments

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 11

## Context

Quality workflows need optional photographic/PDF evidence without storing binaries in PostgreSQL, without public predictable URLs, and without inventing checklist mandatory-evidence rules.

## Decision

1. Introduce `apps.evidence` with `EvidenceAttachment` metadata (original filename, randomized `storage_key`, content type, size, SHA-256, uploader/time, optional caption, allowlisted `linked_kind` + `linked_object_id`).
2. Allowlisted link targets: checklist response (draft), checklist submission, Supervisor review, QA review, future NCR/CAPA.
3. Private storage abstraction (`EVIDENCE_STORAGE_ROOT` filesystem locally; S3/MinIO-compatible backend later per DEC-008). No `MEDIA_URL` public mapping for evidence blobs.
4. Downloads are application-mediated after RBAC on every request (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`). Production may issue short-lived object-store pre-signed URLs only after the same authorization gate.
5. Allowlisted MIME/extensions only; size limit via `EVIDENCE_MAX_UPLOAD_BYTES` (technical default; production limit EVIDENCE REQUIRED / ASM-017).
6. Malware scanning is an interface with default `NOT_CONFIGURED` — do not claim scanning is active until IT security configures a provider.
7. Soft-retire only; admin hard-delete disabled. Immutable linkages require retire permission + reason.
8. Audit: `EVIDENCE_UPLOADED`, `EVIDENCE_DOWNLOADED`, `EVIDENCE_RETIRED`, `EVIDENCE_ACCESS_DENIED`.

## Consequences

- Checklist `evidence_hook` JSON remains metadata; real files live in `apps.evidence`.
- Retention / malware / object-store IAM remain owner decisions (ASM-013, ASM-017, DEC-008).
- No forced evidence for checklist items without separate policy evidence.
