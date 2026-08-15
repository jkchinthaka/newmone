# MaintainPro ↔ FG Digital Recording — Future SSO Boundary

**Do NOT implement fake SSO in this package.**

## Target architecture (future)

```text
MaintainPro
    ↓
Identity Provider / SSO (OIDC or SAML — company approved)
    ↓
FG Digital Recording (independent authorization)
```

## Requirements

| Requirement | Notes |
| --- | --- |
| Common IdP | Company-chosen; not invented here |
| Protocol | OIDC/SAML where approved |
| Independent FG authorization | MaintainPro role ≠ FG QA privilege |
| No tokens in query parameters | Use secure browser flows / headers only |
| Separate sessions until IdP live | Deep-link opens FG; user authenticates to FG |
| Audit | Login and role mapping audited in FG |

## Non-goals (now)

- Password sharing via URL
- Automatic privilege elevation from MaintainPro roles
- Merging codebases or databases

## Status

```text
FUTURE ARCHITECTURE DOCUMENTED — IdP NOT IMPLEMENTED
EXTERNAL BLOCKER — IDENTITY PROVIDER SELECTION / CONTRACT REQUIRED
```
