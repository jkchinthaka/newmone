# UAT Master Execution — Feature Freeze

**Classification:** FORMAL UAT PACKAGE — HUMAN EXECUTION REQUIRED  
**Feature freeze:** Yes — no speculative development; defect fixes only after recorded UAT defects  
**Do not invent PASS / FAIL / signatures**

## Baseline control

| Field | Value |
| --- | --- |
| Repository | `C:\Projects\nelna-fg-digital-recording-system` |
| Branch | `main` |
| **UAT_BASELINE_SHA** (application under test) | `c08ebec96b8551209bc2228866ceb2fb65031668` |
| UAT evidence package docs commit | `4121e5834988c27f42d1efa1662781b4098dab4a` (docs only; no application code change) |
| Environment classification | **TECHNICAL UAT DRY RUN** until named business testers and company-approved UAT data are assigned |
| Formal business UAT | **NOT STARTED** — requires named Recorder / Supervisor / QA / Business Owner |

Every executed case must record `Tested SHA: <full git SHA>`.  
If code changes after a defect fix, retest against the new SHA; keep old evidence tied to the old SHA.

## Shared human fields (leave blank until performed)

| Actual Result | |
| Pass / Fail | |
| Tester | |
| Date | |
| Evidence reference | |
| Defect ID | |
| Retest result | |
| Sign-off | |

---

## UAT-01 — Login / RBAC

| Field | Content |
| --- | --- |
| UAT ID | UAT-01 |
| Module | Accounts / Access control |
| Business purpose | Confirm users only perform authorized actions |
| Role | Recorder, Supervisor/Checker, QA/Verifier, Admin; unauthorized user |
| Preconditions | Named users exist; org assignments known; no shared accounts |
| Test data | Valid employee codes; invalid password; direct URLs to restricted modules |
| Steps | 1) Valid login 2) Invalid login 3) Logout 4) Permission-aware nav 5) Direct URL to unauthorized module 6) Role boundary checks |
| Expected Result | Authorized access only; unauthorized denied; no permission bypass via URL |
| Evidence folder | `evidence/UAT-01/` |
| Tested SHA | `c08ebec96b8551209bc2228866ceb2fb65031668` |
| Actual Result | Recorder login successful. Dashboard and Daily Records accessible. Invalid password rejected safely. Logout worked. Recorder could not access unauthorized Supervisor/QA areas. Supervisor could access Supervisor Review. QA could access QA Review. Direct URL authorization behaved correctly. |
| Pass / Fail | **PASS** (human tester confirmed) |
| Tester | Chinthaka Jayaweera |
| Date | 2026-08-12 |
| Evidence reference | None / screenshots captured if applicable |
| Defect ID | None |
| Retest result | |
| Sign-off | |
| Status | EXECUTED — PASS (human) |

---

## UAT-02 — NMS/PPU/CL/24 Daily Cleaning

| Field | Content |
| --- | --- |
| UAT ID | UAT-02 |
| Module | Daily Records / Cleaning |
| Business purpose | Digitize Daily Cleaning Verification with Acceptable/Unacceptable |
| Role | Recorder → Checker → Verifier |
| Preconditions | CL/24 SOURCE RECEIVED published; recorder authorized |
| Test data | Finish Good: Wall, Floor, Drainage, Foot Bath, WM1, WM2, CR1, CR2; Changing Room: Wall, Floor, Locker; at least one Unacceptable + Correction/CA |
| Steps | Open form → enter Acceptable/Unacceptable → Save Draft → confirm autosave → Submit → Checker → Verifier |
| Expected Result | Labels Acceptable/Unacceptable; draft/submit work; **no automatic NCR/CAPA** unless approved rule exists (none claimed) |
| Evidence folder | `evidence/UAT-02/` |
| Tested SHA | `c08ebec96b8551209bc2228866ceb2fb65031668` |
| Actual Result | CL/24 Daily Cleaning record opened successfully. All Finish Good and Changing Room items available. Choice labels displayed Acceptable / Unacceptable correctly. At least one item recorded as Unacceptable. Correction and Corrective Action entered successfully. Save Draft worked and values remained after reopen/refresh. Checklist submission completed successfully. No automatic NCR/CAPA created solely from Unacceptable. |
| Pass / Fail | **PASS** (human tester confirmed) |
| Tester | Chinthaka Jayaweera |
| Date | 2026-08-12 |
| Evidence reference | None |
| Defect ID | None |
| Retest result | |
| Sign-off | |
| Status | EXECUTED — PASS (human) |

