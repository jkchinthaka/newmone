# Business Evidence Required

## Purpose

Management-ready checklist of the business evidence that is still required before operational rollout or production claims.

## Status table

| Evidence needed | Owner needed | Current status | Technical dependency | Production impact |
| --- | --- | --- | --- | --- |
| Official organization, site, and department catalogue | Management Sponsor / IT Manager | EVIDENCE REQUIRED | `organizations`, scoped RBAC, imports | Cannot load approved real hierarchy |
| Official shift names, codes, timings, overnight policy | Production Manager / Operations | EVIDENCE REQUIRED | `organizations.Shift`, scheduling scope | Production scheduling and audit language remain provisional |
| Official FG product catalogue for approved scope | QA Manager / Production Manager | EVIDENCE REQUIRED | `master_data`, imports, checklist/product linking | Cannot load production product master |
| Product specification limits, including any temperature classes where applicable | QA Manager | EVIDENCE REQUIRED | `master_data` ProductSpecification, checklist rule bindings | No approved limits; no production evaluation rules |
| FG-QA-001 final approved content and publish decision | QA Manager / Production Manager | BLOCKED | `checklists`, recording, QA workflow | Core pilot checklist cannot be published for real use |
| Recorder role mapping to technical permissions | Production Manager / IT Manager | EVIDENCE REQUIRED | `access_control`, `scheduling.record_checklisttask` | Recording cannot be assigned safely |
| Supervisor role mapping | Production Manager / QA Manager | EVIDENCE REQUIRED | `reviews.review_checklistsubmission` | Supervisor review cannot be assigned safely |
| QA role mapping | QA Manager | EVIDENCE REQUIRED | `quality.qa_review_checklistsubmission` | QA final review cannot be assigned safely |
| Segregation-of-duties policy | QA Manager / IT Manager / Management Sponsor | EVIDENCE REQUIRED | role governance, review/QA separation | Conflicting-role controls cannot be finalized |
| Production batch source identity and contract | IT Manager / Production Manager | EVIDENCE REQUIRED | `scheduling`, `integrations`, Phase 07F boundary | Real automatic task generation blocked |
| Bileeta API documents, sandbox, auth method, base URLs, field maps | IT Manager / Bileeta Vendor | BLOCKED | `apps.integrations`, live HTTP gate | Live integration remains disabled |
| Downstream meaning of `RELEASE`, `HOLD`, and `REJECT` | QA Manager / Stores-Warehouse / Dispatch | DECISION REQUIRED | `quality`, dispatch, ERP boundary | QA dispositions stay in-app only |
| Hosted UAT environment decision | IT Manager | EVIDENCE REQUIRED | Phase 19 runbooks, UAT pack | UAT execution remains blocked |
| Device and Wi-Fi operating evidence for factory-floor use | IT Manager / Production Manager | EVIDENCE REQUIRED | local/hosted runtime, online-only model | Pilot viability not proven |
| Backup custody, RPO, and RTO | IT Manager / Management Sponsor | EVIDENCE REQUIRED | Phase 19 backup/restore controls | Production claim blocked |
| Production support ownership and escalation roles | Management Sponsor / IT Manager | OWNER REQUIRED | release/support runbooks | No accountable production support model |
| HACCP plan, CCP/OPRP identification, critical limits, and corrective-action references | QA Manager / Food Safety lead | EVIDENCE REQUIRED | `haccp`, checklist metadata | HACCP foundation cannot become a real company control plan |
| Environmental monitoring catalogue, limits, and excursion policy | QA Manager / Food Safety / Environmental | EVIDENCE REQUIRED | `environmental` | Auto-hold and operational EM use remain disabled |
| Sanitation/SSOP content, chemicals, concentrations, frequencies, verification policy | QA Manager / Food Safety / Sanitation lead | EVIDENCE REQUIRED | `sanitation`, checklists | Production SSOP operation remains provisional |
| Allergen catalogue, declarations, cleaning/sequencing SOPs, block policy | Allergen Control lead / QA / Food Safety | EVIDENCE REQUIRED | `changeover` | Production allergen controls cannot be activated safely |
| Approved paper forms and digitalization inventory | QA Manager / Production Manager | NOT RECEIVED | form-discovery package, checklist publish | Cannot digitalize real forms |
| Official FG-QA-001 approval and publish policy | QA Manager / Production Manager | BLOCKED | `checklists` publish path | Pilot checklist remains draft-only |
| Task applicability rules (product/site/shift/department) | Production Manager / QA Manager | EVIDENCE REQUIRED | `scheduling` applicability engine | Production task generation remains blocked |
| Checklist effective-version as-of business event | QA Manager / Production Manager | DECISION REQUIRED | Phase 07D engine | Historical/current version policy remains open |
| SLA / overdue policy (due-soon, review SLA) | Production Manager / QA Manager | EVIDENCE REQUIRED | scheduling due + Supervisor SLA | Overdue remains display-only |
| Dispatch / loading rules and cold-chain limits | Dispatch / QA / Warehouse | EVIDENCE REQUIRED | `dispatch` | Dispatch quality cannot be production-configured |
| Temperature / cold-chain limit catalogue | QA Manager / Food Safety | EVIDENCE REQUIRED | dispatch + specs | No approved temperature classes |
| Laboratory catalogue, methods, and positive-release policy | QA Manager / Laboratory | EVIDENCE REQUIRED | `laboratory` | LIMS foundation stays unseeded; positive-release OFF |
| Sampling / AQL tables and licensed standard adoption | QA Manager | EVIDENCE REQUIRED | `sampling` | No ISO/AQL tables loaded |
| Calibration intervals and device-enforcement policy | QA / Maintenance / IT | EVIDENCE REQUIRED | `instruments` | Enforcement remains OFF |
| Batch-source / ERP identity contract | IT Manager / Production Manager | EVIDENCE REQUIRED | Phase 07F / `integrations` | Automatic batch task generation blocked |
| Bileeta sandbox credentials and approved endpoints | IT Manager / Bileeta Vendor | BLOCKED | live HTTP gate | Live ERP calls remain disabled |
| Hosting environment decision | IT Manager | EVIDENCE REQUIRED | Phase 19/21 packages | No staging/UAT/production host |
| Retention policy | QA / IT / Management Sponsor | EVIDENCE REQUIRED | audit/evidence retention | Retention remains technical-only |
| UAT participants and pilot scope | Management Sponsor / QA / Production | EVIDENCE REQUIRED | Phase 20 package | UAT remains NOT EXECUTED |
| Paper-fallback, retrospective entry, and decommission policy | QA Manager / Production Manager / Management Sponsor | DECISION REQUIRED | continuity docs, UAT, release gate | Paper must continue |

## Notes

- Use role titles only until the company provides named individuals.
- Do not convert `EVIDENCE REQUIRED` items into assumed values during handover.
- The authoritative source for tracked approvals is [../governance/APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md).
