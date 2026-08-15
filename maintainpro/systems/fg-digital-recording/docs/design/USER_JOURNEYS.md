# User Journeys — Critical Paths

**Document status:** Proposed journeys for design review — not stakeholder-approved  
**Phase:** 01A  
**Last updated:** 2026-08-04

Related: [PERSONAS.md](PERSONAS.md), [MVP_SCOPE.md](../requirements/MVP_SCOPE.md), [WORKFLOW_STATE_MAP.md](WORKFLOW_STATE_MAP.md)

For each step: User action · System response · Business rule · Error/failure path · Audit event · Unresolved decision · Acceptance observation.

Checklist item content, limits, and exact SoD matrices are [EVIDENCE REQUIRED] / [DECISION REQUIRED].

---

## Journey 1 — Operator normal checklist

**Goal:** Complete a normal acceptable checklist faster than paper.  
**Persona:** Operator · **MVP:** Yes (online)

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Opens app; enters employee code + password | Shows login form; validates credentials | Named account only; no enumeration | Invalid login → generic error; lockout path Journey 7 | Auth success/failure | Employee-code vs username [DECISION REQUIRED] | Login succeeds with own account |
| 1.2 | Lands on Home / Tasks | Lists assigned due tasks for scope | Deny-by-default; own scope only | Empty list explained; network error banner | — | Task ordering rule [DECISION REQUIRED] | Sees only own in-scope tasks |
| 1.3 | Opens a task | Shows task detail: template name/version, due, location context | Template version frozen for task | Task reassigned/cancelled → clear message | Task opened | Exact metadata fields [EVIDENCE REQUIRED] | Scope is understandable without training jargon dump |
| 1.4 | Starts checklist | Renders items with large pass/select controls | Minimal typing | Offline → do not claim submit (MVP online) | Checklist started | Item UI types per form [EVIDENCE REQUIRED] | Can mark normal answers with few taps |
| 1.5 | Marks normal acceptable answers | Updates progress; incomplete count | Completeness before submit | Missing required → block submit | Answer changed (as designed) | Which items required [EVIDENCE REQUIRED] | Faster than equivalent paper path in UAT timing |
| 1.6 | Changes an exception if needed | Shows conditional fields only when needed | Fail path → Journey 2 patterns | Incomplete conditional → block | Answer changed | Failure reason lists [EVIDENCE REQUIRED] | Exceptions are obvious |
| 1.7 | Reviews completeness | Summary of unanswered / failed | Cannot submit incomplete | Highlight gaps | — | — | Gaps visible before submit |
| 1.8 | Attests | Shows attestation text + confirm control | Attestation required [ASSUMPTION] pending QA | Decline → stay on review | Attestation recorded | Exact wording [OWNER REQUIRED] | Operator understands attestation meaning |
| 1.9 | Submits | Sends to server; shows in-progress | Submit creates immutable submitted snapshot | Timeout → not “submitted”; retry guidance | Submit requested | Idempotency key design [DECISION REQUIRED] | No false “submitted” before ACK |
| 1.10 | Receives server confirmation | Success state with record ID/time | Server ACK required | Failure → remain editable draft/task | Submit confirmed | — | Clear success with record reference |
| 1.11 | Views submitted record | Read-only own record | No in-place edit | Access denied if out of scope | Record viewed | — | Submitted values visible read-only |

---

## Journey 2 — Operator records a failure

