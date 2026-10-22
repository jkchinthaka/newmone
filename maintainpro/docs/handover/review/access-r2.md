R2: real Nest HTTP coverage of production route-key resolution.
TestingModule creates an application with global prefix api and supertest.
Cases: id, nested path, array controller aliases, farm inline GET/POST/DELETE.
Resolved keys equal the corresponding production inventory keys.
ON: key GRANT reaches handlers despite a mismatching role.
ON: DENY, missing key, or missing declared permission returns 403.
OFF: CLEANER/ADMIN/SUPER_ADMIN match develop decisions; overrides unread.
API/web tsc 0; web unit 371 passed; related Jest 3 suites/12 tests passed.
Tenant audit 0; RBAC 0; 971x27 parity OFF/develop 0 and ON/granted 0.
Independent qa-reviewer PASS; no database writes or fixed ports used.
