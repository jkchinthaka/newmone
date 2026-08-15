# High-Fidelity Screen Specification — Phase 01C

**Document status:** Draft pending owner review — not approved  
**Phase:** 01C — High-fidelity MVP screens and prototype  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Last updated:** 2026-08-05

**CRITICAL:** This specification uses **SAMPLE DATA** placeholders only. Do NOT treat sample employee codes (EMP-XXXX), sample checklists, sample sites, sample temperatures (XX.X°C), or sample batch numbers (SAMPLE-BATCH) as approved Nelna operational facts.

**Related documents:**
- [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md)
- [LOW_FIDELITY_WIREFRAMES.md](LOW_FIDELITY_WIREFRAMES.md)
- [PERSONAS.md](PERSONAS.md)
- [DESIGN_TOKENS.md](DESIGN_TOKENS.md)
- [COMPONENT_SYSTEM.md](COMPONENT_SYSTEM.md)
- [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md)
- [RESPONSIVE_BEHAVIOUR.md](RESPONSIVE_BEHAVIOUR.md)

This document specifies all MVP high-fidelity screens for Figma implementation (Phase 01C). Each screen includes purpose, entry point, data requirements, actions, business rules, permissions, responsive behavior, states, accessibility requirements, open decisions, and development notes.

---

## AUTH — Authentication screens

### AUTH-LGN — Login

**Screen ID:** AUTH-LGN  
**Name:** Login  
**Primary persona:** Any (pre-authentication)  
**Figma page:** 06 Operator Mobile (also applies to all personas)  
**Figma frame pattern:** `06/operator/AUTH-LGN/360`

**Purpose:** Authenticate user with employee code and password; establish session.

**Entry point:** App launch; session expired; explicit logout.

**Data displayed:**
- Login form (employee code input, password input)
- Offline connectivity banner if network unavailable
- System branding (name, optional logo [DECISION REQUIRED])
- Optional language selector (EN/SI) [DECISION REQUIRED]

**Sample data placeholders:**
- Employee code: `EMP-1234` (not a real employee code)
- Password: (masked input)

**Primary actions:**
- Submit credentials → server authentication → redirect to persona home on success

**Secondary actions:**
- Forgot password link (→ AUTH-RST)
- Optional language toggle [DECISION REQUIRED]

**Business rules:**
- Rate-limit failed attempts (server-side)
- Lock account after N failures (policy-defined)
- Session timeout policy [DECISION REQUIRED]
- Require individual named accounts (no shared logins)

**Required permissions:** Public (pre-authentication)

**Responsive:** 360px mobile-first; scales to tablet/desktop.

**States:**
- Default (ready for input)
- Validation error (empty fields, format errors)
- Authentication failed (generic message per security policy)
- Account locked (→ AUTH-LCK message)
- Offline banner (cannot reach server)
- Loading (submit in progress)
- Forced password change (→ AUTH-FPC)

**Accessibility:**
- Keyboard navigable
- Labels for screen readers
- Password show/hide toggle
- Error messages announced
- Focus visible
- Touch targets min 48px

**Open decisions:**
- [ ] **D-01C-001**: Confirm language selector visibility on login (owner approval required)
- [ ] **D-01C-002**: System logo/branding final asset (owner approval required)
- [ ] **D-01C-003**: Session timeout duration (security policy required)

**Development notes:**
- Django auth backend handles credential validation
- CSRF protection required
- Session management per Django defaults
- Redirect to intended destination after successful login

---

### AUTH-FPC — Forced password change

**Screen ID:** AUTH-FPC  
**Name:** Forced password change  
**Primary persona:** Any (authenticated, pending password change)  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/AUTH-FPC/360`

**Purpose:** Require user to set new password on first login or after admin reset.

**Entry point:** Post-authentication when user account flagged for password change.

**Data displayed:**
- Current password (for re-authentication)
- New password input
- Confirm new password input
- Password policy rules (min length, complexity)

**Sample data placeholders:**
- Employee: `EMP-1234` (display name/code at top)

**Primary actions:**
- Submit new password → validate → update → proceed to home

**Secondary actions:**
- Cancel → logout

**Business rules:**
- Password policy enforcement [DECISION REQUIRED — min length, complexity]
- Cannot reuse last N passwords [POLICY REQUIRED]
- Must match current password for re-auth
- Confirm password must match new password

**Required permissions:** Authenticated but pending password change

**Responsive:** Mobile-first 360px.

**States:**
- Default (form ready)
- Validation error (policy violation, mismatch)
- Server error (cannot update)
- Success → redirect
- Offline (block change, cannot reach server)

**Accessibility:**
- Password show/hide toggles
- Policy rules clearly listed
- Error messages specific and announced
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-004**: Confirm password policy specifics (IT security owner required)
- [ ] **D-01C-005**: Password reuse history depth (policy required)

**Development notes:**
- Enforce on middleware for flagged accounts
- Validate password policy server-side
- Hash and salt per Django defaults

---

### AUTH-RST — Password reset request

**Screen ID:** AUTH-RST  
**Name:** Password reset request (concept)  
**Primary persona:** Any  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/AUTH-RST/360`

**Purpose:** Allow user to request password reset (email or admin-mediated).

**Entry point:** Forgot password link on AUTH-LGN.

**Data displayed:**
- Input for employee code or email
- Instructions (contact admin if no email, or reset link sent)
- Generic success message (do not reveal account existence per security)

**Sample data placeholders:**
- Employee code: `EMP-XXXX`

**Primary actions:**
- Submit request → generic success
- Return to login

**Secondary actions:**
- Contact admin link/instructions

**Business rules:**
- Generic response (do not confirm valid/invalid accounts)
- Rate-limit requests
- Email delivery or admin workflow [DECISION REQUIRED]

**Required permissions:** Public

**Responsive:** Mobile-first.

**States:**
- Default
- Submitted (generic success)
- Error (rate-limited)
- Offline (cannot reach server)

**Accessibility:**
- Keyboard navigable
- Clear instructions

**Open decisions:**
- [ ] **D-01C-006**: Email reset vs. admin-mediated reset workflow (IT policy required)
- [ ] **D-01C-007**: Email server integration or helpdesk ticket (owner decision required)

**Development notes:**
- Do not expose account enumeration
- Token-based reset if email enabled
- Admin reset if manual workflow

---

### AUTH-LCK — Account locked

**Screen ID:** AUTH-LCK  
**Name:** Account locked  
**Primary persona:** Any  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/AUTH-LCK/360`

**Purpose:** Inform user their account is locked after repeated failed login attempts.

**Entry point:** Post-failed-login when threshold exceeded.

**Data displayed:**
- Account locked message
- Instructions to contact administrator
- Admin contact info [DECISION REQUIRED]

**Primary actions:**
- Return to login (still locked, informational only)

**Secondary actions:**
- Contact admin link/instructions

**Business rules:**
- Unlock via admin action only (no automatic time-based unlock in MVP)

**Required permissions:** Public

**Responsive:** Mobile-first.

**States:**
- Static locked message

**Accessibility:**
- Clear message
- Contact info readable

**Open decisions:**
- [ ] **D-01C-008**: Admin contact mechanism (email, phone, helpdesk ticket) — owner required

**Development notes:**
- Admin unlock via user management screen (AD-USR)
- Log lock events for audit

---

### AUTH-DEN — Access denied

**Screen ID:** AUTH-DEN  
**Name:** Access denied  
**Primary persona:** Any (authenticated)  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/AUTH-DEN/360`

**Purpose:** Inform user they do not have permission to access requested resource.

**Entry point:** Attempt to access route/action without required permission.

**Data displayed:**
- Access denied message
- Reason (generic: insufficient permissions)
- Return to home link

**Primary actions:**
- Return to home

**Secondary actions:**
- Contact supervisor/admin if access needed

**Business rules:**
- Server-side authorization check (UI denial is not security)
- Log denied access attempts for audit

**Required permissions:** Authenticated (but lacking specific permission)

**Responsive:** Mobile-first, scales to tablet/desktop.

**States:**
- Static denied message

**Accessibility:**
- Clear message
- Return link keyboard accessible

**Open decisions:**
- None

**Development notes:**
- Django permission decorators
- Log denied attempts (audit trail)

---

### AUTH-EXP — Session expired

