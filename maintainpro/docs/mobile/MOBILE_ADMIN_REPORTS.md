# Mobile Admin Console + Advanced Reports (V1)

## Admin Console

Route hub: `/admin`

| Module | Nest source | Mobile |
|--------|-------------|--------|
| Users | `GET/PATCH /admin/users` | list, detail, activate/deactivate (confirm + online) |
| People | `GET /people` | list/search |
| Roles & permissions | `/admin/roles-permissions`, `/roles`, `/roles/permissions` | roles + permission catalog |
| Tenants | `GET /admin/tenants` | list overview (no destructive tenant delete) |
| Invitations | `GET/POST /admin/invitations` | list + invite (online) |
| Departments | `GET /departments` | master-data list |
| Audit | `GET /audit-logs` | read-only list + detail sheet |
| System health | `GET /health`, `GET /health/readiness` | safe status rows only |
| Settings | existing `/settings` | linked from hub |

Critical Admin mutations are **online-only** with confirmation. Flutter never stores password hashes or secrets.

## Advanced Reports

Route hub: `/reports`

| Report | Nest source |
|--------|-------------|
| Management dashboard | `GET /reports/dashboard` |
| Module reports | `GET /reports/:module` (10 allowlisted modules) |
| Management intelligence | `GET /reports/management/profitability/summary` |
| Maintenance exceptions | `GET /reports/maintenance/exceptions` |
| Facilities aging | `GET /facilities/reports/aging` |
| ERP monitoring | `GET /reports/erp-monitoring` |
| Compliance / FG / Audit | deep-links to existing hubs |

All KPI/totals are server-authoritative. Export binary downloads remain Web-first (permission `reports.export`).

## RBAC

- Admin hub UI: SUPER_ADMIN / ADMIN
- Reports hub: `reports.view` or `reports.*` (Nest remains authoritative)
- Direct API 401/403 still gate data access
