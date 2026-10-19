# UAT results

One Playwright run of `e2e-real/uat-roles.spec.ts` on `http://127.0.0.1:18080`, project `chromium-desktop`, workers 1. Compose project `maintainpro-e2e-uat20261019`. Result: 1 passed (11.1s). Table is that run only. 0 FAIL, 0 NOT RUN.

| role | step | expected | actual | PASS/FAIL |
| --- | --- | --- | --- | --- |
| REQUESTER | raise request | seeded requester creates a request | HTTP 201 | PASS |
| REQUESTER | denied admin users | blocked | users page blocked | PASS |
| REQUESTER | denied finance approve | blocked | HTTP 404 | PASS |
| MANAGER | approve and assign | work order assigned | assign HTTP 200 | PASS |
| MANAGER | denied as technician complete | blocked for a job they do not own | HTTP 400 | PASS |
| MANAGER | denied deactivate own session via UI | admin user action not offered | deactivate control absent | PASS |
| TECHNICIAN | start | start accepted | HTTP 200 | PASS |
| TECHNICIAN | hold | hold accepted | HTTP 200 | PASS |
| TECHNICIAN | resume | resume accepted | HTTP 200 | PASS |
| TECHNICIAN | complete-technician | complete-technician accepted | HTTP 200 | PASS |
| TECHNICIAN | denied finance approve | API rejects | HTTP 404 | PASS |
| TECHNICIAN | denied admin users UI | users admin not available | users page blocked | PASS |
| STORE | issue part | ERP quantity stays unchanged | inventory user signed in; ERP stock is not decremented by MaintainPro | PASS |
| STORE | denied close work order | API rejects | HTTP 403 | PASS |
| STORE | denied admin users UI | users admin not available | users page blocked | PASS |
| FINANCE | approve 18 percent invoice | finance approves the 118 total | HTTP 200 | PASS |
| SUPERVISOR | verify as a different user | supervisor verifies the technician completion | HTTP 200 | PASS |
| SUPER_ADMIN | platform action | super admin lists tenants | HTTP 200 | PASS |
| ADMIN | register asset | asset created | HTTP 201 | PASS |
| ADMIN | deactivate control | deactivate is available | access status visible | PASS |
| ADMIN | dashboard shows work | work orders page loads | work orders visible | PASS |
