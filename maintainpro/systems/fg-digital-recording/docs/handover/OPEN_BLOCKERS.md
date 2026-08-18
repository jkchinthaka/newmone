# Open Blockers — Production Readiness Package

Updated: 2026-08-12. Do not invent closures.

## Technical

| ID | Severity | Owner | Status | Evidence | Required action | Blocks UAT? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TECH-MP-001 | Medium | Integration | OPEN | MaintainPro repo not found under expected roots | Provide MaintainPro path; implement FG nav link | No | Soft (navigation UX) |
| TECH-A11Y-001 | Low | App | OPEN | Code review ongoing | Fix only safe a11y issues; device evidence still required | Partial | Soft |
| TECH-SINHALA-001 | Medium | App/QA | OPEN | DEBT-01C-R-NOTO | Real-device Sinhala evidence | Yes (UAT-15) | Soft |

## Business

| ID | Severity | Owner | Status | Evidence | Required action | Blocks UAT? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BUS-FORM-001 | High | Business Owner | OPEN | Register | Approve CL/24/39/30/18 digitization | Partial | Yes |
| BUS-CL39-001 | Medium | Business Owner | OPEN | Schedule ambiguity note | Confirm schedule | No | Recommended |
| BUS-CL18-001 | Medium | Business Owner | OPEN | Header 1–5 vs 10 samples | Confirm sample policy | No | Recommended |
| BUS-MASTER-001 | High | Business Owner | OPEN | Templates only | Provide official master data | Yes | Yes |
| BUS-SOD-001 | High | Business Owner | OPEN | SoD matrix draft | Approve SoD policy | Yes | Yes |
| BUS-ROLES-001 | High | Business Owner/IT | OPEN | | Named production roles | Yes | Yes |

## Infrastructure

| ID | Severity | Owner | Status | Evidence | Required action | Blocks UAT? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INFRA-STAGING-001 | High | IT | OPEN | Package prepared; not deployed | Host staging + TLS | Soft | Yes |
| INFRA-TLS-001 | High | IT | OPEN | | Certificates | Soft | Yes |
| INFRA-SMTP-001 | Medium | IT | OPEN | | Credentials if email required | No | If required |
| INFRA-BACKUP-001 | High | IT | OPEN | Local drill only | Production backup owner + RPO/RTO decision | No | Yes |
| INFRA-MON-001 | Medium | IT | OPEN | Runbook prepared | Configure alerts | Soft | Yes |

## External vendor

| ID | Severity | Owner | Status | Evidence | Required action | Blocks UAT? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EXT-BILEETA-001 | High | Vendor/IT | OPEN | Live disabled | Contract, sandbox, credentials | No for core FG UAT | Yes for ERP live |
| EXT-IDP-001 | Medium | IT/Security | OPEN | SSO future doc only | IdP selection | No | Soft (SSO) |

## UAT

| ID | Severity | Owner | Status | Evidence | Required action | Blocks UAT? | Blocks production? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-HUMAN-001 | High | Named testers | IN PROGRESS | UAT-01..03 PASS | Execute UAT-04..18 | Yes | Yes |
| UAT-PRINT-001 | High | Ops/QA | OPEN | Checklist blank | Printer + preview UAT | Yes (UAT-12) | Yes |
| UAT-DEVICE-001 | High | Ops/QA | OPEN | Matrix blank | Device matrix | Yes (UAT-14/15) | Yes |
| UAT-SIGNOFF-001 | High | QA/Business | OPEN | Sign-off blank | Formal signatures | Yes | Yes |

## MongoDB

PostgreSQL remains AUTHORITATIVE SYSTEM OF RECORD. No cutover claimed.
