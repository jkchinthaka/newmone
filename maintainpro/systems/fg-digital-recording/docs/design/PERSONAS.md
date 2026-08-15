# Personas — Nelna FG Digital Recording System

**Document status:** Proposed design personas — not stakeholder-approved  
**Phase:** 01A — User journeys and low-fidelity specification  
**Last updated:** 2026-08-04

Do not invent personal names, staff counts, or exact Nelna workflows. Values requiring confirmation are tagged.

---

## 1. Operator

| Field | Content |
| --- | --- |
| Primary responsibilities | Complete assigned Finished Goods recording tasks; capture required answers and evidence; submit complete records |
| Device context | Handheld phone (primary); possibly shared company device — [DECISION REQUIRED] ASM-009 |
| Environment | Factory floor / cold areas / wet or gloved conditions possible — [EVIDENCE REQUIRED] ASM-011 |
| Language needs | Sinhala mandatory for operator-facing UI; English optional secondary — [EVIDENCE REQUIRED] ASM-008 |
| Digital skill assumptions | Variable; design for low typing and clear large controls — [ASSUMPTION] |
| Main goals | Finish due tasks faster than paper; avoid mistakes; get clear confirmation after submit |
| Main frustrations | Slow forms, unclear status, small targets, network loss mid-task, ambiguous errors |
| Accessibility considerations | 48–56px touch targets; one-handed use; high contrast; non-colour status; numeric keypad where needed |
| Allowed activities | View own assigned tasks; fill/submit within policy; view own submitted records; upload evidence when required |
| Prohibited activities | Shared login; edit submitted records in place; approve own work if SoD forbids; access other roles’ queues |
| Most important screens | Home, Task list, Checklist, Review before submit, Submission result |
| Most dangerous failure mode | Believes a local draft is “submitted” when server has not confirmed |

---

## 2. Supervisor

| Field | Content |
| --- | --- |
| Primary responsibilities | Review operator submissions; prioritize failures; approve clean records or return for correction with reason |
| Device context | Mobile and tablet |
| Environment | Floor and office adjacency; may review under time pressure |
| Language needs | Sinhala and/or English — mix [DECISION REQUIRED] |
| Digital skill assumptions | Comfortable with lists and detail forms — [ASSUMPTION] |
| Main goals | Clear failures-first queue; fast approve/return; preserve original values |
| Main frustrations | Buried failures, missing evidence, unclear correction history |
| Accessibility considerations | Tablet-friendly tables; status not colour-only; readable evidence thumbnails |
| Allowed activities | Review in-scope records; approve/return per policy; view team task status as scoped |
| Prohibited activities | Bypass SoD; silently alter submitted answers; verify as QA unless separately authorized |
| Most important screens | Overview, Review queue, Record review, Return for correction |
| Most dangerous failure mode | Approves a critical failure without noticing severity/evidence |

---

## 3. QA Officer

| Field | Content |
| --- | --- |
| Primary responsibilities | Verify supervisor-approved records; hold/reject/request reinspection; raise NC when policy requires |
| Device context | Tablet and desktop |
| Environment | QA office / console |
| Language needs | English technical terms likely; Sinhala support as confirmed — [DECISION REQUIRED] |
| Digital skill assumptions | Higher digital fluency — [ASSUMPTION] |
| Main goals | Immutable decisions with full history; SoD enforcement; clear holds |
| Main frustrations | Incomplete evidence chain; unclear amendment trail; invented limits |
| Accessibility considerations | Keyboardable console; error summaries; audit-readable status text |
| Allowed activities | Verify/reject/hold/reinspect in scope; view history; initiate NC concept where authorized |
| Prohibited activities | AI auto-verification; final decisions without human action; editing submitted answers in place |
| Most important screens | Verification queue, Record verification, Hold/reject states |
| Most dangerous failure mode | Releases/verifies despite critical unresolved failure |

---

## 4. Site Manager