**Screen ID:** AUTH-EXP  
**Name:** Session expired  
**Primary persona:** Any (authenticated, session expired)  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/AUTH-EXP/360`

**Purpose:** Inform user their session has expired and require re-login.

**Entry point:** Idle timeout exceeded; server-side session invalidation.

**Data displayed:**
- Session expired message
- Re-login button

**Primary actions:**
- Re-login → AUTH-LGN

**Secondary actions:**
- None

**Business rules:**
- Session timeout per security policy [DECISION REQUIRED]
- Preserve intended destination if feasible

**Required permissions:** Public (post-session-expiry)

**Responsive:** Mobile-first.

**States:**
- Static expired message

**Accessibility:**
- Clear message
- Re-login button keyboard accessible

**Open decisions:**
- [ ] **D-01C-009**: Session timeout duration (security policy required)

**Development notes:**
- Django session middleware
- Preserve next URL if possible
- Clear local storage if any

---

## OP — Operator screens

### OP-HOME — Operator home

**Screen ID:** OP-HOME  
**Name:** Operator home  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-HOME/360`

**Purpose:** Primary operator landing; show due task summary and critical alerts.

**Entry point:** Post-login for operator persona.

**Data displayed:**
- Due tasks count (assigned to user)
- Overdue tasks count (if any) — [PROPOSED]
- Optional: critical alerts count [DECISION REQUIRED]
- Sample batch/task: `SAMPLE-BATCH-001` (not real batch number)
- User name/code: `EMP-XXXX`

**Primary actions:**
- View my tasks → OP-TASKS

**Secondary actions:**
- More/profile → OP-MORE
- Logout (with unsync warning if local drafts exist)

**Business rules:**
- Show only tasks assigned to current user (scoped)
- Counts refresh on load (not real-time in MVP)

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px; scales to 430px, tablet.

**States:**
- Loading (skeleton counts)
- Empty (no tasks assigned)
- Default (counts displayed)
- Error (cannot load counts, show cached or message)
- Offline (show cached counts + offline banner)

**Accessibility:**
- Touch targets min 48px
- Status not color-only
- Keyboard navigable
- Screen reader labels

**Open decisions:**
- [ ] **D-01C-010**: Include critical alerts section on home (owner decision required)
- [ ] **D-01C-011**: Real-time vs. on-load refresh (later phase)

**Development notes:**
- Query assigned tasks for current user
- Cache counts for offline view
- HTMX partial swap for count refresh (later)

---

### OP-TASKS — Task list

**Screen ID:** OP-TASKS  
**Name:** My Tasks  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-TASKS/360`

**Purpose:** List all tasks assigned to operator; filter/sort; navigate to detail.

**Entry point:** From OP-HOME or bottom nav.

**Data displayed:**
- Task list (card or row format)
- Each task: task ID (sample: `TASK-XXXX`), checklist name (sample: `Sample Checklist`), site (sample: `Sample Site`), due time, status (Not Started / In Progress / Failed / Submitted)
- Filters: Due Today / Overdue / All [PROPOSED]

**Sample data placeholders:**
- Task ID: `TASK-0001`
- Checklist: `Sample Pre-Dispatch Checklist`
- Site: `Sample Site A`
- Batch: `SAMPLE-BATCH-001`
- Due: `14:00 2026-08-05`

**Primary actions:**
- Tap task → OP-TASK (detail)

**Secondary actions:**
- Filter toggle (due today, overdue, all)
- Refresh pull-to-refresh [DECISION REQUIRED]

**Business rules:**
- Show only tasks assigned to current user
- Sort by due time ascending (overdue first) [PROPOSED]

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px; scales to tablet.

**States:**
- Loading (skeleton list)
- Empty (no tasks assigned)
- Default (list displayed)
- Error (cannot load)
- Offline (cached list + offline banner)

**Accessibility:**
- Tap targets min 48px per row
- Status indicators not color-only (icon + text)
- Keyboard navigable list
- Screen reader row labels

**Open decisions:**
- [ ] **D-01C-012**: Pull-to-refresh vs. manual refresh button (UX decision required)
- [ ] **D-01C-013**: Sort/filter persistence (local storage or session-based)

**Development notes:**
- Paginate if large list (later)
- Cache for offline view
- HTMX partial for list refresh

---

### OP-TASK — Task detail

**Screen ID:** OP-TASK  
**Name:** Task detail  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-TASK/360`

**Purpose:** Show task metadata and checklist template summary; start checklist.

**Entry point:** From OP-TASKS.

**Data displayed:**
- Task ID: `TASK-XXXX`
- Checklist name: `Sample Checklist`
- Site: `Sample Site`
- Batch: `SAMPLE-BATCH`
- Due: date/time
- Status: Not Started / In Progress / Submitted
- Template item count (e.g., 12 items)
- Instructions (if any) [EVIDENCE REQUIRED]

**Sample data placeholders:**
- As above

**Primary actions:**
- Start checklist → OP-CHK

**Secondary actions:**
- Back to tasks
- View instructions (if provided)

**Business rules:**
- Cannot start if status is Submitted (read-only → OP-REC)
- Can resume In Progress

**Required permissions:** `operator` role; task assigned to user

**Responsive:** Mobile-first 360px.

**States:**
- Loading (task metadata)
- Default (ready to start)
- In Progress (resume button)
- Submitted (view record button → OP-REC)
- Error (cannot load)
- Offline (cached view)

**Accessibility:**
- Clear action buttons
- Status announced
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-014**: Instructions display format (inline, modal, external link) — owner required

**Development notes:**
- Fetch task + template metadata
- Cache for offline
- Route to OP-CHK with task ID

---

### OP-CHK — Checklist (normal flow)

**Screen ID:** OP-CHK  
**Name:** Checklist  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-CHK/360` (multiple states)

**Purpose:** Primary recording interface; operator completes checklist items step-by-step.

**Entry point:** From OP-TASK (start or resume).

**Data displayed:**
- Progress indicator (item X of Y)
- Current item: question text (sample: "Sample question text")
- Input type: pass/fail toggle, temperature entry, yes/no, measurement, etc. [EVIDENCE REQUIRED for exact item types]
- Sample temperature placeholder: `XX.X°C` (not a real limit)
- Previous/Next buttons
- Save draft button (local or server) [DECISION REQUIRED]

**Sample data placeholders:**
- Question: "Sample checklist item text"
- Temperature input: `XX.X°C` (placeholder, not operational limit)
- Measurement: `XX.X kg` (placeholder)

**Primary actions:**
- Answer item
- Next item
- Save draft (local or server)

**Secondary actions:**
- Previous item (review/edit)
- Jump to item (if permitted) [DECISION REQUIRED]
- Exit to tasks (with unsaved warning)

**Business rules:**
- Record timestamp per answer [PROPOSED]
- Failed item triggers failure detail (→ OP-FAIL)
- Cannot submit incomplete (validation at review step)
- Local draft saved periodically [DECISION REQUIRED]

**Required permissions:** `operator` role; task assigned

**Responsive:** Mobile-first 360px; optimized for one-handed use.

**States:**
- Default (item ready)
- Answered (proceed to next)
- Validation error (empty required, out-of-range)
- Failure triggered (→ OP-FAIL)
- Draft saved (confirmation toast)
- Offline (local draft only)

**Accessibility:**
- Large touch targets (56px for operator-critical actions)
- Numeric keypad for temperature/measurement
- Pass/fail toggle clear (not color-only)
- Progress announced
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-015**: Exact checklist item types and templates (evidence from Nelna forms required)
- [ ] **D-01C-016**: Jump-to-item navigation allowed or forced linear (policy required)
- [ ] **D-01C-017**: Local draft auto-save frequency (UX decision required)

**Development notes:**
- Template engine for item types
- Validation rules per item (server-side authoritative)
- Local storage for offline draft
- HTMX for item-by-item partial swap (or full-page POST per item)

---

### OP-FAIL — Failure detail entry

**Screen ID:** OP-FAIL  
**Name:** Failure details  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-FAIL/360`

**Purpose:** Capture reason, measurement (if applicable), and evidence for failed checklist item.

**Entry point:** From OP-CHK when item fails.

**Data displayed:**
- Failed item question (context)
- Reason input (required) — freeform text or dropdown [DECISION REQUIRED]
- Measurement input (if applicable, e.g., actual temperature `XX.X°C`)
- Evidence capture button (photo/video) → OP-EVD
- Sample reason: "Sample reason text"

**Sample data placeholders:**
- Failed item: "Sample failed item question"
- Measurement: `XX.X°C` (placeholder)
- Reason: user-entered text

