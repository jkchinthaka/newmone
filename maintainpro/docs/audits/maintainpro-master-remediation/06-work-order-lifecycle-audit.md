# 06 Work order lifecycle audit

Generic status and bulk verify/close stay blocked in `assertRoleCanSetStatus` and bulk handling.

`updateStatus` now rejects a missing `expectedVersion` with `ConflictException` after transition and role checks, then updates with `updateMany` on `id` and `version`. A lost race (`count !== 1`) is also a conflict.

`update` calls `assertClosedRecordContentEditable` for `CLOSED` and legacy `COMPLETED`. An admin, manager, operations manager, or asset manager can edit only with a correction reason. Cancelled jobs stay editable.

The work-order page sends `expectedVersion` for the status button, hold, and technician completion. Other clients, including Playwright lifecycle specs, were not updated and will receive 409 until they send the version.

Governance file: 18 passed.
