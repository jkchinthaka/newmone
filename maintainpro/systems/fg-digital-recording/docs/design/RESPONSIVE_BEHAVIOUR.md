# Responsive Behaviour

**Document status:** Proposed breakpoints — not tied to a single device SKU  
**Phase:** 01A  
**Last updated:** 2026-08-04

Design fluidly between bands. Pixel values are **PROPOSED**.

## Breakpoint bands

| Band | Approx width | Primary personas | Shell behaviour |
| --- | --- | --- | --- |
| Small phone | ~320–389px | Operator | Single column; bottom nav; sticky CTA; compact header |
| Large phone | ~390–599px | Operator, Supervisor | Same as small with slightly denser lists |
| Tablet | ~600–1023px | Supervisor, QA | Optional split list/detail; larger touch still; may use side or bottom nav |
| Laptop | ~1024–1279px | QA, Admin, Management, Auditor | Persistent side nav; tables; multi-pane detail |
| Desktop | ~1280px+ | Admin, Auditor, Management | Max content width constrained for readability; dense tables OK |

Do not design only for one iPhone or one Android resolution.

## Behaviour rules by band

### Small / large phone

- One primary column.
- Queues as cards.
- Avoid hover-only actions.
- Fixed bottom navigation for operator (≤5 items).
- Modals full-screen or bottom sheets.

### Tablet

- Review/verify: list + detail split when width allows.
- Side-by-side evidence and failed items when possible.
- Still meet 48px targets.

### Laptop / desktop

- Side navigation for QA/Admin/Management/Auditor.
- Keyboard-first enhancements allowed but touch still works.
- Admin forms in drawers or dedicated pages — [DECISION REQUIRED] pattern.

## Content reflow

- Sinhala labels wrap; do not truncate critical status.
- Tables on small screens become stacked definition lists or cards.
- KPI dashboards collapse from 6→2 columns→1.

## Images / evidence

- Thumbnails in lists; full viewer on detail.
- Pinch/zoom capability is a later enhancement note — ensure at least open full image.

## PWA install

- UI must remain usable in standalone display mode (no browser chrome).
- Account for safe-area insets on notched phones.

## Testing matrix (proposed)

| Band | Representative test widths |
| --- | --- |
| Small phone | 360 |
| Large phone | 412 |
| Tablet | 768, 834 |
| Laptop | 1024, 1280 |
| Desktop | 1440 |

Exact device lab list [OWNER REQUIRED].
