# RBAC and Organizational Scope

MaintainPro uses hybrid RBAC:

1. **JWT permissions** (preferred) evaluated by `PermissionsGuard`
2. **Role fallback** when JWT lacks permission claims (DB role lookup)
3. **Tenant isolation** via `X-Tenant-Id` + `TenantContextGuard`
4. **Ownership / assignment** checks inside domain services (work orders, vendor portal)

## Scope dimensions

| Dimension | Enforcement |
|-----------|-------------|
| Tenant | Required on almost all domain queries |
| Site / Department | Optional filters on assets, WO, requests |
| Branch | `branchScope` / site linkage (admin masters) |
| Vendor | `VendorPortalAccess` isolation — vendors never see unrelated jobs |
| Ownership | SoD policies block self-approve / self-verify |

## Invariants (keep in code)

- Cross-tenant reads/writes are denied server-side
- Navigation hiding is **not** authorization
- Role-name-only checks are being replaced by permission keys (`COMPATIBLE_PERMISSION_ALIASES`)

## Negative test expectations

- Cross-tenant IDOR → 404/403
- Vendor user accessing another supplier's repair → forbidden
- Self meter-correction approval → `SOD_VIOLATION`
