# Collection Collision Audit — FG vs MaintainPro

**Generated (UTC):** 2026-08-12T09:55:20Z  
**Production logical database (documented):** `mgintginpro_prod`  
**MongoDB connection:** None (static analysis only)  
**Prisma schema source:** `C:\Users\chint\source\newmone\maintainpro\prisma\schema.prisma`  

## Summary

| Field | Value |
| --- | --- |
| EXISTING_DATABASE_NAME | `mgintginpro_prod` |
| EXISTING_COLLECTION_COUNT (MaintainPro Prisma models) | 114 |
| PLANNED_FG_COLLECTION_COUNT (fg_ namespace) | 231 |
| EXACT_NAME_COLLISIONS | 0 |
| CLASSIFICATION | **SAFE — NO COLLISION** |

## Rules

- MaintainPro owns existing PascalCase Prisma collections — **do not touch**.
- FG owns only `fg_*` collections in the same logical database.
- No development/POC writes to `mgintginpro_prod` until full gate passage.

## MaintainPro collections (reference sample)

First 20 Prisma model / collection names:

- `AccidentEvidence`
- `AccidentReport`
- `AnimalHealthRecord`
- `AnimalProductionLog`
- `AppSetting`
- `Asset`
- `AttendanceLog`
- `AuditLog`
- `Building`
- `ChangeRequest`
- `CleaningChecklist`
- `CleaningChecklistTemplate`
- `CleaningLocation`
- `CleaningVisit`
- `CopilotConversation`
- `CopilotExchangeLog`
- `CopilotMessage`
- `CropCycle`
- `CutoverChecklistItem`
- `DeliveryChecklist`
- ... (94 more)

## Planned FG collections (sample)

- `fg_access_control_role`
- `fg_access_control_role_permissions`
- `fg_access_control_roletemplate`
- `fg_access_control_roletemplate_permissions`
- `fg_access_control_scopedroleassignment`
- `fg_accounts_user`
- `fg_accounts_user_groups`
- `fg_accounts_user_user_permissions`
- `fg_ai_assistance_aiassistancerequest`
- `fg_auth_group`
- `fg_auth_group_permissions`
- `fg_auth_permission`
- `fg_batch_dossier_batchdossierexportrequest`
- `fg_batch_dossier_batchdossierpolicy`
- `fg_batch_genealogy_genealogyedge`
- `fg_batch_genealogy_genealogynode`
- `fg_batch_genealogy_genealogypolicy`
- `fg_capa_capaactionitem`
- `fg_capa_capahistoryentry`
- `fg_capa_correctiveaction`
- `fg_change_control_qualitychangeaffectedlink`
- `fg_change_control_qualitychangeevent`
- `fg_change_control_qualitychangeimpactassessment`
- `fg_change_control_qualitychangeimplementationlink`
- `fg_change_control_qualitychangerequest`
- ... (206 more)

## Pre-cutover live inventory (required before company write)

Run read-only on authorized staging/production host:

```javascript
use mgintginpro_prod
db.getCollectionNames().sort()
```

Compare output to this static audit. Any unexpected overlap → **CUTOVER BLOCKED**.

