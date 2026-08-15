# Phase 06N Test Plan — FG-QA-001 Business Validation

**Phase:** 06N  
**Outcome:** **BLOCKED — BUSINESS APPROVAL REQUIRED** (no publish)

| Scenario | Expectation |
| --- | --- |
| Proposal limits | All NUMBER min/max unset |
| Draft loader | Creates DRAFT only; never auto-publishes |
| Authorization | Operator without manage permission cannot load draft |
| Clone / version pinning | Clone creates new DRAFT version; source version number preserved; limits remain unset |
| Validation matrix | 42 rows; disposition PENDING DECISION; columns cover wording/type/required/repeat/unit/limit/CCP/criticality/evidence/failure/role |
| Validation issues log | No owner decisions recorded |
| Proposal / TEMPLATE-001 / APR-001 docs | Remain NOT APPROVED / BLOCKED — BUSINESS APPROVAL REQUIRED |
| Immutability / publish / recording / Engine v2 repeating-calculated-conditional | Covered by prior phase suites; 06N does not approve content or invent Engine v2 rules onto FG-QA-001 |

Regression suites (existing): `test_fg_qa_001_draft_loader.py`, checklist foundation/publish/clone, recording/repeating/conditional as applicable — run as CI; 06N adds governance assertions only.
