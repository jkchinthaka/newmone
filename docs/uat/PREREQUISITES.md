# Phase 20 — Prerequisites

All rows must be **MET** with cited evidence before UAT execution may claim PASS. Empty or local-only developer evidence is insufficient for business UAT.

| # | Prerequisite | Status | Evidence / notes |
| --- | --- | --- | --- |
| P1 | Technical automated tests pass on release candidate | PARTIAL | Phase 19 technical suites exist on `main`; full CI green on company UAT host **EVIDENCE REQUIRED** |
| P2 | MongoDB stable (if in pilot scope) | N/A / OPEN | PostgreSQL is system of record (ADR-002). Mongo POC is optional; not required for core FG recording. If Management includes Mongo in pilot, stability evidence **EVIDENCE REQUIRED** |
| P3 | Real users configured (pilot personas) | NOT MET | APR-034 pilot users **NOT** management-approved |
| P4 | Real checklist approved + published for pilot | NOT MET | FG-QA-001 / TEMPLATE-001 **BLOCKED — BUSINESS APPROVAL REQUIRED** (Phase 06N); APR-001 open |
| P5 | Real product / master data available | NOT MET | MASTER-001 / ASM-001–006 **EVIDENCE REQUIRED** |
| P6 | Critical roles approved (Recorder / Supervisor / QA / Admin / Auditor; SoD) | NOT MET | APR-010 SoD PENDING; APR-040 role templates EVIDENCE REQUIRED |
| P7 | Pilot / UAT environment available | NOT MET | ASM-015 / APR-021 hosting — local Compose only today |
| P8 | Backup / support ready for pilot window | PARTIAL | Phase 19 backup/restore harness + restore drill technical PASS; company-approved operator custody + RPO/RTO **COMPANY DECISION REQUIRED** (APR-029) |
| P9 | Pilot scope approved (site, dept, product(s), shift, duration, users) | NOT MET | APR-034 — see [PILOT_SCOPE.md](PILOT_SCOPE.md); **do not invent duration or product counts** |
| P10 | Paper decommission not assumed | MET (policy) | Paper remains until formal approval; see parallel-run doc |

**Entry gate:** **CLOSED** — UAT execution against real business operations must not start until P3–P7 and P9 are MET.