---

## UAT-03 — NMS/PPU/CL/39 Cold Room Temperature

| Field | Content |
| --- | --- |
| UAT ID | UAT-03 |
| Module | Daily Records / Cold room |
| Business purpose | Record product temperatures Inside Cold Room |
| Role | Recorder → Checker → Verifier |
| Preconditions | CL/39 published; CR1 and CR2 available |
| Test data | Up / Middle / Down per configured slot; decimal °C; one in-target; one out-of-target; invalid numeric; remarks |
| Steps | Open CR1 and CR2 → enter slots → submit → review warnings |
| Expected Result | Source target presentation **−15°C to −18°C** informational; out-of-target does **not** auto HOLD/REJECT; schedule slot labels remain as published (business confirmation still open for schedule ambiguity) |
| Evidence folder | `evidence/UAT-03/` |
| Tested SHA | `c08ebec96b8551209bc2228866ceb2fb65031668` |
| Actual Result | CL/39 Cold Room CR1 opened successfully. Target band -15°C to -18°C displayed correctly. In-target and out-of-target decimal temperatures entered correctly. Invalid numeric input rejected safely. Remarks, Save Draft, reopen/refresh, and Submit worked correctly. Saved values remained after reopen. No automatic HOLD, REJECT, or NCR from out-of-target reading. CR2 opened successfully and accepted a valid test reading. Schedule slot labels displayed as configured and were not reinterpreted. |
| Pass / Fail | **PASS** (human tester confirmed) |
| Tester | Chinthaka Jayaweera |
| Date | 2026-08-12 |
| Evidence reference | None |
| Defect ID | None |
| Retest result | |
| Sign-off | |
| Status | EXECUTED — PASS (human) |

---

## UAT-04 — NMS/PPU/CL/30 Freezer Truck Inspection

| Field | Content |
| --- | --- |
| UAT ID | UAT-04 |
| Module | Daily Records / Truck inspection |
| Business purpose | Inspection Record for Freezer Truck |
| Role | Recorder → Checker → Verifier |
| Preconditions | CL/30 published |
| Test data | Date, Time, Vehicle, Cleanliness, Pellets, Floor, Side wall, Curtains, Door lock, Insects/signs; PASS and FAIL cases; Corrective Action on FAIL |
| Steps | Complete form → mark FAIL on at least one item → CA → Submit → check/verify |
| Expected Result | PASS/FAIL visually obvious; **no automatic dispatch block** unless approved rule exists |
| Evidence folder | `evidence/UAT-04/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-05 — NMS/PPU/CL/18 Product Dispatch

| Field | Content |
| --- | --- |
| UAT ID | UAT-05 |
| Module | Daily Records / Dispatch |
| Business purpose | Product Dispatch Record with ten temperature samples |
| Role | Recorder → Checker → Verifier |
| Preconditions | CL/18 published |
| Test data | Vehicle, GIN, cleanliness, pellets/curtains, T01–T10, remarks/correction/CA |
| Steps | Open form → confirm labels → enter ten temps → submit |
| Expected Result | Screen labels **PASS / FAIL** (not Yes/No); ten samples available; range **−15°C to −20°C** informational only; note source mismatch: procedure = ten samples vs legacy header 1–5 |
| Evidence folder | `evidence/UAT-05/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-06 — Save / Submit / Duplicate prevention