**Primary actions:**
- Save failure details → return to OP-CHK
- Capture evidence → OP-EVD

**Secondary actions:**
- Cancel (mark item incomplete, require resolution)

**Business rules:**
- Reason required for all failures [PROPOSED]
- Measurement required if item type is measurement-based [TEMPLATE REQUIRED]
- Evidence capture optional or required per item policy [POLICY REQUIRED]

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px.

**States:**
- Default (form ready)
- Validation error (missing reason)
- Evidence attached (show thumbnail)
- Saved

**Accessibility:**
- Clear required field labels
- Error messages announced
- Touch targets min 48px

**Open decisions:**
- [ ] **D-01C-018**: Failure reason freeform vs. dropdown (policy required)
- [ ] **D-01C-019**: Evidence required or optional per failure type (policy required)

**Development notes:**
- Store failure details with checklist answer
- Link to evidence upload (media ID)

---

### OP-EVD — Evidence capture

**Screen ID:** OP-EVD  
**Name:** Evidence capture  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-EVD/360`

**Purpose:** Capture photo/video evidence; show upload progress/status.

**Entry point:** From OP-FAIL or OP-CHK (if evidence required for item).

**Data displayed:**
- Camera preview (if capturing)
- Thumbnail list (captured items)
- Upload status per item (pending, uploading, uploaded, failed)
- Sample filename: `SAMPLE-IMG-001.jpg`

**Sample data placeholders:**
- Filename: `SAMPLE-IMG-001.jpg`
- Size: `2.3 MB` (sample)

**Primary actions:**
- Capture photo
- Capture video (if policy allows) [DECISION REQUIRED]
- Confirm/attach → return to OP-FAIL or OP-CHK

**Secondary actions:**
- Retake
- Delete item
- Cancel

**Business rules:**
- Max file size [DECISION REQUIRED]
- Max video duration [DECISION REQUIRED]
- Upload immediately or queue for sync [DECISION REQUIRED — online-first MVP]
- Store in object storage (not PostgreSQL)

**Required permissions:** `operator` role; device camera permission

**Responsive:** Mobile-first 360px.

**States:**
- Default (ready to capture)
- Capturing (camera active)
- Captured (thumbnail shown)
- Uploading (progress bar)
- Uploaded (success confirmation)
- Upload failed (retry button)
- Offline (queue for sync)

**Accessibility:**
- Camera accessible (device-dependent)
- Upload status announced
- Retry/delete buttons labeled

**Open decisions:**
- [ ] **D-01C-020**: Video evidence allowed or photo-only (policy required)
- [ ] **D-01C-021**: Max file size and video duration (storage/policy required)
- [ ] **D-01C-022**: Immediate upload or queue for later sync (MVP online-first vs. offline)

**Development notes:**
- Django backend receives upload, stores in MinIO/S3
- Return media ID to link with checklist answer
- Handle large uploads (chunked or direct)

---

### OP-REV — Review before submit

**Screen ID:** OP-REV  
**Name:** Review before submit  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-REV/360`

**Purpose:** Show completeness summary; allow operator to review before final submit; attest compliance.

**Entry point:** From OP-CHK (complete all items).

**Data displayed:**
- Task metadata (task ID, checklist, batch, site)
- Completeness summary (all items answered: Yes/No; failures: count; evidence: attached/missing)
- Sample summary: "12 items complete, 2 failures, 3 evidence files attached"
- Attestation statement (I certify this record is accurate) [WORDING REQUIRED]
- Submit button (disabled if incomplete)

**Sample data placeholders:**
- Task: `TASK-XXXX`
- Items: 12 complete
- Failures: 2
- Evidence: 3 files

**Primary actions:**
- Submit → OP-RES (submission in progress)

**Secondary actions:**
- Back to checklist (edit)
- Review failures (jump to failure items)

**Business rules:**
- Cannot submit if incomplete (validation)
- Attestation required (checkbox or button acknowledgment) [DECISION REQUIRED]
- Submit creates immutable record (no in-place edit after submit)
- Offline submit: queue for sync [DECISION REQUIRED — MVP online-first]

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px.

**States:**
- Default (ready to review)
- Incomplete (submit disabled, show gaps)
- Offline (cannot submit, show warning)
- Submitting (loading)

**Accessibility:**
- Completeness status announced
- Submit button clearly enabled/disabled
- Attestation checkbox labeled

**Open decisions:**
- [ ] **D-01C-023**: Attestation wording (legal/QA owner required)
- [ ] **D-01C-024**: Offline submit queue or block submit (MVP decision)

**Development notes:**
- Validation server-side (UI validation is convenience)
- Create immutable record on submit
- Return submission result (success/failure)

---

### OP-RES — Submission result

**Screen ID:** OP-RES  
**Name:** Submission result  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-RES/360` (success and failure states)

**Purpose:** Confirm submission success or show failure with retry option.

**Entry point:** From OP-REV (post-submit).

**Data displayed (success):**
- Success confirmation message
- Record ID: `REC-XXXX` (sample)
- Timestamp
- Next steps (record submitted, awaiting supervisor review)

**Data displayed (failure):**
- Error message (generic or specific)
- Retry button
- Save draft button (if connection lost)

**Sample data placeholders:**
- Record ID: `REC-0001`
- Timestamp: `2026-08-05 14:32`

**Primary actions (success):**
- Return to tasks → OP-TASKS
- View record → OP-REC

**Primary actions (failure):**
- Retry submit
- Save draft (if feasible)

**Secondary actions:**
- Contact supervisor (if persistent failure)

**Business rules:**
- Never fake success (only confirm if server ACK received)
- Log submission timestamp and user
- Honest sync status (do not show "submitted" if only local draft)

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px.

**States:**
- Success (confirmation)
- Failure (retry available)
- Offline (cannot submit, show offline warning)

**Accessibility:**
- Success/failure clearly announced
- Action buttons labeled
- Non-color status (icon + text)

**Open decisions:**
- None (MVP clarity rule: never fake success)

**Development notes:**
- Server returns record ID on success
- On failure, preserve draft if possible
- Log submission events for audit

---

### OP-REC — Own record detail (read-only)

**Screen ID:** OP-REC  
**Name:** Own submitted record  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-REC/360`

**Purpose:** View own submitted record (read-only snapshot).

**Entry point:** From OP-RES (post-submit) or OP-TASKS (view submitted task).

**Data displayed:**
- Record ID: `REC-XXXX`
- Task metadata (checklist, batch, site, due time, submitted time)
- All answers (item questions + answers)
- Failures (reasons, measurements, evidence links)
- Status: Submitted / Approved / Returned for correction / Verified
- Supervisor/QA actions (if visible to operator) [DECISION REQUIRED]

**Sample data placeholders:**
- Record ID: `REC-0001`
- Batch: `SAMPLE-BATCH-001`
- Submitted: `2026-08-05 14:32`
- Status: `Submitted (Awaiting Review)`

**Primary actions:**
- View evidence (if attached)
- Back to tasks

**Secondary actions:**
- Print/export (later phase) [PROPOSED]

**Business rules:**
- Operator cannot edit submitted record (immutable)
- If returned for correction, navigate to correction flow [LATER PHASE CONCEPT]

**Required permissions:** `operator` role; own record only

**Responsive:** Mobile-first 360px.

**States:**
- Loading (fetch record)
- Default (record displayed)
- Error (cannot load)
- Offline (cached view if available)

**Accessibility:**
- Read-only status clear
- Evidence links keyboard accessible
- Status announced

**Open decisions:**
- [ ] **D-01C-025**: Show supervisor/QA approval actions to operator (transparency vs. simplicity)

**Development notes:**
- Fetch immutable record by ID
- Cache for offline view (if feasible)
- Link to evidence files (presigned URLs)

---

### OP-SYNC — Sync status (concept)

