# fix/maintenance-cost-link

Stacked on PR #129 (`fix/broken-links`). Merge #129 before this pull request.

The Maintenance Cost card in web `lib/role-home.ts` and API `reporting-kpis/role-home.ts` opens `/maintenance/jobs`. That page hosts the work-order drawer cost breakdown (labour, parts, vendor, total) added in #119. It no longer opens `/reports/operations`.

The card is omitted for roles that are not allowed to call `GET /work-orders/:id/insights`. `MAINTENANCE_MANAGER` uses the manager home and no longer sees the card. Finance and viewer homes never had it.

Assumption: #119 did not add a separate cost index page. The breakdown is on the work-order drawer, so the card opens the work-order list.

Gates: API tsc 0. Web tsc 0. Web unit 371 pass, 0 fail. Jest `reporting-kpis-phase13` 98 pass (`maxWorkers=2`). `audit:tenant` unapproved 0. `audit:rbac` 971 routes, violations 0.

No schema change. Docker, full-stack e2e, and uat-roles were not run. The page was not opened in a browser. qa-reviewer was not run in this pass.
