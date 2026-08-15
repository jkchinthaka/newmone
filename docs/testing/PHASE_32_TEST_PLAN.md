# Phase 32 Test Plan — Supplier Quality

**Status:** Technical tests for generic foundation  
**Suite:** `apps/supplier_quality/tests/test_phase32_supplier_quality.py`

| ID | Scenario | Expected |
| --- | --- | --- |
| SQ-01 | Create profile with ERP ref; duplicate CI in same org | Unique; ValidationError on duplicate |
| SQ-02 | Same ERP ref in different orgs | Allowed |
| SQ-03 | Procurement cannot manage; can view metrics | PermissionDenied / OK |
| SQ-04 | Cross-org list denied | PermissionDenied |
| SQ-05 | Certificate expiry vs as_of date | Deterministic boolean |
| SQ-06 | Invalid issue/expiry order | ValidationError |
| SQ-07 | Verify certificate (QA only) | verified_at/by set |
| SQ-08 | Link NCR+CAPA on quality event | Persisted; metrics count open links |
| SQ-09 | Cross-org NCR link | ValidationError |
| SQ-10 | Metrics contain no score/threshold/grade | Assert absence |
| SQ-11 | Admin hard delete disabled | has_delete_permission False |

No invented certificate types or score thresholds are asserted as Nelna policy.
