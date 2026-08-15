# Phase 06 — Configurable Checklist Provisional Configuration

**Document status:** Owner-directed provisional technical decision — not real-content approval  
**Created:** 2026-08-07  
**Decision date:** 2026-08-07

## Facts

1. Official checklist forms and operational content were **not** supplied (TEMPLATE-001 / ASM-003 remain EVIDENCE REQUIRED).
2. ASM-001 temperature-class business content remains unresolved; Phase 06A must not invent limits, ranges, or pass/fail rules.
3. MASTER-001 remains unresolved; Phase 06A must not rely on unsupported FG Product attributes.
4. Phase 06 proceeds with a **configurable definition and versioning engine only**.
5. No actual operational checklist content is approved or seeded.
6. Phase 06A does **not** authorize checklist execution, scheduling, recording, review, verification, or evidence.
7. Phase 07+ remain separate modules.
8. This decision does **not** authorize pilot, deployment, or production use.

## Provisional technical rules

1. Bounded context: `apps/checklists` — definitions only.
2. Entities: `ChecklistTemplate`, `ChecklistVersion`, `ChecklistSection`, `ChecklistItem`.
3. Organization-scoped templates; optional provisional `FGProduct` association (not mandatory until evidenced).
4. Version lifecycle: DRAFT → PUBLISHED → RETIRED.
5. Published versions are immutable through application services.
6. New changes require a new DRAFT (clone or blank).
7. No response-type engine in 06A (deferred — EVIDENCE REQUIRED).
8. No temperature/limit/instrument/training/photo/signature fields.
9. Permissions: `checklists.view_checklisttemplate`, `checklists.manage_checklist`.
10. Mutations emit `CHECKLIST_*` security audit events with safe metadata only.

## Related

- [ADR-010-CHECKLIST-DEFINITION-VERSIONING.md](../architecture/ADR-010-CHECKLIST-DEFINITION-VERSIONING.md)
- [ASSUMPTION_REGISTER.md](../business/ASSUMPTION_REGISTER.md)
- [ROADMAP.md](../ROADMAP.md)
