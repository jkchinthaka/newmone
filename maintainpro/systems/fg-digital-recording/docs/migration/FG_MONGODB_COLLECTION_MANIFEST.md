# FG MongoDB Collection Manifest

**Generated (UTC):** 2026-08-12T09:55:37Z  
**Production logical database:** `mgintginpro_prod`  
**Namespace prefix:** `fg_`  
**Collection count:** 231  

## Naming contract

```text
fg_{django_default_db_table}
```

FG collections live in the **same** logical database as MaintainPro.
Do **not** create a separate FG production database.
Do **not** reuse or rename MaintainPro collections.

## Summary

| Field | Value |
| --- | --- |
| EXISTING_DATABASE_NAME | `mgintginpro_prod` |
| PLANNED_FG_COLLECTION_COUNT | 231 |
| MAINTAINPRO_PRISMA_MODELS (reference) | 115 |
| EXACT_COLLISIONS | 0 |

## Collections

### `fg_access_control_role`

- **Django model:** `access_control.Role`
- **Existing PostgreSQL table:** `access_control_role`
- **Proposed Mongo collection:** `fg_access_control_role`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; is_active; Index; constraint:UniqueConstraint:ac_role_code_ci_uniq
- **Relationships:** M2M:permissions->auth.Permission via Role_permissions
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_access_control_role_permissions`

- **Django model:** `access_control.Role_permissions`
- **Existing PostgreSQL table:** `access_control_role_permissions`
- **Proposed Mongo collection:** `fg_access_control_role_permissions`
- **PK field / type:** `id` / `BigAutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:role,permission
- **Relationships:** FK:role->access_control.Role; FK:permission->auth.Permission
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'apps.access_control.models.Role'>

### `fg_access_control_roletemplate`

- **Django model:** `access_control.RoleTemplate`
- **Existing PostgreSQL table:** `access_control_roletemplate`
- **Proposed Mongo collection:** `fg_access_control_roletemplate`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; is_active; Index; constraint:UniqueConstraint:ac_role_template_code_ci_uniq
- **Relationships:** M2M:permissions->auth.Permission via RoleTemplate_permissions
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_access_control_roletemplate_permissions`

- **Django model:** `access_control.RoleTemplate_permissions`
- **Existing PostgreSQL table:** `access_control_roletemplate_permissions`
- **Proposed Mongo collection:** `fg_access_control_roletemplate_permissions`
- **PK field / type:** `id` / `BigAutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:roletemplate,permission
- **Relationships:** FK:roletemplate->access_control.RoleTemplate; FK:permission->auth.Permission
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'apps.access_control.models.RoleTemplate'>

### `fg_access_control_scopedroleassignment`

- **Django model:** `access_control.ScopedRoleAssignment`
- **Existing PostgreSQL table:** `access_control_scopedroleassignment`
- **Proposed Mongo collection:** `fg_access_control_scopedroleassignment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; user,is_active; organization,is_active; valid_until; constraint:UniqueConstraint:ac_active_assignment_uniq
- **Relationships:** FK:user->accounts.User; FK:role->access_control.Role; FK:organization->organizations.Organization; FK:site->organizations.Site; FK:department->organizations.Department; FK:assigned_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_accounts_user`

- **Django model:** `accounts.User`
- **Existing PostgreSQL table:** `accounts_user`
- **Proposed Mongo collection:** `fg_accounts_user`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; Index; locked_until; constraint:UniqueConstraint:acct_user_emp_code_ci_uniq; unique:username
- **Relationships:** M2M:groups->auth.Group via User_groups; M2M:user_permissions->auth.Permission via User_user_permissions
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_accounts_user_groups`

- **Django model:** `accounts.User_groups`
- **Existing PostgreSQL table:** `accounts_user_groups`
- **Proposed Mongo collection:** `fg_accounts_user_groups`
- **PK field / type:** `id` / `BigAutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:user,group
- **Relationships:** FK:user->accounts.User; FK:group->auth.Group
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'apps.accounts.models.User'>

### `fg_accounts_user_user_permissions`

- **Django model:** `accounts.User_user_permissions`
- **Existing PostgreSQL table:** `accounts_user_user_permissions`
- **Proposed Mongo collection:** `fg_accounts_user_user_permissions`
- **PK field / type:** `id` / `BigAutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:user,permission
- **Relationships:** FK:user->accounts.User; FK:permission->auth.Permission
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'apps.accounts.models.User'>

### `fg_ai_assistance_aiassistancerequest`

- **Django model:** `ai_assistance.AIAssistanceRequest`
- **Existing PostgreSQL table:** `ai_assistance_aiassistancerequest`
- **Proposed Mongo collection:** `fg_ai_assistance_aiassistancerequest`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,use_case,created_at; organization,status
- **Relationships:** FK:organization->organizations.Organization; FK:requested_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_auth_group`

- **Django model:** `auth.Group`
- **Existing PostgreSQL table:** `auth_group`
- **Proposed Mongo collection:** `fg_auth_group`
- **PK field / type:** `id` / `AutoField`
- **PK classification:** CONTRIB MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique:name
- **Relationships:** M2M:permissions->auth.Permission via Group_permissions
- **Migration concern:** standard model; PK: CONTRIB MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_auth_group_permissions`

- **Django model:** `auth.Group_permissions`
- **Existing PostgreSQL table:** `auth_group_permissions`
- **Proposed Mongo collection:** `fg_auth_group_permissions`
- **PK field / type:** `id` / `AutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:group,permission
- **Relationships:** FK:group->auth.Group; FK:permission->auth.Permission
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'django.contrib.auth.models.Group'>

### `fg_auth_permission`

- **Django model:** `auth.Permission`
- **Existing PostgreSQL table:** `auth_permission`
- **Proposed Mongo collection:** `fg_auth_permission`
- **PK field / type:** `id` / `AutoField`
- **PK classification:** CONTRIB MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:content_type,codename
- **Relationships:** FK:content_type->contenttypes.ContentType
- **Migration concern:** standard model; PK: CONTRIB MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_batch_dossier_batchdossierexportrequest`

- **Django model:** `batch_dossier.BatchDossierExportRequest`
- **Existing PostgreSQL table:** `batch_dossier_batchdossierexportrequest`
- **Proposed Mongo collection:** `fg_batch_dossier_batchdossierexportrequest`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,batch_reference; organization,status
- **Relationships:** FK:organization->organizations.Organization; FK:requested_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_batch_dossier_batchdossierpolicy`

- **Django model:** `batch_dossier.BatchDossierPolicy`
- **Existing PostgreSQL table:** `batch_dossier_batchdossierpolicy`
- **Proposed Mongo collection:** `fg_batch_dossier_batchdossierpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_batch_genealogy_genealogyedge`

- **Django model:** `batch_genealogy.GenealogyEdge`
- **Existing PostgreSQL table:** `batch_genealogy_genealogyedge`
- **Proposed Mongo collection:** `fg_batch_genealogy_genealogyedge`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,from_node; organization,to_node; organization,relation; organization,is_rework; constraint:UniqueConstraint:batch_gen_edge_org_source_event_uniq; constraint:CheckConstraint:batch_gen_edge_no_self_loop
- **Relationships:** FK:organization->organizations.Organization; FK:from_node->batch_genealogy.GenealogyNode; FK:to_node->batch_genealogy.GenealogyNode; FK:ingested_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_batch_genealogy_genealogynode`

- **Django model:** `batch_genealogy.GenealogyNode`
- **Existing PostgreSQL table:** `batch_genealogy_genealogynode`
- **Proposed Mongo collection:** `fg_batch_genealogy_genealogynode`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,kind; organization,external_key; constraint:UniqueConstraint:batch_gen_node_org_kind_key_ci_uniq
- **Relationships:** FK:organization->organizations.Organization
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_batch_genealogy_genealogypolicy`

- **Django model:** `batch_genealogy.GenealogyPolicy`
- **Existing PostgreSQL table:** `batch_genealogy_genealogypolicy`
- **Proposed Mongo collection:** `fg_batch_genealogy_genealogypolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_capa_capaactionitem`

- **Django model:** `capa.CapaActionItem`
- **Existing PostgreSQL table:** `capa_capaactionitem`
- **Proposed Mongo collection:** `fg_capa_capaactionitem`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; capa,status
- **Relationships:** FK:capa->capa.CorrectiveAction; FK:owner->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_capa_capahistoryentry`

- **Django model:** `capa.CapaHistoryEntry`
- **Existing PostgreSQL table:** `capa_capahistoryentry`
- **Proposed Mongo collection:** `fg_capa_capahistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,capa,created_at
- **Relationships:** FK:organization->organizations.Organization; FK:capa->capa.CorrectiveAction; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_capa_correctiveaction`

- **Django model:** `capa.CorrectiveAction`
- **Existing PostgreSQL table:** `capa_correctiveaction`
- **Proposed Mongo collection:** `fg_capa_correctiveaction`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,due_date; constraint:UniqueConstraint:capa_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:nonconformance->nonconformance.NonConformanceRecord; FK:owner->accounts.User; FK:verified_by->accounts.User; FK:effectiveness_reviewed_by->accounts.User; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_change_control_qualitychangeaffectedlink`

- **Django model:** `change_control.QualityChangeAffectedLink`
- **Existing PostgreSQL table:** `change_control_qualitychangeaffectedlink`
- **Proposed Mongo collection:** `fg_change_control_qualitychangeaffectedlink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_change_affected_link_uniq
- **Relationships:** FK:change_request->change_control.QualityChangeRequest; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_change_control_qualitychangeevent`

- **Django model:** `change_control.QualityChangeEvent`
- **Existing PostgreSQL table:** `change_control_qualitychangeevent`
- **Proposed Mongo collection:** `fg_change_control_qualitychangeevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; change_request,created_at
- **Relationships:** FK:change_request->change_control.QualityChangeRequest; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_change_control_qualitychangeimpactassessment`

- **Django model:** `change_control.QualityChangeImpactAssessment`
- **Existing PostgreSQL table:** `change_control_qualitychangeimpactassessment`
- **Proposed Mongo collection:** `fg_change_control_qualitychangeimpactassessment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:change_request
- **Relationships:** O2O:change_request->change_control.QualityChangeRequest; FK:assessed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_change_control_qualitychangeimplementationlink`

- **Django model:** `change_control.QualityChangeImplementationLink`
- **Existing PostgreSQL table:** `change_control_qualitychangeimplementationlink`
- **Proposed Mongo collection:** `fg_change_control_qualitychangeimplementationlink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:change_request->change_control.QualityChangeRequest; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_change_control_qualitychangerequest`

