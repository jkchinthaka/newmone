# UAT plan — executable cases

Human testers complete **Actual**, **Pass/Fail**, **Evidence**, **Tester**, **Date**, **Defect**, and **Signoff**.  
Do not pre-fill those fields.

Shared fields for every case:

| Field | Value |
| --- | --- |
| Actual | |
| Pass/Fail | |
| Evidence | |
| Tester | |
| Date | |
| Defect | |
| Signoff | |

## UAT-01 Login / RBAC

- **Precondition:** Two named users in different organizations; one without recording permission.
- **Role:** Recorder / unauthorized user
- **Steps:** Log in; open Daily Records; log in as unauthorized user; open Daily Records and `/ncr/`.
- **Expected:** Authorized user reaches Daily Records. Unauthorized user is denied. No shared accounts.

## UAT-02 Daily Cleaning

- **Precondition:** SOURCE RECEIVED CL/24 published in the test org.
- **Role:** Recorder
- **Steps:** Open today’s cleaning; mark Acceptable/Unacceptable; enter correction on Unacceptable; Save Draft; Submit.
- **Expected:** Authenticated recorder timestamp stored. No auto NCR.

## UAT-03 Cold Room Temperature

- **Precondition:** CL/39 published.
- **Role:** Recorder
- **Steps:** Open CR1 and CR2; enter Up/Middle/Down for all three printed slots; submit.
- **Expected:** Slots remain `00:00 to 8:00`, `8:00 to 12:00`, `12:00 to 6:00`. Decimal °C stored. Out-of-range is measurement-only.

## UAT-04 Truck Inspection

- **Precondition:** CL/30 published.
- **Role:** Recorder
- **Steps:** Enter vehicle/time; mark PASS/FAIL; enter corrective action on FAIL; submit.
- **Expected:** FAIL visible. No automatic dispatch block.

## UAT-05 Product Dispatch

- **Precondition:** CL/18 published.
- **Role:** Recorder
- **Steps:** Enter vehicle/GIN; enter samples 01–10; submit.
- **Expected:** Ten samples stored. Range −15 to −20 °C is measurement-only.

## UAT-06 Correction

- **Precondition:** Submitted record returned by supervisor.
- **Role:** Recorder
- **Steps:** Open returned record; change an answer; resubmit.
- **Expected:** Original submission remains; new submission number created.

## UAT-07 Checker / Supervisor

- **Precondition:** Submitted record in queue.
- **Role:** Supervisor
- **Steps:** Open queue; approve one record; return another with a note.
- **Expected:** Decisions immutable and bound to the submission.

## UAT-08 Verifier / QA

- **Precondition:** Supervisor-approved submission.
- **Role:** QA
- **Steps:** RELEASE one; HOLD one; REJECT one using confirmation.
- **Expected:** No ERP side effect. History retained.

## UAT-09 NCR / RCA / CAPA

- **Precondition:** Users with view/manage permissions.
- **Role:** Quality
- **Steps:** Open NCR; create RCA; open CAPA; record effectiveness notes.
- **Expected:** Human-only closure. No AI final decision.

## UAT-10 Search / Reporting

- **Precondition:** Stored daily records.
- **Role:** Recorder / reporting user
- **Steps:** Filter history; export CSV; open quality trends.
- **Expected:** Pagination; CSV injection neutralized; counts match stored data.

## UAT-11 Printing

- **Precondition:** Populated submitted records.
- **Role:** Recorder
- **Steps:** Print current, monthly, and dispatch records on A4 preview.
- **Expected:** Actual answers, actors, form code/revision, no sidebar, readable in black and white.

## UAT-12 Tablet

- **Precondition:** 768px and 390px viewports.
- **Role:** Recorder
- **Steps:** Complete Daily Records on tablet/phone.
- **Expected:** Large controls; no page-level horizontal overflow.

## UAT-13 Sinhala

- **Precondition:** Sinhala operator content where present.
- **Role:** Recorder
- **Steps:** Review operator labels and Noto/system fonts on a real device.
- **Expected:** Readable Sinhala. DEBT-01C-R-NOTO stays open until device evidence exists.

## UAT-14 Network interruption

- **Precondition:** Draft open.
- **Role:** Recorder
- **Steps:** Disable network; attempt save; restore network; save again.
- **Expected:** Failed save visible. No silent offline queue. Conflict banner if another save won.

## UAT-15 Audit trail

- **Precondition:** Submit + supervisor + QA performed.
- **Role:** Admin / QA
- **Steps:** Inspect security audit events and case history.
- **Expected:** Authenticated actors and timestamps; no destroyed history.

## UAT-16 Duplicate prevention

- **Precondition:** Existing cleaning record for a date.
- **Role:** Recorder
- **Steps:** Open the same form/date again.
- **Expected:** Same daily identity reused. Correction path used for legitimate changes.

## UAT-17 Cross-org authorization

- **Precondition:** Two organizations; user scoped to org A.
- **Role:** Recorder / QA
- **Steps:** Attempt direct URL to org B record, NCR, print, and CSV.
- **Expected:** Denied. No IDOR.
