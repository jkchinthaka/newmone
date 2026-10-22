# fix/meter-readings-paging

Branched from `origin/develop`. Pull request #128 and #129 were still open, and this change does not depend on them.

`GET /utilities/readings` is unchanged when `mine`, `days`, and `take` are omitted. `mine=true` keeps readings whose notes contain `[by:<caller>]`. `days` is 1–366. `take` is 1–200. `GET /utilities/meters/latest-readings` returns one latest row per meter in the caller's tenant, with the same roles as `GET /utilities/meters`.

The Meter Readings page loads that latest row and `mine=true&days=7&take=50` instead of every reading for the selected meter.

Assumption: there is no recorder column on `MeterReading`, so `mine` uses the existing `[by:userId]` note.

Gates: API tsc 0. Web tsc 0. Web unit 368 pass, 0 fail. Jest `meter-readings-paging` and `utilities-tenant-isolation` 14 pass (`maxWorkers=2`). `audit:tenant` unapproved 0. `audit:rbac` 972 routes, violations 0.

No schema change and no database writes. Docker, full-stack e2e, and uat-roles were not run. The page was not opened in a browser. qa-reviewer was not run in this pass.
