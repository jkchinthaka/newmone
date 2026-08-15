# Requirements Catalogue

**Document status:** Draft catalogue — requirements are proposed unless marked otherwise  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

## How to read this catalogue

| Field | Meaning |
| --- | --- |
| Requirement ID | Stable identifier |
| Requirement | Statement of need |
| Type | Functional / Non-functional / Constraint |
| Priority | MoSCoW-style proposal: Must / Should / Could / Won't (MVP) |
| Business owner | Named role; person **OWNER REQUIRED** until confirmed |
| Evidence/source | Documented source or EVIDENCE REQUIRED |
| Acceptance method | How satisfaction will be demonstrated |
| Approval status | Proposed / Pending / Approved — **none are Approved yet** |

Do not treat rows as fabricated approved requirements. Values that need Nelna evidence remain open.

## AUTH — Authentication and identity

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 | Users authenticate with individual named accounts | Functional | Must (MVP) | IT owner | Security baseline | Auth tests + UAT | Proposed |
| AUTH-002 | Passwords are stored only as secure hashes | Constraint | Must (MVP) | IT owner | Django security defaults | Security review | Proposed |
| AUTH-003 | Shared accounts are prohibited | Constraint | Must (MVP) | IT / QA | Security baseline | Policy + audit | Proposed |
| AUTH-004 | Sessions expire according to approved policy | Functional | Should | IT owner | EVIDENCE REQUIRED | Config review + tests | Proposed |

## ORG — Organization hierarchy

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-001 | System represents an approved organization hierarchy for access scoping | Functional | Must (MVP) | Business owner | EVIDENCE REQUIRED | Data model review + UAT | Proposed |
| ORG-002 | Role assignments can be scoped to hierarchy nodes | Functional | Must (MVP) | IT / Business | Security baseline | AuthZ tests | Proposed |

## MASTER — Master data

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MASTER-001 | Minimal master data supports the two MVP checklist types only | Functional | Must (MVP) | Business / QA | EVIDENCE REQUIRED | Pilot data pack review | Proposed |
| MASTER-002 | Master data changes are auditable | Functional | Should | QA / IT | Audit policy | Audit tests | Proposed |

## TEMPLATE — Checklist templates

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TEMPLATE-001 | System supports versioned checklist templates | Functional | Must (MVP) | QA owner | Paper forms — EVIDENCE REQUIRED | Template UAT | Proposed |
| TEMPLATE-002 | Exactly two checklist types are in MVP until owners approve expansion | Constraint | Must (MVP) | QA / Business | MVP scope | Scope review | Proposed |
| TEMPLATE-003 | Template content (limits, items, frequencies) comes from approved evidence only | Constraint | Must | QA owner | Controlled documents | Content approval gate | Proposed |

## TASK — Task assignment

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | Operators receive assigned recording tasks for due work | Functional | Must (MVP) | Operations / FG | EVIDENCE REQUIRED | Workflow tests + UAT | Proposed |
| TASK-002 | Task visibility respects scoped authorization | Functional | Must (MVP) | IT / Security | Security baseline | AuthZ tests | Proposed |

## RECORD — Operator recording

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RECORD-001 | Operators can submit checklist answers online for assigned tasks | Functional | Must (MVP) | FG Operations | MVP scope | E2E + UAT | Proposed |
| RECORD-002 | Operator UI minimizes typing and supports Sinhala content | Non-functional | Must (MVP) | Business / QA | Constitution | UX review + UAT | Proposed |
| RECORD-003 | Submitted records are not edited in place | Constraint | Must (MVP) | QA owner | Architecture principles | Amendment tests | Proposed |
| RECORD-004 | Recording remains possible when ERP is unavailable | Constraint | Must | Business / IT | Constitution | Integration isolation test | Proposed |

## REVIEW — Supervisor checking

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REVIEW-001 | Supervisors can check submitted records per approved workflow | Functional | Must (MVP) | FG / Operations | EVIDENCE REQUIRED | Workflow tests + UAT | Proposed |
| REVIEW-002 | Separation of duties prevents prohibited self-check combinations | Constraint | Must (MVP) | QA / IT | Security baseline | Policy tests | Proposed |
| REVIEW-003 | Amendments capture before/after history | Functional | Should (MVP minimum path TBC) | QA owner | Architecture principles | History tests | Proposed |

