# ADR-007: Scoped RBAC

**Status:** Accepted (Phase 03 foundation)
**Date:** 2026-08-06
**Deciders:** Project Owner (technical foundation)

## Context

Finished Goods recording requires organization, site, and department isolation. Permissions must fail closed and must not invent business role names until owners confirm them.

## Decision

1. **Permission authority:** `django.contrib.auth.models.Permission`.
2. **Role model:** `access_control.Role` — UUID, code, name, description, `is_active`, M2M to Permission. No seeded business roles.
3. **Assignments:** `ScopedRoleAssignment` links user + role with optional organization, site, and department scope, validity window, and `assigned_by`.
4. **Hierarchy:** Site requires organization and must belong to it; department requires organization and, if site-bound, must belong to that site.
5. **Global assignment:** Allowed only when organization/site/department are all unset and the assignment service explicitly permits it. Active uniqueness uses PostgreSQL `NULLS NOT DISTINCT` so NULL scope fields compare equal.
6. **Authorization API:** Central services (`user_has_permission`, scope accessors) — views stay thin; UI hiding is never sufficient.
7. **Fail closed:** Inactive users, roles, assignments, future `valid_from`, and expired `valid_until` grant nothing. Cross-organization access is denied.
8. **Superuser:** Explicit Django superuser privilege remains and is tested separately.

## Consequences

- Future FG modules check permissions via access-control services/decorators/mixins.
- Role catalogues are data, not hard-coded Phase 03 seeds.
- PostgreSQL constraints (including NULLS NOT DISTINCT for active assignments) are authoritative; service validation provides friendly errors and is race-aware via IntegrityError handling.

## Related

- [ADR-006-IDENTITY-AND-EMPLOYEE-CODE-AUTHENTICATION.md](ADR-006-IDENTITY-AND-EMPLOYEE-CODE-AUTHENTICATION.md)
- [AUTHENTICATION_AND_ACCESS_CONTROL.md](../security/AUTHENTICATION_AND_ACCESS_CONTROL.md)


## Addendum — Phase 03C RoleTemplate (ADR-007a)

**Status:** Accepted as technical extension (2026-08-10)
**Does not:** approve Nelna business roles, seed templates, or enforce SoD policy.

1. **RoleTemplate:** Configurable empty permission bundle with `business_status`
   PROPOSED | PENDING_OWNER_APPROVAL | OWNER_APPROVED (default PROPOSED).
2. **OWNER_APPROVED:** Service layer requires non-blank `evidence_reference` (APR path).
   Never invent company-approved template content.
3. **create_role_from_template:** Copies permissions into a new `Role` only; does not
   assign users; does not treat PROPOSED as company authority.
4. **set_role_permissions:** Audited mutation path (`ROLE_PERMISSIONS_SET`). Prefer
   services over ad-hoc admin M2M edits (admin save_related routes to the service).
5. **Assignment windows:** `ScopedRoleAssignment.valid_from` / `valid_until` remain the
   temporary/effective windows (names unchanged).
6. **SoD:** Documented in `SOD_DECISION_REGISTER.md` as PENDING — not approved policy.

### Related Phase 03C docs

- [PHASE_03C_ROLE_GOVERNANCE.md](../governance/PHASE_03C_ROLE_GOVERNANCE.md)
- [PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md)
