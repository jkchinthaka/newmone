# Defect status

| ID | Status | Evidence |
|---|---|---|
| QA-FRESH-MAINT-001 | FIXED | Generic status rejects VERIFIED and CLOSED. Dedicated verify blocks the completer. Journey: same user throws ForbiddenException. |
| QA-FRESH-MAINT-002 | FIXED | Cancel from a technician is rejected in the status rules. Journey cancel uses a manager/admin reason. |
| QA-FRESH-MAINT-003 | FIXED | `issuePartRequest` checks remaining quantity and `assertVerifiedIssueAllowed` inside one transaction. |
| QA-FRESH-MAINT-004 | FIXED | Assignment eligibility is covered by the existing assign guards. Not re-probed with an inactive user in this sweep. |
| QA-FRESH-MAINT-005 | FIXED | PM revise whitelist rejects unknown and protected fields. `tier1-defects` "QA-FRESH-MAINT-005 and 037". |
| QA-FRESH-MAINT-006 | FIXED | My Jobs shows Start, Hold, Resume, and Complete. Forbidden jobs use a role message. |
| QA-FRESH-MAINT-007 | FIXED | Overdue auto work order stores the evaluation time when the plan due date is already past. `planning-phase08` expects `dueDate` `2026-09-14T00:00:00.000Z`. |
| QA-FRESH-MAINT-008 | FIXED | Technician and mechanic `findOne` allows only the assignee, creator, or linked employee. |
| QA-FRESH-MAINT-009 | FIXED | `roleCanAccessQueue` is false for SECURITY_OFFICER. `search` throws ForbiddenException. |
| QA-FRESH-MAINT-010 | FIXED | Assignment employee list keeps active execution roles and trades. `workforce-assignment-eligibility`. |
| QA-FRESH-MAINT-011 | FIXED | Add assignee disables immediately and stays on the assignment panel. |
| QA-FRESH-MAINT-012 | FIXED | `planWork` calls `assertWorkOrderScheduleDates` with `rejectPastDates: true`. End before start stays in that helper. |
| QA-FRESH-MAINT-013 | FIXED | Update rejects a blank title and a past due date. `tier1-defects` "QA-FRESH-MAINT-013 and 051". |
| QA-FRESH-MAINT-014 | FIXED | CLOSED and CANCELLED reject content and cost edits unless a verifier sends a correction reason. `tier1-defects` "QA-FRESH-MAINT-014". |
| QA-FRESH-MAINT-015 | FIXED | Checklist create maps items and returns 400 when a key or label is blank. |
| QA-FRESH-MAINT-016 | FIXED | Concurrent 401s share one refresh. `access-token-refresh.test.ts` "QA-FRESH-MAINT-016". |
| QA-FRESH-MAINT-017 | FIXED | Completed counts include CLOSED and VERIFIED. `tier2-defects` "QA-FRESH-MAINT-017". |
| QA-FRESH-MAINT-018 | FIXED | Blank supplier name returns 400. |
| QA-FRESH-MAINT-019 | FIXED | Part request uses name or code search. A raw id field is no longer the fallback. |
| QA-FRESH-MAINT-020 | FIXED | Mutations are not auto-retried. `bff-upstream-fetch` `shouldRetryUpstream`. |
| QA-FRESH-MAINT-021 | FIXED | Last open close returns the asset or vehicle. Another open job keeps it under maintenance. `tier2-defects` "QA-FRESH-MAINT-021". |
| QA-FRESH-MAINT-022 | FIXED | In-progress card uses `inProgressQueueWhere` (includes ON_HOLD). `tier2-defects` "QA-FRESH-MAINT-022". |
| QA-FRESH-MAINT-023 | FIXED | Unassigned card uses `unassignedQueueWhere`. `tier2-defects` "QA-FRESH-MAINT-023". |
| QA-FRESH-MAINT-024 | FIXED | PM overdue card uses `pmPlanOverdueWhere`. Cost card uses `sumAmounts`. `tier2-defects` "QA-FRESH-MAINT-024". |
| QA-FRESH-MAINT-025 | FIXED | Activity timeline includes plan, assign, hold, resume, part issue, verify, and close. `tier2-defects` "QA-FRESH-MAINT-025". |
| QA-FRESH-MAINT-026 | FIXED | Inbox decide blocks self-approval. `approval-inbox.rules.spec.ts` "blocks approving your own request". |
| QA-FRESH-MAINT-027 | FIXED | Part-request roles match the catalog. A return stays pending until confirm. `tier1-defects` "QA-FRESH-MAINT-027". |
| QA-FRESH-MAINT-028 | DEFERRED | Owner decision. Schedule board was not built. |
| QA-FRESH-MAINT-029 | FIXED | PM asset picker no longer forces ACTIVE. Under-maintenance assets are labelled. |
| QA-FRESH-MAINT-030 | FIXED | Cost snapshot rejects invalid numbers with 400. `tier1-defects` "QA-FRESH-MAINT-030". |
| QA-FRESH-MAINT-031 | FIXED | Converted work order title and requester notice use the request description. |
| QA-FRESH-MAINT-032 | FIXED | Seed grants technicians and mechanics `maintenance_requests.create` and `view_own`. A reseed applies it to an existing database. |
| QA-FRESH-MAINT-033 | FIXED | Technician and mechanic work-order UI hides the assignment tab. |
| QA-FRESH-MAINT-034 | FIXED | `reportModuleHref` keeps search, status, category, and dates. |
| QA-FRESH-MAINT-035 | FIXED | Repeat-failure clusters count only work orders flagged `repeatFailureCandidate`. |
| QA-FRESH-MAINT-036 | FIXED | `POST /planning/inspection-templates` creates a template. |
| QA-FRESH-MAINT-037 | FIXED | Unknown PM revise fields return 400. `tier1-defects` "QA-FRESH-MAINT-005 and 037". |
| QA-FRESH-MAINT-038 | FIXED | Part requests and issues reject a quantity above verified stock. `tier1-defects` "QA-FRESH-MAINT-038" and `approved-policy` verified-stock cases. |
| QA-FRESH-MAINT-039 | FIXED | Auto title does not repeat the asset name and does not append an ellipsis. `work-order-create-hci.test.ts`. |
| QA-FRESH-MAINT-040 | FIXED | Estimated hours stay hidden until touch or submit via `visibleFieldMessage`. |
| QA-FRESH-MAINT-041 | FIXED | Work order dialog traps focus, closes on Esc, labels fields, saves per tab, and clears ?wo=. |
| QA-FRESH-MAINT-042 | FIXED | Checklist revise uses PromptDialog. |
| QA-FRESH-MAINT-043 | FIXED | Employee labels omit blank dashes. Remaining days are not negative. Variance waits for an invoice. Quotation fields clear after submit. |
| QA-FRESH-MAINT-044 | FIXED | /work-orders/{id} redirects to /maintenance/jobs?wo=. |
| QA-FRESH-MAINT-045 | FIXED | Production `/health` is minimal. Docs JSON is disabled without auth. `tier1-defects` "QA-FRESH-MAINT-045". |
| QA-FRESH-MAINT-046 | FIXED | Submit controls disable in the click handler. `tier3-defects` web. |
| QA-FRESH-MAINT-047 | FIXED | Validation messages are `field: reason`. `tier3-defects` API. |
| QA-FRESH-MAINT-048 | FIXED | Resume on IN_PROGRESS returns 409. QR tag match: `work-order-evidence-controls` "accepts the work order asset tag as a QR match". |
| QA-FRESH-MAINT-049 | FIXED | Waived evidence is not also missing. `tier2-defects` "QA-FRESH-MAINT-049". |
| QA-FRESH-MAINT-050 | FIXED | Admin user actions stay pinned on the right from the tablet breakpoint. |
| QA-FRESH-MAINT-051 | FIXED | Invalid technicianId and status return 400. `tier1-defects` "QA-FRESH-MAINT-013 and 051". |
| QA-FRESH-MAINT-052 | FIXED | PM create scrolls the name field into view. The vendor picker hides inactive vendors. |
| ADM-001 | FIXED | Tenant ADMIN can change status in-tenant. Self, super admin, last admin, and other tenants stay blocked. |
| ADM-002 | FIXED | Update and remove return 403 for a SUPER_ADMIN target. |
| ADM-003 | FIXED | Delete is one transaction. Membership removal, then 409 Deactivate instead when related rows remain. |
| ADM-004 | FIXED | Role change writes USER_ROLE_CHANGED. |
| ADM-005 | FIXED | Feature-flag reason must be at least 5 characters. |
| ADM-006 | N/A | No defect text in the Phase 3B list. |
| ADM-007 | FIXED | Admin search opens `/admin/users?user=<id>`. |
| ADM-008 | N/A | No defect text in the Phase 3B list. |
| ADM-009 | FIXED | `POST /users/invite` does not create an active user. |
| ADM-010 | N/A | No defect text in the Phase 3B list. |