- **Django model:** `change_control.QualityChangeRequest`
- **Existing PostgreSQL table:** `change_control_qualitychangerequest`
- **Proposed Mongo collection:** `fg_change_control_qualitychangerequest`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; constraint:UniqueConstraint:quality_change_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:requester->accounts.User; FK:owner->accounts.User; FK:approved_by->accounts.User; FK:verified_by->accounts.User; FK:closed_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_allergenreference`

- **Django model:** `changeover.AllergenReference`
- **Existing PostgreSQL table:** `changeover_allergenreference`
- **Proposed Mongo collection:** `fg_changeover_allergenreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:changeover_allergen_ref_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_allergenriskpolicy`

- **Django model:** `changeover.AllergenRiskPolicy`
- **Existing PostgreSQL table:** `changeover_allergenriskpolicy`
- **Proposed Mongo collection:** `fg_changeover_allergenriskpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_changeoverhistoryentry`

- **Django model:** `changeover.ChangeoverHistoryEntry`
- **Existing PostgreSQL table:** `changeover_changeoverhistoryentry`
- **Proposed Mongo collection:** `fg_changeover_changeoverhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:changeover->changeover.ChangeoverRecord; FK:line_clearance->changeover.LineClearanceRecord; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_changeoverrecord`

- **Django model:** `changeover.ChangeoverRecord`
- **Existing PostgreSQL table:** `changeover_changeoverrecord`
- **Proposed Mongo collection:** `fg_changeover_changeoverrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,line_code,-started_at; organization,batch_reference
- **Relationships:** FK:organization->organizations.Organization; FK:previous_product->master_data.FGProduct; FK:next_product->master_data.FGProduct; FK:cleaning_checklist_template->checklists.ChecklistTemplate; FK:cleaning_checklist_version->checklists.ChecklistVersion; FK:packaging_artwork_hook->packaging.LineClearanceArtworkHook; FK:previous_declaration->changeover.ProductAllergenDeclaration; FK:next_declaration->changeover.ProductAllergenDeclaration; FK:verified_by->accounts.User; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_lineclearancerecord`

- **Django model:** `changeover.LineClearanceRecord`
- **Existing PostgreSQL table:** `changeover_lineclearancerecord`
- **Proposed Mongo collection:** `fg_changeover_lineclearancerecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,line_code,-completed_at
- **Relationships:** FK:organization->organizations.Organization; FK:changeover->changeover.ChangeoverRecord; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:checklist_submission->recording.ChecklistSubmission; FK:packaging_artwork_hook->packaging.LineClearanceArtworkHook; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_productallergendeclaration`

- **Django model:** `changeover.ProductAllergenDeclaration`
- **Existing PostgreSQL table:** `changeover_productallergendeclaration`
- **Proposed Mongo collection:** `fg_changeover_productallergendeclaration`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct; FK:approved_by->accounts.User; FK:created_by->accounts.User; M2M:allergen_references->changeover.AllergenReference via ProductAllergenDeclaration_allergen_references
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_changeover_productallergendeclaration_allergen_references`

- **Django model:** `changeover.ProductAllergenDeclaration_allergen_references`
- **Existing PostgreSQL table:** `changeover_productallergendeclaration_allergen_references`
- **Proposed Mongo collection:** `fg_changeover_productallergendeclaration_allergen_references`
- **PK field / type:** `id` / `BigAutoField`
- **PK classification:** THROUGH MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:productallergendeclaration,allergenreference
- **Relationships:** FK:productallergendeclaration->changeover.ProductAllergenDeclaration; FK:allergenreference->changeover.AllergenReference
- **Migration concern:** auto-created through / M2M; PK: THROUGH MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** <class 'apps.changeover.models.ProductAllergenDeclaration'>

### `fg_checklists_checklistcalculationoperand`

- **Django model:** `checklists.ChecklistCalculationOperand`
- **Existing PostgreSQL table:** `checklists_checklistcalculationoperand`
- **Proposed Mongo collection:** `fg_checklists_checklistcalculationoperand`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; calculated_item,position; constraint:UniqueConstraint:chk_calc_operand_pos_uniq; constraint:UniqueConstraint:chk_calc_operand_source_uniq
- **Relationships:** FK:calculated_item->checklists.ChecklistItem; FK:source_item->checklists.ChecklistItem
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistitem`

- **Django model:** `checklists.ChecklistItem`
- **Existing PostgreSQL table:** `checklists_checklistitem`
- **Proposed Mongo collection:** `fg_checklists_checklistitem`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; section,parent_item,position; item_kind; constraint:UniqueConstraint:chk_item_section_position_uniq; constraint:UniqueConstraint:chk_item_section_code_ci_uniq
- **Relationships:** FK:section->checklists.ChecklistSection; FK:parent_item->checklists.ChecklistItem
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistitemevaluationrule`

- **Django model:** `checklists.ChecklistItemEvaluationRule`
- **Existing PostgreSQL table:** `checklists_checklistitemevaluationrule`
- **Proposed Mongo collection:** `fg_checklists_checklistitemevaluationrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:item
- **Relationships:** O2O:item->checklists.ChecklistItem; FK:expected_option->checklists.ChecklistItemOption; FK:specification_version->master_data.SpecificationVersion; FK:specification_parameter->master_data.SpecificationParameter
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistitemoption`

- **Django model:** `checklists.ChecklistItemOption`
- **Existing PostgreSQL table:** `checklists_checklistitemoption`
- **Proposed Mongo collection:** `fg_checklists_checklistitemoption`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:chk_option_item_position_uniq; constraint:UniqueConstraint:chk_option_item_value_ci_uniq
- **Relationships:** FK:item->checklists.ChecklistItem
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistitemrule`

- **Django model:** `checklists.ChecklistItemRule`
- **Existing PostgreSQL table:** `checklists_checklistitemrule`
- **Proposed Mongo collection:** `fg_checklists_checklistitemrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; target_item,rule_kind; constraint:UniqueConstraint:chk_item_rule_kind_uniq
- **Relationships:** FK:target_item->checklists.ChecklistItem; FK:operand_item->checklists.ChecklistItem; FK:expected_option->checklists.ChecklistItemOption
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistsection`

- **Django model:** `checklists.ChecklistSection`
- **Existing PostgreSQL table:** `checklists_checklistsection`
- **Proposed Mongo collection:** `fg_checklists_checklistsection`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:chk_section_version_position_uniq
- **Relationships:** FK:version->checklists.ChecklistVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklisttemplate`

- **Django model:** `checklists.ChecklistTemplate`
- **Existing PostgreSQL table:** `checklists_checklisttemplate`
- **Proposed Mongo collection:** `fg_checklists_checklisttemplate`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; Index; constraint:UniqueConstraint:chk_template_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_checklists_checklistversion`

- **Django model:** `checklists.ChecklistVersion`
- **Existing PostgreSQL table:** `checklists_checklistversion`
- **Proposed Mongo collection:** `fg_checklists_checklistversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; template,status; template,status,effective_from,effective_to; constraint:UniqueConstraint:chk_version_template_number_uniq; constraint:CheckConstraint:chk_version_effective_window_valid
- **Relationships:** FK:template->checklists.ChecklistTemplate
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancecontrolmapping`

- **Django model:** `compliance_mapping.ComplianceControlMapping`
- **Existing PostgreSQL table:** `compliance_mapping_compliancecontrolmapping`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancecontrolmapping`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; edition,status
- **Relationships:** FK:organization->organizations.Organization; FK:edition->compliance_mapping.ComplianceSourceEdition; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_complianceevidencelink`

- **Django model:** `compliance_mapping.ComplianceEvidenceLink`
- **Existing PostgreSQL table:** `compliance_mapping_complianceevidencelink`
- **Proposed Mongo collection:** `fg_compliance_mapping_complianceevidencelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; mapping,evidence_kind
- **Relationships:** FK:mapping->compliance_mapping.ComplianceControlMapping; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancegap`

- **Django model:** `compliance_mapping.ComplianceGap`
- **Existing PostgreSQL table:** `compliance_mapping_compliancegap`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancegap`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; mapping,status
- **Relationships:** FK:mapping->compliance_mapping.ComplianceControlMapping; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancegapaction`

- **Django model:** `compliance_mapping.ComplianceGapAction`
- **Existing PostgreSQL table:** `compliance_mapping_compliancegapaction`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancegapaction`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:gap->compliance_mapping.ComplianceGap; FK:owner->accounts.User; FK:nonconformance->nonconformance.NonConformanceRecord; FK:corrective_action->capa.CorrectiveAction; FK:change_request->change_control.QualityChangeRequest; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancemappingevent`

- **Django model:** `compliance_mapping.ComplianceMappingEvent`
- **Existing PostgreSQL table:** `compliance_mapping_compliancemappingevent`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancemappingevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,created_at; source,created_at
- **Relationships:** FK:organization->organizations.Organization; FK:source->compliance_mapping.ComplianceSource; FK:edition->compliance_mapping.ComplianceSourceEdition; FK:mapping->compliance_mapping.ComplianceControlMapping; FK:gap->compliance_mapping.ComplianceGap; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancesource`

- **Django model:** `compliance_mapping.ComplianceSource`
- **Existing PostgreSQL table:** `compliance_mapping_compliancesource`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancesource`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,kind; constraint:UniqueConstraint:compliance_source_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_compliance_mapping_compliancesourceedition`

- **Django model:** `compliance_mapping.ComplianceSourceEdition`
- **Existing PostgreSQL table:** `compliance_mapping_compliancesourceedition`
- **Proposed Mongo collection:** `fg_compliance_mapping_compliancesourceedition`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; source,register_status; constraint:UniqueConstraint:compliance_source_edition_uniq
- **Relationships:** FK:source->compliance_mapping.ComplianceSource; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintbatchtrace`

- **Django model:** `customer_complaints.CustomerComplaintBatchTrace`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintbatchtrace`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintbatchtrace`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:complaint_case
- **Relationships:** O2O:complaint_case->customer_complaints.CustomerComplaintCase; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintcase`

- **Django model:** `customer_complaints.CustomerComplaintCase`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintcase`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintcase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,code; organization,batch_reference; organization,erp_customer_reference; constraint:UniqueConstraint:complaint_case_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:owner->accounts.User; FK:closed_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintcategoryconfig`

- **Django model:** `customer_complaints.CustomerComplaintCategoryConfig`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintcategoryconfig`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintcategoryconfig`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:complaint_category_org_kind_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintcommunication`

- **Django model:** `customer_complaints.CustomerComplaintCommunication`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintcommunication`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintcommunication`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:complaint_case->customer_complaints.CustomerComplaintCase; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintevidencelink`

- **Django model:** `customer_complaints.CustomerComplaintEvidenceLink`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintevidencelink`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintevidencelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:complaint_evidence_case_attachment_uniq
- **Relationships:** FK:complaint_case->customer_complaints.CustomerComplaintCase; FK:linked_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintinvestigationlink`

- **Django model:** `customer_complaints.CustomerComplaintInvestigationLink`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintinvestigationlink`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintinvestigationlink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; complaint_case,link_kind
- **Relationships:** FK:complaint_case->customer_complaints.CustomerComplaintCase; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplaintpolicy`

- **Django model:** `customer_complaints.CustomerComplaintPolicy`
- **Existing PostgreSQL table:** `customer_complaints_customercomplaintpolicy`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplaintpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_customer_complaints_customercomplainttimelineentry`

- **Django model:** `customer_complaints.CustomerComplaintTimelineEntry`
- **Existing PostgreSQL table:** `customer_complaints_customercomplainttimelineentry`
- **Proposed Mongo collection:** `fg_customer_complaints_customercomplainttimelineentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; complaint_case,created_at
- **Relationships:** FK:complaint_case->customer_complaints.CustomerComplaintCase; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_dispatch_coldchaintemperaturereading`

- **Django model:** `dispatch.ColdChainTemperatureReading`
- **Existing PostgreSQL table:** `dispatch_coldchaintemperaturereading`
- **Proposed Mongo collection:** `fg_dispatch_coldchaintemperaturereading`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,reading_at
- **Relationships:** FK:organization->organizations.Organization; FK:dispatch_record->dispatch.DispatchQualityRecord; FK:equipment->instruments.Equipment; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_dispatch_dispatchhistoryentry`

