# Accessibility Technical Review (Feature Freeze)

**Date:** 2026-08-12
**Scope:** Code/CSS review of operator-facing surfaces.
**Not a substitute for:** real-device UAT, Sinhala UAT, or formal a11y audit sign-off.

## Already present (retained)

| Area | Evidence |
| --- | --- |
| Focus visibility | `static/src/css/app.css` `:focus-visible` rules |
| Skip link | `.skip-link:focus` |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` |
| Status live regions | `aria-live="polite"` on loading / checklist status |

## Findings

| ID | Severity | Finding | Action |
| --- | --- | --- | --- |
| A11Y-01 | Medium | Sinhala typography on factory tablets not evidenced | EXTERNAL — Device UAT (UAT-15) |
| A11Y-02 | Low | Touch target sizing not uniformly enforced to 44×44 | Accept for freeze unless UAT defect; prefer CSS utility if defect filed |
| A11Y-03 | Low | Color alone must not convey Acceptable/Unacceptable / PASS/FAIL | Labels are textual (Acceptable/Unacceptable, PASS/FAIL) — OK; keep icons secondary |
| A11Y-04 | Info | Modal focus trap depends on Alpine usage sites | Spot-check during human UAT-14/15 |

## Policy under feature freeze

- Fix only confirmed UAT defects or clear blockers.
- Do not close Sinhala/device debt without real-device evidence.
- Human fields remain in `docs/uat/DEVICE_UAT_MATRIX.md`.
