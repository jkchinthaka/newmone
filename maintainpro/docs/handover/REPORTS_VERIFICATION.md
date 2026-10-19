# Reports verification

Checked 2026-10-19 on disposable database `maintainpro_e2e_wo_verify`. Each figure was counted with Prisma and with SQL `COUNT(*)` for the tenant that has the most work orders. Pairs matched.

| Figure | Filter | SQL count | API figure | Match |
|---|---|---|---|---|
| Vendor invoice tax on 1000 at 18% | journey helper `taxFromRate` | 180 tax, 1180 total | 180 / 1180 | yes |
| Open work orders | open statuses | 5 | 5 | yes |
| Open MACHINERY | same tenant | 3 | 3 | yes |
| Open SERVICE | same tenant | 1 | 1 | yes |
| Open VEHICLE | same tenant | 1 | 1 | yes |
| Critical open | priority CRITICAL and open | 0 | 0 | yes |
| Overdue | OVERDUE status, or due before the check and not closed/cancelled/completed | 0 | 0 | yes |
| Unassigned | OPEN or PLANNED and no technician | 2 | 2 | yes |
| In progress | IN_PROGRESS or ON_HOLD | 2 | 2 | yes |
| PM overdue | active plan, next due before the check, has a trigger, asset or vehicle set | 0 | 0 | yes |
| Open maintenance requests | NEW / UNDER_REVIEW / NEEDS_INFORMATION / APPROVED | 1 | 1 | yes |
| Pending approval requests | PENDING or EMERGENCY_OVERRIDE_PENDING_REVIEW | 0 | 0 | yes |
| Submitted or reviewed vendor invoices | SUBMITTED / UNDER_REVIEW / REVIEWED | 0 | 0 | yes |

Report export files were not generated in this pass. Card-versus-queue helpers are also covered by `tier2-defects.spec.ts`.
