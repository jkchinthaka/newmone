# Frontend Foundation

**Document status:** Phase 02 foundation guidance
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

## Stack (Phase 02)

| Piece | Version / approach |
| --- | --- |
| Django Templates | Project `templates/` |
| Tailwind CSS | **4.3.3** via `@tailwindcss/cli` |
| htmx | **2.0.10** vendored locally (`npm` + copy script) |
| django-htmx | **1.27.0** |
| Node | **24.18.0** |
| Design tokens | Generated from `design/tokens` into CSS |

Build scripts: see `package.json` (`build:tokens`, `copy:vendor`, `build:css`, `build`).

## Explicit exclusions (Phase 02)

| Item | Status |
| --- | --- |
| Alpine.js | **Not included** |
| CDN scripts/styles | **Not used** — vendor assets copied into `static/` |
| PWA / service worker / web app manifest | **Not included** (ADR-003 remains longer-term direction; not implemented here) |
| Font binary files | **Not committed** |

## Sinhala typography and DEBT-01C-R-NOTO

| Item | Status |
| --- | --- |
| DEBT-01C-R-NOTO | **Open** |
| Noto Sans Sinhala verified | **No** |
| Abhaya Libre production-approved | **No** |
| Phase 02 CSS | Font **stack** may list `"Noto Sans Sinhala"` (plus system fallbacks such as Nirmala UI / Iskoola Pota) |
| Font binaries in repo | **None** |
| Operator UAT / pilot / production | **Blocked** until debt closed with evidence |

Do not claim Noto is verified because the CSS family name appears in the stack.

## Operator-facing constraints (carry-forward)

- Sinhala support remains mandatory for operator-facing content when those UIs are built
- Minimize typing; prefer large touch targets per design tokens
- Contrast restrictions from Phase 01B remain in force for warning/gold text usage

## Related

- [PHASE_02_TECHNICAL_BASELINE.md](../architecture/PHASE_02_TECHNICAL_BASELINE.md)
- [DESIGN_DEBT_REGISTER.md](../design/DESIGN_DEBT_REGISTER.md)
- [ADR-003-RESPONSIVE-PWA.md](../architecture/ADR-003-RESPONSIVE-PWA.md)
- `static/src/css/app.css`