**Goal:** Capture failure with required reason/evidence; prevent incomplete critical submit.  
**Persona:** Operator · **MVP:** Yes (structure); severity rules [EVIDENCE REQUIRED]

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Marks item failed | Reveals conditional failure UI | Failure requires configured follow-ups | — | Item failed marked | Fail taxonomy [EVIDENCE REQUIRED] | Failure UI unmistakable |
| 2.2 | Sees conditional fields | Reason, measurement, photo slots as configured | Template-driven; no invented limits | Missing config → block with admin message | — | Field set per form [EVIDENCE REQUIRED] | Only required extras shown |
| 2.3 | Selects failure reason | Stores coded reason | Reasons from approved list | Free-text only if allowed | Reason selected | List ownership [OWNER REQUIRED] | Cannot proceed without reason when required |
| 2.4 | Enters measurement if required | Numeric keyboard; unit label from template | Validate format only; limits from evidence | Invalid number → inline error | Measurement entered | Limit values [EVIDENCE REQUIRED] — do not invent | Units clear; no fake limits in UI copy |
| 2.5 | Adds photo evidence | Capture/upload progress; thumbnail | Evidence in object storage, not DB BLOB | Upload fail → keep local pending label (not submitted) | Evidence attached | Min photos [DECISION REQUIRED] | Upload state honest |
| 2.6 | Sees severity | Text + icon + pattern (not colour alone) | Severity from deterministic rules | Unknown severity → treat as needs review | Severity displayed | Severity matrix [EVIDENCE REQUIRED] | Critical is unmissable |
| 2.7 | Attempts incomplete submit | Blocked with error summary | Incomplete failure data cannot submit | User returns to gaps | Submit blocked | — | Cannot skip required failure fields |
| 2.8 | Critical result path | Banner: escalation / notify per policy | Deterministic escalation; no AI decision | Notify fail → still record critical locally on server after submit | Escalation triggered | Escalation channels [DECISION REQUIRED] | Operator sees next required action |
| 2.9 | Completes and submits | Server confirm as Journey 1 | Same immutability | Same as 1.9–1.10 | Submit confirmed | — | Failed items visible on record |

---

## Journey 3 — Supervisor review and correction

**Goal:** Failures-first review; approve or return with mandatory reason; preserve originals.  
**Persona:** Supervisor · **MVP:** Yes

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 | Opens Review queue | Lists pending reviews | Scoped; SoD filters | Empty/error states | Queue viewed | Queue SLA [DECISION REQUIRED] | Failures sort first |
| 3.2 | Relies on failures-first ordering | Failed/critical rise to top | Proposed ordering | — | — | Exact sort keys [DECISION REQUIRED] | Critical visible without hunting |
| 3.3 | Opens record | Detail with failed items + evidence | Read submitted snapshot | Missing evidence flagged | Review opened | — | Evidence one tap from failure |
| 3.4 | Inspects failures/evidence | Gallery + item context | — | Broken evidence link → error + audit | Evidence viewed | — | Can judge with evidence present |
| 3.5 | Approves clean record | Confirm; moves to QA queue (if required) | Cannot approve if SoD violated | SoD block message | Supervisor approved | Whether all records need QA [DECISION REQUIRED] | Clean path is short |
| 3.6 | Returns for correction | Requires reason; notifies operator path | Mandatory reason; original preserved | Missing reason → block | Returned for correction | Who may resubmit [DECISION REQUIRED] | Reason stored |
| 3.7 | System preserves originals | Amendments/resubmission link history | No in-place overwrite | — | History linked | Amendment vs return model [DECISION REQUIRED] | Original submitted values remain visible |
| 3.8 | Tracks resubmission | Queue shows returned/resubmitted states | Clear state labels | Lost task → alert | Resubmitted | — | Status not ambiguous |

---

## Journey 4 — QA verification

