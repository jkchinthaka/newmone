# UAT Checklist

Use with staging: **Web** `https://newmone.chinthakajayaweera1.workers.dev` · **API** `https://newmone.onrender.com/api`

Credentials from secret manager only — never commit passwords.

Also see [FINAL_UAT_AND_CUTOVER_CHECKLIST.md](FINAL_UAT_AND_CUTOVER_CHECKLIST.md) for cutover-specific items.

## Automated helpers

```bash
# Hosted smoke (shell env)
npm run smoke:deploy

# Staging browser (shell env)
npm run test:e2e:staging
```

---

## Authentication

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Admin login | ☐ | ☐ | |
| Manager login | ☐ | ☐ | |
| Technician login | ☐ | ☐ | |
| Security officer login | ☐ | ☐ | |
| Store keeper login | ☐ | ☐ | |
| Invalid password message | ☐ | ☐ | Must show "Invalid email or password", not session_expired redirect |
| Logout | ☐ | ☐ | |
| Session expiry redirect | ☐ | ☐ | `/login?reason=session_expired` |

---

## MVP workflow

| Step | Pass | Fail | Notes |
|------|------|------|-------|
| Create / view asset | ☐ | ☐ | |
| Create work order | ☐ | ☐ | |
| Approve work order (if permitted) | ☐ | ☐ | |
| Assign technician | ☐ | ☐ | |
| Reserve / request spare part | ☐ | ☐ | |
| Technician updates job status | ☐ | ☐ | |
| Upload evidence (metadata/readiness) | ☐ | ☐ | |
| Supervisor verifies / completes | ☐ | ☐ | |
| Cost visible on WO | ☐ | ☐ | |
| Dashboard/report reflects update | ☐ | ☐ | |
| Audit log entry created | ☐ | ☐ | Settings → Audit or API |

---

## Security officer

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Login as `security@maintainpro.local` | ☐ | ☐ | |
| Only security/fleet menus visible | ☐ | ☐ | |
| Gate-out allowed vehicle | ☐ | ☐ | |
| Gate-out blocked (expired docs) | ☐ | ☐ | |
| Gate-in | ☐ | ☐ | |
| Unauthorized override denied | ☐ | ☐ | |
| Audit record on gate action | ☐ | ☐ | |
| Mobile/web scan if available | ☐ | ☐ | |

---

## Admin / regression (post `039e361`)

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| `/admin` no React #310 | ☐ | ☐ | |
| `/action-center` no crash | ☐ | ☐ | |
| Non-admin `/admin` permission state | ☐ | ☐ | |

---

## Inventory

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Low-stock visible | ☐ | ☐ | |
| Part reservation on WO | ☐ | ☐ | |
| Stock issue | ☐ | ☐ | |
| Negative stock prevented / warned | ☐ | ☐ | |

---

## ERP sync

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Mode badge (mock/sandbox/live) | ☐ | ☐ | System health / inventory ERP panel |
| Dry-run sync | ☐ | ☐ | |
| Failed sync reason visible | ☐ | ☐ | |
| Retry / refresh readiness | ☐ | ☐ | |

---

## Notifications

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Readiness panel loads | ☐ | ☐ | `/system-health` |
| UAT email test (allowlisted) | ☐ | ☐ | Only if UAT flags enabled |
| UAT SMS test | ☐ | ☐ | |
| Push provider status honest | ☐ | ☐ | mock/live/disabled |

---

## Reports

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Reports dashboard loads | ☐ | ☐ | |
| Overdue / open WO metrics | ☐ | ☐ | |
| Export if available | ☐ | ☐ | |

---

## Production validation

| Check | Pass | Fail |
|-------|------|------|
| `npm run typecheck` | ☐ | ☐ |
| `npm run test` | ☐ | ☐ |
| `npm run build` | ☐ | ☐ |
| `npm run smoke:deploy` | ☐ | ☐ |
| Deployment URL reachable | ☐ | ☐ |
| No secrets in repo | ☐ | ☐ |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | PARTIAL / PASS / FAIL |
| Product owner | | | |
| DevOps | | | |

**Current status (2026-06-15):** PARTIAL — wrong-password UX verified on staging; full authenticated UAT blocked until smoke/seed password aligned with hosted DB.
