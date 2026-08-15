# Low-Fidelity Wireframe Specifications

**Document status:** Text low-fidelity specs for Figma page 03 — not high-fidelity visual design  
**Phase:** 01A  
**Last updated:** 2026-08-04

No final styling, brand colours, or illustration. Use for structure, hierarchy, and behaviour only. Checklist field lists remain [EVIDENCE REQUIRED].

Shared patterns:

- **Status placement:** Top connectivity/sync chip; contextual banners below header.
- **Error placement:** Page error summary at top of main; inline under fields.
- **Primary action:** Sticky bottom on mobile; top-right or footer bar on desktop.
- **Accessibility:** Labels always visible; focus order top→main→sticky CTA; status not colour-only.

---

## AUTH-LGN — Login

```
+---------------------------+
| [App name]                |
| Connectivity: Online      |
+---------------------------+
| Employee code             |
| [________________]        |
| Password                  |
| [________________]        |
| ( ) Show password         |
|                           |
| [  Log in  ]  (primary)   |
| Forgot password?          |
| Error summary (if any)    |
+---------------------------+
```

| Aspect | Spec |
| --- | --- |
| Header | App name only; no role nav |
| Navigation | None |
| Main | Two fields + primary CTA |
| Primary | Log in |
| Secondary | Password reset link |
| Mobile | Full-width fields; CTA ≥48px |
| Tablet/Desktop | Centered narrow column |
| A11y | Associated labels; generic error text (no enumeration) |

---

## AUTH-FPC — Forced password change

Header: “Password change required”. Main: new + confirm password. Primary: Save and continue. Block app chrome until done. Desktop: same narrow form.

---

## AUTH-RST — Password reset request

Main: identifier field; Primary: Send reset link; Secondary: Back to login. Success uses generic “If an account exists…” copy.

---

## AUTH-LCK — Account locked

Main: locked icon+text; recovery instruction (contact supervisor/admin — [OWNER REQUIRED] wording). No password field.

---

## AUTH-DEN — Access denied

Main: “Access denied” + optional request ID; Secondary: Home/Logout. No sensitive resource hints.

---

## AUTH-EXP — Session expired

Main: session expired message; Primary: Log in again. Note drafts: [DECISION REQUIRED] retention.

---

## OP-HOME — Operator home

```
+---------------------------+
| Home          [Sync chip] |
+---------------------------+
| Due today: N              |
| Overdue: N   (text+icon)  |
| Critical alerts (if any)  |
| [Continue task] (if draft)|
| Recent submissions (3)    |
+---------------------------+
| Home Tasks Scan Rec More  |  <- bottom nav PROPOSED
+---------------------------+
```

Empty: “No tasks due”. Loading: skeletons. Offline: chip “Offline — working on this device” (never “submitted”).

---

## OP-TASKS — Task list

Header: Tasks + filter (Due/Overdue). List rows: title, due, status icon+text. Primary per row: Open. Empty: “No assigned tasks”. Mobile: large rows 56px+. Tablet: same list denser.

---

## OP-TASK — Task detail

Header: Back + task title. Main: template name/version, location/shift context ([EVIDENCE REQUIRED] fields), due, Start/Continue CTA. Secondary: View instructions.

---

## OP-CHK — Checklist

```
+---------------------------+
| Checklist    Progress 3/10|
| [Offline/Online chip]     |
+---------------------------+
| Item 1  [Pass] [Fail]     |
| Item 2  [Pass] [Fail]     |
| ...                       |
+---------------------------+
| [Review] sticky primary   |
+---------------------------+
```

Fail navigates/expands OP-FAIL. Minimize typing; prefer toggles/selects. Desktop: two-column item list optional.

---

## OP-FAIL — Failure details

Conditional: Reason select; Measurement + unit label (no invented limits); Severity banner (icon+text+pattern); Link to Evidence. Primary: Save failure details. Errors inline + summary.

---

## OP-EVD — Evidence capture