- **Django model:** `dispatch.DispatchHistoryEntry`
- **Existing PostgreSQL table:** `dispatch_dispatchhistoryentry`
- **Proposed Mongo collection:** `fg_dispatch_dispatchhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; dispatch_record,created_at
- **Relationships:** FK:organization->organizations.Organization; FK:dispatch_record->dispatch.DispatchQualityRecord; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_dispatch_dispatchqualityrecord`

- **Django model:** `dispatch.DispatchQualityRecord`
- **Existing PostgreSQL table:** `dispatch_dispatchqualityrecord`
- **Proposed Mongo collection:** `fg_dispatch_dispatchqualityrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,batch_reference; organization,delivery_loading_reference; constraint:UniqueConstraint:dispatch_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:vehicle_inspection_checklist_version->checklists.ChecklistVersion; FK:vehicle_inspection_submission->recording.ChecklistSubmission; FK:qa_review->quality.QAReview; FK:owner->accounts.User; FK:created_by->accounts.User; FK:completed_by->accounts.User; FK:cancelled_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_dispatch_dispatchquantityline`

- **Django model:** `dispatch.DispatchQuantityLine`
- **Existing PostgreSQL table:** `dispatch_dispatchquantityline`
- **Proposed Mongo collection:** `fg_dispatch_dispatchquantityline`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,batch_reference
- **Relationships:** FK:organization->organizations.Organization; FK:dispatch_record->dispatch.DispatchQualityRecord; FK:created_by->accounts.User; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_dispatch_dispatchreleasepolicy`

- **Django model:** `dispatch.DispatchReleasePolicy`
- **Existing PostgreSQL table:** `dispatch_dispatchreleasepolicy`
- **Proposed Mongo collection:** `fg_dispatch_dispatchreleasepolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_django_admin_log`

- **Django model:** `admin.LogEntry`
- **Existing PostgreSQL table:** `django_admin_log`
- **Proposed Mongo collection:** `fg_django_admin_log`
- **PK field / type:** `id` / `AutoField`
- **PK classification:** CONTRIB MODEL — REVIEW
- **Indexes / uniques:** pk:id
- **Relationships:** FK:user->accounts.User; FK:content_type->contenttypes.ContentType
- **Migration concern:** standard model; PK: CONTRIB MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_django_content_type`

- **Django model:** `contenttypes.ContentType`
- **Existing PostgreSQL table:** `django_content_type`
- **Proposed Mongo collection:** `fg_django_content_type`
- **PK field / type:** `id` / `AutoField`
- **PK classification:** CONTRIB MODEL — REVIEW
- **Indexes / uniques:** pk:id; unique_together:app_label,model
- **Relationships:** (none)
- **Migration concern:** standard model; PK: CONTRIB MODEL — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_django_session`

- **Django model:** `sessions.Session`
- **Existing PostgreSQL table:** `django_session`
- **Proposed Mongo collection:** `fg_django_session`
- **PK field / type:** `session_key` / `CharField`
- **PK classification:** OTHER (CharField) — REVIEW
- **Indexes / uniques:** pk:session_key
- **Relationships:** (none)
- **Migration concern:** standard model; PK: OTHER (CharField) — REVIEW
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_document_control_qualitydocument`

- **Django model:** `document_control.QualityDocument`
- **Existing PostgreSQL table:** `document_control_qualitydocument`
- **Proposed Mongo collection:** `fg_document_control_qualitydocument`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,document_kind; constraint:UniqueConstraint:quality_document_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:owner->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_document_control_qualitydocumentacknowledgement`

- **Django model:** `document_control.QualityDocumentAcknowledgement`
- **Existing PostgreSQL table:** `document_control_qualitydocumentacknowledgement`
- **Proposed Mongo collection:** `fg_document_control_qualitydocumentacknowledgement`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_document_ack_version_user_uniq
- **Relationships:** FK:version->document_control.QualityDocumentVersion; FK:acknowledged_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_document_control_qualitydocumentevent`

- **Django model:** `document_control.QualityDocumentEvent`
- **Existing PostgreSQL table:** `document_control_qualitydocumentevent`
- **Proposed Mongo collection:** `fg_document_control_qualitydocumentevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; document,created_at
- **Relationships:** FK:document->document_control.QualityDocument; FK:version->document_control.QualityDocumentVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_document_control_qualitydocumentversion`

- **Django model:** `document_control.QualityDocumentVersion`
- **Existing PostgreSQL table:** `document_control_qualitydocumentversion`
- **Proposed Mongo collection:** `fg_document_control_qualitydocumentversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; document,status; status,effective_from; constraint:UniqueConstraint:quality_document_version_rev_ci_uniq
- **Relationships:** FK:document->document_control.QualityDocument; FK:created_by->accounts.User; FK:approved_by->accounts.User; FK:published_by->accounts.User; FK:retired_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_document_control_qualityrecorddocumentlink`

- **Django model:** `document_control.QualityRecordDocumentLink`
- **Existing PostgreSQL table:** `document_control_qualityrecorddocumentlink`
- **Proposed Mongo collection:** `fg_document_control_qualityrecorddocumentlink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,linked_kind,linked_object_id; constraint:UniqueConstraint:quality_record_doc_link_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:document_version->document_control.QualityDocumentVersion; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_environmentalexcursionpolicy`

- **Django model:** `environmental.EnvironmentalExcursionPolicy`
- **Existing PostgreSQL table:** `environmental_environmentalexcursionpolicy`
- **Proposed Mongo collection:** `fg_environmental_environmentalexcursionpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_environmentalhistoryentry`

- **Django model:** `environmental.EnvironmentalHistoryEntry`
- **Existing PostgreSQL table:** `environmental_environmentalhistoryentry`
- **Proposed Mongo collection:** `fg_environmental_environmentalhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringexcursion`

- **Django model:** `environmental.MonitoringExcursion`
- **Existing PostgreSQL table:** `environmental_monitoringexcursion`
- **Proposed Mongo collection:** `fg_environmental_monitoringexcursion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:reading
- **Relationships:** FK:organization->organizations.Organization; O2O:reading->environmental.MonitoringReading; FK:limit_rule->environmental.MonitoringLimitRule; FK:hold_case->nonconformance.HoldCase
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringlimitrule`

- **Django model:** `environmental.MonitoringLimitRule`
- **Existing PostgreSQL table:** `environmental_monitoringlimitrule`
- **Proposed Mongo collection:** `fg_environmental_monitoringlimitrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:em_limit_rule_version_point_param_uniq
- **Relationships:** FK:spec_version->environmental.MonitoringSpecVersion; FK:monitoring_point->environmental.MonitoringPoint; FK:parameter->environmental.MonitoringParameter
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringparameter`

- **Django model:** `environmental.MonitoringParameter`
- **Existing PostgreSQL table:** `environmental_monitoringparameter`
- **Proposed Mongo collection:** `fg_environmental_monitoringparameter`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:em_monitoring_parameter_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringpoint`

- **Django model:** `environmental.MonitoringPoint`
- **Existing PostgreSQL table:** `environmental_monitoringpoint`
- **Proposed Mongo collection:** `fg_environmental_monitoringpoint`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:em_monitoring_point_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site; FK:department->organizations.Department; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringreading`

- **Django model:** `environmental.MonitoringReading`
- **Existing PostgreSQL table:** `environmental_monitoringreading`
- **Proposed Mongo collection:** `fg_environmental_monitoringreading`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,monitoring_point,parameter,-recorded_at; organization,parameter,-recorded_at
- **Relationships:** FK:organization->organizations.Organization; FK:monitoring_point->environmental.MonitoringPoint; FK:parameter->environmental.MonitoringParameter; FK:equipment->instruments.Equipment; FK:lab_result->laboratory.LabResult; FK:spec_version->environmental.MonitoringSpecVersion; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringschedulelink`

- **Django model:** `environmental.MonitoringScheduleLink`
- **Existing PostgreSQL table:** `environmental_monitoringschedulelink`
- **Proposed Mongo collection:** `fg_environmental_monitoringschedulelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:monitoring_point->environmental.MonitoringPoint; FK:parameter->environmental.MonitoringParameter; FK:checklist_schedule->scheduling.ChecklistSchedule
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringspec`

- **Django model:** `environmental.MonitoringSpec`
- **Existing PostgreSQL table:** `environmental_monitoringspec`
- **Proposed Mongo collection:** `fg_environmental_monitoringspec`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:em_monitoring_spec_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringspecversion`

- **Django model:** `environmental.MonitoringSpecVersion`
- **Existing PostgreSQL table:** `environmental_monitoringspecversion`
- **Proposed Mongo collection:** `fg_environmental_monitoringspecversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:em_monitoring_spec_version_uniq
- **Relationships:** FK:spec->environmental.MonitoringSpec; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_environmental_monitoringtrendindex`

- **Django model:** `environmental.MonitoringTrendIndex`
- **Existing PostgreSQL table:** `environmental_monitoringtrendindex`
- **Proposed Mongo collection:** `fg_environmental_monitoringtrendindex`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,parameter,-recorded_at; organization,monitoring_point,-recorded_at; unique:reading
- **Relationships:** FK:organization->organizations.Organization; O2O:reading->environmental.MonitoringReading; FK:monitoring_point->environmental.MonitoringPoint; FK:parameter->environmental.MonitoringParameter
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_evidence_evidenceattachment`

- **Django model:** `evidence.EvidenceAttachment`
- **Existing PostgreSQL table:** `evidence_evidenceattachment`
- **Proposed Mongo collection:** `fg_evidence_evidenceattachment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,linked_kind,linked_object_id; organization,lifecycle_status,uploaded_at; content_sha256; unique:storage_key
- **Relationships:** FK:organization->organizations.Organization; FK:uploaded_by->accounts.User; FK:retired_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_foreign_body_challengeschedulerule`

- **Django model:** `foreign_body.ChallengeScheduleRule`
- **Existing PostgreSQL table:** `foreign_body_challengeschedulerule`
- **Proposed Mongo collection:** `fg_foreign_body_challengeschedulerule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:fb_schedule_rule_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:equipment->instruments.Equipment; FK:checklist_template->checklists.ChecklistTemplate; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_foreign_body_containmentassessment`

- **Django model:** `foreign_body.ContainmentAssessment`
- **Existing PostgreSQL table:** `foreign_body_containmentassessment`
- **Proposed Mongo collection:** `fg_foreign_body_containmentassessment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:failed_test
- **Relationships:** FK:organization->organizations.Organization; O2O:failed_test->foreign_body.MetalDetectorChallengeTest; FK:previous_pass_test->foreign_body.MetalDetectorChallengeTest; FK:hold_case->nonconformance.HoldCase; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_foreign_body_foreignbodyhistoryentry`

- **Django model:** `foreign_body.ForeignBodyHistoryEntry`
- **Existing PostgreSQL table:** `foreign_body_foreignbodyhistoryentry`
- **Proposed Mongo collection:** `fg_foreign_body_foreignbodyhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:challenge_test->foreign_body.MetalDetectorChallengeTest; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_foreign_body_metaldetectorchallengetest`

- **Django model:** `foreign_body.MetalDetectorChallengeTest`
- **Existing PostgreSQL table:** `foreign_body_metaldetectorchallengetest`
- **Proposed Mongo collection:** `fg_foreign_body_metaldetectorchallengetest`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,performed_at; equipment,performed_at; organization,batch_reference
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site; FK:equipment->instruments.Equipment; FK:test_piece->foreign_body.TestPiece; FK:schedule_rule->foreign_body.ChallengeScheduleRule; FK:checklist_task->scheduling.ChecklistTask; FK:operator->accounts.User; FK:verifier->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_foreign_body_testpiece`

