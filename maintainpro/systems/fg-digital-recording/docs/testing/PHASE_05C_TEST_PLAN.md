# Phase 05C Test Plan — FG Product Master Foundation

**Phase:** 05C  
**Scope:** `apps.master_data` FG Product expansion (no Nelna catalogue seeds)

| Area | Coverage |
| --- | --- |
| Normalized code uniqueness | `test_phase05c` + foundation uniqueness cases |
| Duplicate ERP mapping (when set) | Phase 05C ERP uniqueness + empty-ERP coexistence |
| Inactive / effective window | Lifecycle + invalid effective window |
| Historical safety | Hard-delete refuse + admin delete blocked |
| Import validation | Dry-run, commit, duplicate failure, command template |
| Cross-org / site-only authz | Site-only denied; cross-org denied; 05B hardening suite |
| Search / filter / query bound | Selector search + CaptureQueriesContext |

Target: `apps.master_data` coverage ≥ 80% (full `apps/master_data/tests/` suite).