Main: Capture photo / Choose file; thumbnails with Uploading / Failed / Attached states. Primary: Done. Offline: “Saved on this device — waiting to sync” for pending files.

---

## OP-REV — Review before submit

Main: unanswered list; failed items summary; attestation checkbox+text ([OWNER REQUIRED] copy). Primary: Submit. Secondary: Back to checklist. Block submit if incomplete.

---

## OP-RES — Submission result

Success: “Saved on server” + record ref + View record. Failure: “Not saved on server” + Retry. **Never** success styling for local-only.

---

## OP-REC — Own record detail

Read-only snapshot; status chip; evidence thumbnails; no edit. Secondary: Back to records.

---

## OP-SYNC — Sync status (design / Later implement)

List queue items with states from Journey 6. Primary: Retry failed. Empty: “Nothing waiting to sync”.

---

## OP-MORE — More

Language (SI/EN as available), sync entry, help, logout. Desktop: account menu equivalent.

---

## SV-OVR — Supervisor overview

Cards: Pending review, Failures, Overdue (text counts + icons). CTA: Go to Review queue. Tablet: 2×2 cards. Desktop: same + side nav.

---

## SV-QUE — Review queue

Failures-first list: severity icon+label, age, operator. Filters. Empty: “No records to review”. Split view on tablet+: list | preview.

---

## SV-REV — Record review

Header: Record ID + status. Main: failed items first; evidence; full answers; history timeline. Primary: Approve. Secondary: Return for correction. SoD deny banner if illegal.

---

## SV-RET — Return for correction

Mandatory reason (select/text per policy). Primary: Confirm return. Cancel secondary.

---

## SV-TEAM — Team task view

List/filter by person or area — depth [DECISION REQUIRED]. Empty/loading/error standard.

---

## QA-OVR / QA-QUE

Analogous to supervisor with “Pending verification” framing; desktop table density allowed.

---

## QA-VER — Record verification

Desktop: left summary / centre record / right history. Actions: Verify · Reject · Hold · Request reinspection. NC action labeled **Later** if out of MVP. Immutable confirm modal.

---

## QA-HLD — Hold / reject / reinspection

Reason required; unmissable hold banner preview; confirm.

---

## AD-SHL — Administration shell

Desktop side nav (IA admin list). Content: placeholder landing “Select a module”.

---

## AD-USR / AD-ROL / AD-ORG / AD-TPL — Concepts

Table + Create/Edit drawers; scope pickers; audit note “changes are logged”. No invented org names in examples — use placeholders like “Site A (example)”.

---

## MG-KPI — KPI dashboard concept

4–6 KPI cards only ([DECISION REQUIRED] metrics). Critical alerts strip. No operational mutate.

---

## MG-ALT / MG-TRD

Alerts list; trends later with non-colour series encodings.

---

## AU-SRC — Audit search

Filters: scope, date, status, template. Results table. Read-only badge persistent.

---

## AU-PCK — Record pack

Sections: snapshot · template version · evidence · approval chain · amendments · audit events · Print/Export concept.

---

## AU-HIS — Audit event history

Filterable event table; no edit.

---

## LD-BLK — Loading blocked (Later)

```
+----------------------------------+
| !!! LOADING BLOCKED !!!          |
| icon + text + hatch pattern      |
| Failed item summary              |
| Evidence                         |
| [Approve loading] DISABLED       |
| [Request reinspection]           |
| [Request override] (future)      |
+----------------------------------+
```

No temperature numbers unless evidenced.

---

## Cross-cutting empty / loading / error

| State | Pattern |
| --- | --- |
| Empty | Illustration-free text + optional primary next action |
| Loading | Skeleton or progress; preserve layout |
| Error | Summary + recovery action; log correlation id if available |

## Responsive behaviour summary

| Screen class | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Operator | Single column, sticky CTA, bottom nav | Slightly denser | Rare; still usable |
| Queues | Stacked cards | List/detail split | Tables + detail pane |
| Admin/Audit | Not primary | Condensed | Full console |
