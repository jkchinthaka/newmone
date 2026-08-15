# ADR-035 — Versioned HACCP / control-point foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 23

## Context

Finished Goods checklists already carry optional `control_point_class` / `criticality` metadata (06L). The business still needs a versioned place to represent an **approved** company HACCP plan later, without inventing Nelna CCPs, critical limits, monitoring values, or corrective actions.

## Decision

1. Introduce `apps.haccp` with `HaccpPlan` / `HaccpPlanVersion` / `ProcessStep` / `Hazard` / `ControlMeasure` / `ControlPoint`.
2. Hazard categories are generic industry shells: BIOLOGICAL / CHEMICAL / PHYSICAL / ALLERGEN.
3. HACCP control-point types are CCP / OPRP / PRP. Checklist GMP/QUALITY remain on ChecklistItem (06L).
4. `CriticalLimitReference` stores references (rule/spec/unit/precision/boundary semantics) — numeric bounds stay null unless loaded from approved evidence.
5. Monitoring and corrective-action rows are reference shells; auto HOLD/NCR flags default **False**.
6. `ChecklistItemHaccpBinding` links an item to an exact plan version + control point and freezes `frozen_haccp_context` for historical integrity.
7. APPROVED/RETIRED versions are immutable. `approve_haccpplan` is separate from `manage_haccpplan`; System Admin is not assumed to hold food-safety approval authority.
8. Persistence remains PostgreSQL SoR (ADR-002).

## Consequences

- Actual company HACCP plan content remains **COMPANY EVIDENCE REQUIRED** (APR-027 / ASM-002 and new APR-048).
- AI-generated HACCP examples are not approval evidence.
- No production go-live implication.