- **Django model:** `foreign_body.TestPiece`
- **Existing PostgreSQL table:** `foreign_body_testpiece`
- **Proposed Mongo collection:** `fg_foreign_body_testpiece`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:fb_test_piece_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_checklistitemhaccpbinding`

- **Django model:** `haccp.ChecklistItemHaccpBinding`
- **Existing PostgreSQL table:** `haccp_checklistitemhaccpbinding`
- **Proposed Mongo collection:** `fg_haccp_checklistitemhaccpbinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:checklist_item
- **Relationships:** O2O:checklist_item->checklists.ChecklistItem; FK:plan_version->haccp.HaccpPlanVersion; FK:control_point->haccp.ControlPoint
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_controlmeasure`

- **Django model:** `haccp.ControlMeasure`
- **Existing PostgreSQL table:** `haccp_controlmeasure`
- **Proposed Mongo collection:** `fg_haccp_controlmeasure`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_measure_hazard_code_ci_uniq
- **Relationships:** FK:hazard->haccp.Hazard
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_controlpoint`

- **Django model:** `haccp.ControlPoint`
- **Existing PostgreSQL table:** `haccp_controlpoint`
- **Proposed Mongo collection:** `fg_haccp_controlpoint`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_cp_version_code_ci_uniq
- **Relationships:** FK:plan_version->haccp.HaccpPlanVersion; FK:process_step->haccp.ProcessStep; FK:hazard->haccp.Hazard
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_correctiveactionreference`

- **Django model:** `haccp.CorrectiveActionReference`
- **Existing PostgreSQL table:** `haccp_correctiveactionreference`
- **Proposed Mongo collection:** `fg_haccp_correctiveactionreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:control_point
- **Relationships:** O2O:control_point->haccp.ControlPoint
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_criticallimitreference`

- **Django model:** `haccp.CriticalLimitReference`
- **Existing PostgreSQL table:** `haccp_criticallimitreference`
- **Proposed Mongo collection:** `fg_haccp_criticallimitreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:control_point
- **Relationships:** O2O:control_point->haccp.ControlPoint; FK:specification_parameter->master_data.SpecificationParameter
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_haccphistoryentry`

- **Django model:** `haccp.HaccpHistoryEntry`
- **Existing PostgreSQL table:** `haccp_haccphistoryentry`
- **Proposed Mongo collection:** `fg_haccp_haccphistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:plan->haccp.HaccpPlan; FK:plan_version->haccp.HaccpPlanVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_haccpplan`

- **Django model:** `haccp.HaccpPlan`
- **Existing PostgreSQL table:** `haccp_haccpplan`
- **Proposed Mongo collection:** `fg_haccp_haccpplan`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_plan_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_haccpplanversion`

- **Django model:** `haccp.HaccpPlanVersion`
- **Existing PostgreSQL table:** `haccp_haccpplanversion`
- **Proposed Mongo collection:** `fg_haccp_haccpplanversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_plan_version_uniq
- **Relationships:** FK:plan->haccp.HaccpPlan; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_hazard`

- **Django model:** `haccp.Hazard`
- **Existing PostgreSQL table:** `haccp_hazard`
- **Proposed Mongo collection:** `fg_haccp_hazard`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_hazard_step_code_ci_uniq
- **Relationships:** FK:process_step->haccp.ProcessStep
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_monitoringrule`

- **Django model:** `haccp.MonitoringRule`
- **Existing PostgreSQL table:** `haccp_monitoringrule`
- **Proposed Mongo collection:** `fg_haccp_monitoringrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:control_point
- **Relationships:** O2O:control_point->haccp.ControlPoint
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_haccp_processstep`

- **Django model:** `haccp.ProcessStep`
- **Existing PostgreSQL table:** `haccp_processstep`
- **Proposed Mongo collection:** `fg_haccp_processstep`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:haccp_step_version_code_ci_uniq
- **Relationships:** FK:plan_version->haccp.HaccpPlanVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_instruments_calibrationrecord`

- **Django model:** `instruments.CalibrationRecord`
- **Existing PostgreSQL table:** `instruments_calibrationrecord`
- **Proposed Mongo collection:** `fg_instruments_calibrationrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; equipment,calibrated_on; next_due_on; constraint:CheckConstraint:inst_calib_next_due_gte_calibrated
- **Relationships:** FK:equipment->instruments.Equipment; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_instruments_equipment`

- **Django model:** `instruments.Equipment`
- **Existing PostgreSQL table:** `instruments_equipment`
- **Proposed Mongo collection:** `fg_instruments_equipment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; organization,equipment_type; Index; constraint:UniqueConstraint:inst_equipment_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_integrations_integrationattempt`

- **Django model:** `integrations.IntegrationAttempt`
- **Existing PostgreSQL table:** `integrations_integrationattempt`
- **Proposed Mongo collection:** `fg_integrations_integrationattempt`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; status,created_at; organization,status; constraint:UniqueConstraint:integ_src_idem_channel_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:requested_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_ipqc_ipqchistoryentry`

- **Django model:** `ipqc.IpqcHistoryEntry`
- **Existing PostgreSQL table:** `ipqc_ipqchistoryentry`
- **Proposed Mongo collection:** `fg_ipqc_ipqchistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:inspection_case->ipqc.IpqcInspectionCase; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_ipqc_ipqcinspectioncase`

- **Django model:** `ipqc.IpqcInspectionCase`
- **Existing PostgreSQL table:** `ipqc_ipqcinspectioncase`
- **Proposed Mongo collection:** `fg_ipqc_ipqcinspectioncase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,workflow_status; organization,due_at; organization,failure_detected; organization,production_line_code; organization,batch_reference; constraint:UniqueConstraint:ipqc_case_org_occurrence_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:definition->ipqc.IpqcProcessCheckDefinition; FK:product->master_data.FGProduct; FK:process_step->haccp.ProcessStep; FK:shift->organizations.Shift; FK:checklist_task->scheduling.ChecklistTask; FK:checklist_submission->recording.ChecklistSubmission; FK:equipment->instruments.Equipment; FK:sampling_plan_version->sampling.SamplingPlanVersion; FK:nonconformance->nonconformance.NonConformanceRecord; FK:hold_case->nonconformance.HoldCase; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_ipqc_ipqcprocesscheckdefinition`

- **Django model:** `ipqc.IpqcProcessCheckDefinition`
- **Existing PostgreSQL table:** `ipqc_ipqcprocesscheckdefinition`
- **Proposed Mongo collection:** `fg_ipqc_ipqcprocesscheckdefinition`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,trigger_kind,is_active; constraint:UniqueConstraint:ipqc_definition_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:product->master_data.FGProduct; FK:process_step->haccp.ProcessStep; FK:shift->organizations.Shift; FK:checklist_schedule->scheduling.ChecklistSchedule; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_ipqc_ipqcworkflowpolicy`

- **Django model:** `ipqc.IpqcWorkflowPolicy`
- **Existing PostgreSQL table:** `ipqc_ipqcworkflowpolicy`
- **Proposed Mongo collection:** `fg_ipqc_ipqcworkflowpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_iqc_incomingreceiptevent`

- **Django model:** `iqc.IncomingReceiptEvent`
- **Existing PostgreSQL table:** `iqc_incomingreceiptevent`
- **Proposed Mongo collection:** `fg_iqc_incomingreceiptevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,erp_receipt_reference; constraint:UniqueConstraint:iqc_incoming_event_source_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:receipt->receiving.ReceiptQualityRecord; FK:inspection_case->iqc.IqcInspectionCase; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_iqc_iqchistoryentry`

- **Django model:** `iqc.IqcHistoryEntry`
- **Existing PostgreSQL table:** `iqc_iqchistoryentry`
- **Proposed Mongo collection:** `fg_iqc_iqchistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:inspection_case->iqc.IqcInspectionCase; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_iqc_iqcinspectioncase`

- **Django model:** `iqc.IqcInspectionCase`
- **Existing PostgreSQL table:** `iqc_iqcinspectioncase`
- **Proposed Mongo collection:** `fg_iqc_iqcinspectioncase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,workflow_status; unique:receipt
- **Relationships:** FK:organization->organizations.Organization; O2O:receipt->receiving.ReceiptQualityRecord; FK:checklist_task->scheduling.ChecklistTask; FK:checklist_submission->recording.ChecklistSubmission; FK:supervisor_review->reviews.SupervisorReview; FK:sampling_plan_version->sampling.SamplingPlanVersion; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_iqc_iqcworkflowpolicy`

- **Django model:** `iqc.IqcWorkflowPolicy`
- **Existing PostgreSQL table:** `iqc_iqcworkflowpolicy`
- **Proposed Mongo collection:** `fg_iqc_iqcworkflowpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labexternalcertificate`

- **Django model:** `laboratory.LabExternalCertificate`
- **Existing PostgreSQL table:** `laboratory_labexternalcertificate`
- **Proposed Mongo collection:** `fg_laboratory_labexternalcertificate`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:sample->laboratory.LabSample; FK:lab_test->laboratory.LabTest; FK:verified_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labhistoryentry`

- **Django model:** `laboratory.LabHistoryEntry`
- **Existing PostgreSQL table:** `laboratory_labhistoryentry`
- **Proposed Mongo collection:** `fg_laboratory_labhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:sample->laboratory.LabSample; FK:lab_result->laboratory.LabResult; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labpositivereleasepolicy`

- **Django model:** `laboratory.LabPositiveReleasePolicy`
- **Existing PostgreSQL table:** `laboratory_labpositivereleasepolicy`
- **Proposed Mongo collection:** `fg_laboratory_labpositivereleasepolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labresult`

- **Django model:** `laboratory.LabResult`
- **Existing PostgreSQL table:** `laboratory_labresult`
- **Proposed Mongo collection:** `fg_laboratory_labresult`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; constraint:UniqueConstraint:lab_result_test_param_rev_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:lab_test->laboratory.LabTest; FK:parameter->laboratory.LabTestParameter; FK:previous_result->laboratory.LabResult; FK:specification_parameter->master_data.SpecificationParameter; FK:entered_by->accounts.User; FK:verified_by->accounts.User; FK:finalized_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labsample`

- **Django model:** `laboratory.LabSample`
- **Existing PostgreSQL table:** `laboratory_labsample`
- **Proposed Mongo collection:** `fg_laboratory_labsample`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,batch_reference; constraint:UniqueConstraint:lab_sample_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site; FK:product->master_data.FGProduct; FK:checklist_submission->recording.ChecklistSubmission; FK:nonconformance->nonconformance.NonConformanceRecord; FK:hold_case->nonconformance.HoldCase; FK:registered_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labtest`

- **Django model:** `laboratory.LabTest`
- **Existing PostgreSQL table:** `laboratory_labtest`
- **Proposed Mongo collection:** `fg_laboratory_labtest`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:lab_test_sample_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:sample->laboratory.LabSample; FK:method_reference->laboratory.TestMethodReference
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_labtestparameter`

