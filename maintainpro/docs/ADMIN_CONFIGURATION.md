# Admin Configuration

Authorized administrators manage business masters through `/admin` and `/admin/maintenance-config`.

## Versioned / history-backed

- Priority SLA rules, job categories, analysis/reason codes → `ConfigChangeHistory`
- Feature flags, maintenance templates, warranties
- Reliability / CBM / permit policies
- Workflow publish (`POST /workflows/:id/publish`)

## Stable identifiers

Use codes/UUIDs — not display labels — as business keys (`@@unique([tenantId, code])` pattern).

## High-risk publish

Workflow versions use DRAFT → PUBLISHED → RETIRED. Active WOs may store `workflowVersionId` for the version they started with.
