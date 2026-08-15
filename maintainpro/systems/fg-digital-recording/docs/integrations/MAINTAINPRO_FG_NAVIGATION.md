# MaintainPro → FG Digital Recording Navigation Integration

## Goal

MaintainPro users get a professional navigation entry **FG Digital Recording** that opens the **separate** FG application in a normal browser navigation (new tab or same tab per MaintainPro UX norms).

## Hard constraints

- Systems remain independently deployable
- Do **not** merge repositories
- Do **not** iframe FG inside MaintainPro
- Do **not** pass login credentials in the URL
- Do **not** hard-code production URL in UI source

## Configuration

```text
# MaintainPro environment (example)
FG_DIGITAL_RECORDING_URL=http://localhost:8001

# Production placeholder (set in MaintainPro env only)
FG_DIGITAL_RECORDING_URL=https://fg.nelna.lk
```

If config is missing: hide the menu entry or show a disabled “not configured” state — never a broken link to a hard-coded host.

## Same-server hosting model (logical isolation)

```text
SERVER
 |
 +-- MaintainPro  → maintenance.nelna.lk
 +-- FG Digital Recording → fg.nelna.lk
```

| Concern | Rule |
| --- | --- |
| Codebases | Separate Git repos |
| Runtime | Separate services |
| Env / secrets | Separate |
| Logs | Separate |
| Databases | `maintainpro_db` and `nelna_fg_db` (separate DBs; shared PG instance OK) |

## Current execution status (this workstation)

Searched expected development roots (`C:\Projects`, obvious Maintain* folders).
**No authorized MaintainPro repository was found.**

```text
MAINTAINPRO CODE INTEGRATION BLOCKED — REPOSITORY PATH REQUIRED
```

## When path is provided

1. Inspect MaintainPro nav/sidebar + permission patterns.
2. Add **FG Digital Recording** entry using existing design system/icon set.
3. Wire to `FG_DIGITAL_RECORDING_URL`.
4. Permission-aware: only show to authorized MaintainPro roles (company mapping **OWNER REQUIRED**).
5. Test desktop and mobile navigation.
6. Document PR in MaintainPro repo only (no FG code copy).

## Sign-off fields (blank)

| Field | Value |
| --- | --- |
| MaintainPro repo path | |
| Implementer | |
| Reviewer | |
| FG URL staging | |
| FG URL production | |
| Date | |