**Goal:** Human verification with SoD; immutable outcome; full history.  
**Persona:** QA Officer · **MVP:** Verify/reject core; NC/hold depth may be partial — label later where needed

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Opens QA queue | Supervisor-approved pending verify | Scoped | Empty/error | Queue viewed | — | Only eligible records |
| 4.2 | Reviews record | Full history: submit, supervisor, amendments | SoD: not same actor as forbidden roles | SoD violation blocked | Verify opened | Exact SoD matrix [EVIDENCE REQUIRED] | History complete |
| 4.3 | Verifies | Confirm; record verified | Human only; no AI final | — | QA verified | — | Decision immutable afterward |
| 4.4 | Rejects | Mandatory reason | — | Missing reason block | QA rejected | — | Reason required |
| 4.5 | Places hold | Hold state unmissable | Hold rules [EVIDENCE REQUIRED] | Unauthorized hold blocked | Hold placed | Hold authority [OWNER REQUIRED] | Hold visible everywhere relevant |
| 4.6 | Requests reinspection | Creates/flags reinspection task concept | — | — | Reinspection requested | Task creation rules [DECISION REQUIRED] | Operator/supervisor see new work |
| 4.7 | Raises NC (concept) | NC draft/link — **Later phase** if out of MVP | CAPA-001 Won't MVP unless approved | Hide or badge “Later” | NC opened | MVP inclusion [DECISION REQUIRED] | Not smuggled in as approved MVP without sign-off |
| 4.8 | Separation of duty | Server denies illegal combinations | Deny-by-default | Clear access denied | AuthZ deny | — | UI and API both deny |
| 4.9 | Final immutable decision | No silent reopen | Corrections via controlled process only | — | Decision finalized | Reopen policy [DECISION REQUIRED] | Cannot quietly edit outcome |
| 4.10 | Views full history | Timeline UI | — | — | — | — | Auditor-ready trail |

---

## Journey 5 — Critical loading block

**Goal:** Unmissable LOADING BLOCKED on critical vehicle/loading failure; no normal approve.  
**Persona:** Loading-capable role (often supervisor/dispatch) — exact role [OWNER REQUIRED]  
**Scope:** Later phase (LOADING-001); design states now; **do not invent temperature limits**

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Starts vehicle inspection | Loading checklist UI | Template from approved forms later | — | Inspection started | Forms [EVIDENCE REQUIRED] | — |
| 5.2 | Records critical failure | Severity critical | Deterministic rules; no AI | — | Critical failure | Limits [EVIDENCE REQUIRED] | No invented °C in UI |
| 5.3 | Sees LOADING BLOCKED | Full-width banner + icon + text + pattern | Normal approve disabled | — | Block engaged | Banner copy [OWNER REQUIRED] | Cannot miss block |
| 5.4 | Views failed item + evidence | Linked prominently | — | Missing evidence blocks release paths | — | — | Evidence adjacent |
| 5.5 | Attempts normal loading approval | Control unavailable/disabled with explanation | Cannot approve while blocked | — | Approve blocked | — | No hidden bypass |
| 5.6 | Requests reinspection | New inspection path | — | — | Reinspection | — | Clear next step |
| 5.7 | Escalates | Notify authorized roles | Channels TBD | Notify fail logged | Escalated | Channels [DECISION REQUIRED] | — |
| 5.8 | Override request | Request workflow concept | Dual authorization **future decision** | Unauthorized override denied | Override requested | Dual auth [DECISION REQUIRED] | Override never silent |
| 5.9 | Audit visibility | Full trail of block/override | — | — | — | — | Auditable end-to-end |

---

## Journey 6 — Offline and synchronization concept

**Goal:** Honest sync states; never call local data “submitted” without server ACK.  
**Scope:** Design states only — **not implemented in 01A / not MVP delivery**

| State | User-visible meaning | Allowed wording | Forbidden wording |
| --- | --- | --- | --- |
| Online | Connected | Online | — |
| Offline but working | Can draft locally | Offline — working on this device | Submitted |
| Saved on this device | Local draft persisted | Saved on this device | Submitted to server |
| Waiting to sync | Queued | Waiting to sync | Submitted |
| Syncing | Upload in progress | Syncing… | Submitted |
| Evidence uploading | Files transferring | Uploading evidence… | Record submitted |
| Sync failed | Needs retry | Sync failed — not on server | Submitted |
| Conflict | Server/local diverge | Sync conflict — review needed | Auto-resolved silently (unless designed) |
| Synchronized | Server confirmed | Synchronized / saved on server | — |

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6.1 | Loses network mid-entry | Banner: Offline but working | MVP: may block submit — [ASSUMPTION] | — | Connectivity lost (client) | MVP offline policy [DECISION REQUIRED] | Banner visible |
| 6.2 | Saves draft | Saved on this device | Not submitted | Storage full → error | Local save | — | Label correct |
| 6.3 | Reconnects | Waiting to sync / Syncing | Idempotent sync later | Sync failed state | Sync attempted | Conflict rules [DECISION REQUIRED] | No duplicate silent submits |
| 6.4 | Server ACK | Synchronized + submitted only then | Server confirmation required | — | Submit confirmed | — | Wording rule held |