**Screen ID:** OP-SYNC  
**Name:** Sync status  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-SYNC/360`

**Purpose:** Show offline sync queue: local drafts, pending uploads, sync conflicts.

**Entry point:** From OP-MORE or system notification (offline design concept; MVP is online-first).

**Data displayed:**
- Queue status: local drafts (count), waiting sync (count), sync failed (count), conflicts (count)
- Sample queue: "2 drafts local, 1 waiting sync, 0 failed, 0 conflicts"
- Per-item: task ID, status, retry button

**Sample data placeholders:**
- Draft: `TASK-XXXX local draft`
- Waiting: `TASK-YYYY waiting sync`

**Primary actions:**
- Retry failed sync
- Resolve conflict (choose local or server version)

**Secondary actions:**
- Delete local draft (with confirmation)

**Business rules:**
- MVP is online-first (offline design for later phase)
- Conflict resolution requires user choice (never silent merge)
- Honest status (never fake "synced" if not confirmed)

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px.

**States:**
- Empty (no pending)
- Default (queue displayed)
- Syncing (progress)
- Conflict (resolution UI)

**Accessibility:**
- Queue status announced
- Retry buttons labeled
- Conflict resolution clear

**Open decisions:**
- [ ] **D-01C-026**: Full offline MVP or online-first with future offline (phase decision)
- [ ] **D-01C-027**: Conflict resolution UI detail (UX decision)

**Development notes:**
- IndexedDB or localStorage for local queue
- Background sync API (if offline enabled)
- Server conflict detection (version/timestamp)

---

### OP-MORE — More / profile

**Screen ID:** OP-MORE  
**Name:** More / profile  
**Primary persona:** Operator  
**Figma page:** 06 Operator Mobile  
**Figma frame pattern:** `06/operator/OP-MORE/360`

**Purpose:** Profile summary, language toggle, logout.

**Entry point:** Bottom nav or hamburger menu.

**Data displayed:**
- User name: `Sample User` / `EMP-XXXX`
- Role: Operator
- Language toggle (EN / SI) [DECISION REQUIRED]
- Sync status (if offline enabled)
- App version (informational)

**Sample data placeholders:**
- User: `Sample User (EMP-1234)`

**Primary actions:**
- Logout (with unsync warning if local drafts exist)

**Secondary actions:**
- Change language
- View sync status → OP-SYNC (if offline)
- Help/support link [DECISION REQUIRED]

**Business rules:**
- Logout requires confirmation if unsaved work exists
- Language change persists per user preference [DECISION REQUIRED]

**Required permissions:** `operator` role

**Responsive:** Mobile-first 360px.

**States:**
- Default (profile displayed)
- Unsaved warning (if logout with drafts)

**Accessibility:**
- Logout button clear
- Language toggle labeled

**Open decisions:**
- [ ] **D-01C-028**: Language preference persistence (user profile vs. browser storage)
- [ ] **D-01C-029**: Help/support link destination (owner decision)

**Development notes:**
- Logout clears session
- Language preference stored in user profile (if Django i18n)

---

## SV — Supervisor screens

### SV-OVR — Supervisor overview

**Screen ID:** SV-OVR  
**Name:** Supervisor overview  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-OVR/768`

**Purpose:** Landing for supervisor; show pending review count, failures-first, team status.

**Entry point:** Post-login for supervisor persona.

**Data displayed:**
- Pending review count (scope-filtered)
- Failures count (items with failures awaiting review) [PROPOSED]
- Overdue reviews [PROPOSED]
- Sample counts: "5 pending, 3 with failures, 1 overdue"

**Sample data placeholders:**
- Pending: 5 records
- Failures: 3 records
- Overdue: 1 record

**Primary actions:**
- View review queue → SV-QUE

**Secondary actions:**
- View team status → SV-TEAM
- Alerts → SV-ALT

**Business rules:**
- Show only records in supervisor's scope (site/dept/team) [SCOPE RULES REQUIRED]
- Counts refresh on load (not real-time in MVP)

**Required permissions:** `supervisor` role

**Responsive:** Mobile 430px and tablet 768px optimized.

**States:**
- Loading (skeleton counts)
- Empty (no pending reviews)
- Default (counts displayed)
- Error (cannot load)
- Offline (cached counts)

**Accessibility:**
- Touch targets min 48px
- Status not color-only
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-030**: Supervisor scope definition (site/dept/team) — owner required
- [ ] **D-01C-031**: Real-time vs. on-load refresh

**Development notes:**
- Query submitted records in scope
- Filter failures-first queue
- Cache for offline view

---

### SV-QUE — Review queue

**Screen ID:** SV-QUE  
**Name:** Review queue  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-QUE/768`

**Purpose:** List records awaiting supervisor review; prioritize failures.

**Entry point:** From SV-OVR or bottom nav.

**Data displayed:**
- Record list (card or table format)
- Each record: record ID (sample: `REC-XXXX`), operator (sample: `EMP-XXXX / Sample Operator`), checklist, batch, site, submitted time, status (Submitted / With Failures), failure count
- Filters: All / Failures Only / Overdue [PROPOSED]
- Sort: failures-first, then by submitted time [PROPOSED]

**Sample data placeholders:**
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator`
- Batch: `SAMPLE-BATCH-001`
- Submitted: `2026-08-05 14:32`
- Failures: 2

**Primary actions:**
- Tap record → SV-REV (review detail)

**Secondary actions:**
- Filter toggle (failures-first, all, overdue)
- Refresh

**Business rules:**
- Show only records in scope
- Failures-first sort by default [PROPOSED]
- Cannot review own records if SoD policy forbids [POLICY REQUIRED]

**Required permissions:** `supervisor` role

**Responsive:** Tablet 768px optimized; mobile 430px fallback.

**States:**
- Loading (skeleton list)
- Empty (no pending reviews)
- Default (list displayed)
- Error (cannot load)
- Offline (cached list)

**Accessibility:**
- Tap targets min 48px per row
- Status indicators not color-only
- Keyboard navigable list
- Failure count announced

**Open decisions:**
- [ ] **D-01C-032**: Separation-of-duty rules for supervisor self-review (policy required)
- [ ] **D-01C-033**: Queue sort/filter persistence

**Development notes:**
- Query submitted records in scope
- Exclude own records if SoD enforced
- Cache for offline view

---

### SV-REV — Record review

**Screen ID:** SV-REV  
**Name:** Record review  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-REV/768`

**Purpose:** Review operator-submitted record; view all answers, failures, evidence; approve or return for correction.

**Entry point:** From SV-QUE.

**Data displayed:**
- Record ID: `REC-XXXX`
- Task metadata (operator, checklist, batch, site, submitted time)
- All answers (item questions + answers)
- Failures section (highlighted): reasons, measurements, evidence
- Evidence thumbnails (tap to preview)
- Sample failure: "Item 5: Sample failed item — Reason: Sample reason — Measurement: XX.X°C — Evidence: 2 files"

**Sample data placeholders:**
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator`
- Batch: `SAMPLE-BATCH-001`
- Failure: as above

**Primary actions:**
- Approve → confirmation → return to SV-QUE
- Return for correction → SV-RET (reason required)

**Secondary actions:**
- View evidence (full-screen preview)
- Flag for escalation [DECISION REQUIRED]

**Business rules:**
- Approval creates immutable supervisor-approved record
- Return requires reason (mandatory) [PROPOSED]
- Cannot approve own record if SoD forbids [POLICY REQUIRED]
- Preserve original values (no in-place edit)

**Required permissions:** `supervisor` role; record in scope; not own record (if SoD)

**Responsive:** Tablet 768px optimized; desktop 1024px.

**States:**
- Loading (fetch record)
- Default (record displayed, actions enabled)
- Approved (confirmation, return to queue)
- Returned (navigate to SV-RET)
- Error (cannot load)
- Offline (degraded, block mutate actions)

**Accessibility:**
- Failures clearly highlighted (not color-only)
- Evidence links keyboard accessible
- Approve/Return buttons clearly labeled
- Status announced

**Open decisions:**
- [ ] **D-01C-034**: Escalation workflow (to QA or site manager) — policy required
- [ ] **D-01C-035**: Evidence preview format (inline, modal, full-screen)

**Development notes:**
- Fetch immutable record + evidence
- Approval POST creates supervisor-approved record
- Return POST requires reason
- SoD check server-side

---

### SV-RET — Return for correction

