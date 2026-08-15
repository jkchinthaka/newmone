# Authentication UI Polish

**Document status:** Design implementation note — not an approval form
**Branch:** `design/authentication-ui-polish` (merged via PR #8)
**Created:** 2026-08-06
**Last updated:** 2026-08-07

## Purpose

Record visual and accessibility polish applied to the Phase 03 authentication interface after Phase 03 security approval. This document does **not** authorize production, pilot, operator UAT, or Sinhala UI completion.

## Merge and validation status

| Item | Status |
| --- | --- |
| Implementation | Merged to `main` via PR #8 |
| Local validation | Passed (quality checks, pytest, coverage) |
| Docker validation | Passed (Compose test profile) |
| GitHub Actions | Evidence was **unavailable** during a GitHub Actions incident; **do not claim the missing CI check passed**; do not create retroactive approval claims |

Authentication UI polish is **complete as merged English foundation UI**. It is not Sinhala UI approval and not production readiness.

## Visual design decisions

- Soft neutral app background using design tokens (`--color-surface-app`, soft green tint).
- Centered authentication card with white surface, subtle border, and low elevation.
- Nelna primary green from tokens (`--token-color-semantic-action-primary` / `#216E39`) for primary actions.
- Gold token used only as a calm notice accent on the authenticated landing page.
- Compact brand header (text mark “NELNA”) — no logo binary committed.
- Rounded controls and cards using existing radius tokens.
- Calm internal-enterprise appearance: no glassmorphism, no large animations, no decorative clutter.

## Pages updated

| Page | Path |
| --- | --- |
| Sign in | `templates/accounts/login.html` |
| Change password | `templates/accounts/change_password.html` |
| Forced password change | `templates/accounts/force_password_change.html` |
| Account notice / locked route | `templates/accounts/account_locked.html` |
| Authenticated landing | `templates/accounts/landing.html` |
| Forbidden | `templates/errors/403.html` |
| Shared field / error components | `templates/components/form_field.html`, `auth_error.html` |
| Base layout blocks | `templates/base.html` |
| Local CSS / JS | `static/src/css/app.css`, `static/src/js/app.js` |

## Responsive behavior

Layouts target phone (360px), tablet (768px), and desktop (1366px / 1920px):

- Auth card remains centered and readable without horizontal scroll.
- Primary buttons are full-width in the auth card.
- Landing actions wrap on narrow viewports.
- Short-viewport screens keep the card vertically usable via centered flex layout.

## Accessibility considerations

- Semantic headings, labels, and POST forms retained.
- Accessible error summary for non-field and field errors.
- Password visibility toggle uses `aria-controls`, `aria-pressed`, and accessible labels.
- Visible focus rings use the existing focus token.
- Autocomplete attributes preserved (`username`, `current-password`, `new-password`).
- Minimum practical touch targets (~48px) for buttons and toggles.
- `prefers-reduced-motion` support disables non-essential transitions/animations.
- Errors are text-based, not color-only.

## Security behavior preserved

UI polish does **not** change:

- Generic invalid-login messaging
- Locked-account enumeration protection (login does not redirect to a locked-identifying outcome)
- CSRF protection
- POST-only logout
- Session rotation and forced-password-change middleware
- Password validators and audit events
- Employee-code authentication and scoped RBAC

The `/accounts/locked/` route remains available as a non-enumerating informational page and is not selected from login based on a submitted employee code.

## Manual verification performed

Local visual checks intended for reviewers:

- Login desktop and mobile widths
- Invalid-login generic error
- Change-password and forced-password-change pages
- Authenticated landing and POST logout control
- 403 page
- Keyboard focus order and focus visibility
- Long validation messages and 200% browser zoom

Screenshots may be captured locally for review evidence and are not committed unless repository rules explicitly require them.

## Known limitations

- No approved logo binary is shipped; a text brand mark is used.
- Authentication UI visual polish is separate from Phase 03 security approval conditions.
- Request-level login rate limiting remains deferred (PostgreSQL lockout remains the active control).
- No finished-goods operational modules are presented.

## Sinhala typography debt

**DEBT-01C-R-NOTO remains open.**

- English foundation copy only
- No unverified Sinhala operator-interface copy added
- No Noto Sans Sinhala or other font binaries committed
- No Sinhala typography validation claim
- Sinhala UI approval remains deferred

## Related

- [PHASE_03_ACCOUNTS_RBAC_APPROVAL.md](../approvals/PHASE_03_ACCOUNTS_RBAC_APPROVAL.md)
- [DESIGN_DEBT_REGISTER.md](DESIGN_DEBT_REGISTER.md)
- [FRONTEND_FOUNDATION.md](../frontend/FRONTEND_FOUNDATION.md)