---

## Journey 7 — Account and access problem

**Goal:** Safe auth recovery without account enumeration.  
**Persona:** Any · **MVP:** Core auth errors

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7.1 | Invalid login | Generic failure message | No user existence reveal | Retry with rate limit | Auth failure | Lockout threshold [DECISION REQUIRED] | Same message for bad user/pass |
| 7.2 | Locked account | Locked state + recovery hint | Lockout policy | — | Account locked | Duration [DECISION REQUIRED] | No enumeration |
| 7.3 | Forced password change | Must change before app | Policy | Weak password rejected | Password change forced | Complexity policy [EVIDENCE REQUIRED] | Cannot skip |
| 7.4 | Access denied | Clear denied page | Deny-by-default | — | AuthZ deny | — | No blank crash |
| 7.5 | Expired session | Session expired → login | Secure cookies | — | Session expired | Timeout [EVIDENCE REQUIRED] | Draft retention rules TBD |
| 7.6 | Assisted recovery | Supervisor/admin unlock concept | Named admin action; audited | Self-service may be limited | Unlock performed | Who can unlock [OWNER REQUIRED] | No shared break-glass user |
| 7.7 | Enumeration protection | Constant messaging/timing as practical | Security baseline | — | — | — | Testers cannot probe valid IDs easily |

---

## Journey 8 — Auditor record retrieval

**Goal:** Read-only retrieval of pack: template version, evidence, chain, amendments, history.  
**Persona:** Auditor · **MVP:** Basic search + pack concept; rich export may mature in Phase 16

| Step | User action | System response | Business rule | Error/failure path | Audit event | Unresolved decision | Acceptance observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8.1 | Logs in (named) | Auditor shell read-only | Mutation controls absent | — | Login | — | Read-only banner |
| 8.2 | Selects scope | Scope picker within grants | Scoped RBAC | Out-of-scope empty | — | Hierarchy [DECISION REQUIRED] | Cannot see other sites |
| 8.3 | Applies date filters | Filtered results | — | Invalid range error | Search performed | Retention limits [EVIDENCE REQUIRED] | Filters obvious |
| 8.4 | Opens record detail | Snapshot + status | Read-only | — | Record viewed | — | — |
| 8.5 | Views template version | Version ID/label shown | Frozen at submit | Missing version = defect | — | — | Version always present |
| 8.6 | Opens evidence | Authorized signed URL view | Evidence ACL | Denied/expired URL | Evidence viewed | — | Access audited |
| 8.7 | Views approval chain | Submit→check→verify actors/times | — | — | — | — | Chain complete |
| 8.8 | Views amendments | Before/after | History preserved | — | — | — | Originals intact |
| 8.9 | Views audit history | Event list | — | — | — | — | — |
| 8.10 | Printable audit pack concept | Print/PDF concept | Not a compliance certificate alone | Generation fail | Pack exported | Pack contents [DECISION REQUIRED] | Pack is retrieval aid, not claim |

---

## Journey acceptance summary (proposed)

| Journey | Design principle check |
| --- | --- |
| J1 | Faster than paper for normal path — validate in UAT timing |
| J2 | Incomplete critical failure cannot submit |
| J3 | Originals preserved; return requires reason |
| J4 | Human immutable verify; SoD enforced |
| J5 | LOADING BLOCKED unmissable; no invented limits |
| J6 | Never “submitted” without server ACK |
| J7 | No account enumeration |
| J8 | Read-only; full pack visibility |
