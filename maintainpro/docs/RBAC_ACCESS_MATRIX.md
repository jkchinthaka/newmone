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

## Session

A token that still says `ADMIN` is denied when the database role is no longer allowed. A locked account cannot use an existing access token.
