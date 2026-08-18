# Mongo Query Compatibility Inventory

**Generated (UTC):** 2026-08-13T04:11:55Z  

Static scan of unsupported / high-risk Django ORM patterns for MongoDB cutover.
Counts are occurrence sites (AST), not unique business operations.

## Pattern summary

| Pattern | Occurrences | Mongo risk |
| --- | ---: | --- |
| prefetch_related | 3 | HIGH — unsupported / rewrite |
| OuterRef | 0 | HIGH — unproven / rewrite |
| Subquery | 0 | HIGH — unproven / rewrite |
| Exists | 0 | MEDIUM — verify |
| select_for_update | 3 | BLOCKER — replace with CAS |
| annotate | 7 | MEDIUM — case-by-case |
| aggregate | 16 | MEDIUM — case-by-case |
| Lower/Upper/Coalesce/Case/When | 87 | MEDIUM — expressions |
| select_related | 412 | LOW-MEDIUM — often OK as joins/lookups |
| RawSQL / extra | 36 | HIGH if present |

## Core operator path priority

Prove these before optional modules:

```text
Login → Daily Record → Save → Submit → Supervisor → Return/Approve
→ Correction/Resubmit → QA Release/Hold/Reject → History → Print
Then: NCR → RCA → CAPA
```

| Core page | Related apps / hints |
| --- | --- |
| Login | accounts, login, auth |
| Dashboard | dashboard, workspace |
| Daily Records | recording, scheduling |
| History | history, recording |
| Recorder task | recording |
| Supervisor queue | reviews |
| QA queue | quality |
| Printing | print, reports, batch_dossier |
| RCA | rca |
| CAPA | capa |
| NCR | nonconformance |
| Reports | reports |

## Occurrences by pattern

### `Case` (0)


### `Coalesce` (0)


### `Exists` (0)


### `Lower` (87)

- `apps/access_control/models.py:32`
- `apps/access_control/models.py:38`
- `apps/access_control/models.py:76`
- `apps/access_control/models.py:82`
- `apps/accounts/models.py:40`
- `apps/accounts/models.py:46`
- `apps/batch_genealogy/models.py:74`
- `apps/capa/models.py:152`
- `apps/change_control/models.py:145`
- `apps/changeover/models.py:93`
- `apps/checklists/models.py:199`
- `apps/checklists/models.py:209`
- `apps/checklists/models.py:521`
- `apps/checklists/models.py:1121`
- `apps/checklists/proposal_loader.py:441`
- `apps/compliance_mapping/models.py:164`
- `apps/compliance_mapping/models.py:232`
- `apps/customer_complaints/models.py:162`
- `apps/customer_complaints/models.py:236`
- `apps/dispatch/models.py:160`
- `apps/document_control/models.py:97`
- `apps/document_control/models.py:183`
- `apps/environmental/models.py:115`
- `apps/environmental/models.py:173`
- `apps/environmental/models.py:210`
- `apps/foreign_body/models.py:100`
- `apps/foreign_body/models.py:166`
- `apps/haccp/models.py:95`
- `apps/haccp/models.py:185`
- `apps/haccp/models.py:215`
- `apps/haccp/models.py:244`
- `apps/haccp/models.py:293`
- `apps/instruments/models.py:127`
- `apps/instruments/models.py:141`
- `apps/ipqc/models.py:131`
- `apps/iqc/models.py:96`
- `apps/iqc/models.py:97`
- `apps/laboratory/models.py:91`
- `apps/laboratory/models.py:159`
- `apps/laboratory/models.py:274`
- `apps/laboratory/models.py:332`
- `apps/master_data/models.py:99`
- `apps/master_data/models.py:104`
- `apps/master_data/models.py:123`
- `apps/master_data/models.py:125`
- `apps/master_data/models.py:196`
- `apps/master_data/models.py:206`
- `apps/master_data/models.py:373`
- `apps/master_data/models.py:379`
- `apps/nonconformance/models.py:182`
- `apps/nonconformance/models.py:309`
- `apps/notifications/models.py:154`
- `apps/organizations/models.py:29`
- `apps/organizations/models.py:35`
- `apps/organizations/models.py:64`
- `apps/organizations/models.py:71`
- `apps/organizations/models.py:113`
- `apps/organizations/models.py:119`
- `apps/organizations/models.py:128`
- `apps/organizations/models.py:191`
- `apps/organizations/models.py:220`
- `apps/packaging/models.py:77`
- `apps/packaging/models.py:268`
- `apps/process_fmea/models.py:84`
- `apps/process_fmea/models.py:224`
- `apps/process_fmea/models.py:260`
- `apps/product_returns/models.py:127`
- `apps/product_returns/models.py:128`
- `apps/quality_audits/models.py:147`
- `apps/quality_audits/models.py:272`
- `apps/quality_quarantine/models.py:101`
- `apps/quality_risks/models.py:146`
- `apps/quality_risks/models.py:204`
- `apps/rca/models.py:115`
- `apps/recall/models.py:161`
- `apps/recall/models.py:263`
- `apps/recall/models.py:301`
- `apps/recall/models.py:642`
- `apps/receiving/models.py:109`
- `apps/receiving/models.py:155`
- `apps/receiving/models.py:371`
- `apps/sampling/models.py:73`
- `apps/sampling/models.py:188`
- `apps/sanitation/models.py:87`
- `apps/sanitation/models.py:226`
- `apps/sanitation/models.py:348`
- `apps/supplier_quality/models.py:78`

