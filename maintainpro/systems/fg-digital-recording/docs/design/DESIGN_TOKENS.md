# Design Tokens — Phase 01B

**Document status:** Proposed token system for design review — not a brand or certification claim  
**Phase:** 01B-R — reconciled to owner-approved palette  
**Last updated:** 2026-08-04  
**Depends on:** Phase 01A approved baseline

**Canonical companions (prefer these for detail):**
- [DESIGN_SYSTEM_FOUNDATIONS.md](DESIGN_SYSTEM_FOUNDATIONS.md)
- [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md)
- [CONTRAST_VALIDATION.md](CONTRAST_VALIDATION.md)
- [PHASE_01B_DECISIONS.md](PHASE_01B_DECISIONS.md)
- Machine-readable: [`design/tokens/nelna-fg.tokens.json`](../../design/tokens/nelna-fg.tokens.json)

**Palette reconciliation:** An earlier draft used teal `#0F6B5C` neutrals. That draft is **superseded** by the approved industrial palette below (P1B-001). Do not implement the superseded teal values.

This specification defines Figma variables and implementation-facing token names for later Django/Tailwind mapping. It does **not** invent Nelna operational limits or claim production UI readiness.

Visual direction: operational factory-floor clarity — cool green-tinted neutrals, strong primary green actions, gold as decorative accent only, high-contrast critical red. Avoid purple marketing gradients and cream/terracotta editorial themes.

---

## Token layers

| Layer | Purpose |
| --- | --- |
| Primitive | Raw palette, type sizes, space scale |
| Semantic | Role-based usage (text, surface, border, status, focus) |
| Component | Optional aliases bound inside components |

Figma collections: see [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md). Light mode only (no dark mode in MVP).

---

## Colour — primitives (approved palette direction)

| Token | Value | Notes |
| --- | --- | --- |
| `color.primitive.neutral.0` | `#FFFFFF` | Surface |
| `color.primitive.neutral.50` | `#F6F8F6` | App background |
| `color.primitive.neutral.200` | `#DDE4DF` | Border |
| `color.primitive.neutral.500` | `#5C685F` | Secondary text |
| `color.primitive.neutral.900` | `#17211A` | Primary text |
| `color.primitive.green.700` | `#216E39` | Primary |
| `color.primitive.green.800` | `#18572C` | Primary hover |
| `color.primitive.green.100` | `#E8F4EB` | Primary soft |
| `color.primitive.gold.500` | `#C7A94B` | Decorative only — **not body text** |
| `color.primitive.gold.100` | `#F8F2DD` | Gold soft panels |
| `color.primitive.success.700` | `#237A45` | Success |
| `color.primitive.warning.700` | `#B76E00` | Warning — **not AA normal body on white** |
| `color.primitive.critical.700` | `#C93434` | Critical |
| `color.primitive.info.700` | `#2563A8` | Information |

---

## Colour — semantic

| Token | Maps to / value |
| --- | --- |
| `color.semantic.action.primary` | green.700 |
| `color.semantic.action.primaryHover` | green.800 |
| `color.semantic.action.primarySoft` | green.100 |
| `color.semantic.text.primary` | neutral.900 |
| `color.semantic.text.secondary` | neutral.500 |
| `color.semantic.text.inverse` | `#FFFFFF` |
| `color.semantic.surface.app` | neutral.50 |
| `color.semantic.surface.card` | neutral.0 |
| `color.semantic.border.default` | neutral.200 |
| `color.semantic.status.success` | success.700 |
| `color.semantic.status.warning` | warning.700 (restricted) |
| `color.semantic.status.critical` | critical.700 |
| `color.semantic.status.information` | info.700 |
| `color.semantic.focus.ring` | green.700 |

Component guidance must use **semantic roles**, not raw hex. Status always pairs text + icon + pattern.

---

## Typography

| Token | Value |
| --- | --- |
| `font.family.sans` | `Inter, "Noto Sans Sinhala", "Noto Sans", system-ui, sans-serif` |
| `font.family.mono` | `ui-monospace, "Noto Sans Mono", monospace` |
| Sizes | 12 / 14 / 16 / 18 / 20 / 24 / 28 |
| Weights | 400 / 500 / 600 / 700 |
| Line heights | 1.25 / 1.45 / 1.6 |

---

## Spacing, sizing, radius, elevation, motion

Unchanged structure from 01B draft: **4px** spacing base; touch **min 48** / operator **56**; radius 4/8/12; minimal elevation; motion 120/200/320ms. Full tables: [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md) and JSON artifact.

---

## Open token decisions

| ID | Topic | Status |
| --- | --- | --- |
| TOK-002 | Dark mode | Deferred / not MVP |
| TOK-003 | Font hosting for Inter + Noto Sans Sinhala | [DECISION REQUIRED] |
| P1B-014 | Darken warning for AA body text | [DECISION REQUIRED] |
