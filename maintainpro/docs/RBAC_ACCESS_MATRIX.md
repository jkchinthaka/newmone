# Access matrix

This document records the server-enforced model. It is not authorization logic. The API guards decide access.

One user has one role. The role holds permissions. Membership ties the user to a tenant. There is no separate per-user permission override.

Permissions on protected routes are read from the database on each request. A role change or a lock takes effect on the next request. Other users' sessions are not revoked.

## Representative checks — 2026-09-30

Tenant `cmu3u90gn0000adjtqs1vhrs7`.

| Identity | Users administration | Assign super admin | Open registration | Invited member |
| --- | --- | --- | --- | --- |
| Tenant admin | List returns 200 | Rejected, 403 | — | Can create an invitation |
| Cleaner | 403 | — | — | — |
| No invitation | — | — | 403 | — |
| Newly accepted member | 403 | — | — | Became TECHNICIAN in the inviting tenant |

The acceptance request cannot send a tenant id or a role id. Extra fields are rejected. The role comes from the invitation membership, looked up inside that tenant.

## Protected role rules

- A tenant administrator cannot assign `SUPER_ADMIN`.
- A manager cannot assign `ADMIN`.
- A user cannot change their own role.
- `SUPER_ADMIN` cannot be deleted.
- A non-super-admin cannot edit the super-admin role.
- Role lists are limited to the active tenant when a tenant is selected.
- The last active super admin cannot be deactivated. That rule already existed.

## Browser walk — 2026-09-30

Signed in as `superadmin@maintainpro.local` through the login page. `GET /auth/me` returned 200. Reloading `/admin/users` stayed signed in.

| Screen | What was seen |
| --- | --- |
| `/admin/users` | Search for "Phase Thirteen" left one row: technician, default tenant, active. Effective permissions for that role show granted and not-granted keys from the catalogue. |
| `/admin/roles` | Search for CLEANER left one built-in role and three permissions: `cleaning.log_visit`, `cleaning.report_issue`, `facility_issues.report`. |

Disposable user `p13-030281@maintainpro.local`:

- Deactivated from the users screen. The next login returned 401.
- Reactivated from the same screen.
- Role changed to VIEWER. The next login was 200, user administration returned 403, and inventory parts returned 403.
- Role restored to TECHNICIAN.

Bulk user import is not required. The tenant has a small seeded user set, and invitation already onboards one person at a time.

Email delivery was not used. Local mailbox delivery stays NOT VERIFIED.

## Admin screens

| Route | Class |
| --- | --- |
| `/admin`, `/admin/users`, `/admin/roles`, `/admin/invitations`, `/admin/tenants`, `/admin/people`, `/admin/organization`, `/admin/approvals`, `/admin/asset-masters`, `/admin/bulk-imports`, `/admin/job-categories`, `/admin/maintenance-config`, `/admin/maintenance-templates`, `/admin/checklist-templates`, `/admin/fault-codes`, `/admin/reason-codes`, `/admin/priority-sla`, `/admin/work-permits`, `/admin/condition-monitoring`, `/admin/warranties`, `/admin/feature-flags` | Working configuration. These screens read and write stored records that the related modules use. |
| `/admin/audit`, `/admin/data-quality`, `/admin/config-history`, `/admin/security` | Read-only. Audit and data quality say so on the page. Security is a set of links. Config history lists past changes. |
| `/admin/integrations` | Retired as a separate editor. The route redirects to system health. |

No second permission layer was added. Super admin can edit role permissions because that endpoint re-reads the database role. A tenant admin cannot call it.