### `OuterRef` (0)


### `RawSQL` (0)


### `Subquery` (0)


### `Upper` (0)


### `When` (0)


### `aggregate` (16)

- `apps/checklists/services.py:228`
- `apps/checklists/services.py:239`
- `apps/checklists/services.py:839`
- `apps/checklists/services.py:910`
- `apps/mongo_poc/services.py:89`
- `apps/mongo_poc/services.py:112`
- `apps/process_fmea/services.py:415`
- `apps/process_fmea/services.py:805`
- `apps/quality_risks/services.py:375`
- `apps/recording/correction_services.py:536`
- `apps/scheduling/generation.py:521`
- `apps/scheduling/generation.py:528`
- `apps/scheduling/generation.py:529`
- `apps/scheduling/generation.py:530`
- `apps/scheduling/generation.py:531`
- `apps/scheduling/generation.py:533`

### `annotate` (7)

- `apps/checklists/proposal_loader.py:440`
- `apps/checklists/selectors.py:107`
- `apps/checklists/selectors.py:152`
- `apps/compliance_mapping/selectors.py:87`
- `apps/quality_audits/selectors.py:96`
- `apps/quality_audits/selectors.py:119`
- `apps/quality_risks/selectors.py:89`

### `extra` (36)

- `apps/capa/admin.py:23`
- `apps/checklists/admin.py:22`
- `apps/checklists/admin.py:42`
- `apps/checklists/admin.py:77`
- `apps/checklists/evaluation.py:282`
- `apps/checklists/evaluation.py:290`
- `apps/checklists/evaluation.py:294`
- `apps/checklists/services.py:133`
- `apps/checklists/services.py:134`
- `apps/compliance_mapping/tests/test_phase46_compliance_mapping.py:491`
- `apps/compliance_mapping/tests/test_phase46_compliance_mapping.py:506`
- `apps/compliance_mapping/tests/test_phase46_compliance_mapping.py:513`
- `apps/compliance_mapping/tests/test_phase46_compliance_mapping.py:691`
- `apps/compliance_mapping/tests/test_phase46_compliance_mapping.py:694`
- `apps/dispatch/admin.py:29`
- `apps/dispatch/admin.py:36`
- `apps/ipqc/services.py:584`
- `apps/ipqc/services.py:589`
- `apps/master_data/admin.py:55`
- `apps/master_data/specification_services.py:71`
- `apps/master_data/specification_services.py:72`
- `apps/master_data/specification_services.py:94`
- `apps/master_data/specification_services.py:95`
- `apps/master_data/tests/test_phase06o_product_specifications.py:174`
- `apps/master_data/tests/test_phase06o_product_specifications.py:177`
- `apps/rca/services.py:486`
- `apps/rca/services.py:487`
- `apps/rca/services.py:488`
- `apps/recording/admin.py:19`
- `apps/recording/admin.py:133`
- `apps/recording/synthetic_demo.py:90`
- `apps/recording/synthetic_demo.py:91`
- `apps/scheduling/applicability.py:422`
- `apps/scheduling/applicability.py:423`
- `apps/scheduling/assignment.py:87`
- `apps/scheduling/batch_events.py:98`

### `prefetch_related` (3)

- `apps/core/persistence/queries.py:72`
- `apps/core/persistence/queries.py:97`
- `apps/recording/tests/test_phase06i_calculated_fields.py:426`

### `select_for_update` (3)

- `apps/core/persistence/queries.py:44`
- `apps/core/persistence/queries.py:85`
- `apps/core/persistence/queries.py:92`

### `select_related` (412)