**Screen ID:** SV-RET  
**Name:** Return for correction  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-RET/768`

**Purpose:** Require supervisor to provide reason when returning record to operator for correction.

**Entry point:** From SV-REV (return action).

**Data displayed:**
- Record ID: `REC-XXXX`
- Operator: `EMP-XXXX / Sample Operator`
- Reason input (required) — freeform text or dropdown [DECISION REQUIRED]
- Sample reason: "Sample correction reason text"

**Sample data placeholders:**
- Record ID: `REC-0001`
- Reason: user-entered text

**Primary actions:**
- Confirm return → record status updated → operator notified [NOTIFICATION METHOD REQUIRED]

**Secondary actions:**
- Cancel (return to SV-REV)

**Business rules:**
- Reason required (cannot return without reason) [PROPOSED]
- Original record preserved (correction creates amendment) [PROPOSED — later phase detail]
- Operator sees returned notification (OP-TASKS or notification) [DECISION REQUIRED]

**Required permissions:** `supervisor` role

**Responsive:** Tablet 768px.

**States:**
- Default (form ready)
- Validation error (missing reason)
- Submitting (loading)
- Success (return to SV-QUE)
- Offline (block mutate)

**Accessibility:**
- Reason field clearly labeled
- Error messages announced
- Confirm button clear

**Open decisions:**
- [ ] **D-01C-036**: Return reason freeform vs. dropdown (policy required)
- [ ] **D-01C-037**: Operator notification method (in-app, email, SMS) — owner required

**Development notes:**
- Return POST with reason
- Update record status to Returned
- Create notification or alert for operator
- Log return event for audit

---

### SV-TEAM — Team status (concept)

**Screen ID:** SV-TEAM  
**Name:** Team task view  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-TEAM/768`

**Purpose:** View team task status (assigned tasks, completion, overdue).

**Entry point:** From SV-OVR or nav.

**Data displayed:**
- Team member list (operators in scope)
- Each member: name (sample: `EMP-XXXX / Sample Operator`), assigned tasks (count), completed tasks (count), overdue (count)
- Sample row: `EMP-1234 / Sample Operator — 3 assigned, 2 completed, 1 overdue`

**Sample data placeholders:**
- Operator: `EMP-1234 / Sample Operator`
- Assigned: 3
- Completed: 2
- Overdue: 1

**Primary actions:**
- Tap operator → drill-down to operator's tasks (if authorized)

**Secondary actions:**
- Refresh

**Business rules:**
- Show only operators in supervisor's scope [SCOPE RULES REQUIRED]
- Counts summary only (detailed task list requires authorization)

**Required permissions:** `supervisor` role; scope authorization

**Responsive:** Tablet 768px.

**States:**
- Loading (skeleton list)
- Empty (no team members in scope)
- Default (list displayed)
- Error (cannot load)
- Offline (cached view)

**Accessibility:**
- Tap targets min 48px per row
- Status counts announced
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-038**: Supervisor drill-down to individual operator tasks (authorization policy required)
- [ ] **D-01C-039**: Team scope definition (site/dept/team) — owner required

**Development notes:**
- Query operators in scope
- Aggregate task counts per operator
- Cache for offline view

---

### SV-ALT — Alerts (concept)

**Screen ID:** SV-ALT  
**Name:** Supervisor alerts  
**Primary persona:** Supervisor  
**Figma page:** 07 Supervisor Mobile and Tablet  
**Figma frame pattern:** `07/supervisor/SV-ALT/768`

**Purpose:** Show critical alerts (overdue, repeated failures, escalations).

**Entry point:** From SV-OVR or nav.

**Data displayed:**
- Alert list
- Each alert: type (Overdue / Repeated Failure / Escalation), record ID (sample: `REC-XXXX`), operator, timestamp, action required
- Sample alert: "Overdue: REC-0001 (Sample Operator) — Due 2 hours ago — Action: Review now"

**Sample data placeholders:**
- Alert type: Overdue
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator`

**Primary actions:**
- Tap alert → navigate to relevant record (SV-REV or SV-QUE)

**Secondary actions:**
- Dismiss (if allowed) [DECISION REQUIRED]
- Filter by type

**Business rules:**
- Alert rules [POLICY REQUIRED — what triggers alerts]
- Scope-filtered alerts only

**Required permissions:** `supervisor` role

**Responsive:** Mobile and tablet.

**States:**
- Loading (skeleton list)
- Empty (no alerts)
- Default (list displayed)
- Error (cannot load)

**Accessibility:**
- Alert severity announced (not color-only)
- Tap targets min 48px
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-040**: Alert trigger rules (overdue threshold, repeated failure count) — policy required
- [ ] **D-01C-041**: Alert dismissal allowed or sticky until resolved

**Development notes:**
- Alert generation rules (background job or on-query)
- Scope-filter alerts
- Link alerts to records

---

## QA — QA Officer screens

### QA-OVR — QA overview

**Screen ID:** QA-OVR  
**Name:** QA overview  
**Primary persona:** QA Officer  
**Figma page:** 08 QA Console  
**Figma frame pattern:** `08/qa/QA-OVR/1024`

**Purpose:** QA landing; show pending verification count, holds, critical findings.

**Entry point:** Post-login for QA persona.

**Data displayed:**
- Pending verification count (supervisor-approved records awaiting QA)
- Holds count [PROPOSED]
- Critical findings [PROPOSED]
- Sample counts: "8 pending verification, 2 holds, 1 critical"

**Sample data placeholders:**
- Pending: 8 records
- Holds: 2 records
- Critical: 1 finding

**Primary actions:**
- View verification queue → QA-QUE

**Secondary actions:**
- View holds
- View critical findings

**Business rules:**
- Show only records in QA's scope [SCOPE RULES REQUIRED]
- Counts refresh on load

**Required permissions:** `qa` role

**Responsive:** Desktop 1024px optimized; tablet 768px fallback.

**States:**
- Loading (skeleton counts)
- Empty (no pending)
- Default (counts displayed)
- Error (cannot load)
- Offline (cached counts)

**Accessibility:**
- Touch targets min 48px (if touch-enabled desktop)
- Status not color-only
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-042**: QA scope definition (site/dept/product) — owner required

**Development notes:**
- Query supervisor-approved records in scope
- Cache for offline view

---

### QA-QUE — Verification queue

**Screen ID:** QA-QUE  
**Name:** Verification queue  
**Primary persona:** QA Officer  
**Figma page:** 08 QA Console  
**Figma frame pattern:** `08/qa/QA-QUE/1024`

**Purpose:** List records awaiting QA verification.

**Entry point:** From QA-OVR or nav.

**Data displayed:**
- Record list (table format)
- Each record: record ID (sample: `REC-XXXX`), operator, supervisor, checklist, batch, site, submitted time, supervisor approval time, status (Awaiting Verification / Hold / Verified), failure count
- Filters: All / With Failures / Holds [PROPOSED]

**Sample data placeholders:**
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator`
- Supervisor: `EMP-5678 / Sample Supervisor`
- Batch: `SAMPLE-BATCH-001`
- Failures: 2

**Primary actions:**
- Tap record → QA-VER (verification detail)

**Secondary actions:**
- Filter toggle
- Refresh

**Business rules:**
- Show only supervisor-approved records in QA scope
- Cannot verify own-operated or own-supervised records if SoD forbids [POLICY REQUIRED]

**Required permissions:** `qa` role

**Responsive:** Desktop 1024px; tablet 768px fallback.

**States:**
- Loading (skeleton table)
- Empty (no pending)
- Default (table displayed)
- Error (cannot load)
- Offline (cached list)

**Accessibility:**
- Table keyboard navigable
- Status indicators not color-only
- Row selection clear

**Open decisions:**
- [ ] **D-01C-043**: QA SoD rules (cannot verify own-operated or own-supervised) — policy required

**Development notes:**
- Query supervisor-approved records in scope
- SoD filter server-side
- Cache for offline view

---

### QA-VER — Record verification

**Screen ID:** QA-VER  
**Name:** Record verification  
**Primary persona:** QA Officer  
**Figma page:** 08 QA Console  
**Figma frame pattern:** `08/qa/QA-VER/1024`

**Purpose:** Full record review; view approval chain, history, evidence; verify/reject/hold/reinspect.

**Entry point:** From QA-QUE.

**Data displayed:**
- Record ID: `REC-XXXX`
- Full history: operator submission, supervisor approval (with timestamps, user IDs)
- All answers (item questions + answers)
- Failures section (highlighted): reasons, measurements, evidence
- Evidence panel (thumbnails, full-screen preview)
- Approval chain (operator → supervisor → QA) [PROPOSED]
- Audit timeline (submission, approval, amendments if any) [PROPOSED]

