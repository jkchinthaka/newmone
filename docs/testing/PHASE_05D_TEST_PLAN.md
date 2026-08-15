# Phase 05D Test Plan — Equipment Calibration Foundation

| Area | Coverage |
| --- | --- |
| Equipment identity / uniqueness | Org-scoped normalized code |
| Cross-org / operator denial | manage_equipment required; cross-org denied |
| Inactive historical safety | Calibration retained; hard delete refused |
| Due calculations | VALID / DUE / OVERDUE / UNKNOWN / OUT_OF_SERVICE |
| Invalid dates | next_due_on < calibrated_on rejected |
| Authorization / audit | Status + certificate metadata events |
| Checklist hook | requires_equipment_reference defaults False |

Target: `apps.instruments` coverage ≥ 80%.
