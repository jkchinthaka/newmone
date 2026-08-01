# Procurement RBAC Matrix (Phase 5C)

| Role | create | view | receive | approve_op | approve_fin | erp_sync | erp_dry_run | erp_apply |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TECHNICIAN/MECHANIC | | part_requests only | | | | | | |
| PROCUREMENT_OFFICER | Y | Y | | | | | | |
| ASSET_MANAGER | Y | Y | | Y | | | | |
| INVENTORY_KEEPER | | Y | Y | | | | Y | |
| FINANCE | | Y | | | Y | | | |
| MANAGER / OPERATIONS_MANAGER | | Y | | Y | Y | Y | | |
| ADMIN / SUPER_ADMIN | full catalog including erp_apply | | | | | | | Y |

Permissions added: purchase_orders.create/view/receive, inventory.erp_dry_run, inventory.erp_apply.