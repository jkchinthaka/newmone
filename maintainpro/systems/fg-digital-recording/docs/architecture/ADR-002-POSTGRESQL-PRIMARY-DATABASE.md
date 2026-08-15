# ADR-002 — PostgreSQL as Primary Operational Database

**Status:** Accepted (technical direction)  
**Date:** 2026-08-04  
**Phase:** 00 — Discovery and governance

## Context

The system must manage users, roles, organization scopes, tasks, submissions, approvals, amendments, audit events, and reports. These entities are relational, require foreign-key integrity, and participate in multi-step workflows that need ACID transactions. Checklist answers may vary by template version and benefit from flexible storage alongside relational anchors.

## Decision

Use **PostgreSQL** as the authoritative operational database. Use **JSONB** for flexible checklist snapshots and answers where appropriate. Store photos and large files in object storage, not in PostgreSQL.

## Relational nature of core entities

Users, roles, memberships, organization nodes, tasks, records, review actions, and audit events form a connected graph best enforced with tables, foreign keys, and constraints.

## ACID transaction requirements

Submit, check, verify, amend, and similar operations must update multiple rows atomically. PostgreSQL transactions provide the required consistency for a modular monolith.

## Foreign-key integrity

Referential integrity prevents orphaned tasks, reviews without records, and unauditable dangling references that weaken accountability.

## PostgreSQL JSONB use

JSONB is appropriate for:

- Template-driven answer payloads
- Immutable snapshots of checklist content at submission time
- Limited flexible metadata explicitly designed for JSON

JSONB is **not** a substitute for relational modeling of identity, permissions, workflow status, or audit linkage.

## Why MongoDB is not selected for this clean restart

A document-primary database is not chosen because workflow integrity, constrained relationships, reporting joins, and transactional multi-record updates are central to this product. PostgreSQL covers relational needs and still offers JSONB where flexibility is justified. This is a forward-looking fit assessment for the greenfield system, not a commentary on any prior implementation.

**2026-08-10 update:** The company has requested MongoDB / Atlas. That request is assessed in [ADR-018](ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md) with status **POC REQUIRED**. ADR-002 remains the **implemented** primary-database decision until a later accepted ADR supersedes it with POC evidence and written APR-020 approval. Do not treat ADR-018 as an accepted cutover.

## File storage separation

Evidence binaries go to MinIO (local) or S3-compatible storage (production). PostgreSQL stores metadata, hashes as designed, access linkage, and audit references.

## Reporting and audit benefits

SQL joins, constraints, and mature backup tooling support audit exports, operational reports, and restore testing required before production claims.

## Consequences and limitations

- Requires PostgreSQL operations skill and backup/restore discipline
- JSONB queries need deliberate indexing and schema conventions
- Very large analytical workloads may later need replicas or warehouses (not required for MVP)
- Object-storage failure modes are separate from database failure modes and must be monitored

## References

- [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) DEC-003, DEC-008
- [SECURITY_BASELINE.md](../security/SECURITY_BASELINE.md)