- **Django model:** `laboratory.LabTestParameter`
- **Existing PostgreSQL table:** `laboratory_labtestparameter`
- **Proposed Mongo collection:** `fg_laboratory_labtestparameter`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:lab_param_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:specification_parameter->master_data.SpecificationParameter; FK:method_reference->laboratory.TestMethodReference
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_laboratory_testmethodreference`

- **Django model:** `laboratory.TestMethodReference`
- **Existing PostgreSQL table:** `laboratory_testmethodreference`
- **Proposed Mongo collection:** `fg_laboratory_testmethodreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:lab_method_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_master_data_fgproduct`

- **Django model:** `master_data.FGProduct`
- **Existing PostgreSQL table:** `master_data_fgproduct`
- **Proposed Mongo collection:** `fg_master_data_fgproduct`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; Index; Index; organization,category; constraint:UniqueConstraint:md_fgproduct_org_code_ci_uniq; constraint:UniqueConstraint:md_fgproduct_org_erp_ci_uniq; constraint:CheckConstraint:md_fgproduct_effective_window_valid
- **Relationships:** FK:organization->organizations.Organization
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_master_data_productspecification`

- **Django model:** `master_data.ProductSpecification`
- **Existing PostgreSQL table:** `master_data_productspecification`
- **Proposed Mongo collection:** `fg_master_data_productspecification`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; Index; constraint:UniqueConstraint:md_productspec_product_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_master_data_specificationparameter`

- **Django model:** `master_data.SpecificationParameter`
- **Existing PostgreSQL table:** `master_data_specificationparameter`
- **Proposed Mongo collection:** `fg_master_data_specificationparameter`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; Index; constraint:UniqueConstraint:md_specparam_version_code_ci_uniq
- **Relationships:** FK:version->master_data.SpecificationVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_master_data_specificationversion`

- **Django model:** `master_data.SpecificationVersion`
- **Existing PostgreSQL table:** `master_data_specificationversion`
- **Proposed Mongo collection:** `fg_master_data_specificationversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; specification,status; constraint:UniqueConstraint:md_specversion_spec_number_uniq; constraint:CheckConstraint:md_specversion_effective_window_valid
- **Relationships:** FK:specification->master_data.ProductSpecification; FK:approved_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_nonconformance_holdcase`

- **Django model:** `nonconformance.HoldCase`
- **Existing PostgreSQL table:** `nonconformance_holdcase`
- **Proposed Mongo collection:** `fg_nonconformance_holdcase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; constraint:UniqueConstraint:hold_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:owner->accounts.User; FK:nonconformance->nonconformance.NonConformanceRecord; FK:opened_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_nonconformance_nonconformancerecord`

- **Django model:** `nonconformance.NonConformanceRecord`
- **Existing PostgreSQL table:** `nonconformance_nonconformancerecord`
- **Proposed Mongo collection:** `fg_nonconformance_nonconformancerecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,batch_reference; constraint:UniqueConstraint:ncr_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_task->scheduling.ChecklistTask; FK:checklist_submission->recording.ChecklistSubmission; FK:owner->accounts.User; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_nonconformance_qualitycasehistoryentry`

- **Django model:** `nonconformance.QualityCaseHistoryEntry`
- **Existing PostgreSQL table:** `nonconformance_qualitycasehistoryentry`
- **Proposed Mongo collection:** `fg_nonconformance_qualitycasehistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,case_kind,case_id,created_at
- **Relationships:** FK:organization->organizations.Organization; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_notifications_notification`

- **Django model:** `notifications.Notification`
- **Existing PostgreSQL table:** `notifications_notification`
- **Proposed Mongo collection:** `fg_notifications_notification`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; recipient,read_at,created_at; organization,event_type,created_at; constraint:UniqueConstraint:notif_recipient_dedupe_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:recipient->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_notifications_notificationdeliveryattempt`

- **Django model:** `notifications.NotificationDeliveryAttempt`
- **Existing PostgreSQL table:** `notifications_notificationdeliveryattempt`
- **Proposed Mongo collection:** `fg_notifications_notificationdeliveryattempt`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; status,channel,last_attempted_at; unique:idempotency_key
- **Relationships:** FK:notification->notifications.Notification
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_notifications_organizationnotificationpolicy`

- **Django model:** `notifications.OrganizationNotificationPolicy`
- **Existing PostgreSQL table:** `notifications_organizationnotificationpolicy`
- **Proposed Mongo collection:** `fg_notifications_organizationnotificationpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_organizations_department`

- **Django model:** `organizations.Department`
- **Existing PostgreSQL table:** `organizations_department`
- **Proposed Mongo collection:** `fg_organizations_department`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; site,is_active; Index; constraint:UniqueConstraint:org_dept_org_code_ci_uniq; constraint:UniqueConstraint:org_dept_site_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_organizations_organization`

- **Django model:** `organizations.Organization`
- **Existing PostgreSQL table:** `organizations_organization`
- **Proposed Mongo collection:** `fg_organizations_organization`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; is_active; Index; constraint:UniqueConstraint:org_organization_code_ci_uniq
- **Relationships:** (none)
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_organizations_shift`

- **Django model:** `organizations.Shift`
- **Existing PostgreSQL table:** `organizations_shift`
- **Proposed Mongo collection:** `fg_organizations_shift`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; site,is_active; department,is_active; Index; constraint:UniqueConstraint:org_shift_scope_code_ci_uniq; constraint:CheckConstraint:org_shift_department_requires_site; constraint:CheckConstraint:org_shift_effective_window_valid
- **Relationships:** FK:organization->organizations.Organization; FK:site->organizations.Site; FK:department->organizations.Department
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_organizations_site`

- **Django model:** `organizations.Site`
- **Existing PostgreSQL table:** `organizations_site`
- **Proposed Mongo collection:** `fg_organizations_site`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; Index; constraint:UniqueConstraint:org_site_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_artworkverificationrecord`

- **Django model:** `packaging.ArtworkVerificationRecord`
- **Existing PostgreSQL table:** `packaging_artworkverificationrecord`
- **Proposed Mongo collection:** `fg_packaging_artworkverificationrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:artwork_version->packaging.ArtworkVersion; FK:checklist_submission->recording.ChecklistSubmission; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_artworkversion`

- **Django model:** `packaging.ArtworkVersion`
- **Existing PostgreSQL table:** `packaging_artworkversion`
- **Proposed Mongo collection:** `fg_packaging_artworkversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:packaging_artwork_version_uniq
- **Relationships:** FK:artwork->packaging.PackagingArtwork; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_checklistitemartworkbinding`

- **Django model:** `packaging.ChecklistItemArtworkBinding`
- **Existing PostgreSQL table:** `packaging_checklistitemartworkbinding`
- **Proposed Mongo collection:** `fg_packaging_checklistitemartworkbinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:checklist_item
- **Relationships:** O2O:checklist_item->checklists.ChecklistItem; FK:artwork_version->packaging.ArtworkVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_lineclearanceartworkhook`

- **Django model:** `packaging.LineClearanceArtworkHook`
- **Existing PostgreSQL table:** `packaging_lineclearanceartworkhook`
- **Proposed Mongo collection:** `fg_packaging_lineclearanceartworkhook`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:packaging_line_clearance_hook_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:artwork_version->packaging.ArtworkVersion; FK:checklist_template->checklists.ChecklistTemplate; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_packagingartwork`

- **Django model:** `packaging.PackagingArtwork`
- **Existing PostgreSQL table:** `packaging_packagingartwork`
- **Proposed Mongo collection:** `fg_packaging_packagingartwork`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:packaging_artwork_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_packaging_packaginghistoryentry`

- **Django model:** `packaging.PackagingHistoryEntry`
- **Existing PostgreSQL table:** `packaging_packaginghistoryentry`
- **Proposed Mongo collection:** `fg_packaging_packaginghistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:artwork->packaging.PackagingArtwork; FK:artwork_version->packaging.ArtworkVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_currentcontrol`

- **Django model:** `process_fmea.CurrentControl`
- **Existing PostgreSQL table:** `process_fmea_currentcontrol`
- **Proposed Mongo collection:** `fg_process_fmea_currentcontrol`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:failure_mode->process_fmea.FailureMode; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_failureeffect`

- **Django model:** `process_fmea.FailureEffect`
- **Existing PostgreSQL table:** `process_fmea_failureeffect`
- **Proposed Mongo collection:** `fg_process_fmea_failureeffect`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:failure_mode->process_fmea.FailureMode; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_failuremode`

- **Django model:** `process_fmea.FailureMode`
- **Existing PostgreSQL table:** `process_fmea_failuremode`
- **Proposed Mongo collection:** `fg_process_fmea_failuremode`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:process_fmea_mode_code_ci_uniq
- **Relationships:** FK:process_step->process_fmea.ProcessStep; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_failuremodeassessment`

- **Django model:** `process_fmea.FailureModeAssessment`
- **Existing PostgreSQL table:** `process_fmea_failuremodeassessment`
- **Proposed Mongo collection:** `fg_process_fmea_failuremodeassessment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:process_fmea_assessment_snapshot_uniq
- **Relationships:** FK:failure_mode->process_fmea.FailureMode; FK:assessed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_potentialcause`

- **Django model:** `process_fmea.PotentialCause`
- **Existing PostgreSQL table:** `process_fmea_potentialcause`
- **Proposed Mongo collection:** `fg_process_fmea_potentialcause`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:failure_mode->process_fmea.FailureMode; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processfmea`

- **Django model:** `process_fmea.ProcessFmea`
- **Existing PostgreSQL table:** `process_fmea_processfmea`
- **Proposed Mongo collection:** `fg_process_fmea_processfmea`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,fmea_code; constraint:UniqueConstraint:process_fmea_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processfmeaevent`

- **Django model:** `process_fmea.ProcessFmeaEvent`
- **Existing PostgreSQL table:** `process_fmea_processfmeaevent`
- **Proposed Mongo collection:** `fg_process_fmea_processfmeaevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; fmea,created_at
- **Relationships:** FK:fmea->process_fmea.ProcessFmea; FK:version->process_fmea.ProcessFmeaVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processfmealink`

- **Django model:** `process_fmea.ProcessFmeaLink`
- **Existing PostgreSQL table:** `process_fmea_processfmealink`
- **Proposed Mongo collection:** `fg_process_fmea_processfmealink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; version,link_kind
- **Relationships:** FK:version->process_fmea.ProcessFmeaVersion; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processfmeascoringpolicy`

- **Django model:** `process_fmea.ProcessFmeaScoringPolicy`
- **Existing PostgreSQL table:** `process_fmea_processfmeascoringpolicy`
- **Proposed Mongo collection:** `fg_process_fmea_processfmeascoringpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:process_fmea_scoring_policy_org_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processfmeaversion`

- **Django model:** `process_fmea.ProcessFmeaVersion`
- **Existing PostgreSQL table:** `process_fmea_processfmeaversion`
- **Proposed Mongo collection:** `fg_process_fmea_processfmeaversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; fmea,status; constraint:UniqueConstraint:process_fmea_version_uniq
- **Relationships:** FK:fmea->process_fmea.ProcessFmea; FK:created_by->accounts.User; FK:approved_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_processstep`

- **Django model:** `process_fmea.ProcessStep`
- **Existing PostgreSQL table:** `process_fmea_processstep`
- **Proposed Mongo collection:** `fg_process_fmea_processstep`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:process_fmea_step_code_ci_uniq
- **Relationships:** FK:version->process_fmea.ProcessFmeaVersion; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_process_fmea_recommendedaction`

