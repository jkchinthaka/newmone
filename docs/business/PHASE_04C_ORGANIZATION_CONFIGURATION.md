# Phase 04C — Organization and Shift Configuration Foundation

**Document status:** Technical configuration foundation — **not** official Nelna value approval  
**Phase:** 04C  
**Authority separation:** TECHNICALLY SUPPORTED ≠ BUSINESS APPROVED / EVIDENCE SUPPLIED

## Evidence check (truthful)

| Gate | Status | Implication |
| --- | --- | --- |
| ASM-004 Organization / Site / Department names & codes | **DECISION REQUIRED** | No official values loaded |
| ASM-005 Shift names & codes | **EVIDENCE REQUIRED** | No official Shift rows seeded |
| ASM-006 Shift times / overnight / effective-date policy | **DECISION REQUIRED** | Provisional overnight rule only (`end_time <= start_time`) |
| APR-002 / APR-003 / APR-004 | **EVIDENCE REQUIRED** | Production config blocked |

**No real company Organization/Site/Department/Shift catalogue was available in-repo.**  
Phase 04C therefore delivers **safe configuration + controlled import support only**.

## TECHNICALLY SUPPORTED

- Organization / Site / Department / Shift models (Phase 03 + 04A)
- Soft activate/deactivate lifecycle; **hard delete refused**
- Shift `effective_from` / `effective_to` and overnight derivation (provisional)
- Hierarchy integrity validations (org ownership, site under org, department under site when set)
- Object-scoped management permissions:
  - `organizations.manage_organization`
  - `organizations.manage_site`
  - `organizations.manage_department`
  - `organizations.manage_shift` (existing)
- Audited create/update/activate/deactivate for org/site/department/shift
- Controlled CSV import: dry-run, preview, duplicate report, validation, atomic write, error file, audit
- Header-only import template (no sample company data)
- Management command: `import_organization_hierarchy`
- Shift management UI remains Phase 04B; org/site/department practical admin search/filter retained

## NOT delivered as company fact

- Official Nelna codes, names, or shift times
- Seeded Day/Night or site catalogues
- Claim that overnight calendar-day policy is business-approved

## Import usage

```text
python manage.py import_organization_hierarchy --write-template docs/business/templates/ORGANIZATION_HIERARCHY_IMPORT_TEMPLATE.csv
python manage.py import_organization_hierarchy --csv <evidence.csv> --actor <USER_UUID>
python manage.py import_organization_hierarchy --csv <evidence.csv> --actor <USER_UUID> --commit --error-file errors.csv
```

Always dry-run first. Commit only after owner-supplied evidence aligns with ASM-004/005/006.

## Historical safety

Referenced Site / Department / Shift / Organization rows must not be hard-deleted. Use deactivate (and Shift `effective_to` when ending definitions). FK `on_delete=PROTECT` remains fail-closed.