- `apps/access_control/governance_services.py:54`
- `apps/access_control/governance_services.py:98`
- `apps/access_control/governance_services.py:184`
- `apps/access_control/governance_services.py:239`
- `apps/access_control/selectors.py:27`
- `apps/access_control/services.py:35`
- `apps/access_control/services.py:184`
- `apps/batch_dossier/selectors.py:45`
- `apps/batch_dossier/selectors.py:64`
- `apps/batch_dossier/selectors.py:83`
- `apps/batch_dossier/selectors.py:102`
- `apps/batch_dossier/selectors.py:118`
- `apps/batch_dossier/selectors.py:137`
- `apps/batch_dossier/selectors.py:159`
- `apps/batch_dossier/selectors.py:187`
- `apps/batch_dossier/selectors.py:202`
- `apps/batch_dossier/selectors.py:229`
- `apps/batch_dossier/selectors.py:258`
- `apps/batch_dossier/selectors.py:273`
- `apps/batch_dossier/selectors.py:302`
- `apps/batch_genealogy/selectors.py:34`
- `apps/batch_genealogy/selectors.py:42`
- `apps/batch_genealogy/selectors.py:49`
- `apps/batch_genealogy/services.py:516`
- `apps/batch_genealogy/services.py:525`
- `apps/capa/selectors.py:38`
- `apps/capa/selectors.py:54`
- `apps/capa/selectors.py:61`
- `apps/capa/services.py:412`
- `apps/capa/views.py:47`
- `apps/capa/views.py:123`
- `apps/change_control/services.py:130`
- `apps/change_control/services.py:167`
- `apps/change_control/services.py:229`
- `apps/change_control/services.py:291`
- `apps/change_control/services.py:339`
- `apps/change_control/services.py:373`
- `apps/change_control/services.py:431`
- `apps/change_control/services.py:466`
- `apps/checklists/compat_queries.py:22`
- `apps/checklists/compat_queries.py:38`
- `apps/checklists/compat_queries.py:49`
- `apps/checklists/effective_version.py:122`
- `apps/checklists/effective_version.py:161`
- `apps/checklists/effective_version.py:324`
- `apps/checklists/proposal_loader.py:440`
- `apps/checklists/proposal_loader.py:450`
- `apps/checklists/selectors.py:82`
- `apps/checklists/selectors.py:107`
- `apps/checklists/selectors.py:135`
- `apps/checklists/selectors.py:163`
- `apps/checklists/services.py:218`
- `apps/checklists/services.py:435`
- `apps/checklists/services.py:615`
- `apps/checklists/services.py:639`
- `apps/checklists/services.py:654`
- `apps/checklists/services.py:745`
- `apps/checklists/services.py:916`
- `apps/checklists/services.py:1009`
- `apps/checklists/services.py:1017`
- `apps/checklists/services.py:1103`
- `apps/checklists/services.py:1112`
- `apps/checklists/services.py:1209`
- `apps/checklists/services.py:1236`
- `apps/checklists/services.py:1265`
- `apps/checklists/services.py:1314`
- `apps/checklists/services.py:1746`
- `apps/checklists/services.py:1788`
- `apps/checklists/services.py:1820`
- `apps/checklists/tests/test_checklist_governance.py:362`
- `apps/checklists/tests/test_checklist_governance.py:363`
- `apps/checklists/tests/test_checklist_response_schema.py:323`
- `apps/checklists/views.py:152`
- `apps/checklists/views.py:176`
- `apps/checklists/views.py:440`
- `apps/checklists/views.py:473`
- `apps/checklists/views.py:496`
- `apps/checklists/views.py:519`
- `apps/checklists/views.py:565`
- `apps/checklists/views.py:622`
- `apps/checklists/views.py:647`
- `apps/checklists/views.py:672`
- `apps/checklists/views.py:706`
- `apps/checklists/views.py:744`
- `apps/checklists/views.py:771`
- `apps/compliance_mapping/selectors.py:61`
- `apps/compliance_mapping/selectors.py:76`
- `apps/compliance_mapping/services.py:268`
- `apps/compliance_mapping/services.py:335`
- `apps/compliance_mapping/services.py:371`
- `apps/compliance_mapping/services.py:408`
- `apps/compliance_mapping/services.py:457`
- `apps/compliance_mapping/services.py:493`
- `apps/compliance_mapping/services.py:533`
- `apps/compliance_mapping/services.py:579`
- `apps/compliance_mapping/services.py:640`
- `apps/compliance_mapping/services.py:839`
- `apps/core/checklist_workflow.py:310`
- `apps/core/checklist_workflow.py:318`
- `apps/core/persistence/queries.py:60`
- `apps/core/persistence/queries.py:61`
- `apps/core/persistence/queries.py:61`
- `apps/customer_complaints/selectors.py:38`
- `apps/customer_complaints/selectors.py:48`
- `apps/customer_complaints/selectors.py:65`
- `apps/customer_complaints/views.py:40`
- `apps/dispatch/selectors.py:42`
- `apps/dispatch/selectors.py:49`
- `apps/dispatch/selectors.py:62`
- `apps/dispatch/views.py:40`
- `apps/document_control/selectors.py:92`
- `apps/document_control/selectors.py:106`
- `apps/document_control/services.py:158`
- `apps/document_control/services.py:207`
- `apps/document_control/services.py:247`
- `apps/document_control/services.py:273`
- `apps/document_control/services.py:304`
- `apps/document_control/services.py:353`
- `apps/document_control/services.py:429`
- `apps/document_control/services.py:491`
- `apps/document_control/services.py:537`
- `apps/environmental/selectors.py:20`
- `apps/environmental/selectors.py:57`
- `apps/environmental/services.py:271`
- `apps/environmental/services.py:307`
- `apps/environmental/services.py:336`
- `apps/environmental/services.py:398`
- `apps/environmental/services.py:407`
- `apps/environmental/services.py:417`
- `apps/evidence/linking.py:118`
- `apps/evidence/linking.py:139`
- `apps/evidence/linking.py:158`
- `apps/evidence/linking.py:178`
- `apps/evidence/linking.py:247`
- `apps/evidence/linking.py:285`
- `apps/evidence/linking.py:394`
- `apps/evidence/linking.py:412`
- `apps/evidence/linking.py:426`
- `apps/evidence/selectors.py:45`
- `apps/evidence/selectors.py:59`
- `apps/evidence/services.py:173`
- `apps/foreign_body/selectors.py:29`
- `apps/foreign_body/services.py:306`
- `apps/haccp/selectors.py:34`
- `apps/haccp/selectors.py:48`
- `apps/haccp/selectors.py:64`
- `apps/haccp/services.py:230`
- `apps/haccp/services.py:273`
- `apps/haccp/services.py:311`
- `apps/haccp/services.py:351`
- `apps/haccp/services.py:420`
- `apps/haccp/services.py:465`
- `apps/haccp/services.py:500`
- `apps/haccp/services.py:538`
- `apps/haccp/services.py:596`
- `apps/haccp/services.py:640`
- `apps/haccp/services.py:653`
- `apps/haccp/services.py:668`
- `apps/haccp/snapshots.py:33`
- `apps/haccp/views.py:49`
- `apps/instruments/selectors.py:45`
- `apps/instruments/selectors.py:69`
- `apps/instruments/selectors.py:100`
- `apps/instruments/services.py:181`
- `apps/instruments/services.py:326`
- `apps/instruments/services.py:365`
- `apps/integrations/reconciliation.py:37`
- `apps/ipqc/selectors.py:72`
- `apps/ipqc/selectors.py:91`
- `apps/ipqc/selectors.py:107`
- `apps/iqc/services.py:498`
- `apps/laboratory/selectors.py:34`
- `apps/laboratory/selectors.py:41`
- `apps/laboratory/selectors.py:48`
- `apps/laboratory/services.py:270`
- `apps/laboratory/views.py:52`
- `apps/master_data/selectors.py:61`
- `apps/master_data/selectors.py:84`
- `apps/master_data/selectors.py:155`
- `apps/master_data/selectors.py:181`
- `apps/master_data/selectors.py:197`
- `apps/master_data/services.py:225`
- `apps/master_data/specification_services.py:244`
- `apps/master_data/specification_services.py:290`
- `apps/master_data/specification_services.py:355`
- `apps/master_data/specification_services.py:437`
- `apps/master_data/specification_services.py:471`
- `apps/master_data/specification_services.py:511`
- `apps/master_data/specification_services.py:544`
- `apps/nonconformance/selectors.py:42`
- `apps/nonconformance/selectors.py:58`
- `apps/nonconformance/selectors.py:73`
- `apps/nonconformance/selectors.py:85`
- `apps/nonconformance/views.py:47`
- `apps/nonconformance/views.py:131`
- `apps/notifications/selectors.py:16`
- `apps/notifications/tasks.py:38`
- `apps/organizations/hierarchy_import.py:537`
- `apps/organizations/hierarchy_import.py:540`
- `apps/organizations/selectors.py:38`
- … 212 more

## M2M / through / cascades

See `docs/migration/FG_MONGODB_COLLECTION_MANIFEST.md` and `docs/migration/MONGODB_PRIMARY_KEY_PLAN.md` for through-model and PK review.
Delete cascades and M2M must be validated per relationship on Mongo POC — do not assume PostgreSQL ON DELETE behavior.

## Classification

```text
MONGODB SAME-DATABASE CUTOVER BLOCKED — CONTINUING COMPATIBILITY ENGINEERING
```