- **Django model:** `process_fmea.RecommendedAction`
- **Existing PostgreSQL table:** `process_fmea_recommendedaction`
- **Proposed Mongo collection:** `fg_process_fmea_recommendedaction`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:failure_mode->process_fmea.FailureMode; FK:corrective_action->capa.CorrectiveAction; FK:change_request->change_control.QualityChangeRequest; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_product_returns_returnqualitypolicy`

- **Django model:** `product_returns.ReturnQualityPolicy`
- **Existing PostgreSQL table:** `product_returns_returnqualitypolicy`
- **Proposed Mongo collection:** `fg_product_returns_returnqualitypolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_product_returns_returnqualityrecord`

- **Django model:** `product_returns.ReturnQualityRecord`
- **Existing PostgreSQL table:** `product_returns_returnqualityrecord`
- **Proposed Mongo collection:** `fg_product_returns_returnqualityrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,original_batch_reference; constraint:UniqueConstraint:return_quality_erp_line_ci_uniq; constraint:CheckConstraint:return_quality_never_saleable
- **Relationships:** FK:organization->organizations.Organization; FK:hold_case->nonconformance.HoldCase; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:checklist_task->scheduling.ChecklistTask; FK:dispositioned_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_product_returns_returnqualitytimelineentry`

- **Django model:** `product_returns.ReturnQualityTimelineEntry`
- **Existing PostgreSQL table:** `product_returns_returnqualitytimelineentry`
- **Proposed Mongo collection:** `fg_product_returns_returnqualitytimelineentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:return_quality_record->product_returns.ReturnQualityRecord; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityaudit`

- **Django model:** `quality_audits.QualityAudit`
- **Existing PostgreSQL table:** `quality_audits_qualityaudit`
- **Proposed Mongo collection:** `fg_quality_audits_qualityaudit`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,site_reference; organization,process_reference; constraint:UniqueConstraint:quality_audit_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:lead_auditor->accounts.User; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:checklist_task->scheduling.ChecklistTask; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityauditchecklistbinding`

- **Django model:** `quality_audits.QualityAuditChecklistBinding`
- **Existing PostgreSQL table:** `quality_audits_qualityauditchecklistbinding`
- **Proposed Mongo collection:** `fg_quality_audits_qualityauditchecklistbinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_audit_checklist_bind_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityauditevent`

- **Django model:** `quality_audits.QualityAuditEvent`
- **Existing PostgreSQL table:** `quality_audits_qualityauditevent`
- **Proposed Mongo collection:** `fg_quality_audits_qualityauditevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; audit,created_at
- **Relationships:** FK:audit->quality_audits.QualityAudit; FK:finding->quality_audits.QualityAuditFinding; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityauditfinding`

- **Django model:** `quality_audits.QualityAuditFinding`
- **Existing PostgreSQL table:** `quality_audits_qualityauditfinding`
- **Proposed Mongo collection:** `fg_quality_audits_qualityauditfinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; status,due_date; audit,status
- **Relationships:** FK:audit->quality_audits.QualityAudit; FK:owner->accounts.User; FK:nonconformance->nonconformance.NonConformanceRecord; FK:corrective_action->capa.CorrectiveAction; FK:action_completed_by->accounts.User; FK:verified_by->accounts.User; FK:closed_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityauditfindingcodeconfig`

- **Django model:** `quality_audits.QualityAuditFindingCodeConfig`
- **Existing PostgreSQL table:** `quality_audits_qualityauditfindingcodeconfig`
- **Proposed Mongo collection:** `fg_quality_audits_qualityauditfindingcodeconfig`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_audit_finding_code_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_audits_qualityauditparticipant`

- **Django model:** `quality_audits.QualityAuditParticipant`
- **Existing PostgreSQL table:** `quality_audits_qualityauditparticipant`
- **Proposed Mongo collection:** `fg_quality_audits_qualityauditparticipant`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_audit_participant_uniq
- **Relationships:** FK:audit->quality_audits.QualityAudit; FK:user->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_qareview`

- **Django model:** `quality.QAReview`
- **Existing PostgreSQL table:** `quality_qareview`
- **Proposed Mongo collection:** `fg_quality_qareview`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,reviewed_at; organization,decision; unique:checklist_submission; unique:supervisor_review
- **Relationships:** FK:organization->organizations.Organization; O2O:checklist_submission->recording.ChecklistSubmission; O2O:supervisor_review->reviews.SupervisorReview; FK:reviewed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_quarantine_qualityquarantineevent`

- **Django model:** `quality_quarantine.QualityQuarantineEvent`
- **Existing PostgreSQL table:** `quality_quarantine_qualityquarantineevent`
- **Proposed Mongo collection:** `fg_quality_quarantine_qualityquarantineevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; quarantine,created_at
- **Relationships:** FK:quarantine->quality_quarantine.QualityQuarantineRecord; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_quarantine_qualityquarantinepolicy`

- **Django model:** `quality_quarantine.QualityQuarantinePolicy`
- **Existing PostgreSQL table:** `quality_quarantine_qualityquarantinepolicy`
- **Proposed Mongo collection:** `fg_quality_quarantine_qualityquarantinepolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_quarantine_qualityquarantinerecord`

- **Django model:** `quality_quarantine.QualityQuarantineRecord`
- **Existing PostgreSQL table:** `quality_quarantine_qualityquarantinerecord`
- **Proposed Mongo collection:** `fg_quality_quarantine_qualityquarantinerecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,batch_reference; organization,source,source_reference; constraint:UniqueConstraint:quality_quarantine_code_org_ci_uniq; constraint:CheckConstraint:quality_quarantine_not_ledger
- **Relationships:** FK:organization->organizations.Organization; FK:opened_by->accounts.User; FK:owner->accounts.User; FK:resolved_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityrisk`

- **Django model:** `quality_risks.QualityRisk`
- **Existing PostgreSQL table:** `quality_risks_qualityrisk`
- **Proposed Mongo collection:** `fg_quality_risks_qualityrisk`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,next_review_date; constraint:UniqueConstraint:quality_risk_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:owner->accounts.User; FK:accepted_by->accounts.User; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskassessment`

- **Django model:** `quality_risks.QualityRiskAssessment`
- **Existing PostgreSQL table:** `quality_risks_qualityriskassessment`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskassessment`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; risk,assessed_at; constraint:UniqueConstraint:quality_risk_assessment_version_uniq
- **Relationships:** FK:risk->quality_risks.QualityRisk; FK:assessed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskcategoryconfig`

- **Django model:** `quality_risks.QualityRiskCategoryConfig`
- **Existing PostgreSQL table:** `quality_risks_qualityriskcategoryconfig`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskcategoryconfig`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_risk_category_org_code_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskevent`

- **Django model:** `quality_risks.QualityRiskEvent`
- **Existing PostgreSQL table:** `quality_risks_qualityriskevent`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; risk,created_at
- **Relationships:** FK:risk->quality_risks.QualityRisk; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityrisklink`

- **Django model:** `quality_risks.QualityRiskLink`
- **Existing PostgreSQL table:** `quality_risks_qualityrisklink`
- **Proposed Mongo collection:** `fg_quality_risks_qualityrisklink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; risk,link_kind
- **Relationships:** FK:risk->quality_risks.QualityRisk; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskmitigation`

- **Django model:** `quality_risks.QualityRiskMitigation`
- **Existing PostgreSQL table:** `quality_risks_qualityriskmitigation`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskmitigation`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:risk->quality_risks.QualityRisk; FK:owner->accounts.User; FK:corrective_action->capa.CorrectiveAction; FK:change_request->change_control.QualityChangeRequest; FK:training_record->training.TrainingRecord; FK:document_version->document_control.QualityDocumentVersion; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskreview`

- **Django model:** `quality_risks.QualityRiskReview`
- **Existing PostgreSQL table:** `quality_risks_qualityriskreview`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskreview`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:risk->quality_risks.QualityRisk; FK:reviewed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_quality_risks_qualityriskscoringpolicy`

- **Django model:** `quality_risks.QualityRiskScoringPolicy`
- **Existing PostgreSQL table:** `quality_risks_qualityriskscoringpolicy`
- **Proposed Mongo collection:** `fg_quality_risks_qualityriskscoringpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:quality_risk_scoring_policy_org_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcacapalink`

- **Django model:** `rca.RcaCapaLink`
- **Existing PostgreSQL table:** `rca_rcacapalink`
- **Proposed Mongo collection:** `fg_rca_rcacapalink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:cause->rca.RcaCause; FK:corrective_action->capa.CorrectiveAction; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcacause`

- **Django model:** `rca.RcaCause`
- **Existing PostgreSQL table:** `rca_rcacause`
- **Proposed Mongo collection:** `fg_rca_rcacause`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:confirmed_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcaevent`

- **Django model:** `rca.RcaEvent`
- **Existing PostgreSQL table:** `rca_rcaevent`
- **Proposed Mongo collection:** `fg_rca_rcaevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; rca,created_at
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcaevidencelink`

- **Django model:** `rca.RcaEvidenceLink`
- **Existing PostgreSQL table:** `rca_rcaevidencelink`
- **Proposed Mongo collection:** `fg_rca_rcaevidencelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:cause->rca.RcaCause; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcafishboneentry`

- **Django model:** `rca.RcaFishboneEntry`
- **Existing PostgreSQL table:** `rca_rcafishboneentry`
- **Proposed Mongo collection:** `fg_rca_rcafishboneentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcafivewhystep`

- **Django model:** `rca.RcaFiveWhyStep`
- **Existing PostgreSQL table:** `rca_rcafivewhystep`
- **Proposed Mongo collection:** `fg_rca_rcafivewhystep`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:rca_five_why_sequence_uniq
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rcaparticipant`

- **Django model:** `rca.RcaParticipant`
- **Existing PostgreSQL table:** `rca_rcaparticipant`
- **Proposed Mongo collection:** `fg_rca_rcaparticipant`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:rca->rca.RootCauseAnalysis; FK:participant->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rca_rootcauseanalysis`

- **Django model:** `rca.RootCauseAnalysis`
- **Existing PostgreSQL table:** `rca_rootcauseanalysis`
- **Proposed Mongo collection:** `fg_rca_rootcauseanalysis`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; constraint:UniqueConstraint:rca_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:facilitator->accounts.User; FK:verified_by->accounts.User; FK:created_by->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_mockexercisemetrics`

- **Django model:** `recall.MockExerciseMetrics`
- **Existing PostgreSQL table:** `recall_mockexercisemetrics`
- **Proposed Mongo collection:** `fg_recall_mockexercisemetrics`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:recall_case
- **Relationships:** O2O:recall_case->recall.RecallCase; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_mockimprovementaction`

