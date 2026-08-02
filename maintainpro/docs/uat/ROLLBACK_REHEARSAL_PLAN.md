# Rollback Rehearsal Plan

Triggers: auth down, critical workflow down, corruption, tenant isolation fail, repeated 5xx, migration fail, security incident, monitoring unavailable.
Assets: previous SHA/digest, RC SHA/digest, pre-cutover backup ref, restore runbook.
Disposable E2E only → `ROLLBACK_REHEARSAL_VALIDATED` (not PRODUCTION_ROLLBACK_VALIDATED).
Never: production data, mongorestore --drop, volume remove.