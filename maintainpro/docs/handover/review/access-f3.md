F3: read-only preview plus bulk permission actions and searchable users.
Preview uses the existing caller JWT; no target token/session is minted.
Only a current database SUPER_ADMIN may preview an active same-tenant non-SA.
All preview mutation verbs are rejected before authentication or handlers.
Stale preview reads/mutations fail closed after flag/runtime disable.
Root banner remains visible with Exit preview; BFF skips silent preview refresh.
Bulk validates scope first; each save is atomic/audited; conflicts reported per user.
API/web tsc0; web372; related Jest8 suites39 pass plus final preview9 pass.
Tenant0; RBAC972/0; parity972x27 OFF/develop0 ON/grants0; latest qa-reviewer PASS.
Mocked Playwright desktop/mobile pass;3053 stopped;3040/3041 untouched; no DB/migrations.
