# Figma Tokens and Components Build Specification — Phase 01B

**Document status:** Instruction for Figma pages 04–05 — see also implementation log for actual Figma work  
**Phase:** 01B-R  
**Last updated:** 2026-08-04

**Prefer detailed guides:** [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md) · [FIGMA_COMPONENT_BUILD_GUIDE.md](FIGMA_COMPONENT_BUILD_GUIDE.md) · [FIGMA_IMPLEMENTATION_LOG.md](FIGMA_IMPLEMENTATION_LOG.md)

Owners create or update the Figma Professional file using this specification plus [DESIGN_TOKENS.md](DESIGN_TOKENS.md) and [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md). Do not generate binary image assets in git. Do not copy unrelated design systems or unlicensed brand assets.

## Prerequisites

- Phase 01A approved as proposed baseline ([PHASE_01A_DESIGN_APPROVAL.md](../approvals/PHASE_01A_DESIGN_APPROVAL.md))
- Open business decisions remain tagged — do not paint them as final operational truth

## Figma pages to build in 01B

| Page | Deliverable |
| --- | --- |
| 04 Design Tokens | Primitive + semantic variable collections; type styles; effect styles; pattern styles for critical/blocked |
| 05 Components | Component set for inventory in COMPONENT_SYSTEM.md with auto-layout and variants |
| 00–03, 11 | Do not rebuild; link/annotate if token application notes needed |
| 06–10, 12 | Remain stubs until **01C** |
| 13 Developer Handoff | Add token→CSS variable mapping table frame linking to repo docs |
| 99 Archive | Unused experiments |

## Variables setup

1. Collection `primitive` — colour, space, radius, size numbers  
2. Collection `semantic` — aliases for surfaces, text, borders, actions, status  
3. Mode: `Light` only (Dark deferred — TOK-002)  
4. Name variables to match token paths (`color/brand/600`, `sem/text/primary`, …)

## Text styles

Create Figma text styles bound to font tokens:

- `text/body`, `text/body-strong`, `text/label`, `text/title-sm`, `text/title-md`, `text/title-lg`, `text/critical`, `text/meta`, `text/mono`

Load Noto Sans Sinhala (or approved equivalent) in the file for operator samples. Pending SI strings use `SI: [pending translation]` pattern.

## Component build order

1. Focus ring / base field  
2. Buttons (primary/secondary/danger/ghost/operator)  
3. Pass/fail control  
4. Status chip + banners (incl. blocked pattern)  
5. Task row + queue row  
6. Evidence thumbnail + capture bar  
7. Bottom nav + side nav  
8. Connectivity chip + sync queue item  
9. Empty/skeleton/error summary  
10. Modal confirm + bottom sheet  
11. Auth panels  
12. KPI card  

Publish as a team library when the owner’s Figma plan allows ([DECISION REQUIRED] workspace).

## Frame naming on page 04–05

- `04/tokens/colour-primitives`
- `04/tokens/colour-semantic`
- `04/tokens/typography`
- `04/tokens/spacing-sizing`
- `04/tokens/status-patterns`
- `05/comp/[category]/[name]/overview`
- Specimens: `05/comp/button/primary/_specimen`

## Review status badges

Frames: `Draft` · `In review` · `Approved with conditions` · `Approved` · `Rejected`  
Do not mark 01B Approved without [PHASE_01B_DESIGN_APPROVAL.md](../approvals/PHASE_01B_DESIGN_APPROVAL.md).

## Version history

Figma versions: `v0.3-01B-tokens`, `v0.4-01B-components`, `v0.5-01B-review`  
Pair with git PR for this documentation branch.

## Handoff notes for later Django/Tailwind

| Figma | Implementation |
| --- | --- |
| Semantic variables | `:root` CSS variables |
| Space / type | Tailwind theme extension |
| Components | Django partials + Tailwind classes; HTMX targets annotated in 01C |
| Status comps | Shared partial ensuring text+icon+pattern |

## Explicit non-claims

- No high-fidelity MVP screens completed in 01B  
- No application code  
- No final Sinhala regulatory translations  
- No Nelna temperature limits or form field catalogues invented  
