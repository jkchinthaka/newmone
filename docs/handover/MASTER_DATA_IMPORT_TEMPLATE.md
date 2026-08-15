# Master Data Import Template

**Rule:** Do not invent Nelna operational values. Populate CSV templates only with company-approved data.

CSV shells (headers only): `docs/handover/templates/`

| File | Purpose |
| --- | --- |
| `organizations.csv` | Legal/org units |
| `sites.csv` | Sites belonging to an organization |
| `departments.csv` | Departments / areas |
| `shifts.csv` | Shift codes and timings (**overnight policy OWNER REQUIRED**) |
| `products.csv` | SKUs / products (**limits OWNER REQUIRED**) |
| `users.csv` | Named users (no shared accounts) |
| `role_assignments.csv` | Org-scoped role mapping |

## Required fields (logical)

### Organization

- code, name, is_active
- **OWNER REQUIRED** for official codes/names

### Site

- organization_code, site_code, site_name, is_active
- timezone if different from Asia/Colombo (**CONFIRM**)

### Department

- organization_code, site_code, department_code, department_name, is_active

### Shift

- organization_code, shift_code, shift_name, start_time, end_time, overnight_flag
- **BUSINESS APPROVAL REQUIRED** for night-shift operational day

### Product

- organization_code, product_code, product_name, is_active
- temperature class / limits: **EVIDENCE REQUIRED — do not invent**

### Users

- employee_code, full_name, email (optional), organization_code, site_code, is_active
- password: set via secure provisioning only; never commit passwords

### Role assignments

- employee_code, organization_code, role (`recorder` / `supervisor` / `qa` / `admin` as implemented)
- effective_from / effective_to if used
- **SoD review required** before production load

## Import process (proposed technical)

1. Receive approved CSVs from Business Owner / IT.
2. Validate codes uniqueness and org scope.
3. Load in transaction.
4. Audit who loaded what and when.
5. Smoke-test login and org isolation with non-production accounts first.

**Status:** Templates prepared. **No company master data loaded by this package.**
