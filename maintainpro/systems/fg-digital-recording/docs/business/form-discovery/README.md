# Real Form Discovery Framework

**Document status:** Formal evidence-collection framework — **not** approved Nelna form content  
**Phase:** 06F  
**Created:** 2026-08-09  
**Related:** ASM-003, APR-001, APR-028, TEMPLATE-001, FG-QA-001 proposed draft  

## Purpose

Prevent Checklist Engine v2 (and any future checklist digitalization) from being based on **invented** forms, limits, sample sizes, AQL values, HACCP classifications, role authority, or ERP payloads.

This folder is the **company evidence intake path** for real Finished Goods (FG) and related QA/production forms.

## Hard rules

1. **Silence is not approval.** Collecting a form does not approve it for digitalization.
2. **AI reports are research inputs only** — never company evidence. See [FORM_DISCOVERY_GUIDE.md](FORM_DISCOVERY_GUIDE.md#ai-research-handling).
3. Do **not** pre-fill temperature limits, metal-detector limits, sample sizes, AQL, product codes, CCP/OPRP labels, or role authority as Nelna facts.
4. FG-QA-001 remains a **project-proposed DRAFT** until APR-001 is APPROVED with written owner evidence.
5. Status vocabulary for forms is defined in [FORM_EVIDENCE_REGISTER.md](FORM_EVIDENCE_REGISTER.md) — distinct from technical IMPLEMENTED status.

## Package contents

| Artifact | Role |
| --- | --- |
| [FORM_DISCOVERY_GUIDE.md](FORM_DISCOVERY_GUIDE.md) | How to request, classify, and gate forms |
| [FORM_INVENTORY_TEMPLATE.csv](FORM_INVENTORY_TEMPLATE.csv) | Header-only inventory of candidate company forms |
| [FORM_ITEM_CLASSIFICATION_TEMPLATE.csv](FORM_ITEM_CLASSIFICATION_TEMPLATE.csv) | Header-only per-item classification worksheet |
| [FORM_EVIDENCE_REGISTER.md](FORM_EVIDENCE_REGISTER.md) | Tracking register (status, owners, gaps) |
| [RESPONSE_ENGINE_GAP_MAP.md](RESPONSE_ENGINE_GAP_MAP.md) | Current engine primitives vs possible future needs |

## Current company evidence (repository truth)

| Item | Status |
| --- | --- |
| Complete paper-form inventory (ASM-003 / APR-028) | **NOT RECEIVED** |
| Official FG checklist controlled source | **NOT RECEIVED** (proposal states none suitable exists today) |
| FG-QA-001 | Project-proposed DRAFT only — **NOT APPROVED** |
| TEMPLATE-001 intake | Evidence contract exists; content unresolved |
| Claude/Gemini industry reports | **INDUSTRY RESEARCH / PROPOSED DESIGN INPUT** only — not evidence |

## Downstream gate

Checklist Engine v2 schema/work **must not** start from invented form structures. Prefer:

1. Inventory rows with Evidence Source  
2. Item classification from the real form  
3. Status **APPROVED FOR DIGITALIZATION** (written)  
4. Then definition build under existing checklist versioning rules  

Architecture for future capability extensions (repeating, calculated, conditionals, evaluation, control-point metadata, numeric hardening): [ADR-019](../../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md) and [PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md](../PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md). **06G is design only.**

## Links

- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](../TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [proposals/FG_QA_001_DRAFT_V0_1.md](../proposals/FG_QA_001_DRAFT_V0_1.md)
- [ASSUMPTION_REGISTER.md](../ASSUMPTION_REGISTER.md) (ASM-003)
- [APPROVAL_REGISTER.md](../../governance/APPROVAL_REGISTER.md) (APR-001, APR-028, APR-036+)
- [ADR-019 Checklist Engine v2](../../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md)
