# Cursor parallel log

Access Studio files were not edited. This branch is `fix/broken-links` from `origin/develop` `658ae0c2`.

## Broken links

- Manager home KPI, PM compliance, and maintenance cost cards now open `/reports/operations` (PM keeps `?search=preventive`). `performance` and `financials` are not retained reports.
- The driver intelligence dashboard Reports link opens `/reports/operations`.
- Register asset opens the asset register drawer at `/assets?asset=<id>`.
- Asset tag CSV, XLSX, and QR downloads use `/api/backend/...`. The BFF treats CSV and spreadsheet responses as bytes, and the template responses set `Content-Disposition`.
- `apps/web/lib/__tests__/internal-routes.test.ts` checks that every role-home and navigation href matches an app page, and that role home does not link a removed report slug.

Gates: web `tsc --noEmit` exit 0. Web unit 369 passed, 0 failed. API `tsc --noEmit` exit 0. Jest `reporting-kpis-phase13.spec.ts` filtered to "MANAGER report cards": 1 passed. Database `maintainpro_e2e_cursor` was set for that Jest process and was not required by the test. `nelna` and `MaintainProDev` were not used.

fix/maintenance-cost-link | DONE | fix/maintenance-cost-link | ab89fa34 | 134 | API tsc 0; web tsc 0; web unit 371/0; Jest reporting-kpis-phase13 98; tenant 0; RBAC 971/0 | Stacked on #129. Maintenance Cost opens /maintenance/jobs. Hidden when the role cannot open work-order insights. Browser not opened. 3040/3041 untouched.