**Sample data placeholders:**
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator — Submitted 2026-08-05 14:32`
- Supervisor: `EMP-5678 / Sample Supervisor — Approved 2026-08-05 15:10`
- Failures: as above

**Primary actions:**
- Verify → confirmation → record status Verified
- Reject → reason required (similar to return flow)
- Hold → reason required (temporary hold, investigation) [DECISION REQUIRED]
- Reinspect → trigger reinspection workflow [DECISION REQUIRED]

**Secondary actions:**
- View evidence (full-screen)
- View audit timeline
- Initiate NC (if authorized) [LATER PHASE CONCEPT]

**Business rules:**
- Verification creates immutable QA-verified record
- Reject/Hold/Reinspect require reason [PROPOSED]
- Cannot verify own-operated or own-supervised records if SoD forbids [POLICY REQUIRED]
- Preserve full history (no in-place edit)

**Required permissions:** `qa` role; record in scope; not own-operated/supervised (if SoD)

**Responsive:** Desktop 1024px optimized.

**States:**
- Loading (fetch record + history)
- Default (record displayed, actions enabled)
- Verified (confirmation, return to queue)
- Rejected (reason required)
- Hold (reason required)
- Reinspect (trigger workflow)
- Error (cannot load)
- Offline (degraded, block mutate actions)

**Accessibility:**
- Failures clearly highlighted (not color-only)
- Evidence links keyboard accessible
- Action buttons clearly labeled
- Audit timeline keyboard navigable
- Status announced

**Open decisions:**
- [ ] **D-01C-044**: Reject vs. Hold vs. Reinspect workflows (policy required)
- [ ] **D-01C-045**: NC initiation authorization (QA or separate NC role) — policy required
- [ ] **D-01C-046**: Reinspection trigger process (reassign to operator or supervisor) — workflow required

**Development notes:**
- Fetch immutable record + full history + evidence
- Verification POST creates QA-verified record
- Reject/Hold/Reinspect POST requires reason
- SoD check server-side
- Log QA actions for audit

---

### QA-HLD — Hold/reject/reinspection states (concept)

**Screen ID:** QA-HLD  
**Name:** Hold/reject/reinspection states  
**Primary persona:** QA Officer  
**Figma page:** 08 QA Console  
**Figma frame pattern:** `08/qa/QA-HLD/1024`

**Purpose:** Show records in Hold, Rejected, or Reinspection states; manage resolution.

**Entry point:** From QA-OVR or QA-QUE filter.

**Data displayed:**
- Record list (filtered by state: Hold / Rejected / Reinspection)
- Each record: record ID, operator, reason, hold/reject timestamp, action required
- Sample: `REC-0001 — Hold — Reason: Sample hold reason — Action: Investigate`

**Sample data placeholders:**
- Record ID: `REC-0001`
- State: Hold
- Reason: user-entered hold reason

**Primary actions:**
- Tap record → detail view
- Resolve hold (if investigation complete)
- Cancel reinspection (if policy allows)

**Secondary actions:**
- Filter by state

**Business rules:**
- Hold requires investigation completion before resolution
- Rejected records [WORKFLOW REQUIRED — CAPA, rework, etc.]
- Reinspection routes back to operator or supervisor [WORKFLOW REQUIRED]

**Required permissions:** `qa` role

**Responsive:** Desktop 1024px.

**States:**
- Loading (skeleton list)
- Empty (no holds/rejects/reinspections)
- Default (list displayed)
- Error (cannot load)

**Accessibility:**
- Table keyboard navigable
- Status not color-only
- Action buttons labeled

**Open decisions:**
- [ ] **D-01C-047**: Hold resolution workflow (investigation, release, escalate) — policy required
- [ ] **D-01C-048**: Rejected record workflow (CAPA, rework) — policy required
- [ ] **D-01C-049**: Reinspection routing (operator or supervisor) — workflow required

**Development notes:**
- Query records by state (Hold, Rejected, Reinspection)
- Resolution workflow depends on policy
- Log state changes for audit

---

### QA-NC — NC creation (concept)

**Screen ID:** QA-NC  
**Name:** Non-conformance creation  
**Primary persona:** QA Officer (if authorized)  
**Figma page:** 08 QA Console  
**Figma frame pattern:** `08/qa/QA-NC/1024`

**Purpose:** Initiate Non-Conformance (NC) report for critical findings.

**Entry point:** From QA-VER (if policy allows).

**Data displayed:**
- NC form: title, description, severity, root cause, corrective action, CAPA plan [TEMPLATE REQUIRED]
- Link to record ID: `REC-XXXX`
- Sample NC: "NC-0001: Sample non-conformance title"

**Sample data placeholders:**
- NC ID: `NC-0001`
- Title: user-entered
- Severity: Critical / Major / Minor [POLICY REQUIRED]

**Primary actions:**
- Create NC → CAPA workflow (later phase)

**Secondary actions:**
- Cancel (return to QA-VER)

**Business rules:**
- NC authorization [POLICY REQUIRED — QA-only or separate NC role]
- NC workflow [LATER PHASE — CAPA, root cause, closure]

**Required permissions:** `qa` role + `nc` permission (if separate)

**Responsive:** Desktop 1024px.

**States:**
- Default (form ready)
- Validation error (missing required fields)
- Submitting (loading)
- Success (NC created)

**Accessibility:**
- Form keyboard accessible
- Required fields clearly labeled
- Error messages announced

**Open decisions:**
- [ ] **D-01C-050**: NC authorization (QA-only or separate role) — policy required
- [ ] **D-01C-051**: NC workflow and CAPA integration (later phase scope)

**Development notes:**
- NC form template [EVIDENCE REQUIRED]
- Link NC to record ID
- CAPA workflow (later phase)

---

## LD — Loading screens (concept)

### LD-BLK — Loading blocked state

**Screen ID:** LD-BLK  
**Name:** Loading blocked state  
**Primary persona:** Loading role (later phase)  
**Figma page:** 09 Administration (or separate Loading page if later expanded)  
**Figma frame pattern:** `09/admin/LD-BLK/768`

**Purpose:** Show loading-block banner for vehicle/container inspection failure.

**Entry point:** From loading inspection workflow (later phase).

**Data displayed:**
- LOADING BLOCKED banner (critical)
- Reason: critical inspection failure
- Vehicle/container ID: `VEHICLE-XXXX` (sample)
- Failed item: sample failed item
- Evidence link
- Override request/escalation options [DECISION REQUIRED]

**Sample data placeholders:**
- Vehicle: `VEHICLE-001`
- Failed item: "Sample critical inspection item"
- Reason: "Sample failure reason"

**Primary actions:**
- Reinspect (if authorized)
- Escalate (if policy allows)
- Override request (dual-control concept) [DECISION REQUIRED]

**Secondary actions:**
- View evidence
- View audit trail

**Business rules:**
- Loading block is critical hold (cannot release)
- Override requires dual-control or authorized role [POLICY REQUIRED]
- Preserve audit trail for loading release

**Required permissions:** `loading` role (later phase)

**Responsive:** Tablet 768px; desktop 1024px.

**States:**
- Blocked (critical banner)
- Reinspection pass (block released)
- Override pending (awaiting authorization)

**Accessibility:**
- Critical banner announced (not color-only)
- Action buttons clearly labeled
- Evidence links keyboard accessible

**Open decisions:**
- [ ] **D-01C-052**: Loading inspection workflow scope (MVP vs. later phase)
- [ ] **D-01C-053**: Override/dual-control authorization (policy required)

**Development notes:**
- Later phase scope
- Critical state pattern (red banner, block icon, clear message)
- Audit trail for loading release

---

## AD — Administration screens

### AD-SHL — Administration shell

**Screen ID:** AD-SHL  
**Name:** Administration shell  
**Primary persona:** System Administrator  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AD-SHL/1024`

**Purpose:** Admin navigation shell (sidebar or tabs).

**Entry point:** Post-login for admin persona.

**Data displayed:**
- Admin navigation: Users, Roles and Scope, Organization, Templates, Audit, System Settings
- Current section highlighted

**Primary actions:**
- Navigate to admin section

**Secondary actions:**
- Return to home (if admin also has operational role)
- Logout

**Business rules:**
- Show only authorized admin sections per role
- Audit all admin actions

**Required permissions:** `admin` role

**Responsive:** Desktop 1024px; tablet 768px fallback.

**States:**
- Default (nav ready)

**Accessibility:**
- Keyboard navigable
- Current section announced

**Open decisions:**
- None

**Development notes:**
- Django admin or custom admin UI
- Permission-based nav visibility

---

### AD-USR — User management (concept)

