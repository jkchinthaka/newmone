# Design System Foundations — Phase 01B

**Document status:** Proposed foundations aligned to owner-approved palette — awaiting Phase 01B design-system approval  
**Phase:** 01B-R  
**Last updated:** 2026-08-04  
**Canonical tokens:** [DESIGN_TOKENS.md](DESIGN_TOKENS.md) · [nelna-fg.tokens.json](../../design/tokens/nelna-fg.tokens.json) · [FIGMA_VARIABLES_SPEC.md](FIGMA_VARIABLES_SPEC.md)

Earlier teal values in the first 01B draft are **superseded** by the approved palette below. See [PHASE_01B_DECISIONS.md](PHASE_01B_DECISIONS.md).

---

## Design principles

1. **Operational clarity over decoration** — factory-floor readability first.
2. **Faster than paper** for the normal operator path.
3. **Minimal typing** — large pass/fail, selects, numeric pads, scan.
4. **Honest system state** — never call local saves “submitted”.
5. **Status is multi-encoded** — text + icon + pattern; colour is enhancement only.
6. **Critical is unmissable** — blocked/hold/critical use strong banners.
7. **Sinhala-first operators** — layouts tolerate longer strings.
8. **One responsive PWA** — shared components across breakpoints.
9. **Semantic tokens in components** — never hard-wire raw hex in component guidance.
10. **No invented Nelna limits** — measurement fields show units from templates only.

## Industrial and food-production visual direction

Cool, clean production aesthetic: light green-tinted neutrals, strong primary green actions, gold as secondary accent only (not body text), high-contrast critical red. Avoid purple marketing gradients and cream/terracotta editorial looks.

## Brand colours (approved palette — proposed for system use)

| Role | Hex | Notes |
| --- | --- | --- |
| Primary green | `#216E39` | Primary actions |
| Primary hover | `#18572C` | Pressed/hover primary |
| Primary soft | `#E8F4EB` | Soft fills, selected backgrounds |
| Secondary gold | `#C7A94B` | Accent only — **not** body text (fails AA) |
| Gold soft | `#F8F2DD` | Soft accent panels |
| App background | `#F6F8F6` | App chrome |
| Surface | `#FFFFFF` | Cards, sheets |
| Primary text | `#17211A` | Body/titles |
| Secondary text | `#5C685F` | Meta, hints |
| Border | `#DDE4DF` | Dividers, input borders |

## Semantic colours

| Semantic role | Token concept | Value |
| --- | --- | --- |
| `action.primary` | Primary green | `#216E39` |
| `action.primary.hover` | Primary hover | `#18572C` |
| `action.primary.soft` | Primary soft | `#E8F4EB` |
| `text.primary` | Primary text | `#17211A` |
| `text.secondary` | Secondary text | `#5C685F` |
| `text.inverse` | White on strong fills | `#FFFFFF` |
| `surface.app` | App background | `#F6F8F6` |
| `surface.card` | Surface | `#FFFFFF` |
| `border.default` | Border | `#DDE4DF` |
| `status.success` | Success | `#237A45` |
| `status.warning` | Warning | `#B76E00` — **large text / UI chrome only unless darkened** (see contrast doc) |
| `status.critical` | Critical | `#C93434` |
| `status.information` | Information | `#2563A8` |
| `accent.gold` | Secondary gold | `#C7A94B` — decorative/accent only |
| `accent.gold.soft` | Gold soft | `#F8F2DD` |

Component guidance must reference **semantic roles**, not raw hex.

## Typography

| Role | Stack |
| --- | --- |
| UI sans | `Inter, "Noto Sans Sinhala", "Noto Sans", system-ui, sans-serif` |
| Sinhala emphasis | Prefer Noto Sans Sinhala glyphs within the stack |
| Mono | `ui-monospace, "Noto Sans Mono", monospace` for codes/measurements |

Scale (proposed): 12 / 14 / 16 / 18 / 20 / 24 / 28 px with weights 400/500/600/700. Line-height 1.45 body for Sinhala.

## Sinhala typography

- Operator strings: Sinhala-first; allow +30–40% width vs English [ASSUMPTION].
- Do not invent final regulatory Sinhala; use pending placeholders until glossary approval.
- Avoid truncating critical status in SI.

## Spacing

4px base: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56.

## Layout

- Operator: single column, sticky bottom CTA, bottom nav ≤5.
- Queues tablet+: list/detail split.
- Admin/QA desktop: sidebar + content ≤ max readable width.

## Responsive reference frames

| Reference | Width (proposed) |
| --- | --- |
| Phone small | 360 |
| Phone large | 412 |
| Tablet | 768 |
| Laptop | 1024 |
| Desktop | 1440 |

## Border radius

`sm 4` · `md 8` · `lg 12`. Avoid pill primary CTAs on the floor.

## Borders

Default `border.default` 1px. Strong focus/error borders 2px with semantic colour + text.

## Elevation

Minimal: none for lists; light shadow for sheets/modals only.

## Iconography

**Proposed:** Lucide icon set (consistent stroke). Always pair icons with text for status. [DECISION REQUIRED] final icon pack license confirmation.

## Motion

Fast 120ms · normal 200ms · standard easing. Honor `prefers-reduced-motion`.

## Accessibility

Target WCAG 2.2 AA. See [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md) and [CONTRAST_VALIDATION.md](CONTRAST_VALIDATION.md).

## Touch-target strategy

Minimum **48×48px**. Preferred operator primaries **48–56px**.

## Low-connectivity considerations

Persistent connectivity chip; sync queue honesty; never “submitted” before server ACK; degraded read with stale badge when applicable.