## QA — QA verification

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 | QA can verify checked records per approved workflow | Functional | Must (MVP) | QA owner | EVIDENCE REQUIRED | Workflow tests + UAT | Proposed |
| QA-002 | Critical failures follow deterministic configured rules, not AI | Constraint | Must | QA owner | AI safety policy | Rule engine tests | Proposed |

## EVIDENCE — Evidence files

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EVIDENCE-001 | Evidence files stored in object storage, not PostgreSQL BLOBs | Constraint | Must (MVP) | IT owner | ADR-002 | Architecture review | Proposed |
| EVIDENCE-002 | Evidence access is authorized and auditable | Functional | Must (MVP) | QA / IT | Security baseline | Access + audit tests | Proposed |

## CAPA — Non-conformance and CAPA

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAPA-001 | NC/hold/CAPA capabilities are out of MVP unless explicitly approved | Constraint | Won't (MVP) | QA owner | MVP scope | Scope gate | Proposed |
| CAPA-002 | CAPA closure must never be an AI final decision | Constraint | Must | QA owner | AI safety policy | Design review | Proposed |

## LOADING — Loading and dispatch

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LOADING-001 | Loading/dispatch/cold-chain controls are post-MVP | Constraint | Won't (MVP) | Dispatch / QA | Roadmap | Scope gate | Proposed |
| LOADING-002 | Loading release must never be an AI final decision | Constraint | Must | QA / Dispatch | AI safety policy | Design review | Proposed |

## OFFLINE — Offline drafts and sync

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OFFLINE-001 | Offline draft/sync is post-MVP | Constraint | Won't (MVP) | IT / Operations | MVP scope | Scope gate | Proposed |
| OFFLINE-002 | Sync design must prevent silent duplicate submissions | Functional | Must (later) | IT / QA | Risk register | Sync tests | Proposed |

## REPORT — Reporting

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REPORT-001 | Basic audit export available for pilot scope | Functional | Must (MVP) | QA / Internal audit | MVP scope | Export UAT | Proposed |
| REPORT-002 | Management dashboards beyond pilot needs are later phase | Constraint | Could | Management | Roadmap | Scope gate | Proposed |

## AUDIT — Audit events

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUDIT-001 | Important operations create audit events | Functional | Must (MVP) | QA / IT | Constitution | Audit tests | Proposed |
| AUDIT-002 | Operational history is preserved; no destructive operational deletes | Constraint | Must | QA owner | Constitution | Data integrity tests | Proposed |

## ERP — Integrations

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ERP-001 | No ERP dependency for MVP recording | Constraint | Must (MVP) | IT / Business | MVP scope | Isolation test | Proposed |
| ERP-002 | No direct ERP database writes from this system | Constraint | Must | IT owner | Security baseline | Design + code review | Proposed |

## SECURITY — Security controls

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SECURITY-001 | Authorization is deny-by-default and server-side | Constraint | Must (MVP) | IT / Security | Security baseline | AuthZ tests | Proposed |
| SECURITY-002 | Secrets are never stored in source control | Constraint | Must | IT owner | Security baseline | Repo scanning / review | Proposed |
| SECURITY-003 | Production deployment requires explicit approval | Constraint | Must | Project owner | Git workflow rules | Release checklist | Proposed |

## OPERATIONS — Environments and continuity

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPERATIONS-001 | Environments follow the environment strategy | Non-functional | Should | IT owner | Environment strategy | Ops review | Proposed |
| OPERATIONS-002 | Business continuity fallback is QA-approved before operational use | Constraint | Must | QA owner | BC draft | Procedure approval | Proposed |

## AI — Assistance

| Requirement ID | Requirement | Type | Priority | Business owner | Evidence/source | Acceptance method | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-001 | AI features are out of MVP | Constraint | Won't (MVP) | Project owner | MVP scope | Scope gate | Proposed |
| AI-002 | AI must not make final food-safety, QA, loading-release, CAPA-closure, or access-control decisions | Constraint | Must | QA / IT | AI safety policy | Design + tests | Proposed |
| AI-003 | Core workflows must not depend on AI availability | Constraint | Must | IT / Business | AI safety policy | Failure-mode test | Proposed |
