# ERP Business Analysis

**Perspective:** ERP Business Analyst + Product + Security controls  
**Scope:** MaintainPro operational ERP-adjacent processes (not a full financial GL)  
**Method:** Schema + module inspection + prior phase reports; **no production data read**

## 1. Platform positioning

MaintainPro is an **operational maintenance / fleet / facilities / inventory** platform with:

- Strong work-order, asset, fleet, facility, and inventory capabilities.
- Purchasing workflow with operational + finance approvals and ERP sync hooks.
- Farm and cleaning vertical modules.
- Audit logging primitives and RBAC.

It is **not** evidenced as a complete AR/AP/GL finance system. Finance controls should be treated as **control points + integration**, unless product owners expand scope.

## 2. Master data governance

| Domain | Present in platform (evidence) | Gaps / questions |
| --- | --- | --- |
| Tenants / memberships | Prisma `Tenant`, `TenantMembership` | Multi-company chart of accounts? |
| Users / roles / permissions | `User`, `Role`, `Permission`, large `RoleName` enum | SoD matrix incomplete |
| Departments / job codes / employees | Models + workforce modules | Cost centre vs department mapping? |
| Assets / vehicles / drivers | Core modules | Category taxonomy governance |
| Facilities hierarchy | Property/Building/Floor/Room | Occupancy / lease accounting out of scope? |
| Spare parts / suppliers / POs | Inventory + procurement | Warehouse master: multi-warehouse unclear |
| Work-order taxonomy | Global + tenant taxonomy | Change control for global taxonomy |
| ERP mappings | `ErpFieldMapping`, import batches, reconciliation mismatches | Source-of-truth per entity unanswered |

**Control needs:** master-data ownership, maker-checker for supplier/bank fields, inactive-vs-delete policy, reference data versioning.

## 3. Inventory controls

**Strengths observed:**

- `SparePart`, `StockMovement`, stock-in / stock-out services.
- Explicit **negative stock blocked** path (`negative_stock_blocked` audit reason).
- Part requests with multi-step approvals and issue flows.
- Work-order parts linkage.

**Gaps / validation TODOs:**

| Control | Status | Business risk |
| --- | --- | --- |
| Opening stock / cutover balances | Needs process + tooling validation | Wrong available qty at go-live |
| Reservation vs available qty | Needs E2E proof | Double allocation |
| Lot / serial tracking | Not fully evidenced as mandatory | Regulated parts |
| Stock transfer between warehouses | Unclear | Multi-site ops |
| Valuation method | Unanswered | Finance mismatch |
| Cycle count / reconciliation | Partial (reports exist; process TBD) | Shrinkage |
| Concurrent stock-out race | Needs DB/transaction tests | Oversell |

## 4. Purchasing

**Strengths:**

- PO create + operational approval + finance approval progression.
- Lines, ERP sync attempts, rejection paths.
- Tenant-scoped inventory/PO work in prior hardening.

**Gaps vs classic ERP purchasing:**

| Step | MaintainPro | Typical ERP expectation |
| --- | --- | --- |
| Purchase request | Partly via part requests / PO create | Formal PR document |
| RFQ / quote compare | Not evidenced as first-class | Competitive bid |
| Goods receipt (GRN) | PO status progression | Separate GRN + qty tolerance |
| Invoice match | ERP sync / references | 2-way / 3-way match |
| Payment | Integration / external | AP payment run |
| Over-receipt / short-close | Needs rules | Tolerance % |
| Cancellation / reversal | Needs explicit audit rules | Period control |

## 5. Work orders (core value stream)

Expected lifecycle to validate end-to-end:

Request → Approval → Plan → Assign → Reserve parts → Execute → Evidence → Complete → Supervisor verify → Cost capture → Close → (Reopen/Cancel)

**Evidence of depth:** assignees, parts, evidence, vendor repair, QR/supervisor verification modules, history.

**Control risks:**

- Client-supplied `createdById` historically noted in mutation inventory — must remain server-derived.
- Evidence mandatory rules by WO type.
- Cost capture completeness before close.
- Reopen permissions and audit.

## 6. Finance-related controls

| Control | Assessment |
| --- | --- |
| Approval thresholds | Finance approval step exists; amount-based matrix unanswered |
| Budget ownership | Not evidenced as enforced ledger |
| Tax fields | Needs field-level review |
| Duplicate supplier invoice prevention | Needs explicit unique business key |
| Three-way matching | Not full AP module |
| Financial period close | Not evidenced |
| Cost allocation to asset/WO/dept | Partial via WO/parts costing |

**Recommendation:** For controlled production, treat finance as **approval + reference + ERP outbound**, and document what MaintainPro will **not** own.

## 7. Operational controls checklist

| Control | Code signals | Residual risk |
| --- | --- | --- |
| Maker-checker | PO dual approval; part-request approvals | Same user both roles? |
| Segregation of duties | RBAC keys rich | Enforcement matrix missing |
| Idempotency | Partial (queues/ERP); not universal on mutations | Duplicate POSTs |
| Concurrency | Prisma transactions in places | Stock race |
| Audit trail | `AuditLog` + util | Coverage completeness |
| Mandatory evidence | Module-specific | Policy by WO type |
| Tenant isolation | Audited PASS historically | Must remain fail-closed |

## 8. Integrations (ERP)

Present: field mappings, import batches, reconciliation mismatches, mock sync, access checklist, stock sync tests.

**Required BA deliverables before go-live:**

1. Entity-level source-of-truth matrix (MaintainPro vs Bileeta vs other).
2. Retry / timeout / dead-letter SLAs.
3. Reconciliation cadence and mismatch owners.
4. Duplicate event handling rules.
5. Cutover mapping for opening balances.

## 9. Roles and segregation of duties

**Roles in schema (`RoleName`):** SUPER_ADMIN, ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, COMPLIANCE_MANAGER, MANAGER, TECHNICIAN, MECHANIC, ASSET_MANAGER, INVENTORY_KEEPER, SUPERVISOR, SECURITY_OFFICER, CLEANER, DRIVER, VIEWER, farm roles, FACILITY_MANAGER, BUILDING_SUPERVISOR.

**Business roles called out by stakeholders but not 1:1 enums:** Requester, Approver, Store keeper, Finance reviewer — currently **permission combinations** rather than named roles.

**SoD risks to validate:**

1. Same user creates PO and grants finance approval.
2. Same user requests parts and issues stock.
3. Technician closes WO without supervisor when policy requires verify.
4. SUPER_ADMIN used for daily operations (break-glass only).
5. Driver / security gate override without second person.

## 10. UI/UX implications for ERP users

Priority usability risks for go-live operators:

- Approval queues visibility by role.
- Clear stock availability before issue.
- Status language consistency (PO workflow vs WO status).
- Session-expired recovery (cookie auth + HTTP mode).
- Error messages that cite business document numbers.
- Mobile field tech flows for WO evidence.

## 11. MVP vs later for controlled production

**MVP (P0/P1 business):** login/session, tenant isolation, WO lifecycle, stock issue without negative, PO dual approval, audit on sensitive writes, ERP sync observability.

**Later (P2/P3):** full RFQ, lot/serial, formal GRN tolerances, AP three-way match, period close, advanced valuation.