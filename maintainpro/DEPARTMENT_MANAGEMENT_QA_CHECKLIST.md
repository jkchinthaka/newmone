# Department Management QA Checklist

Use this checklist when validating the centralized department master-data rollout.

## Master Data

- Verify the seed creates every canonical department from `department-master-list.ts` once per tenant.
- Create a department without a code and confirm the API generates a unique code.
- Try creating a duplicate name with different casing or spacing and confirm it is rejected.
- Update a department by `PUT /departments/:id` and confirm name/code uniqueness is preserved.
- Delete a department by `DELETE /departments/:id` and confirm it is soft-deactivated, not physically removed.
- Confirm non-admin users cannot create, update, or deactivate departments.

## Dropdown Selection

- Confirm asset create/edit requires `Select Department` and blocks manual free-text entry.
- Search departments by partial name and select from the dropdown.
- Confirm legacy assets with a text-only department show the legacy warning and require a department selection on save.
- Confirm maintenance job creation for machinery, service, and vehicle uses the department dropdown.
- Confirm department filter controls use dropdown/multi-select behavior, not text inputs.

## Reporting And Filtering

- Filter reports by one department and confirm results match that department only.
- Filter reports by multiple departments and confirm the API receives comma-separated `departmentIds`.
- Confirm asset tables filter by `departmentId` and retain legacy `department` text only for backward compatibility.
- Confirm dashboard/report filter reset clears both single and multi-department selections.

## Migration

- Run `npm --prefix maintainpro run departments:migrate` in a non-production database first.
- Confirm duplicate department rows are deactivated after references are moved to the canonical department.
- Confirm legacy `Asset.department` text maps to `Asset.departmentId` for known canonical names and aliases.
- Review unmatched migration log entries and decide whether new aliases are needed before production rollout.

## Performance And UX

- Confirm `GET /departments` responses include `Cache-Control: private, max-age=60`.
- Validate dropdown search with a large department list and confirm typing remains responsive.
- Check mobile widths for the asset form, report filters, and maintenance job editor.
- Confirm inactive departments are excluded from normal dropdowns unless explicitly requested.

## Automated Validation

- `npm --prefix maintainpro run typecheck --workspace @maintainpro/api`
- `npm --prefix maintainpro run typecheck --workspace @maintainpro/web`
- `npm --prefix maintainpro run test --workspace @maintainpro/api`
- `npm --prefix maintainpro run build --workspace @maintainpro/api`
- `npm --prefix maintainpro run build --workspace @maintainpro/web`
