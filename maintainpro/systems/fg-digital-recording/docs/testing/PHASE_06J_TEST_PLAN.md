# Phase 06J Test Plan — Conditional checklist rules

**Document status:** Technical test plan — not UAT / business approval  
**Phase:** 06J  
**Architecture:** ADR-019

## Scope

Server-authoritative `VISIBLE_IF` / `REQUIRED_IF` / `EVIDENCE_REQUIRED_IF` with closed comparators.

## Cases

| ID | Case | Expectation |
| --- | --- | --- |
| 06J-T01 | Unknown comparator / expression-like string | Rejected |
| 06J-T02 | EQ/IN/GT/IS_ANSWERED on YES_NO / NUMBER | Deterministic |
| 06J-T03 | VISIBLE_IF cycle | Rejected at set/publish |
| 06J-T04 | Hidden bypass (answer while not visible) | ValidationError; no persisted answer |
| 06J-T05 | REQUIRED_IF when gate YES | Completeness requires detail; submit blocked until answered |
| 06J-T06 | Snapshot `condition_context` | Frozen at submit; not recomputed historically |
| 06J-T08 | SELECT / YES_NO_NA / IS_EMPTY | Deterministic predicates |
| 06J-T09 | Malformed / XSS-like operators | Rejected (no eval) |
| 06J-T10 | Cross-org rule manage | PermissionDenied |
| 06J-T11 | Correction + historical condition_context | Source frozen; resubmit new context |
| 06J-T12 | Hidden item not in required completeness | Submit allowed when gate NO |
## Non-goals

- Invented Nelna predicates / form content
- Expression language
- Auto HOLD/REJECT from evidence rules
- Client-authoritative visibility
