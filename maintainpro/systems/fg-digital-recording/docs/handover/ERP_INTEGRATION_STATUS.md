# ERP Integration Status

## Status

`BLOCKED`

The repository implements an ERP/Bileeta boundary only. Live Bileeta integration is not implemented or approved.

## What exists

- `apps.integrations` contracts and mocks
- evidence gate model
- dead-letter and reconciliation support
- prepare-only outbound patterns
- batch-event boundary support for future integration

## What does not exist

- approved live Bileeta API contract
- approved sandbox access
- approved live credentials
- approved live endpoints
- approved webhook or polling implementation
- authorized ERP stock/disposition side effects

## Authoritative references

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md)
- [../integration/BILEETA_VENDOR_EVIDENCE_REGISTER.md](../integration/BILEETA_VENDOR_EVIDENCE_REGISTER.md)
- [../governance/APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

## Repository language to preserve

The current project state says:

- production batch source evidence is required
- Bileeta API and sandbox evidence are required
- no direct ERP database writes are allowed
- local quality dispositions do not imply ERP stock movement

## Handover conclusion

For handover, describe the integration status as:

- boundary and mocks exist
- live Bileeta is blocked
- production use requires vendor artifacts and named owner approval