| Field | Content |
| --- | --- |
| Primary responsibilities | Oversee site-scoped operational status; act on escalations within authority |
| Device context | Tablet/desktop; occasional mobile |
| Environment | Site office |
| Language needs | [DECISION REQUIRED] |
| Digital skill assumptions | Dashboard-oriented — [ASSUMPTION] |
| Main goals | See blocked/critical items; understand backlog without deep data entry |
| Main frustrations | Noise KPIs; missing escalation clarity |
| Accessibility considerations | Clear alert hierarchy; readable KPI cards |
| Allowed activities | View site-scoped dashboards and alerts; drill to records if authorized |
| Prohibited activities | Mutating records outside granted roles; shared accounts |
| Most important screens | Site overview / critical alerts (may overlap management) |
| Most dangerous failure mode | Misses a loading block or critical hold that requires site action |

---

## 5. Management user

| Field | Content |
| --- | --- |
| Primary responsibilities | Monitor a small set of actionable KPIs and trends |
| Device context | Desktop-first; laptop |
| Environment | Office |
| Language needs | [DECISION REQUIRED] — often English for summary terms |
| Digital skill assumptions | Dashboard consumers — [ASSUMPTION] |
| Main goals | 4–6 actionable KPIs; drill-down to issues |
| Main frustrations | Vanity metrics; delayed data; unclear severity |
| Accessibility considerations | Text alternatives for charts; non-colour series |
| Allowed activities | Read approved dashboards; limited drill-down |
| Prohibited activities | Operational mutate (submit/check/verify) unless separately role-granted |
| Most important screens | KPI dashboard, Critical alerts, Trend drill-down concept |
| Most dangerous failure mode | Treats dashboard green status as food-safety clearance |

---

## 6. System Administrator

| Field | Content |
| --- | --- |
| Primary responsibilities | Manage users, roles/scope, org structure, operational settings within policy |
| Device context | Desktop |
| Environment | IT/admin office |
| Language needs | English administration terminology primary — [ASSUMPTION] pending ASM-008 |
| Digital skill assumptions | Trained administrator required — see risk RSK-011 |
| Main goals | Correct scoped access; auditable admin changes |
| Main frustrations | Unclear scope model; accidental over-privilege |
| Accessibility considerations | Keyboard admin forms; confirmation for destructive admin actions |
| Allowed activities | User/role/org/settings management as authorized |
| Prohibited activities | Shared accounts; bypassing audit; production changes without approval process |
| Most important screens | Users, Roles and Scope, Organization, System Settings |
| Most dangerous failure mode | Grants overly broad access or creates shared credentials |

---

## 7. Super Administrator

| Field | Content |
| --- | --- |
| Primary responsibilities | Break-glass / platform-level configuration beyond normal site admin |
| Device context | Desktop |
| Environment | Controlled IT access |
| Language needs | English technical |
| Digital skill assumptions | High — restricted role |
| Main goals | Recover access issues; configure system-wide settings safely |
| Main frustrations | Unlogged break-glass use |
| Accessibility considerations | Strong confirmations; dual-control concepts [DECISION REQUIRED] |
| Allowed activities | Elevated configuration within documented procedures |
| Prohibited activities | Routine operational recording; silent privilege use |
| Most important screens | System Settings, Audit, elevated user recovery concepts |
| Most dangerous failure mode | Unaudited privilege escalation or secret exposure |

---

## 8. Auditor

| Field | Content |
| --- | --- |
| Primary responsibilities | Retrieve records, evidence, approval chains, amendments, and audit history read-only |
| Device context | Desktop (primary); tablet possible |
| Environment | Audit room / remote as policy allows |
| Language needs | [DECISION REQUIRED] |
| Digital skill assumptions | Search and document review — [ASSUMPTION] |
| Main goals | Fast retrieval of immutable packs; printable audit pack concept |
| Main frustrations | Missing template version; incomplete evidence links |
| Accessibility considerations | Printable contrast; clear read-only banners |
| Allowed activities | Search, view, export/print within scope — mutation-free |
| Prohibited activities | Any create/update/delete of operational records; approvals |
| Most important screens | Audit search, Record pack, Audit event history |
| Most dangerous failure mode | Believes UI view equals certified compliance claim |

---

## Cross-persona rules

- Individual named accounts only; shared accounts prohibited.
- Authorization is server-side; UI never grants access alone.
- AI never makes final food-safety, QA, loading-release, CAPA-closure, or access-control decisions.
- Exact checklist steps and limits remain [EVIDENCE REQUIRED].