**Screen ID:** AD-USR  
**Name:** User management  
**Primary persona:** System Administrator  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AD-USR/1024`

**Purpose:** Manage users (list, create, edit, deactivate, unlock).

**Entry point:** From AD-SHL.

**Data displayed:**
- User list (table)
- Each user: employee code (sample: `EMP-XXXX`), name (sample: `Sample User`), role(s), scope, status (Active / Inactive / Locked), last login
- Search/filter by name, code, role

**Sample data placeholders:**
- Employee code: `EMP-1234`
- Name: `Sample User`
- Role: Operator
- Status: Active

**Primary actions:**
- Add user
- Edit user (tap row → detail form)
- Deactivate user
- Unlock account (if locked)

**Secondary actions:**
- Reset password (admin-mediated)
- View audit history for user

**Business rules:**
- Employee code unique
- Role and scope required
- Cannot delete users (deactivate only, preserve audit trail) [PROPOSED]
- Unlock requires reason [PROPOSED]

**Required permissions:** `admin` role + `users` permission

**Responsive:** Desktop 1024px.

**States:**
- Loading (skeleton table)
- Empty (no users — should never occur)
- Default (table displayed)
- Error (cannot load)

**Accessibility:**
- Table keyboard navigable
- Search input accessible
- Action buttons labeled

**Open decisions:**
- [ ] **D-01C-054**: User deletion vs. deactivation only (policy required)
- [ ] **D-01C-055**: Admin unlock reason required or optional

**Development notes:**
- Django User model
- Permission-based action visibility
- Audit user changes

---

### AD-ROL — Roles and scope (concept)

**Screen ID:** AD-ROL  
**Name:** Roles and scope  
**Primary persona:** System Administrator  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AD-ROL/1024`

**Purpose:** Manage roles, permissions, and scope definitions.

**Entry point:** From AD-SHL.

**Data displayed:**
- Role list: Operator, Supervisor, QA, Admin, Auditor, etc.
- Each role: name, permissions (list), scope type (User / Site / Dept / Team) [SCOPE MODEL REQUIRED]
- Sample role: `Operator — Permissions: view_own_tasks, submit_checklist — Scope: User`

**Sample data placeholders:**
- Role: Operator
- Permissions: view_own_tasks, submit_checklist, upload_evidence
- Scope: User

**Primary actions:**
- Add role (if custom roles allowed) [DECISION REQUIRED]
- Edit role permissions
- Edit scope definition

**Secondary actions:**
- View users with role

**Business rules:**
- Role-based access control (RBAC)
- Deny by default
- Scope model [EVIDENCE REQUIRED — site/dept/team hierarchy]

**Required permissions:** `admin` role + `roles` permission

**Responsive:** Desktop 1024px.

**States:**
- Loading (skeleton list)
- Default (list displayed)
- Error (cannot load)

**Accessibility:**
- Table keyboard navigable
- Permissions list readable
- Action buttons labeled

**Open decisions:**
- [ ] **D-01C-056**: Custom roles allowed or predefined roles only (policy required)
- [ ] **D-01C-057**: Scope model detail (site/dept/team hierarchy) — owner required

**Development notes:**
- Django permission model
- Scope model implementation (site/dept/team foreign keys or hierarchy)
- Audit role changes

---

### AD-ORG — Organization hierarchy (concept)

**Screen ID:** AD-ORG  
**Name:** Organization hierarchy  
**Primary persona:** System Administrator  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AD-ORG/1024`

**Purpose:** Manage organization structure (sites, departments, teams).

**Entry point:** From AD-SHL.

**Data displayed:**
- Tree or table view: sites → departments → teams [STRUCTURE REQUIRED]
- Sample hierarchy: `Sample Site A → Sample Dept → Sample Team`

**Sample data placeholders:**
- Site: `Sample Site A`
- Department: `Sample Department`
- Team: `Sample Team`

**Primary actions:**
- Add site/dept/team
- Edit site/dept/team
- Deactivate site/dept/team (preserve history)

**Secondary actions:**
- View users in site/dept/team

**Business rules:**
- Hierarchy model [EVIDENCE REQUIRED — Nelna org structure]
- Cannot delete org units (deactivate only, preserve history) [PROPOSED]

**Required permissions:** `admin` role + `org` permission

**Responsive:** Desktop 1024px.

**States:**
- Loading (skeleton tree)
- Default (tree/table displayed)
- Error (cannot load)

**Accessibility:**
- Tree keyboard navigable
- Expand/collapse accessible
- Action buttons labeled

**Open decisions:**
- [ ] **D-01C-058**: Nelna organization hierarchy (sites, depts, teams) — owner required
- [ ] **D-01C-059**: Org unit deletion vs. deactivation only

**Development notes:**
- Django hierarchy model (sites, depts, teams)
- Tree view or nested table
- Audit org changes

---

## MG — Management screens

### MG-KPI — KPI dashboard (concept)

**Screen ID:** MG-KPI  
**Name:** KPI dashboard  
**Primary persona:** Management user  
**Figma page:** 10 Management Dashboard  
**Figma frame pattern:** `10/management/MG-KPI/1440`

**Purpose:** Show actionable KPIs (4–6 KPIs recommended).

**Entry point:** Post-login for management persona.

**Data displayed:**
- KPI cards: Completion rate, Failure rate, Overdue tasks, Critical alerts, Loading blocks [PROPOSED]
- Sample KPI: "Completion rate: 94% (47/50 tasks completed today)"
- **IMPORTANT:** All KPI definitions are [PROPOSED] and require owner approval

**Sample data placeholders:**
- Completion rate: 94% [PROPOSED]
- Failure rate: 6% [PROPOSED]
- Overdue: 3 tasks [PROPOSED]
- Critical alerts: 1 [PROPOSED]

**Primary actions:**
- Drill-down to detail (if authorized)

**Secondary actions:**
- Refresh
- Change date range [DECISION REQUIRED]

**Business rules:**
- KPIs [DECISION REQUIRED — owner must define actionable KPIs]
- Scope-filtered (site/all) [DECISION REQUIRED]
- Data freshness indicator (stale badge if offline or delayed)

**Required permissions:** `management` role

**Responsive:** Desktop 1440px optimized; tablet 1024px fallback.

**States:**
- Loading (skeleton cards)
- Default (KPIs displayed)
- Stale (offline or delayed data — show badge)
- Error (cannot load)

**Accessibility:**
- KPI values announced
- Charts have text alternatives
- Non-color series (if charts)
- Keyboard navigable

**Open decisions:**
- [ ] **D-01C-060**: Define 4–6 actionable KPIs (owner required)
- [ ] **D-01C-061**: Scope (site-specific or all-sites) — owner required
- [ ] **D-01C-062**: Date range filter (today, week, month) — UX decision

**Development notes:**
- KPI calculation (background job or on-query)
- Cache for performance
- Stale data indicator (never fake real-time if not)

---

### MG-ALT — Critical alerts (management view)

**Screen ID:** MG-ALT  
**Name:** Critical alerts (management)  
**Primary persona:** Management user / Site Manager  
**Figma page:** 10 Management Dashboard  
**Figma frame pattern:** `10/management/MG-ALT/1440`

**Purpose:** Show critical alerts requiring management attention.

**Entry point:** From MG-KPI or nav.

**Data displayed:**
- Alert list (table)
- Each alert: type (Overdue / Critical Failure / Loading Block / Hold), record ID (sample: `REC-XXXX`), site, timestamp, action required
- Sample alert: "Loading Block: REC-0001 (Sample Site A) — Action: Escalated"

**Sample data placeholders:**
- Alert type: Loading Block
- Record ID: `REC-0001`
- Site: `Sample Site A`

**Primary actions:**
- Tap alert → drill-down (if authorized)

**Secondary actions:**
- Filter by type
- Filter by site

**Business rules:**
- Alert rules [POLICY REQUIRED]
- Scope-filtered (management scope)

**Required permissions:** `management` role

**Responsive:** Desktop 1440px; tablet 1024px fallback.

**States:**
- Loading (skeleton list)
- Empty (no critical alerts)
- Default (list displayed)
- Error (cannot load)

**Accessibility:**
- Alert severity announced (not color-only)
- Table keyboard navigable
- Action buttons labeled

**Open decisions:**
- [ ] **D-01C-063**: Management drill-down authorization (view-only or limited mutate)

**Development notes:**
- Alert generation rules (background job)
- Scope-filter by management scope
- Link to records if authorized

---

## AU — Auditor screens

### AU-SRC — Audit search

**Screen ID:** AU-SRC  
**Name:** Audit search  
**Primary persona:** Auditor  
**Figma page:** 09 Administration (or separate Audit page)  
**Figma frame pattern:** `09/admin/AU-SRC/1024`

**Purpose:** Search records, events, and audit history by filters.

**Entry point:** Post-login for auditor persona or from admin nav.

**Data displayed:**
- Search filters: date range, record ID, operator, site, batch, status
- Sample filter: `Date: 2026-08-01 to 2026-08-05, Site: Sample Site A`

**Sample data placeholders:**
- Record ID: `REC-XXXX`
- Date range: `2026-08-01 to 2026-08-05`
- Site: `Sample Site A`

**Primary actions:**
- Execute search → AU-HIS (result list)

**Secondary actions:**
- Clear filters
- Save search (if feature available) [DECISION REQUIRED]

**Business rules:**
- Auditor read-only (no mutate)
- Scope-filtered if auditor scope limited [DECISION REQUIRED]

**Required permissions:** `auditor` role

**Responsive:** Desktop 1024px.

**States:**
- Default (form ready)
- Searching (loading)
- Results (navigate to AU-HIS)
- Error (cannot search)

**Accessibility:**
- Form keyboard accessible
- Date pickers accessible
- Search button labeled

**Open decisions:**
- [ ] **D-01C-064**: Auditor scope (all-access or site-limited) — policy required
- [ ] **D-01C-065**: Saved search feature (later phase)

**Development notes:**
- Query records and audit events by filters
- Paginate results
- Export results (later phase)

---

### AU-HIS — Audit event history

**Screen ID:** AU-HIS  
**Name:** Audit event history  
**Primary persona:** Auditor  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AU-HIS/1024`

