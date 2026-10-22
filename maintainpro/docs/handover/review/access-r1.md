R1: preserve existing Studio grants during flag-OFF role saves.
Runtime role saves retain omitted isAccessStudioKey rows, including their IDs.
The seed replacement path applies the same preservation rule.
Ordinary omitted permissions are still removed and runtime removals audited.
Flag ON permits explicit Studio grant removal as before.
API tsc and web tsc: exit 0.
Web unit: 371 passed; sandbox profile error resolved outside sandbox.
Related Jest: 5 suites, 14 tests passed with maxWorkers=2.
Tenant audit: 0 unapproved; RBAC: 971 routes, 0 violations.
Parity: 971 routes x 27 roles; OFF/develop and ON/granted mismatches 0.
