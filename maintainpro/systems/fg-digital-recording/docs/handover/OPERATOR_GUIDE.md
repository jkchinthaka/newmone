# Operator guide — Daily Records

Simple shop-floor steps. Use your own login. Never type another person’s name as recorder, checker, or verifier.

## Login

1. Open the application URL provided by IT.
2. Sign in with your employee code and password.
3. If sign-in fails, stop and ask a supervisor. Do not share accounts.

## Today’s cleaning (NMS/PPU/CL/24)

1. Open **Daily Records**.
2. Confirm the date.
3. Open **Daily Cleaning Verification**.
4. For each item choose **Acceptable** or **Unacceptable**.
5. If Unacceptable, complete Correction and Corrective Action.
6. **Save Draft** any time. **Submit** when required items are complete.

## Cold-room temperature (NMS/PPU/CL/39)

1. Open **Daily Records**.
2. Open **Cold Room 1** or **Cold Room 2**.
3. Enter Up / Middle / Down °C for each printed slot: `00:00 to 8:00`, `8:00 to 12:00`, `12:00 to 6:00`.
4. The system only compares the documented source range −15°C to −18°C. That is not QA RELEASE or HOLD.

Schedule note: the paper procedure says every 6 hours; the printed slots are not uniform six-hour ranges. Do not invent a different schedule.

## Truck inspection (NMS/PPU/CL/30)

1. Open **Inspection Record for Freezer Truck**.
2. Enter vehicle / time.
3. Mark each check **PASS** or **FAIL**.
4. FAIL should prompt Corrective Action. This does not automatically block dispatch.

## Product dispatch (NMS/PPU/CL/18)

1. Open **Product Dispatch Record**.
2. Enter vehicle and GIN in the identity/context fields.
3. Enter temperature samples 01–10.
4. Documented source range is −15°C to −20°C. Out-of-range is measurement-only, not RELEASE/HOLD/REJECT.

The paper header may show 1–5. Digital recording stores ten samples.

## Save draft / submit

- **Save Draft** keeps incomplete work.
- **Submit** freezes answers. Later changes use correction, not silent overwrite.
- Autosave uses the same server token. If another tab saved first, reload and re-enter.

## Returned for correction

1. Open the returned record from Daily Records or Checklist Recording.
2. Read the supervisor note.
3. Correct answers.
4. Resubmit. The original submission stays in history.

## Supervisor review

1. Open **Supervisor Review** (authorized checkers only).
2. Open the submitted record.
3. **Approve** or **Return** with a clear reason.
4. Returned work goes back to the recorder for correction and resubmit. Old submissions stay in history.

## QA review

1. Open **QA Review** (authorized QA only).
2. Choose **RELEASE**, **HOLD**, or **REJECT** only when the company process applies.
3. Record the reason. This is not an ERP write.

## Search / print / export

- **Record history** filters stored controlled-form records.
- **Print** opens a print sheet of saved answers (sidebar hidden).
- **Print monthly pack** reprints the selected month.
- **Export CSV** downloads the filtered history (may be capped; watch for truncation notice). Do not rename CSV to XLSX.

## Logout / support

- Use **Logout** when leaving a shared tablet.
- Escalation: supervisor → IT support (`docs/operations/SUPPORT_RUNBOOK.md`).

## If save or network fails

- Stay on the page if possible.
- Use **Save Draft** again when the network returns.
- If the conflict banner appears, reload before typing more.
- Offline writing is not supported. Do not keep working in a disconnected browser expecting later sync.

## Duplicate warning

Opening the same form/date/room reuses the existing daily identity. That is intentional. Do not create a second paper-equivalent record for the same day unless a supervisor starts a formal correction.
