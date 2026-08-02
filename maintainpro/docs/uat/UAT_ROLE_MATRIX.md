# UAT Role Matrix

Do not use one administrator for every scenario.

| Role | Permitted | Prohibited | Training | Sign-off |
| --- | --- | --- | --- | --- |
| System Admin | config, users, go-live view | claim all sign-off categories alone | ADMIN | SYSTEM_ADMIN |
| IT Manager | ops, readiness | finance apply alone | ADMIN | IT_MANAGER |
| Department Manager | WO approve | cross-tenant | MANAGER | DEPARTMENT_MANAGER |
| Technician | assigned WO work | approve finance | TECHNICIAN | — |
| Inventory Keeper | stock issue | delete master without auth | INVENTORY | — |
| Procurement Officer | PO path | ERP apply without admin | PROCUREMENT | — |
| Finance | financial approve | operational approve alone | FINANCE | — |
| QA Tester | UAT evidence | production deploy | QA | QA_TESTER |
| Business Owner | acceptance | technical deploy | OWNER | BUSINESS_OWNER |