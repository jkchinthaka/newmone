# Security Review Report — MaintainPro Pilot (UAT-023)

**UAT phase:** UAT-023  
**Document owner:** Security + QA Lead  
**Last updated:** 2026-07-02  
**Source of truth:** [permission-matrix.md](permission-matrix.md), [backend-rbac-audit.md](backend-rbac-audit.md), `apps/api/test/security-rbac-audit.spec.ts`

**Policy:** *No system record = No official company action.* All sensitive actions require authenticated, authorized API calls with audit trail.

---

## 1. Executive summary

| Area | Verdict | Notes |
|------|---------|-------|
| Authentication (JWT) | ✅ Pass | All `/api/*` routes except public auth/health require valid JWT |
| Tenant isolation | ✅ Pass | `X-Tenant-Id` enforced via `TenantContextGuard` |
| Role-based access (pilot roles) | ✅ Pass (with documented exceptions) | 347 routes PASS in RBAC audit; 24 TODO (mostly notifications) |
| Maker-checker / fraud controls | ✅ Pass | UAT-020 validated |
| Pilot page access | ✅ Pass | Navigation aligned with UAT-018 |
| Production secrets hygiene | ✅ Pass | No credentials in documentation or git |

**Overall security verdict for pilot:** **APPROVED** subject to open TODO routes not being used for pilot workflows and production secret rotation at cutover.

---

## 2. Enforcement model (reference)

Global guard order on API:

1. `JwtAuthGuard`
2. `TenantContextGuard` (`X-Tenant-Id`)
3. `RolesGuard` (`@Roles`)
4. `PermissionsGuard` (`@Permissions` + DB fallback)

Finance capability is granted via permission `purchase_orders.approve_finance` (held by `MANAGER`, `OPERATIONS_MANAGER`, `ADMIN`) or legacy `FINANCE_APPROVER` role string on report endpoints.

---

## 3. Web route access matrix (pilot pages)

Legend: ✅ Allowed · ❌ Blocked (403 or redirect) · **RO** Read-only

| Route | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance¹ |
|-------|-------------|-------|---------|------------|------------|------------------|------------------|----------|
| `/` (dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ RO |
| `/work-orders` | ✅ full | ✅ full | ✅ full | ✅ view + verify | ✅ own | ✅ RO | ✅ RO | ❌ |
| `/work-orders/new` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/action-center` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ RO |
| `/inventory` | ✅ | ✅ | ✅ | ❌ | ✅ RO | ✅ | ❌ | ❌ |
| `/fleet/gate` | ✅ | ✅ | ✅ RO | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/reports` | ✅ | ✅ | ✅ | ✅ RO | ❌ | ✅ RO | ❌ | ✅ RO |
| `/reports/management-intelligence` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/reports/fraud-control` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/audit` | ✅ | ✅ | ❌ | ✅ RO | ❌ | ❌ | ❌ | ❌ |
| `/admin` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/system-health` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ✅ RO | ❌ | ❌ | ❌ | ❌ | ❌ |

¹ **Finance** = user with `purchase_orders.approve_finance` and/or `FINANCE_APPROVER` role mapping.

---

## 4. API access matrix (pilot-critical endpoints)

### 4.1 Work orders

| API | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance |
|-----|-------------|-------|---------|------------|------------|------------------|------------------|---------|
| `GET /work-orders` | ✅ | ✅ | ✅ | ✅ | ✅ own | ✅ | ✅ | ❌ |
| `POST /work-orders` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PATCH /work-orders/:id` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PATCH /work-orders/:id/status` | ✅ | ✅ | ✅ | ❌ | ✅ own | ❌ | ❌ | ❌ |
| `POST .../approve` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST .../supervisor-verify` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST .../bulk-action` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.2 Parts & inventory

| API | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance |
|-----|-------------|-------|---------|------------|------------|------------------|------------------|---------|
| `GET /part-requests` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `POST /part-requests` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `POST .../approve-operational` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST .../approve-finance` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `POST .../issue` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST /inventory/stock-movements` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 4.3 Purchase orders & vendor repair

| API | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance |
|-----|-------------|-------|---------|------------|------------|------------------|------------------|---------|
| `POST /purchase-orders` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST .../approve-operational` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST .../approve-finance` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Vendor quotation approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Invoice finance approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.4 Gate & fleet

| API | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance |
|-----|-------------|-------|---------|------------|------------|------------------|------------------|---------|
| `POST /gate/out` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /gate/in` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Gate override approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.5 Reports & system

| API | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | TECHNICIAN | INVENTORY_KEEPER | SECURITY_OFFICER | Finance |
|-----|-------------|-------|---------|------------|------------|------------------|------------------|---------|
| Management intelligence | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fraud control summary | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `GET /audit` | ✅ | ✅ | ❌ | ✅ RO | ❌ | ❌ | ❌ | ❌ |
| `GET /deployment-readiness` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin user CRUD | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Maker-checker controls (UAT-020)

| Control | Enforced | Bypass |
|---------|----------|--------|
| Part request: requester ≠ approver | ✅ API | Admin override + audit |
| PO operational ≠ finance same user | ✅ API | Documented exception process |
| Vendor quotation approval | ✅ API | Emergency override |
| Invoice without supervisor verification | ❌ Blocked | — |
| Gate override without reason | ❌ Blocked | Min 3 characters |

---

## 6. Known exceptions and TODO items

| Item | UAT | Risk | Pilot mitigation |
|------|-----|------|------------------|
| 24 notification routes without `@Permissions` | UAT-022 | Low for pilot | Do not expose notification admin UAT endpoints to non-admin |
| Predictive AI chat — all authenticated | UAT-022 | Low | Disable or monitor usage during pilot |
| `FINANCE_APPROVER` not in Prisma enum | UAT-021 | Medium | Use permission-based finance users |
| Evidence storage disabled on staging | UAT-012 | Medium | Enable before evidence UAT or waive with sign-off |

---

## 7. Validation evidence

| Check | Command / artifact | Result |
|-------|-------------------|--------|
| RBAC audit generation | `node scripts/generate-backend-rbac-audit.mjs` | 347 PASS / 24 TODO |
| Security regression tests | `npm run test --workspace @maintainpro/api -- test/security-rbac-audit.spec.ts` | PASS |
| Manual spot-check (5 roles × 5 routes) | QA worksheet | **TBD** at pilot kick-off |

---

## 8. Recommendations

1. Provision pilot users with **least privilege** — no `SUPER_ADMIN` for floor staff.
2. Rotate JWT secrets at production cutover (not reused from staging).
3. Complete manual spot-check worksheet on pilot day 1.
4. Review fraud control report weekly during pilot for override patterns.
5. Tighten notification RBAC before company-wide rollout (UAT-022 carry-forward).

---

## 9. Sign-off

| Role | Name | Signature | Date | Verdict |
|------|------|-----------|------|---------|
| Security / IT | | | | ☐ Approve pilot ☐ Block |
| QA Lead | | | | |
| Backend Lead | | | | |
| Operations Manager | | | | |
