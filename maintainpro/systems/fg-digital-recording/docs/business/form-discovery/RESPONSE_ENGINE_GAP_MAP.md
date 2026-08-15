# Response Engine Gap Map

**Document status:** Analysis only — **no schema implementation** in Phase 06F  
**Phase:** 06F  
**Created:** 2026-08-09  
**Code baseline:** `apps.checklists.models.ChecklistResponseType` on `main`

## Purpose

Compare **currently implemented** checklist response primitives with **possible** future needs suggested by industry practice and by **future company evidence**.  

This is **not** a requirement to build Checklist Engine v2 features. Implement only after APPROVED FOR DIGITALIZATION forms prove the need.

## Current supported response primitives (code)

| Primitive | Supported now | Notes |
| --- | --- | --- |
| YES_NO | Yes | Definition + recording path |
| YES_NO_NA | Yes | Definition + recording path |
| NUMBER | Yes | Optional unit / min / max on definition; limits must not be invented |
| TEXT | Yes | Free text |
| SELECT | Yes | Options on definition; disposition labels in FG-QA-001 draft are proposed only |

Not implemented as first-class definition/recording types today (examples): PHOTO/attachment capture as response type, DATE/TIME, repeating sample grids, calculated fields, conditional visibility, equipment reference fields, CCP metadata as structured definition.

## Possible future needs (evidence-driven — not claimed as Nelna requirements)

| Capability | Why it often appears on FG/QA paper | Current engine | Suggested gap class | POC/ADR before build? |
| --- | --- | --- | --- | --- |
| Repeating groups / sample grids | Multiple samples per batch/line | Not supported as definition construct | Engine gap if evidenced | Yes |
| Sample size / AQL rules | Sampling plans on QC forms | Not supported | Evidence + engine gap | Yes — never invent AQL |
| Calculated fields | Derived pass/fail, averages | Not supported | Engine gap if evidenced | Yes |
| Conditional fields | Show/hide by prior answer | Not supported | Engine gap if evidenced | Yes |
| Date / time responses | Calibration due, check time | Not first-class type | Possible type extension | Yes |
| Attachments / photos | Evidence of label, seal, hygiene | Module `evidence` not started; not a response type | Architecture + module | Yes |
| Equipment / instrument reference | Device ID, calibration status | `instruments` not started | Module + definition link | Yes |
| Control-point metadata (CCP/OPRP/PRP/GMP) | HACCP plan linkage | Not on ChecklistItem as approved taxonomy | Evidence (ASM-002) then model | Yes — do not invent |
| Scheduled / time-based tasks | Shift/hourly checks | Scheduling is batch-task foundation; recurrence later | Scheduling policy evidence | Yes |
| Product-spec version pin | Spec revision on measurement | Product foundation only; specs unresolved | MASTER-001 / APR-006 | Yes |

## Gap vs FG-QA-001 proposed draft (not company evidence)

The project-proposed FG-QA-001 draft uses only current primitives (YES_NO, YES_NO_NA, NUMBER, TEXT, SELECT). That **does not** prove the company needs only those types. Real forms may require gaps above.

## How to use this map during discovery

1. When classifying a real form item, set Response Type to a current primitive **or** leave blank and note required capability in Notes.  
2. Aggregate blank/gap Notes into backlog candidates.  
3. Promote a gap to implementation only with: APPROVED FOR DIGITALIZATION form + ADR + phase authorization.

## Non-goals for Phase 06F

- No model/migration changes  
- No new response types  
- No invented CCP/OPRP or limits  
- No claim that industry research equals company need

## Phase 06G follow-on

Architecture for extending the **existing** versioned checklist domain (not a parallel engine):
[ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md](../../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md).

Implementation units **06H–06M** are design-sequenced only; business values remain evidence-gated. AI-suggested JSON Schema / expression languages / new SPA frameworks are **rejected** for v2 (see ADR-019).