| Field | Content |
| --- | --- |
| UAT ID | UAT-06 |
| Module | Recording |
| Business purpose | Prevent accidental duplicate daily identities and duplicate submits |
| Role | Recorder |
| Preconditions | Controlled daily form for a known date |
| Test data | Same form/date reopen; repeated Save; double Submit; refresh |
| Steps | Save Draft → repeat Save → refresh → reopen → Submit → repeated Submit → reopen same day |
| Expected Result | No accidental duplicates; safe idempotent submit; no silent data loss |
| Evidence folder | `evidence/UAT-06/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-07 — Supervisor Approve

| Field | Content |
| --- | --- |
| UAT ID | UAT-07 |
| Module | Reviews |
| Business purpose | Immutable supervisor approval of submitted snapshot |
| Role | Supervisor |
| Preconditions | Submitted record awaiting check |
| Test data | Known submission with saved answers |
| Steps | Recorder submit → Supervisor queue → Open → Review snapshot → Approve (confirm) |
| Expected Result | Snapshot/actors/timestamps shown; decision stored; audit created; unauthorized cannot approve |
| Evidence folder | `evidence/UAT-07/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-08 — Supervisor Return / Correction / Resubmit

| Field | Content |
| --- | --- |
| UAT ID | UAT-08 |
| Module | Reviews / Corrections |
| Business purpose | Return path preserves history |
| Role | Supervisor + Recorder |
| Preconditions | Submitted record |
| Test data | Return note; corrected answer |
| Steps | Return → Recorder opens returned → Correction → Resubmit → Supervisor reviews new submission |
| Expected Result | Original submission retained; correction history exists; return reason visible; new submission number |
| Evidence folder | `evidence/UAT-08/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-09 — QA RELEASE / HOLD / REJECT

| Field | Content |
| --- | --- |
| UAT ID | UAT-09 |
| Module | Quality |
| Business purpose | Manual QA dispositions without ERP side effects |
| Role | QA |
| Preconditions | Separate supervisor-approved submissions for each disposition |
| Test data | Three submissions (or equivalent isolated scenarios) |
| Steps | QA queue → RELEASE one; HOLD one; REJECT one (each with confirmation) |
| Expected Result | Confirmation required; unauthorized denied; audit actor/time; no Bileeta/ERP action; no URL state skip |
| Evidence folder | `evidence/UAT-09/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-10 — NCR / RCA / CAPA

| Field | Content |
| --- | --- |
| UAT ID | UAT-10 |
| Module | Nonconformance / RCA / CAPA |
| Business purpose | Human-controlled quality case workflow |
| Role | Quality users with manage/confirm permissions |
| Preconditions | Authorized NCR/RCA/CAPA users (demo roles may lack RCA — use approved UAT accounts) |
| Test data | Owner-supplied codes only; evidence citations; no invented thresholds |
| Steps | NCR as permitted → RCA create → 5 Why/cause/evidence → support → human confirm → CAPA link → close; verify closed immutable; duplicate RCA code handled |
| Expected Result | Evidence + human confirm required; closed RCA not editable; duplicate code controlled validation |
| Evidence folder | `evidence/UAT-10/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-11 — History / Search / Filters

| Field | Content |
| --- | --- |
| UAT ID | UAT-11 |
| Module | Daily Records history |
| Business purpose | Find stored records safely |
| Role | Authorized recorder/reporting user |
| Preconditions | Stored records exist |
| Test data | Valid filters; invalid `date=xyz`, `month=abcd`, `date_from=invalid` |
| Steps | Apply each filter; try malformed inputs |
| Expected Result | Valid filters work; malformed inputs controlled validation (no 500) |
| Evidence folder | `evidence/UAT-11/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-12 — Printing (HIGH PRIORITY)

