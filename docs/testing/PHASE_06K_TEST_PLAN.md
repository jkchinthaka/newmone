# Phase 06K Test Plan — Deterministic checklist item evaluation

**Document status:** Technical test plan — not UAT / business approval  
**Phase:** 06K  
**Architecture:** ADR-019 §7

## Hard invariant (business safety)

| Measurement / checklist evaluation | Is not |
| --- | --- |
| `PASS` | QA `RELEASE` |
| `FAIL` | QA `HOLD` |
| `FAIL` | QA `REJECT` |
| `WARN` | Any QA disposition |

Evaluation **never** creates or modifies `QAReview`. Disposition remains a separate human QA workflow.

## Scope

Server-authoritative item evaluation with explicit definition-level rules only:

- `NUMERIC_BOUNDS` (Decimal; inclusive/exclusive and warn bands must be configured explicitly)
- `EXPECTED_CHOICE` (YES/NO; NA → `NOT_EVALUATED` when configured)
- `EXPECTED_OPTION` (SELECT)
- `CALCULATED_NUMERIC_BOUNDS`

No evaluation when no approved rule exists (`NOT_EVALUATED`). Hidden/non-applicable under conditions → `NOT_EVALUATED`.

## Cases

| ID | Case | Expectation |
| --- | --- | --- |
| 06K-T01 | Numeric in / out / inclusive boundary | PASS / FAIL per explicit inclusivity |
| 06K-T02 | Exclusive boundary | Boundary value FAIL when exclusive |
| 06K-T03 | Warning band | WARN when outside pass band but inside configured warn band |
| 06K-T04 | YES/NO expected choice | PASS/FAIL |
| 06K-T05 | YES_NO_NA → NA | NOT_EVALUATED (default treat_na_as_not_evaluated) |
| 06K-T06 | SELECT expected option | PASS/FAIL |
| 06K-T07 | Calculated numeric bounds | Uses server-computed calculated value |
| 06K-T08 | Conditional non-applicable | No trusted FAIL; hidden answers cleared; NOT_EVALUATED path |
| 06K-T09 | Missing rule | NOT_EVALUATED even if informational min/max set |
| 06K-T10 | Client-spoofed PASS | Overwritten by server; no QAReview |
| 06K-T11 | Historical snapshot | Frozen evaluation_context; future rule changes do not rewrite history |
| 06K-T12 | Correction | Source snapshot immutable; new submission gets new evaluation snapshot |
| 06K-T13 | Cross-org rule manage | PermissionDenied |
| 06K-T14 | Inclusivity required | ValidationError if bound set without explicit inclusivity |
| 06K-T15 | Rule set/clear audit | CHECKLIST_ITEM_EVALUATION_RULE_* events (not per calculation) |
| 06K-T16 | Save query budget | Bounded queries (no runaway N+1) |

## Non-goals

- Invented Nelna temperature limits, warning bands, or inclusivity defaults
- Auto HOLD / REJECT / RELEASE / CAPA / NCR from evaluation
- Client-authoritative PASS/FAIL
- Noisy audit events for every deterministic calculation
