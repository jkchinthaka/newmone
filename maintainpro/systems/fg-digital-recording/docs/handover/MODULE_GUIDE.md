# Module Guide

## Purpose

This guide maps the implemented Django apps to the phase model recorded in [../PROJECT_STATUS.md](../PROJECT_STATUS.md) and [../architecture/MODULE_MAP.md](../architecture/MODULE_MAP.md).

## Core modules by phase

| App | Phase mapping | Current evidence-based note |
| --- | --- | --- |
| `core` | 02+, 10B | Shared foundation and derived workflow lifecycle |
| `accounts` | 03 | Employee-code identity and account lifecycle |
| `organizations` | 03, 04A-04C | Org scope, site/department hierarchy, Shift foundation; real values still evidence-required |
| `access_control` | 03, 03C | Scoped RBAC, RoleTemplate governance; business role mapping pending |
| `security_audit` | 03+ | Audit-event capture |
| `master_data` | 05A-05C, 06O | FG Product and ProductSpecification foundations; official catalogue/limits not approved |
| `instruments` | 05D, 25 | Equipment, calibration, and device traceability |
| `training` | 05E | Training foundation; policy remains evidence-required |
| `checklists` | 06A-06O, 07D | Checklist definitions, rules, evaluation, metadata, effective-version resolution |
| `scheduling` | 07A-07H | Tasks, applicability, recurring schedules, assignment, due/overdue, batch-event boundary |
| `recording` | 08A-08C, 09B | Draft recording, immutable submission, correction/resubmission |
| `reviews` | 09A-09C | Supervisor review and governance |
| `quality` | 10A | Final in-app QA disposition |
| `evidence` | 11 | Private evidence metadata and storage orchestration |
| `nonconformance` | 12 | NCR and Hold foundation |
| `capa` | 12 | CAPA foundation |
| `dispatch` | 13 | Loading/dispatch quality and cold-chain foundations |
| `notifications` | 15 | In-app notifications and optional email foundation |
| `reports` | 16 | Governed reporting and CSV export |
| `integrations` | 17 | ERP/Bileeta contracts, mocks, dead-letter, reconciliation; live connector blocked |
| `ai_assistance` | 18 | Optional advisory AI foundation, default OFF |
| `laboratory` | 22 | Lab/LIMS foundation |
| `haccp` | 23 | HACCP and control-point foundation |
| `sampling` | 24 | Sampling-plan engine |
| `foreign_body` | 26 | Foreign-body and metal-detector challenge foundation |
| `sanitation` | 27 | Sanitation/SSOP foundation |
| `environmental` | 28 | Environmental monitoring foundation |
| `packaging` | 29 | Packaging artwork verification foundation |
| `changeover` | 30 | Allergen/changeover/line-clearance foundation |
| `receiving` | 31 | Raw/material receiving quality foundation |
| `supplier_quality` | 32 | Supplier quality foundation |
| `iqc` | 33 | Incoming Quality Control workflow foundation |
| `ipqc` | 34 | In-Process Quality Control workflow foundation |
| `batch_dossier` | 35 | Electronic batch quality dossier |
| `batch_genealogy` | 36 | Batch genealogy traceability |
| `recall` | 37-38 | Recall/withdrawal and mock recall |
| `customer_complaints` | 39 | Customer complaint workflow foundation |
| `product_returns` | 40 | Returned-product quality workflow foundation |

## Important interpretation

- A module being implemented does not mean it is business-approved
- A module being implemented does not mean it is UAT-passed
- A module being implemented does not mean it is production-configured

That distinction is mandatory in this repository’s status vocabulary.

## Notable blockers across modules

- `organizations`: official org/site/department/shift data missing
- `access_control`: recorder/Supervisor/QA mapping and SoD evidence missing
- `master_data`: official products and specification limits missing
- `checklists`: FG-QA-001 remains draft only
- `scheduling` and `integrations`: live batch source and Bileeta vendor evidence missing
- `quality` and downstream modules: production workflows blocked by upstream business gates

## Recommended next reading

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [../architecture/MODULE_MAP.md](../architecture/MODULE_MAP.md)
- [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md)