- **Django model:** `recall.MockImprovementAction`
- **Existing PostgreSQL table:** `recall_mockimprovementaction`
- **Proposed Mongo collection:** `fg_recall_mockimprovementaction`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:mock_improvement_case_code_ci_uniq
- **Relationships:** FK:recall_case->recall.RecallCase; FK:finding->recall.MockRecallFinding; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_mockrecallfinding`

- **Django model:** `recall.MockRecallFinding`
- **Existing PostgreSQL table:** `recall_mockrecallfinding`
- **Proposed Mongo collection:** `fg_recall_mockrecallfinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; recall_case,link_kind
- **Relationships:** FK:recall_case->recall.RecallCase; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallaffectedbatch`

- **Django model:** `recall.RecallAffectedBatch`
- **Existing PostgreSQL table:** `recall_recallaffectedbatch`
- **Proposed Mongo collection:** `fg_recall_recallaffectedbatch`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; recall_case,batch_reference; constraint:UniqueConstraint:recall_batch_case_ref_ci_uniq
- **Relationships:** FK:recall_case->recall.RecallCase
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallaffectedproduct`

- **Django model:** `recall.RecallAffectedProduct`
- **Existing PostgreSQL table:** `recall_recallaffectedproduct`
- **Proposed Mongo collection:** `fg_recall_recallaffectedproduct`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:recall_product_case_ref_ci_uniq
- **Relationships:** FK:recall_case->recall.RecallCase
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallcase`

- **Django model:** `recall.RecallCase`
- **Existing PostgreSQL table:** `recall_recallcase`
- **Proposed Mongo collection:** `fg_recall_recallcase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,code; organization,is_mock; organization,mode; constraint:UniqueConstraint:recall_case_org_code_ci_uniq; constraint:CheckConstraint:recall_case_mock_mode_consistent
- **Relationships:** FK:organization->organizations.Organization; FK:initiated_by->accounts.User; FK:owner->accounts.User; FK:closed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallcommunicationrecord`

- **Django model:** `recall.RecallCommunicationRecord`
- **Existing PostgreSQL table:** `recall_recallcommunicationrecord`
- **Proposed Mongo collection:** `fg_recall_recallcommunicationrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:recall_case->recall.RecallCase; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallpolicy`

- **Django model:** `recall.RecallPolicy`
- **Existing PostgreSQL table:** `recall_recallpolicy`
- **Proposed Mongo collection:** `fg_recall_recallpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recallquantityline`

- **Django model:** `recall.RecallQuantityLine`
- **Existing PostgreSQL table:** `recall_recallquantityline`
- **Proposed Mongo collection:** `fg_recall_recallquantityline`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:recall_qty_case_batch_uniq
- **Relationships:** FK:recall_case->recall.RecallCase; FK:affected_batch->recall.RecallAffectedBatch; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recall_recalltimelineentry`

- **Django model:** `recall.RecallTimelineEntry`
- **Existing PostgreSQL table:** `recall_recalltimelineentry`
- **Proposed Mongo collection:** `fg_recall_recalltimelineentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; recall_case,created_at
- **Relationships:** FK:recall_case->recall.RecallCase; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_materialreference`

- **Django model:** `receiving.MaterialReference`
- **Existing PostgreSQL table:** `receiving_materialreference`
- **Proposed Mongo collection:** `fg_receiving_materialreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:receiving_material_erp_ref_org_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_materialspecification`

- **Django model:** `receiving.MaterialSpecification`
- **Existing PostgreSQL table:** `receiving_materialspecification`
- **Proposed Mongo collection:** `fg_receiving_materialspecification`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:receiving_material_spec_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:material->receiving.MaterialReference; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_materialspecificationparameter`

- **Django model:** `receiving.MaterialSpecificationParameter`
- **Existing PostgreSQL table:** `receiving_materialspecificationparameter`
- **Proposed Mongo collection:** `fg_receiving_materialspecificationparameter`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:receiving_material_spec_param_uniq
- **Relationships:** FK:version->receiving.MaterialSpecificationVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_materialspecificationversion`

- **Django model:** `receiving.MaterialSpecificationVersion`
- **Existing PostgreSQL table:** `receiving_materialspecificationversion`
- **Proposed Mongo collection:** `fg_receiving_materialspecificationversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:receiving_material_spec_version_uniq
- **Relationships:** FK:specification->receiving.MaterialSpecification; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_receiptlabsamplelink`

- **Django model:** `receiving.ReceiptLabSampleLink`
- **Existing PostgreSQL table:** `receiving_receiptlabsamplelink`
- **Proposed Mongo collection:** `fg_receiving_receiptlabsamplelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:receiving_receipt_lab_sample_uniq
- **Relationships:** FK:receipt->receiving.ReceiptQualityRecord; FK:lab_sample->laboratory.LabSample; FK:linked_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_receiptqualityrecord`

- **Django model:** `receiving.ReceiptQualityRecord`
- **Existing PostgreSQL table:** `receiving_receiptqualityrecord`
- **Proposed Mongo collection:** `fg_receiving_receiptqualityrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,erp_receipt_reference; organization,supplier_lot; organization,quality_state; constraint:UniqueConstraint:receiving_receipt_org_grn_lot_material_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:supplier_profile->supplier_quality.SupplierQualityProfile; FK:material->receiving.MaterialReference; FK:inspection_checklist_template->checklists.ChecklistTemplate; FK:inspection_checklist_version->checklists.ChecklistVersion; FK:material_specification_version->receiving.MaterialSpecificationVersion; FK:dispositioned_by->accounts.User; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_receiving_receivinghistoryentry`

- **Django model:** `receiving.ReceivingHistoryEntry`
- **Existing PostgreSQL table:** `receiving_receivinghistoryentry`
- **Proposed Mongo collection:** `fg_receiving_receivinghistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:receipt->receiving.ReceiptQualityRecord; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recording_checklistcorrection`

- **Django model:** `recording.ChecklistCorrection`
- **Existing PostgreSQL table:** `recording_checklistcorrection`
- **Proposed Mongo collection:** `fg_recording_checklistcorrection`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; checklist_record,status; unique:source_submission; unique:resulting_submission
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_record->recording.ChecklistRecord; O2O:source_submission->recording.ChecklistSubmission; FK:started_by->accounts.User; O2O:resulting_submission->recording.ChecklistSubmission
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recording_checklistrecord`

- **Django model:** `recording.ChecklistRecord`
- **Existing PostgreSQL table:** `recording_checklistrecord`
- **Proposed Mongo collection:** `fg_recording_checklistrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,updated_at; organization,status; unique:checklist_task
- **Relationships:** FK:organization->organizations.Organization; O2O:checklist_task->scheduling.ChecklistTask; FK:started_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recording_checklistresponse`

- **Django model:** `recording.ChecklistResponse`
- **Existing PostgreSQL table:** `recording_checklistresponse`
- **Proposed Mongo collection:** `fg_recording_checklistresponse`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; checklist_record,updated_at; checklist_record,checklist_item,sample_index; constraint:UniqueConstraint:rec_response_record_item_sample_uniq; constraint:CheckConstraint:rec_response_exactly_one_value
- **Relationships:** FK:checklist_record->recording.ChecklistRecord; FK:checklist_item->checklists.ChecklistItem; FK:selected_option->checklists.ChecklistItemOption; FK:equipment->instruments.Equipment; FK:calibration_record->instruments.CalibrationRecord
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recording_checklistsubmission`

- **Django model:** `recording.ChecklistSubmission`
- **Existing PostgreSQL table:** `recording_checklistsubmission`
- **Proposed Mongo collection:** `fg_recording_checklistsubmission`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; checklist_record,submitted_at; constraint:UniqueConstraint:rec_submission_record_number_uniq
- **Relationships:** FK:checklist_record->recording.ChecklistRecord; FK:submitted_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_recording_checklistsubmissionresponse`

- **Django model:** `recording.ChecklistSubmissionResponse`
- **Existing PostgreSQL table:** `recording_checklistsubmissionresponse`
- **Proposed Mongo collection:** `fg_recording_checklistsubmissionresponse`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; checklist_submission,checklist_item,sample_index; constraint:UniqueConstraint:rec_sub_resp_sub_item_sample_uniq; constraint:CheckConstraint:rec_sub_resp_exactly_one_value
- **Relationships:** FK:checklist_submission->recording.ChecklistSubmission; FK:checklist_item->checklists.ChecklistItem; FK:selected_option->checklists.ChecklistItemOption; FK:equipment->instruments.Equipment; FK:calibration_record->instruments.CalibrationRecord
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_reports_reportrun`

- **Django model:** `reports.ReportRun`
- **Existing PostgreSQL table:** `reports_reportrun`
- **Proposed Mongo collection:** `fg_reports_reportrun`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,report_code,created_at; organization,status
- **Relationships:** FK:organization->organizations.Organization; FK:requested_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_reviews_supervisorreview`

- **Django model:** `reviews.SupervisorReview`
- **Existing PostgreSQL table:** `reviews_supervisorreview`
- **Proposed Mongo collection:** `fg_reviews_supervisorreview`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,reviewed_at; organization,decision; unique:checklist_submission
- **Relationships:** FK:organization->organizations.Organization; O2O:checklist_submission->recording.ChecklistSubmission; FK:reviewed_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_reviews_supervisorreviewgovernancepolicy`

- **Django model:** `reviews.SupervisorReviewGovernancePolicy`
- **Existing PostgreSQL table:** `reviews_supervisorreviewgovernancepolicy`
- **Proposed Mongo collection:** `fg_reviews_supervisorreviewgovernancepolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; self_review_mode; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rework_reworkcase`

- **Django model:** `rework.ReworkCase`
- **Existing PostgreSQL table:** `rework_reworkcase`
- **Proposed Mongo collection:** `fg_rework_reworkcase`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,source_batch_reference; constraint:UniqueConstraint:rework_case_org_execution_key_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:inspection_task->scheduling.ChecklistTask; FK:source_qa_review->quality.QAReview; FK:source_hold_case->nonconformance.HoldCase; FK:source_ncr->nonconformance.NonConformanceRecord; FK:authorized_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rework_reworkcaseevent`

- **Django model:** `rework.ReworkCaseEvent`
- **Existing PostgreSQL table:** `rework_reworkcaseevent`
- **Proposed Mongo collection:** `fg_rework_reworkcaseevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:case->rework.ReworkCase; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_rework_reworkpolicystub`

- **Django model:** `rework.ReworkPolicyStub`
- **Existing PostgreSQL table:** `rework_reworkpolicystub`
- **Proposed Mongo collection:** `fg_rework_reworkpolicystub`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:rework_policy_org_key_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_checklistitemsamplingbinding`

- **Django model:** `sampling.ChecklistItemSamplingBinding`
- **Existing PostgreSQL table:** `sampling_checklistitemsamplingbinding`
- **Proposed Mongo collection:** `fg_sampling_checklistitemsamplingbinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:checklist_item
- **Relationships:** O2O:checklist_item->checklists.ChecklistItem; FK:plan_version->sampling.SamplingPlanVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_samplerequirement`

