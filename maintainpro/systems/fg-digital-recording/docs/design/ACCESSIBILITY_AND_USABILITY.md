# Accessibility and Usability

**Document status:** Proposed requirements for design and later implementation  
**Phase:** 01A  
**Last updated:** 2026-08-04

## Target

Aim for **WCAG 2.2 Level AA** for interactive operator and QA flows ([NON_FUNCTIONAL_REQUIREMENTS.md](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md) — PROPOSED until approved). Formal conformance audit is a later gate — do not claim certified AA yet.

## Keyboard access

- All interactive controls reachable by keyboard on tablet/desktop shells.
- Logical focus order: header → main → primary actions.
- No keyboard traps in modals; Esc closes where used.

## Visible focus

- High-visibility focus ring on all interactive elements; never remove outline without replacement.

## Form labels

- Every input has a persistent visible label (not placeholder-only).
- Groups (pass/fail) use fieldset/legend or explicit group labels.

## Error summaries

- Page-level summary listing errors with links/jumps to fields.
- Inline errors adjacent to fields; announced to assistive tech.

## Screen-reader announcements

- Live regions for submit result, sync state changes, critical banners.
- Status text must include plain language, not colour name alone (“Critical failure”, not “red item”).

## Non-colour status indicators

Combine **text + icon + shape/pattern** (and colour as enhancement only).

## Contrast

- Text/icon contrast aligned to WCAG AA targets for normal and large text.
- Critical banners: strong contrast; never light-grey on white for warnings.

## Touch targets

| Requirement | Value |
| --- | --- |
| Minimum touch target | **48×48 CSS px** |
| Recommended operational target | **48–56 CSS px** for primary operator controls |
| Spacing | Adequate gap to reduce mis-taps with gloves |

## Glove use / wet / cold

- Large controls; avoid tiny icon-only primary actions.
- Confirm hygiene/device SOP constraints [EVIDENCE REQUIRED] ASM-011 before final industrial accessories guidance.

## One-handed mobile use

- Primary CTA in thumb-reachable sticky bottom region.
- Destructive actions not adjacent to primary without confirmation.

## Reduced typing

- Selects, toggles, steppers, scan entry preferred over free text.
- Free text only when evidenced as required.

## Numeric keyboard

- `inputmode`/equivalent for measurements and codes.

## Barcode / QR scanning concept

- Optional Scan entry in IA [DECISION REQUIRED].
- Provide non-scan fallback always (manual task open).

## Device orientation

- Operator flows support portrait primary; landscape must not clip sticky CTA.
- Locking orientation is a device-policy decision [DECISION REQUIRED].

## Network-loss visibility

- Persistent connectivity/sync chip.
- Honest offline copy per Content guide.
- Never imply server submission without ACK.

## Usability acceptance observations (design)

- Normal checklist path fewer taps than paper equivalent fields (validate in UAT).
- Critical and LOADING BLOCKED states identifiable in ≤1 second glance test in review sessions.
