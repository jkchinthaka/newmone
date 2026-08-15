# Phase 06L Test Plan — Control-point / criticality metadata

**Document status:** Engineering test plan — **not** HACCP/QMS approval  
**Phase:** 06L  
**Evidence gate:** ASM-002 / APR-027 still **EVIDENCE REQUIRED** for production non-NONE classifications. AI reports are not approval.

## Hard invariant

| Metadata | Is not |
| --- | --- |
| Control-point class (CCP/OPRP/…) | QA HOLD / REJECT / RELEASE |
| Criticality (MINOR/MAJOR/CRITICAL) | Automatic NCR or dispatch block |

Metadata may support display, future reporting, and future escalation **only when** an approved deterministic policy exists in a later phase.

## Scope

Generic taxonomy on `ChecklistItem` (version-owned, default `NONE` / blank criticality):

- `NONE | CCP | OPRP | PRP | GMP | QUALITY`
- Criticality: blank | `MINOR | MAJOR | CRITICAL`

No automatic classification of existing items. No invented Nelna CCP/OPRP mappings.

## Cases

| ID | Case | Expectation |
| --- | --- | --- |
| 06L-T01 | Defaults | New items → `NONE`, blank criticality |
| 06L-T02 | No auto-classify | Existing-style items remain NONE without explicit set |
| 06L-T03 | Editor validation | Unknown class/criticality → ValidationError |
| 06L-T04 | Audit | Metadata change → `CHECKLIST_ITEM_CONTROL_POINT_METADATA_UPDATED` |
| 06L-T05 | Published immutability | Cannot change metadata on published version items |
| 06L-T06 | Clone | New draft copies control-point + criticality |
| 06L-T07 | Cross-org | Foreign org manager denied |
| 06L-T08 | Submission freeze | `control_point_context` frozen; later draft changes do not rewrite history |
| 06L-T09 | No disposition | Submit with non-NONE metadata does not create `QAReview` |
| 06L-T10 | Display helpers | Labels for class/criticality; calm UI note (not alarmist) |

## Out of scope

- Seeding real Nelna CCP/OPRP/PRP classifications
- Auto HOLD/REJECT/RELEASE/NCR/dispatch from metadata
- HACCP plan management module