- **Django model:** `sampling.SampleRequirement`
- **Existing PostgreSQL table:** `sampling_samplerequirement`
- **Proposed Mongo collection:** `fg_sampling_samplerequirement`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:rule
- **Relationships:** O2O:rule->sampling.SamplingRule
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_samplinghistoryentry`

- **Django model:** `sampling.SamplingHistoryEntry`
- **Existing PostgreSQL table:** `sampling_samplinghistoryentry`
- **Proposed Mongo collection:** `fg_sampling_samplinghistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:plan->sampling.SamplingPlan; FK:plan_version->sampling.SamplingPlanVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_samplingplan`

- **Django model:** `sampling.SamplingPlan`
- **Existing PostgreSQL table:** `sampling_samplingplan`
- **Proposed Mongo collection:** `fg_sampling_samplingplan`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sampling_plan_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_samplingplanversion`

- **Django model:** `sampling.SamplingPlanVersion`
- **Existing PostgreSQL table:** `sampling_samplingplanversion`
- **Proposed Mongo collection:** `fg_sampling_samplingplanversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sampling_plan_version_uniq
- **Relationships:** FK:plan->sampling.SamplingPlan; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sampling_samplingrule`

- **Django model:** `sampling.SamplingRule`
- **Existing PostgreSQL table:** `sampling_samplingrule`
- **Proposed Mongo collection:** `fg_sampling_samplingrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sampling_rule_version_code_ci_uniq
- **Relationships:** FK:plan_version->sampling.SamplingPlanVersion; FK:product->master_data.FGProduct; FK:site->organizations.Site
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_checklisttemplatesanitationbinding`

- **Django model:** `sanitation.ChecklistTemplateSanitationBinding`
- **Existing PostgreSQL table:** `sanitation_checklisttemplatesanitationbinding`
- **Proposed Mongo collection:** `fg_sanitation_checklisttemplatesanitationbinding`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:checklist_template
- **Relationships:** O2O:checklist_template->checklists.ChecklistTemplate; FK:program_version->sanitation.SanitationProgramVersion
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_chemicalreference`

- **Django model:** `sanitation.ChemicalReference`
- **Existing PostgreSQL table:** `sanitation_chemicalreference`
- **Proposed Mongo collection:** `fg_sanitation_chemicalreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:chemical_reference_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationchemicalreference`

- **Django model:** `sanitation.SanitationChemicalReference`
- **Existing PostgreSQL table:** `sanitation_sanitationchemicalreference`
- **Proposed Mongo collection:** `fg_sanitation_sanitationchemicalreference`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sanitation_chem_link_uniq
- **Relationships:** FK:program_version->sanitation.SanitationProgramVersion; FK:chemical->sanitation.ChemicalReference
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationfailpolicy`

- **Django model:** `sanitation.SanitationFailPolicy`
- **Existing PostgreSQL table:** `sanitation_sanitationfailpolicy`
- **Proposed Mongo collection:** `fg_sanitation_sanitationfailpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationhistoryentry`

- **Django model:** `sanitation.SanitationHistoryEntry`
- **Existing PostgreSQL table:** `sanitation_sanitationhistoryentry`
- **Proposed Mongo collection:** `fg_sanitation_sanitationhistoryentry`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:organization->organizations.Organization; FK:program->sanitation.SanitationProgram; FK:program_version->sanitation.SanitationProgramVersion; FK:actor->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationprogram`

- **Django model:** `sanitation.SanitationProgram`
- **Existing PostgreSQL table:** `sanitation_sanitationprogram`
- **Proposed Mongo collection:** `fg_sanitation_sanitationprogram`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sanitation_program_org_code_ci_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationprogramversion`

- **Django model:** `sanitation.SanitationProgramVersion`
- **Existing PostgreSQL table:** `sanitation_sanitationprogramversion`
- **Proposed Mongo collection:** `fg_sanitation_sanitationprogramversion`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sanitation_program_version_uniq
- **Relationships:** FK:program->sanitation.SanitationProgram; FK:approved_by->accounts.User; FK:created_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationschedulelink`

- **Django model:** `sanitation.SanitationScheduleLink`
- **Existing PostgreSQL table:** `sanitation_sanitationschedulelink`
- **Proposed Mongo collection:** `fg_sanitation_sanitationschedulelink`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id
- **Relationships:** FK:program_version->sanitation.SanitationProgramVersion; FK:checklist_schedule->scheduling.ChecklistSchedule
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_sanitation_sanitationscope`

- **Django model:** `sanitation.SanitationScope`
- **Existing PostgreSQL table:** `sanitation_sanitationscope`
- **Proposed Mongo collection:** `fg_sanitation_sanitationscope`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; constraint:UniqueConstraint:sanitation_scope_version_code_ci_uniq
- **Relationships:** FK:program_version->sanitation.SanitationProgramVersion; FK:site->organizations.Site; FK:department->organizations.Department; FK:equipment->instruments.Equipment
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_checklistapplicabilityrule`

- **Django model:** `scheduling.ChecklistApplicabilityRule`
- **Existing PostgreSQL table:** `scheduling_checklistapplicabilityrule`
- **Proposed Mongo collection:** `fg_scheduling_checklistapplicabilityrule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; organization,product,is_active; organization,site,is_active; organization,department,is_active; organization,shift,is_active; organization,effective_from,effective_to; checklist_template,is_active; constraint:UniqueConstraint:sched_appl_org_code_uniq; constraint:CheckConstraint:sched_applicability_effective_window_valid
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:product->master_data.FGProduct; FK:site->organizations.Site; FK:department->organizations.Department; FK:shift->organizations.Shift
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_checklistschedule`

- **Django model:** `scheduling.ChecklistSchedule`
- **Existing PostgreSQL table:** `scheduling_checklistschedule`
- **Proposed Mongo collection:** `fg_scheduling_checklistschedule`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active,trigger_type; shift,is_active; constraint:UniqueConstraint:sched_schedule_org_code_uniq; constraint:CheckConstraint:sched_schedule_interval_positive
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:shift->organizations.Shift
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_checklisttask`

- **Django model:** `scheduling.ChecklistTask`
- **Existing PostgreSQL table:** `scheduling_checklisttask`
- **Proposed Mongo collection:** `fg_scheduling_checklisttask`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,status; organization,batch_reference; checklist_template,status; organization,trigger_type,status; schedule,status; due_at,status; organization,due_from,due_at; organization,assignee_kind; assigned_user,status; constraint:UniqueConstraint:sched_task_org_tmpl_occ_uniq; constraint:UniqueConstraint:sched_task_org_tmpl_batch_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:checklist_template->checklists.ChecklistTemplate; FK:checklist_version->checklists.ChecklistVersion; FK:schedule->scheduling.ChecklistSchedule; FK:shift->organizations.Shift; FK:assigned_user->accounts.User; FK:assigned_role->access_control.Role; FK:assigned_department->organizations.Department; FK:assigned_shift->organizations.Shift; FK:assigned_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_checklisttaskassignmentevent`

- **Django model:** `scheduling.ChecklistTaskAssignmentEvent`
- **Existing PostgreSQL table:** `scheduling_checklisttaskassignmentevent`
- **Proposed Mongo collection:** `fg_scheduling_checklisttaskassignmentevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; checklist_task,assigned_at; action,assigned_at
- **Relationships:** FK:checklist_task->scheduling.ChecklistTask; FK:assigned_user->accounts.User; FK:assigned_role->access_control.Role; FK:assigned_department->organizations.Department; FK:assigned_shift->organizations.Shift; FK:previous_assigned_user->accounts.User; FK:previous_assigned_role->access_control.Role; FK:previous_assigned_department->organizations.Department; FK:previous_assigned_shift->organizations.Shift; FK:assigned_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_externalbatchevent`

- **Django model:** `scheduling.ExternalBatchEvent`
- **Existing PostgreSQL table:** `scheduling_externalbatchevent`
- **Proposed Mongo collection:** `fg_scheduling_externalbatchevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; status,created_at; organization,status; external_batch_id; constraint:UniqueConstraint:sched_extbatchevt_src_event_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct; FK:site->organizations.Site; FK:shift->organizations.Shift; FK:checklist_task->scheduling.ChecklistTask
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_scheduling_externalbatchmapping`

- **Django model:** `scheduling.ExternalBatchMapping`
- **Existing PostgreSQL table:** `scheduling_externalbatchmapping`
- **Proposed Mongo collection:** `fg_scheduling_externalbatchmapping`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; source_system,mapping_kind,external_key; organization,is_active; constraint:UniqueConstraint:sched_extmap_org_src_key_uniq; constraint:UniqueConstraint:sched_extmap_scoped_src_key_uniq
- **Relationships:** FK:organization->organizations.Organization; FK:product->master_data.FGProduct; FK:site->organizations.Site; FK:shift->organizations.Shift
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_security_audit_securityauditevent`

- **Django model:** `security_audit.SecurityAuditEvent`
- **Existing PostgreSQL table:** `security_audit_securityauditevent`
- **Proposed Mongo collection:** `fg_security_audit_securityauditevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; event_type,created_at; subject_user,created_at; actor,created_at; request_id
- **Relationships:** FK:actor->accounts.User; FK:subject_user->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_supplier_quality_suppliercertificate`

- **Django model:** `supplier_quality.SupplierCertificate`
- **Existing PostgreSQL table:** `supplier_quality_suppliercertificate`
- **Proposed Mongo collection:** `fg_supplier_quality_suppliercertificate`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; expires_on; profile,certificate_type
- **Relationships:** FK:profile->supplier_quality.SupplierQualityProfile; FK:verified_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_supplier_quality_supplierqualityevent`

- **Django model:** `supplier_quality.SupplierQualityEvent`
- **Existing PostgreSQL table:** `supplier_quality_supplierqualityevent`
- **Proposed Mongo collection:** `fg_supplier_quality_supplierqualityevent`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; profile,event_kind; occurred_at
- **Relationships:** FK:profile->supplier_quality.SupplierQualityProfile; FK:nonconformance->nonconformance.NonConformanceRecord; FK:corrective_action->capa.CorrectiveAction; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_supplier_quality_supplierqualityprofile`

- **Django model:** `supplier_quality.SupplierQualityProfile`
- **Existing PostgreSQL table:** `supplier_quality_supplierqualityprofile`
- **Proposed Mongo collection:** `fg_supplier_quality_supplierqualityprofile`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,is_active; constraint:UniqueConstraint:sq_profile_org_erp_ref_ci_uniq
- **Relationships:** FK:organization->organizations.Organization
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_training_trainingenforcementpolicy`

- **Django model:** `training.TrainingEnforcementPolicy`
- **Existing PostgreSQL table:** `training_trainingenforcementpolicy`
- **Proposed Mongo collection:** `fg_training_trainingenforcementpolicy`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; unique:organization
- **Relationships:** O2O:organization->organizations.Organization; FK:updated_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

### `fg_training_trainingrecord`

- **Django model:** `training.TrainingRecord`
- **Existing PostgreSQL table:** `training_trainingrecord`
- **Proposed Mongo collection:** `fg_training_trainingrecord`
- **PK field / type:** `id` / `UUIDField`
- **PK classification:** UUID — SAFE CANDIDATE
- **Indexes / uniques:** pk:id; organization,subject_user,status; organization,competency_scope; expires_on; constraint:CheckConstraint:trn_record_expires_gte_trained
- **Relationships:** FK:organization->organizations.Organization; FK:subject_user->accounts.User; FK:checklist_template->checklists.ChecklistTemplate; FK:equipment->instruments.Equipment; FK:business_role->access_control.Role; FK:recorded_by->accounts.User
- **Migration concern:** standard model
- **MaintainPro collision:** NONE
- **Auto-created:** False

