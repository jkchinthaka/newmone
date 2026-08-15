# Phase 11 - Secure Quality Evidence Attachments

**Document status:** Technical foundation - production hardening still EVIDENCE REQUIRED
**Phase:** 11
**ADR:** [ADR-023-SECURE-QUALITY-EVIDENCE-ATTACHMENTS.md](../architecture/ADR-023-SECURE-QUALITY-EVIDENCE-ATTACHMENTS.md)

## Goal

Add secure, optional evidence attachments to quality workflows without public file URLs or PostgreSQL BLOBs.

## Delivered

- Generic `EvidenceAttachment` metadata + private filesystem store
- Allowlisted links: draft response, submission, Supervisor review, QA review, future NCR/CAPA
- Allowlist / size / randomized keys / authorized download / safe disposition
- SHA-256 integrity; malware scan interface with honest `NOT_CONFIGURED` default
- Soft-retire only for removal; immutable linkage after finalize/submit
- Audit events for upload / download / retire / missing access
- Tests covering auth, cross-org, invalid type, oversize, malicious filename, missing blob, hash, immutability (coverage >= 80%)

## STATUS: PHASE 11 EVIDENCE ATTACHMENTS COMPLETE
