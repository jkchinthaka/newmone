# Phase 12 — Full Admin Panel & Data Governance

**Branch:** `maintainpro/phase-12-admin-governance`

Replaces software-delivery-centric Admin Console with operational Maintenance Administration.

## Safety

- Soft deactivate only (no unsafe delete)
- Last critical admin protected
- Self-deactivate blocked
- Technician with open work requires reassignment preview
- High-impact config: confirmation + impact preview + reason
- Bulk import: Upload → Validate → Preview → Errors → Confirm → Import → Audit (no unvalidated writes)

## Data quality rules

Duplicate assets, missing location/criticality, stale meter, missing PM checklist, retired asset with PM, inactive tech with jobs, missing RCA, ERP mapping errors, stale mileage, expired compliance.
