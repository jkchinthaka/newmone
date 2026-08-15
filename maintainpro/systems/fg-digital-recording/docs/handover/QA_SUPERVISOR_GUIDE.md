# Supervisor and QA guide

Supervisor and QA decisions are authenticated actions. They are not wet signatures and they do not write to ERP.

## Supervisor (checker)

1. Open **Supervisor Review**.
2. Open a submitted record.
3. Read the frozen answers, not the live draft.
4. **Approve** or **Return for correction**.
5. Add a note when returning.

Approve means supervisor review is complete. It does **not** mean product RELEASE.

## QA (verifier)

QA is available only after Supervisor Approve.

1. Open **QA Review**.
2. Confirm the exact submission and supervisor decision.
3. Choose **RELEASE**, **HOLD**, or **REJECT** using the confirmation screen.
4. Record a note when the decision needs context.

These labels are provisional application dispositions. They do not move inventory, block dispatch automatically, or create NCR/CAPA unless a human opens those cases.

## NCR / RCA / CAPA

- Open **NCR / Holds** to create or update a formal case.
- Open **Root Cause Analysis** for structured investigation. Software cannot confirm a root cause.
- Open **CAPA** for action plan, verification, and effectiveness review notes.
- Linking RCA to CAPA is an explicit human action.

## Laboratory / HACCP

- Laboratory shows registered samples and recorded results. No invented limits.
- HACCP shows versioned plan shells and advisory control-point policy. Checklist PASS is not QA RELEASE.
