# RACI — Roles and Responsibilities

**Document status:** Role-based RACI — **no employee names invented**
**Created:** 2026-08-09
**Rule:** Unknown named people = **OWNER TO BE CONFIRMED**. Silence does not assign accountability.

## Legend

| Letter | Meaning |
| --- | --- |
| R | Responsible — does the work |
| A | Accountable — final yes/no |
| C | Consulted |
| I | Informed |

Where a cell would require inventing a person, use **OWNER TO BE CONFIRMED** in Notes.

---

## Core delivery

| Activity | Management Sponsor | IT Manager | QA Manager | Production Manager | Stores/Warehouse | Dispatch | System Administrator | Developer | Bileeta Vendor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project prioritization / phase authorization | A | C | C | C | I | I | I | R | I |
| Technical architecture (ADRs) | I | A | C | I | I | I | C | R | C |
| Application implementation | I | C | I | I | I | I | C | R/A* | I |
| Automated tests / quality gates | I | C | I | I | I | I | C | R | I |
| Security baseline enforcement | I | A | C | I | I | I | R | R | I |
| Documentation / governance registers | A | C | C | C | I | I | C | R | I |

\*Developer is accountable for code quality on delivered units; Management Sponsor remains accountable for go/no-go of business phases.

---

## Master data and content

| Activity | Management Sponsor | IT Manager | QA Manager | Production Manager | Stores/Warehouse | Dispatch | System Administrator | Developer | Bileeta Vendor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Org / Site / Department official values | A | R | C | C | I | I | C | I | I |
| Shift official values / overnight policy | A | C | C | R | I | I | C | I | I |
| FG Product catalogue (MASTER-001) | I | C | A | R | C | I | C | I | C |
| Specification limits / CCP content | I | I | A | C | I | I | I | I | I |
| Checklist content (FG-QA-001) approval | I | I | A | C | I | I | I | C | I |
| Checklist definition engine (technical) | I | C | C | I | I | I | C | R | I |

---

## Workflow and authorization

| Activity | Management Sponsor | IT Manager | QA Manager | Production Manager | Stores/Warehouse | Dispatch | System Administrator | Developer | Bileeta Vendor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Recorder role mapping | A | R | C | R | I | I | C | C | I |
| Supervisor role mapping | A | C | C | R | I | I | C | C | I |
| QA role mapping | A | C | R | C | I | I | C | C | I |
| Segregation-of-duties policy | A | C | R | C | I | I | C | C | I |
| Operator recording (future production) | I | I | C | R | I | I | C | I | I |
| Supervisor review (future production) | I | I | C | R | I | I | C | I | I |
| QA disposition (future production) | I | I | R/A | C | C | C | C | I | I |
| RELEASE downstream execution | A | C | A | C | R | R | C | I | C |
| HOLD investigation ownership | I | I | A | R | C | I | I | I | I |
| REJECT / rework / disposal authority | A | I | A | R | C | I | I | I | I |

Notes: Production use of recording/review/QA remains **BLOCKED** until approvals complete. RACI above describes intended future operational accountability, not current authorization to operate digitally in production.

---

## Integration, environments, continuity

| Activity | Management Sponsor | IT Manager | QA Manager | Production Manager | Stores/Warehouse | Dispatch | System Administrator | Developer | Bileeta Vendor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Batch source selection | A | R | C | C | I | I | C | C | C |
| Bileeta API / sandbox | I | A | I | C | I | I | C | C | R |
| Hosting decision | A | R | I | I | I | I | C | C | I |
| Secret vault ownership | A | A | I | I | I | I | R | C | I |
| Backup / restore drills | I | A | I | I | I | I | R | C | I |
| Production support roster | A | A | C | C | I | I | R | C | I |
| UAT / pilot authorization | A | C | A | A | I | I | C | C | I |
| Production go-live approval | A | A | A | A | I | I | C | I | I |

---

## Named assignees

| Role | Named person |
| --- | --- |
| Management Sponsor | OWNER TO BE CONFIRMED |
| IT Manager | OWNER TO BE CONFIRMED |
| QA Manager | OWNER TO BE CONFIRMED |
| Production Manager | OWNER TO BE CONFIRMED |
| Stores/Warehouse lead | OWNER TO BE CONFIRMED |
| Dispatch lead | OWNER TO BE CONFIRMED |
| System Administrator | OWNER TO BE CONFIRMED |
| Developer | OWNER TO BE CONFIRMED (delivery capacity exists; formal named roster TBC) |
| Bileeta Vendor contact | OWNER TO BE CONFIRMED |

Update this table only when written nomination exists.
