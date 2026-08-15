# Phase 05D — Equipment and Calibration Foundation

**Document status:** Technical foundation — **not** calibration-interval / overdue-policy approval  
**Phase:** 05D  

## Scope delivered

| Area | Status |
| --- | --- |
| Equipment master (code, type taxonomy, serial, org/site, manufacturer/model, operational status, active) | TECHNICALLY SUPPORTED — **unseeded** |
| CalibrationRecord (calibrated_on, next_due_on, certificate/provider refs, recorded_by) | TECHNICALLY SUPPORTED — **no invented frequency** |
| Fitness labels VALID / DUE / OVERDUE / OUT_OF_SERVICE / UNKNOWN | Derived labels only — **block vs warn = EVIDENCE REQUIRED** |
| Hard delete | Refused; inactive / OUT_OF_SERVICE preserves history (PROTECT FKs) |
| ChecklistItem.requires_equipment_reference | Optional flag default **False** — does not force existing items |
| Authorization | `instruments.manage_equipment` / `view_equipment` — separate from operator record permissions |
| Audit | Equipment create/update/activate/deactivate/status; calibration create; certificate metadata update |
| Evidence attachments | Deferred (metadata references only) |

## Explicitly not delivered

- Seeded scales/thermometers/probes or Nelna asset catalogue
- Invented calibration intervals or auto next_due calculation from frequency
- Hard-coded overdue recording block/warn behavior
- Live certificate file storage

## Permissions

| Permission | Notes |
| --- | --- |
| `instruments.view_equipment` | Inspect equipment / calibration history |
| `instruments.manage_equipment` | Administer equipment and calibration records |

Operator `scheduling.record_checklisttask` does **not** imply equipment administration.
