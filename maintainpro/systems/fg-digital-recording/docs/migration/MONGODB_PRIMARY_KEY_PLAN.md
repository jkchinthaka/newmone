# MongoDB Primary Key Plan

**Generated (UTC):** 2026-08-12T09:55:15Z  
**Production database:** `maintainpro_prod`  
**Rule:** Do not silently regenerate IDs. Historical relationships must stay stable.

## Classification summary

| Classification | Count |
| --- | ---: |
| UUID — SAFE CANDIDATE | 220 |
| THROUGH MODEL — REVIEW | 6 |
| CONTRIB MODEL — REVIEW | 4 |
| OTHER (CharField) — REVIEW | 1 |

## Identity preservation requirements

These domains must keep stable identity across PostgreSQL → Mongo cutover:

- Checklist submissions and submission numbers
- Supervisor / QA review decisions
- Audit / security events
- Quality cases, holds, quarantines
- RCA / CAPA / NCR records and links

UUID primary keys are the preferred SAFE CANDIDATE for FG domain models.
Implicit BigAutoField / contrib AutoField models require explicit redesign
before Mongo cutover — do not convert silently.

## Per-model plan

| App | Model | PG table | Mongo collection | PK | Classification | Cutover action |
| --- | --- | --- | --- | --- | --- | --- |
| access_control | Role | `access_control_role` | `fg_access_control_role` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| access_control | Role_permissions | `access_control_role_permissions` | `fg_access_control_role_permissions` | `id:BigAutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| access_control | RoleTemplate | `access_control_roletemplate` | `fg_access_control_roletemplate` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| access_control | RoleTemplate_permissions | `access_control_roletemplate_permissions` | `fg_access_control_roletemplate_permissions` | `id:BigAutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| access_control | ScopedRoleAssignment | `access_control_scopedroleassignment` | `fg_access_control_scopedroleassignment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| accounts | User | `accounts_user` | `fg_accounts_user` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| accounts | User_groups | `accounts_user_groups` | `fg_accounts_user_groups` | `id:BigAutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| accounts | User_user_permissions | `accounts_user_user_permissions` | `fg_accounts_user_user_permissions` | `id:BigAutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| admin | LogEntry | `django_admin_log` | `fg_django_admin_log` | `id:AutoField` | CONTRIB MODEL — REVIEW | Review Django contrib / Celery tables; may stay ObjectId on clean Mongo deploy |
| ai_assistance | AIAssistanceRequest | `ai_assistance_aiassistancerequest` | `fg_ai_assistance_aiassistancerequest` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| auth | Group | `auth_group` | `fg_auth_group` | `id:AutoField` | CONTRIB MODEL — REVIEW | Review Django contrib / Celery tables; may stay ObjectId on clean Mongo deploy |
| auth | Group_permissions | `auth_group_permissions` | `fg_auth_group_permissions` | `id:AutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| auth | Permission | `auth_permission` | `fg_auth_permission` | `id:AutoField` | CONTRIB MODEL — REVIEW | Review Django contrib / Celery tables; may stay ObjectId on clean Mongo deploy |
| batch_dossier | BatchDossierExportRequest | `batch_dossier_batchdossierexportrequest` | `fg_batch_dossier_batchdossierexportrequest` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| batch_dossier | BatchDossierPolicy | `batch_dossier_batchdossierpolicy` | `fg_batch_dossier_batchdossierpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| batch_genealogy | GenealogyEdge | `batch_genealogy_genealogyedge` | `fg_batch_genealogy_genealogyedge` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| batch_genealogy | GenealogyNode | `batch_genealogy_genealogynode` | `fg_batch_genealogy_genealogynode` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| batch_genealogy | GenealogyPolicy | `batch_genealogy_genealogypolicy` | `fg_batch_genealogy_genealogypolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| capa | CapaActionItem | `capa_capaactionitem` | `fg_capa_capaactionitem` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| capa | CapaHistoryEntry | `capa_capahistoryentry` | `fg_capa_capahistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| capa | CorrectiveAction | `capa_correctiveaction` | `fg_capa_correctiveaction` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| change_control | QualityChangeAffectedLink | `change_control_qualitychangeaffectedlink` | `fg_change_control_qualitychangeaffectedlink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| change_control | QualityChangeEvent | `change_control_qualitychangeevent` | `fg_change_control_qualitychangeevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| change_control | QualityChangeImpactAssessment | `change_control_qualitychangeimpactassessment` | `fg_change_control_qualitychangeimpactassessment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| change_control | QualityChangeImplementationLink | `change_control_qualitychangeimplementationlink` | `fg_change_control_qualitychangeimplementationlink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| change_control | QualityChangeRequest | `change_control_qualitychangerequest` | `fg_change_control_qualitychangerequest` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | AllergenReference | `changeover_allergenreference` | `fg_changeover_allergenreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | AllergenRiskPolicy | `changeover_allergenriskpolicy` | `fg_changeover_allergenriskpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | ChangeoverHistoryEntry | `changeover_changeoverhistoryentry` | `fg_changeover_changeoverhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | ChangeoverRecord | `changeover_changeoverrecord` | `fg_changeover_changeoverrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | LineClearanceRecord | `changeover_lineclearancerecord` | `fg_changeover_lineclearancerecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | ProductAllergenDeclaration | `changeover_productallergendeclaration` | `fg_changeover_productallergendeclaration` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| changeover | ProductAllergenDeclaration_allergen_references | `changeover_productallergendeclaration_allergen_references` | `fg_changeover_productallergendeclaration_allergen_references` | `id:BigAutoField` | THROUGH MODEL — REVIEW | Map M2M through documents; preserve both FKs |
| checklists | ChecklistCalculationOperand | `checklists_checklistcalculationoperand` | `fg_checklists_checklistcalculationoperand` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistItem | `checklists_checklistitem` | `fg_checklists_checklistitem` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistItemEvaluationRule | `checklists_checklistitemevaluationrule` | `fg_checklists_checklistitemevaluationrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistItemOption | `checklists_checklistitemoption` | `fg_checklists_checklistitemoption` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistItemRule | `checklists_checklistitemrule` | `fg_checklists_checklistitemrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistSection | `checklists_checklistsection` | `fg_checklists_checklistsection` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistTemplate | `checklists_checklisttemplate` | `fg_checklists_checklisttemplate` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| checklists | ChecklistVersion | `checklists_checklistversion` | `fg_checklists_checklistversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceControlMapping | `compliance_mapping_compliancecontrolmapping` | `fg_compliance_mapping_compliancecontrolmapping` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceEvidenceLink | `compliance_mapping_complianceevidencelink` | `fg_compliance_mapping_complianceevidencelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceGap | `compliance_mapping_compliancegap` | `fg_compliance_mapping_compliancegap` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceGapAction | `compliance_mapping_compliancegapaction` | `fg_compliance_mapping_compliancegapaction` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceMappingEvent | `compliance_mapping_compliancemappingevent` | `fg_compliance_mapping_compliancemappingevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceSource | `compliance_mapping_compliancesource` | `fg_compliance_mapping_compliancesource` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| compliance_mapping | ComplianceSourceEdition | `compliance_mapping_compliancesourceedition` | `fg_compliance_mapping_compliancesourceedition` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| contenttypes | ContentType | `django_content_type` | `fg_django_content_type` | `id:AutoField` | CONTRIB MODEL — REVIEW | Review Django contrib / Celery tables; may stay ObjectId on clean Mongo deploy |
| customer_complaints | CustomerComplaintBatchTrace | `customer_complaints_customercomplaintbatchtrace` | `fg_customer_complaints_customercomplaintbatchtrace` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintCase | `customer_complaints_customercomplaintcase` | `fg_customer_complaints_customercomplaintcase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintCategoryConfig | `customer_complaints_customercomplaintcategoryconfig` | `fg_customer_complaints_customercomplaintcategoryconfig` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintCommunication | `customer_complaints_customercomplaintcommunication` | `fg_customer_complaints_customercomplaintcommunication` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintEvidenceLink | `customer_complaints_customercomplaintevidencelink` | `fg_customer_complaints_customercomplaintevidencelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintInvestigationLink | `customer_complaints_customercomplaintinvestigationlink` | `fg_customer_complaints_customercomplaintinvestigationlink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintPolicy | `customer_complaints_customercomplaintpolicy` | `fg_customer_complaints_customercomplaintpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| customer_complaints | CustomerComplaintTimelineEntry | `customer_complaints_customercomplainttimelineentry` | `fg_customer_complaints_customercomplainttimelineentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| dispatch | ColdChainTemperatureReading | `dispatch_coldchaintemperaturereading` | `fg_dispatch_coldchaintemperaturereading` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| dispatch | DispatchHistoryEntry | `dispatch_dispatchhistoryentry` | `fg_dispatch_dispatchhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| dispatch | DispatchQualityRecord | `dispatch_dispatchqualityrecord` | `fg_dispatch_dispatchqualityrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| dispatch | DispatchQuantityLine | `dispatch_dispatchquantityline` | `fg_dispatch_dispatchquantityline` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| dispatch | DispatchReleasePolicy | `dispatch_dispatchreleasepolicy` | `fg_dispatch_dispatchreleasepolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| document_control | QualityDocument | `document_control_qualitydocument` | `fg_document_control_qualitydocument` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| document_control | QualityDocumentAcknowledgement | `document_control_qualitydocumentacknowledgement` | `fg_document_control_qualitydocumentacknowledgement` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| document_control | QualityDocumentEvent | `document_control_qualitydocumentevent` | `fg_document_control_qualitydocumentevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| document_control | QualityDocumentVersion | `document_control_qualitydocumentversion` | `fg_document_control_qualitydocumentversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| document_control | QualityRecordDocumentLink | `document_control_qualityrecorddocumentlink` | `fg_document_control_qualityrecorddocumentlink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | EnvironmentalExcursionPolicy | `environmental_environmentalexcursionpolicy` | `fg_environmental_environmentalexcursionpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | EnvironmentalHistoryEntry | `environmental_environmentalhistoryentry` | `fg_environmental_environmentalhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringExcursion | `environmental_monitoringexcursion` | `fg_environmental_monitoringexcursion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringLimitRule | `environmental_monitoringlimitrule` | `fg_environmental_monitoringlimitrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringParameter | `environmental_monitoringparameter` | `fg_environmental_monitoringparameter` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringPoint | `environmental_monitoringpoint` | `fg_environmental_monitoringpoint` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringReading | `environmental_monitoringreading` | `fg_environmental_monitoringreading` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringScheduleLink | `environmental_monitoringschedulelink` | `fg_environmental_monitoringschedulelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringSpec | `environmental_monitoringspec` | `fg_environmental_monitoringspec` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringSpecVersion | `environmental_monitoringspecversion` | `fg_environmental_monitoringspecversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| environmental | MonitoringTrendIndex | `environmental_monitoringtrendindex` | `fg_environmental_monitoringtrendindex` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| evidence | EvidenceAttachment | `evidence_evidenceattachment` | `fg_evidence_evidenceattachment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| foreign_body | ChallengeScheduleRule | `foreign_body_challengeschedulerule` | `fg_foreign_body_challengeschedulerule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| foreign_body | ContainmentAssessment | `foreign_body_containmentassessment` | `fg_foreign_body_containmentassessment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| foreign_body | ForeignBodyHistoryEntry | `foreign_body_foreignbodyhistoryentry` | `fg_foreign_body_foreignbodyhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| foreign_body | MetalDetectorChallengeTest | `foreign_body_metaldetectorchallengetest` | `fg_foreign_body_metaldetectorchallengetest` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| foreign_body | TestPiece | `foreign_body_testpiece` | `fg_foreign_body_testpiece` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | ChecklistItemHaccpBinding | `haccp_checklistitemhaccpbinding` | `fg_haccp_checklistitemhaccpbinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | ControlMeasure | `haccp_controlmeasure` | `fg_haccp_controlmeasure` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | ControlPoint | `haccp_controlpoint` | `fg_haccp_controlpoint` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | CorrectiveActionReference | `haccp_correctiveactionreference` | `fg_haccp_correctiveactionreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | CriticalLimitReference | `haccp_criticallimitreference` | `fg_haccp_criticallimitreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | HaccpHistoryEntry | `haccp_haccphistoryentry` | `fg_haccp_haccphistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | HaccpPlan | `haccp_haccpplan` | `fg_haccp_haccpplan` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | HaccpPlanVersion | `haccp_haccpplanversion` | `fg_haccp_haccpplanversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | Hazard | `haccp_hazard` | `fg_haccp_hazard` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | MonitoringRule | `haccp_monitoringrule` | `fg_haccp_monitoringrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| haccp | ProcessStep | `haccp_processstep` | `fg_haccp_processstep` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| instruments | CalibrationRecord | `instruments_calibrationrecord` | `fg_instruments_calibrationrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| instruments | Equipment | `instruments_equipment` | `fg_instruments_equipment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| integrations | IntegrationAttempt | `integrations_integrationattempt` | `fg_integrations_integrationattempt` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| ipqc | IpqcHistoryEntry | `ipqc_ipqchistoryentry` | `fg_ipqc_ipqchistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| ipqc | IpqcInspectionCase | `ipqc_ipqcinspectioncase` | `fg_ipqc_ipqcinspectioncase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| ipqc | IpqcProcessCheckDefinition | `ipqc_ipqcprocesscheckdefinition` | `fg_ipqc_ipqcprocesscheckdefinition` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| ipqc | IpqcWorkflowPolicy | `ipqc_ipqcworkflowpolicy` | `fg_ipqc_ipqcworkflowpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| iqc | IncomingReceiptEvent | `iqc_incomingreceiptevent` | `fg_iqc_incomingreceiptevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| iqc | IqcHistoryEntry | `iqc_iqchistoryentry` | `fg_iqc_iqchistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| iqc | IqcInspectionCase | `iqc_iqcinspectioncase` | `fg_iqc_iqcinspectioncase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| iqc | IqcWorkflowPolicy | `iqc_iqcworkflowpolicy` | `fg_iqc_iqcworkflowpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabExternalCertificate | `laboratory_labexternalcertificate` | `fg_laboratory_labexternalcertificate` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabHistoryEntry | `laboratory_labhistoryentry` | `fg_laboratory_labhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabPositiveReleasePolicy | `laboratory_labpositivereleasepolicy` | `fg_laboratory_labpositivereleasepolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabResult | `laboratory_labresult` | `fg_laboratory_labresult` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabSample | `laboratory_labsample` | `fg_laboratory_labsample` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabTest | `laboratory_labtest` | `fg_laboratory_labtest` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | LabTestParameter | `laboratory_labtestparameter` | `fg_laboratory_labtestparameter` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| laboratory | TestMethodReference | `laboratory_testmethodreference` | `fg_laboratory_testmethodreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| master_data | FGProduct | `master_data_fgproduct` | `fg_master_data_fgproduct` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| master_data | ProductSpecification | `master_data_productspecification` | `fg_master_data_productspecification` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| master_data | SpecificationParameter | `master_data_specificationparameter` | `fg_master_data_specificationparameter` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| master_data | SpecificationVersion | `master_data_specificationversion` | `fg_master_data_specificationversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| nonconformance | HoldCase | `nonconformance_holdcase` | `fg_nonconformance_holdcase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| nonconformance | NonConformanceRecord | `nonconformance_nonconformancerecord` | `fg_nonconformance_nonconformancerecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| nonconformance | QualityCaseHistoryEntry | `nonconformance_qualitycasehistoryentry` | `fg_nonconformance_qualitycasehistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| notifications | Notification | `notifications_notification` | `fg_notifications_notification` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| notifications | NotificationDeliveryAttempt | `notifications_notificationdeliveryattempt` | `fg_notifications_notificationdeliveryattempt` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| notifications | OrganizationNotificationPolicy | `notifications_organizationnotificationpolicy` | `fg_notifications_organizationnotificationpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| organizations | Department | `organizations_department` | `fg_organizations_department` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| organizations | Organization | `organizations_organization` | `fg_organizations_organization` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| organizations | Shift | `organizations_shift` | `fg_organizations_shift` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| organizations | Site | `organizations_site` | `fg_organizations_site` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | ArtworkVerificationRecord | `packaging_artworkverificationrecord` | `fg_packaging_artworkverificationrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | ArtworkVersion | `packaging_artworkversion` | `fg_packaging_artworkversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | ChecklistItemArtworkBinding | `packaging_checklistitemartworkbinding` | `fg_packaging_checklistitemartworkbinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | LineClearanceArtworkHook | `packaging_lineclearanceartworkhook` | `fg_packaging_lineclearanceartworkhook` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | PackagingArtwork | `packaging_packagingartwork` | `fg_packaging_packagingartwork` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| packaging | PackagingHistoryEntry | `packaging_packaginghistoryentry` | `fg_packaging_packaginghistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | CurrentControl | `process_fmea_currentcontrol` | `fg_process_fmea_currentcontrol` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | FailureEffect | `process_fmea_failureeffect` | `fg_process_fmea_failureeffect` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | FailureMode | `process_fmea_failuremode` | `fg_process_fmea_failuremode` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | FailureModeAssessment | `process_fmea_failuremodeassessment` | `fg_process_fmea_failuremodeassessment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | PotentialCause | `process_fmea_potentialcause` | `fg_process_fmea_potentialcause` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessFmea | `process_fmea_processfmea` | `fg_process_fmea_processfmea` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessFmeaEvent | `process_fmea_processfmeaevent` | `fg_process_fmea_processfmeaevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessFmeaLink | `process_fmea_processfmealink` | `fg_process_fmea_processfmealink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessFmeaScoringPolicy | `process_fmea_processfmeascoringpolicy` | `fg_process_fmea_processfmeascoringpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessFmeaVersion | `process_fmea_processfmeaversion` | `fg_process_fmea_processfmeaversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | ProcessStep | `process_fmea_processstep` | `fg_process_fmea_processstep` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| process_fmea | RecommendedAction | `process_fmea_recommendedaction` | `fg_process_fmea_recommendedaction` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| product_returns | ReturnQualityPolicy | `product_returns_returnqualitypolicy` | `fg_product_returns_returnqualitypolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| product_returns | ReturnQualityRecord | `product_returns_returnqualityrecord` | `fg_product_returns_returnqualityrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| product_returns | ReturnQualityTimelineEntry | `product_returns_returnqualitytimelineentry` | `fg_product_returns_returnqualitytimelineentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality | QAReview | `quality_qareview` | `fg_quality_qareview` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAudit | `quality_audits_qualityaudit` | `fg_quality_audits_qualityaudit` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAuditChecklistBinding | `quality_audits_qualityauditchecklistbinding` | `fg_quality_audits_qualityauditchecklistbinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAuditEvent | `quality_audits_qualityauditevent` | `fg_quality_audits_qualityauditevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAuditFinding | `quality_audits_qualityauditfinding` | `fg_quality_audits_qualityauditfinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAuditFindingCodeConfig | `quality_audits_qualityauditfindingcodeconfig` | `fg_quality_audits_qualityauditfindingcodeconfig` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_audits | QualityAuditParticipant | `quality_audits_qualityauditparticipant` | `fg_quality_audits_qualityauditparticipant` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_quarantine | QualityQuarantineEvent | `quality_quarantine_qualityquarantineevent` | `fg_quality_quarantine_qualityquarantineevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_quarantine | QualityQuarantinePolicy | `quality_quarantine_qualityquarantinepolicy` | `fg_quality_quarantine_qualityquarantinepolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_quarantine | QualityQuarantineRecord | `quality_quarantine_qualityquarantinerecord` | `fg_quality_quarantine_qualityquarantinerecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRisk | `quality_risks_qualityrisk` | `fg_quality_risks_qualityrisk` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskAssessment | `quality_risks_qualityriskassessment` | `fg_quality_risks_qualityriskassessment` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskCategoryConfig | `quality_risks_qualityriskcategoryconfig` | `fg_quality_risks_qualityriskcategoryconfig` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskEvent | `quality_risks_qualityriskevent` | `fg_quality_risks_qualityriskevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskLink | `quality_risks_qualityrisklink` | `fg_quality_risks_qualityrisklink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskMitigation | `quality_risks_qualityriskmitigation` | `fg_quality_risks_qualityriskmitigation` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskReview | `quality_risks_qualityriskreview` | `fg_quality_risks_qualityriskreview` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| quality_risks | QualityRiskScoringPolicy | `quality_risks_qualityriskscoringpolicy` | `fg_quality_risks_qualityriskscoringpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaCapaLink | `rca_rcacapalink` | `fg_rca_rcacapalink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaCause | `rca_rcacause` | `fg_rca_rcacause` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaEvent | `rca_rcaevent` | `fg_rca_rcaevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaEvidenceLink | `rca_rcaevidencelink` | `fg_rca_rcaevidencelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaFishboneEntry | `rca_rcafishboneentry` | `fg_rca_rcafishboneentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaFiveWhyStep | `rca_rcafivewhystep` | `fg_rca_rcafivewhystep` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RcaParticipant | `rca_rcaparticipant` | `fg_rca_rcaparticipant` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rca | RootCauseAnalysis | `rca_rootcauseanalysis` | `fg_rca_rootcauseanalysis` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | MockExerciseMetrics | `recall_mockexercisemetrics` | `fg_recall_mockexercisemetrics` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | MockImprovementAction | `recall_mockimprovementaction` | `fg_recall_mockimprovementaction` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | MockRecallFinding | `recall_mockrecallfinding` | `fg_recall_mockrecallfinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallAffectedBatch | `recall_recallaffectedbatch` | `fg_recall_recallaffectedbatch` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallAffectedProduct | `recall_recallaffectedproduct` | `fg_recall_recallaffectedproduct` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallCase | `recall_recallcase` | `fg_recall_recallcase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallCommunicationRecord | `recall_recallcommunicationrecord` | `fg_recall_recallcommunicationrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallPolicy | `recall_recallpolicy` | `fg_recall_recallpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallQuantityLine | `recall_recallquantityline` | `fg_recall_recallquantityline` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recall | RecallTimelineEntry | `recall_recalltimelineentry` | `fg_recall_recalltimelineentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | MaterialReference | `receiving_materialreference` | `fg_receiving_materialreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | MaterialSpecification | `receiving_materialspecification` | `fg_receiving_materialspecification` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | MaterialSpecificationParameter | `receiving_materialspecificationparameter` | `fg_receiving_materialspecificationparameter` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | MaterialSpecificationVersion | `receiving_materialspecificationversion` | `fg_receiving_materialspecificationversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | ReceiptLabSampleLink | `receiving_receiptlabsamplelink` | `fg_receiving_receiptlabsamplelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | ReceiptQualityRecord | `receiving_receiptqualityrecord` | `fg_receiving_receiptqualityrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| receiving | ReceivingHistoryEntry | `receiving_receivinghistoryentry` | `fg_receiving_receivinghistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recording | ChecklistCorrection | `recording_checklistcorrection` | `fg_recording_checklistcorrection` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recording | ChecklistRecord | `recording_checklistrecord` | `fg_recording_checklistrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recording | ChecklistResponse | `recording_checklistresponse` | `fg_recording_checklistresponse` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recording | ChecklistSubmission | `recording_checklistsubmission` | `fg_recording_checklistsubmission` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| recording | ChecklistSubmissionResponse | `recording_checklistsubmissionresponse` | `fg_recording_checklistsubmissionresponse` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| reports | ReportRun | `reports_reportrun` | `fg_reports_reportrun` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| reviews | SupervisorReview | `reviews_supervisorreview` | `fg_reviews_supervisorreview` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| reviews | SupervisorReviewGovernancePolicy | `reviews_supervisorreviewgovernancepolicy` | `fg_reviews_supervisorreviewgovernancepolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rework | ReworkCase | `rework_reworkcase` | `fg_rework_reworkcase` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rework | ReworkCaseEvent | `rework_reworkcaseevent` | `fg_rework_reworkcaseevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| rework | ReworkPolicyStub | `rework_reworkpolicystub` | `fg_rework_reworkpolicystub` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | ChecklistItemSamplingBinding | `sampling_checklistitemsamplingbinding` | `fg_sampling_checklistitemsamplingbinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | SampleRequirement | `sampling_samplerequirement` | `fg_sampling_samplerequirement` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | SamplingHistoryEntry | `sampling_samplinghistoryentry` | `fg_sampling_samplinghistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | SamplingPlan | `sampling_samplingplan` | `fg_sampling_samplingplan` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | SamplingPlanVersion | `sampling_samplingplanversion` | `fg_sampling_samplingplanversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sampling | SamplingRule | `sampling_samplingrule` | `fg_sampling_samplingrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | ChecklistTemplateSanitationBinding | `sanitation_checklisttemplatesanitationbinding` | `fg_sanitation_checklisttemplatesanitationbinding` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | ChemicalReference | `sanitation_chemicalreference` | `fg_sanitation_chemicalreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationChemicalReference | `sanitation_sanitationchemicalreference` | `fg_sanitation_sanitationchemicalreference` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationFailPolicy | `sanitation_sanitationfailpolicy` | `fg_sanitation_sanitationfailpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationHistoryEntry | `sanitation_sanitationhistoryentry` | `fg_sanitation_sanitationhistoryentry` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationProgram | `sanitation_sanitationprogram` | `fg_sanitation_sanitationprogram` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationProgramVersion | `sanitation_sanitationprogramversion` | `fg_sanitation_sanitationprogramversion` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationScheduleLink | `sanitation_sanitationschedulelink` | `fg_sanitation_sanitationschedulelink` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sanitation | SanitationScope | `sanitation_sanitationscope` | `fg_sanitation_sanitationscope` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ChecklistApplicabilityRule | `scheduling_checklistapplicabilityrule` | `fg_scheduling_checklistapplicabilityrule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ChecklistSchedule | `scheduling_checklistschedule` | `fg_scheduling_checklistschedule` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ChecklistTask | `scheduling_checklisttask` | `fg_scheduling_checklisttask` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ChecklistTaskAssignmentEvent | `scheduling_checklisttaskassignmentevent` | `fg_scheduling_checklisttaskassignmentevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ExternalBatchEvent | `scheduling_externalbatchevent` | `fg_scheduling_externalbatchevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| scheduling | ExternalBatchMapping | `scheduling_externalbatchmapping` | `fg_scheduling_externalbatchmapping` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| security_audit | SecurityAuditEvent | `security_audit_securityauditevent` | `fg_security_audit_securityauditevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| sessions | Session | `django_session` | `fg_django_session` | `session_key:CharField` | OTHER (CharField) — REVIEW | Owner review required |
| supplier_quality | SupplierCertificate | `supplier_quality_suppliercertificate` | `fg_supplier_quality_suppliercertificate` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| supplier_quality | SupplierQualityEvent | `supplier_quality_supplierqualityevent` | `fg_supplier_quality_supplierqualityevent` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| supplier_quality | SupplierQualityProfile | `supplier_quality_supplierqualityprofile` | `fg_supplier_quality_supplierqualityprofile` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| training | TrainingEnforcementPolicy | `training_trainingenforcementpolicy` | `fg_training_trainingenforcementpolicy` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |
| training | TrainingRecord | `training_trainingrecord` | `fg_training_trainingrecord` | `id:UUIDField` | UUID — SAFE CANDIDATE | Preserve UUID values as document `_id` or dedicated `id` field |

## Cutover policy

1. Synthetic Mongo POC may use clean IDs for new data only.
2. Production data migration (later) must map existing UUID PKs 1:1.
3. Do not migrate PostgreSQL production data until Mongo runtime is proven.
4. Classification remains blocked while any REQUIRES REDESIGN PKs remain on the core path.