| Field | Content |
| --- | --- |
| UAT ID | UAT-12 |
| Module | Print / A4 controlled record |
| Business purpose | Professional A4 print distinct from screen UX |
| Role | Recorder / Supervisor / QA as authorized |
| Preconditions | Populated submitted records for CL/24, /39, /30, /18 |
| Test data | Actual saved answers; monthly packs |
| Steps | Browser Print Preview for daily + monthly packs for all four forms |
| Expected Result | Saved answers present; form code/rev; actors; no sidebar; A4; no clipping; B&W readable; no blank accidental pages |
| Evidence folder | `evidence/UAT-12/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-13 — CSV / Export

| Field | Content |
| --- | --- |
| UAT ID | UAT-13 |
| Module | Daily Records export |
| Business purpose | Authorized CSV export of history |
| Role | Authorized user |
| Preconditions | History filters known |
| Test data | Same filters as history; large result set if available |
| Steps | Export CSV; open in spreadsheet; check org scope and formula safety |
| Expected Result | Valid CSV; no cross-org rows; formula injection protected; **2000-row limit labeled** when truncated |
| Evidence folder | `evidence/UAT-13/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-14 — Tablet / Mobile

| Field | Content |
| --- | --- |
| UAT ID | UAT-14 |
| Module | Responsive UI |
| Business purpose | Usable on floor tablets |
| Role | Recorder / Supervisor / QA |
| Preconditions | Browser emulation or real device |
| Test data | Viewports 1024×768, 768px, ~390px |
| Steps | Exercise Daily Records, forms, Supervisor, QA |
| Expected Result | No whole-page horizontal overflow; usable PASS/FAIL and numeric; sticky actions; menus usable |
| Evidence folder | `evidence/UAT-14/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-15 — Accessibility / Sinhala

| Field | Content |
| --- | --- |
| UAT ID | UAT-15 |
| Module | Accessibility / i18n |
| Business purpose | Operator usability including Sinhala where present |
| Role | Recorder |
| Preconditions | Intended device/browser for Sinhala |
| Test data | Keyboard, zoom, contrast, touch |
| Steps | Keyboard nav; focus; labels; zoom; Sinhala rendering on real intended device if available |
| Expected Result | Usable keyboard/focus/labels; Sinhala debt remains open until real device evidence |
| Evidence folder | `evidence/UAT-15/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-16 — Network interruption

| Field | Content |
| --- | --- |
| UAT ID | UAT-16 |
| Module | Recording resilience |
| Business purpose | Truthful failure handling (online-only MVP) |
| Role | Recorder |
| Preconditions | Draft open |
| Test data | Temporary network loss |
| Steps | Disable network during draft/autosave/submit; restore; retry |
| Expected Result | Truthful error; no silent data loss; **no claim of full offline mode** |
| Evidence folder | `evidence/UAT-16/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-17 — Audit trail

| Field | Content |
| --- | --- |
| UAT ID | UAT-17 |
| Module | Security audit / history |
| Business purpose | Reconstruct who did what |
| Role | Admin / QA |
| Preconditions | End-to-end record with submit + supervisor + QA |
| Test data | Known record IDs |
| Steps | Inspect actors/timestamps/correction/supervisor/QA/RCA-CAPA links |
| Expected Result | Historical snapshots intact; authenticated actors |
| Evidence folder | `evidence/UAT-17/` |
| Status | AWAITING HUMAN UAT |

---

## UAT-18 — Cross-org security

| Field | Content |
| --- | --- |
| UAT ID | UAT-18 |
| Module | Multi-tenant isolation |
| Business purpose | Org A cannot access Org B |
| Role | Users in two organizations |
| Preconditions | Safe Org A / Org B test users and records |
| Test data | Cross-org IDs for view/print/export/review/disposition/RCA |
| Steps | Attempt each cross-org access path |
| Expected Result | Denied for view/print/export/review/disposition/mutate |
| Evidence folder | `evidence/UAT-18/` |
| Status | AWAITING HUMAN UAT |

---

## Execution roll-up

| UAT ID | Status |
| --- | --- |
| UAT-01 | EXECUTED — PASS (human: Chinthaka Jayaweera, 2026-08-12) |
| UAT-02 | EXECUTED — PASS (human: Chinthaka Jayaweera, 2026-08-12) |
| UAT-03 | EXECUTED — PASS (human: Chinthaka Jayaweera, 2026-08-12) |
| UAT-04 … UAT-18 | AWAITING HUMAN UAT |

Related: `UAT_DEFECT_REGISTER.md`, `UAT_SIGNOFF.md`, existing Phase 20 package in this folder (not overwritten).