**Purpose:** List audit events (record submissions, approvals, amendments, admin actions).

**Entry point:** From AU-SRC (search results) or drill-down from record.

**Data displayed:**
- Event list (table)
- Each event: timestamp, event type (Submission / Approval / Verification / Amendment / Admin Action), user (sample: `EMP-XXXX`), record ID (sample: `REC-XXXX`), description
- Sample event: `2026-08-05 14:32 — Submission — EMP-1234 — REC-0001 — Checklist submitted`

**Sample data placeholders:**
- Timestamp: `2026-08-05 14:32`
- Event: Submission
- User: `EMP-1234`
- Record: `REC-0001`

**Primary actions:**
- Tap event → detail (if drill-down available)
- View record → AU-PCK

**Secondary actions:**
- Export (CSV, PDF) [LATER PHASE]

**Business rules:**
- Auditor read-only
- Immutable event log

**Required permissions:** `auditor` role

**Responsive:** Desktop 1024px.

**States:**
- Loading (skeleton table)
- Empty (no events in filter)
- Default (table displayed)
- Error (cannot load)

**Accessibility:**
- Table keyboard navigable
- Event types announced
- Export buttons labeled

**Open decisions:**
- [ ] **D-01C-066**: Export format (CSV, PDF, Excel) — owner decision

**Development notes:**
- Query audit events from log table
- Paginate results
- Export later phase

---

### AU-PCK — Record pack (audit detail)

**Screen ID:** AU-PCK  
**Name:** Record pack (printable audit pack)  
**Primary persona:** Auditor  
**Figma page:** 09 Administration  
**Figma frame pattern:** `09/admin/AU-PCK/1024`

**Purpose:** Full record detail with all history, evidence, approvals, amendments (audit pack).

**Entry point:** From AU-HIS or AU-SRC.

**Data displayed:**
- Record ID: `REC-XXXX`
- Full history: operator submission, supervisor approval, QA verification (timestamps, users)
- All answers (item questions + answers)
- Failures: reasons, measurements, evidence
- Amendments (if any): before/after, reason, timestamp
- Approval chain
- Audit timeline
- Evidence panel (thumbnails, full links)
- Template version

**Sample data placeholders:**
- Record ID: `REC-0001`
- Operator: `EMP-1234 / Sample Operator — Submitted 2026-08-05 14:32`
- Supervisor: `EMP-5678 / Sample Supervisor — Approved 2026-08-05 15:10`
- QA: `EMP-9012 / Sample QA Officer — Verified 2026-08-05 16:05`

**Primary actions:**
- Print/export (later phase) [PROPOSED]
- View evidence (full-screen)

**Secondary actions:**
- Back to search

**Business rules:**
- Auditor read-only
- Immutable pack (no edit)
- Show full history including amendments

**Required permissions:** `auditor` role

**Responsive:** Desktop 1024px; print-optimized layout [LATER PHASE].

**States:**
- Loading (fetch record + history + evidence)
- Default (pack displayed)
- Error (cannot load)

**Accessibility:**
- Printable contrast (WCAG AA)
- Keyboard navigable
- Evidence links accessible
- Clear read-only banner

**Open decisions:**
- [ ] **D-01C-067**: Printable audit pack format (PDF or print-friendly HTML) — later phase

**Development notes:**
- Fetch immutable record + full history + evidence + amendments
- Print stylesheet (later phase)
- PDF export (later phase)

---

## Cross-cutting states

All screens must support these common states where applicable:

### Offline states

- **Offline banner:** "You are offline. Some features are unavailable."
- **Cached view:** Show cached data with timestamp and "Last updated" label
- **Sync pending:** "Changes will sync when online"
- **Sync failed:** "Sync failed. Retry?" with retry button
- **Conflict:** "Conflict detected. Choose version to keep."

**Design notes:**
- Offline banner persistent at top (dismissible or sticky per UX decision)
- Never fake success if not confirmed by server
- Honest sync status always

### Loading states

- **Skeleton screens:** Use skeleton loaders (not spinners alone) for cards, lists, tables
- **Partial loading:** Load critical content first (progressive enhancement)
- **Timeout:** Show timeout message if loading exceeds reasonable time

### Error states

- **Generic error:** "Something went wrong. Please try again."
- **Specific error:** Show actionable error message (e.g., "Password must be at least 8 characters")
- **Retry button:** Always provide retry for transient errors
- **Contact admin:** For persistent errors, show contact info

### Empty states

- **No data:** "No tasks assigned" (with illustration or icon)
- **Call to action:** "Start by adding a task" (if appropriate)

### Success states

- **Confirmation toast:** "Record submitted successfully" (auto-dismiss after 3–5s)
- **Confirmation page:** For critical actions (e.g., OP-RES)

---

## Accessibility requirements (all screens)

- **Keyboard navigation:** All interactive elements keyboard accessible
- **Focus visible:** Clear focus indicator (2px solid green, per design tokens)
- **Touch targets:** Min 48px for general UI; 56px for operator-critical actions
- **Color contrast:** WCAG 2.2 AA (4.5:1 for normal text, 3:1 for large text)
- **Status not color-only:** Use icon + text for pass/fail, success/error, status
- **Labels:** All form inputs have labels (visible or screen-reader-only)
- **Error messages:** Announced to screen readers
- **Headings:** Proper heading hierarchy (h1, h2, h3)
- **Alt text:** All images have alt text (evidence photos: descriptive or "Evidence photo [N]")
- **Language:** `lang` attribute set (EN or SI) per page

---

## Responsive breakpoints (all screens)

| Breakpoint | Width | Priority personas |
| --- | --- | --- |
| Mobile (small) | 360px | Operator |
| Mobile (large) | 430px | Operator, Supervisor |
| Tablet | 768px | Supervisor, QA |
| Desktop (small) | 1024px | QA, Admin, Auditor |
| Desktop (large) | 1440px | Management |

See [RESPONSIVE_SCREEN_MATRIX.md](RESPONSIVE_SCREEN_MATRIX.md) for screen-by-breakpoint mapping.

---

## Open decisions summary

This specification includes **67 open decisions** (D-01C-001 through D-01C-067) requiring owner, policy, or evidence resolution before implementation. See [PHASE_01C_DECISIONS.md](PHASE_01C_DECISIONS.md) for decision register.

---

## Next steps

1. Review this specification with business owner and QA.
2. Resolve open decisions (policy, evidence, owner approval required).
3. Build high-fidelity screens in Figma per this specification.
4. Complete Phase 01B conditions (variables, component sets, a11y annotations).
5. Phase 01C exit: design approval, not implementation start.

---

**Document status:** Draft pending owner review  
**Approval required before:** Figma high-fidelity build completion  
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
