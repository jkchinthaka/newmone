# ADR-001 — Modular Monolith

**Status:** Accepted (technical direction)  
**Date:** 2026-08-04  
**Phase:** 00 — Discovery and governance

## Context

The Nelna FG Digital Recording System is a greenfield Finished Goods recording product delivered by a solo or small team. The domain includes authentication, organization scoping, checklists, tasks, records, reviews, evidence, and later quality and integration capabilities. Strong consistency is required for multi-record business operations (submit, check, verify, amend, audit).

## Decision

Build and operate the system as a **modular monolith**: one Django deployable unit with clear internal module boundaries, domain services, selectors, and policies.

## Why a modular monolith suits a solo/small team

- One deployment pipeline, one database transaction boundary for core workflows
- Lower operational overhead than distributed services
- Faster iteration while preserving a path to extract modules later
- Easier end-to-end reasoning for audit and authorization behavior

## Why microservices are rejected (initial delivery)

- Premature network boundaries increase failure modes and latency
- Distributed transactions complicate submit/check/verify consistency
- Independent services require more CI, observability, and on-call overhead than justified pre-pilot
- Team size does not support many separately versioned deployables

## Module-boundary rules

1. Each module owns its models and public service API.
2. Cross-module consumers call services/selectors, not ad-hoc private internals when a public API exists.
3. Views/templates contain no business rules.
4. Authorization lives in policies and is enforced server-side.
5. Circular module dependencies are avoided.

## Service and selector patterns

- **Services** — write-side business operations; validate, authorize (via policies), persist, emit audit events
- **Selectors** — read-side query composition for complex lists and detail views
- **Policies** — permission and separation-of-duty decisions; deny by default

## Database transaction boundary

Multi-record business operations run inside explicit database transactions so related rows (record, status transitions, audit events, task updates) commit or roll back together.

## Future extraction criteria

Consider extracting a module only when most of the following are true:

- Independent scaling or release cadence is required
- A clear team ownership boundary exists
- Consistency can be redesigned without breaking audit guarantees
- An ADR approving extraction is accepted

## Consequences

- Requires discipline to keep modules clean inside one codebase
- Single database remains the consistency hub (intentional)
- Performance tuning is vertical/modular first, not service-splitting first

## References

- [MODULE_MAP.md](MODULE_MAP.md)
- [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) DEC-002
