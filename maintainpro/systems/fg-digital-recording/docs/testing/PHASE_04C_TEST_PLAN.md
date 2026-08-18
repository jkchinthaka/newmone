# Phase 04C Test Plan — Organization Configuration Foundation

**Document status:** Technical regression plan  
**Scope:** Hierarchy integrity, uniqueness, overnight Shift, effective dates, inactive lifecycle, historical safety, cross-org denial, import dry-run/fail/commit

## Automated coverage

| Area | Tests |
| --- | --- |
| Hierarchy / uniqueness | Existing `test_models_services` + Phase 04C mismatch/duplicate import cases |
| Overnight / effective dates | `test_overnight_shift_and_invalid_effective_window` + 04A shift tests |
| Inactive / reactivate | `test_inactive_and_reactivate_rules` |
| Historical hard-delete refusal | `test_hard_delete_refused_for_historical_safety`, admin delete blocked |
| Cross-org | `test_cross_org_site_management_denied` |
| Import | dry-run, commit, duplicate failure, unknown org, unauthenticated |
| Seed guard | no NELNA / DAY / NIGHT catalogue rows |

Target: `apps.organizations` coverage ≥ 80% for Phase 04C slice (run with full organizations tests).
