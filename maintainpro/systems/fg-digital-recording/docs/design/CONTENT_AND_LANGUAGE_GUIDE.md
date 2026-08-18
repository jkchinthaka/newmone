# Content and Language Guide

**Document status:** Proposed writing rules — final Sinhala regulatory terms need stakeholder review  
**Phase:** 01A  
**Last updated:** 2026-08-04

## Principles

- Operator-facing UI: **Sinhala-first** labels and instructions.
- Administration and many technical terms: **English** acceptable; confirm mix [DECISION REQUIRED] ASM-008.
- Do **not** invent final Sinhala translations for technical or regulatory terms without stakeholder review.
- Do not invent temperature limits, CCP names, or form titles — use placeholders like `[Template name — EVIDENCE REQUIRED]`.

## Sinhala-first operator labels

| UI element | Approach |
| --- | --- |
| Primary nav, buttons, task states | Sinhala label required in MVP designs |
| Optional bilingual | Secondary English in smaller text only if owners approve |
| Layout | Allow +30–40% string growth vs English [ASSUMPTION] |

Placeholder pattern in Figma: `SI: [pending translation]` + `EN: Tasks` until approved glossary exists.

## English administration terminology

Prefer stable English for: User, Role, Scope, Template version, Audit event, Integration, Environment. Provide Sinhala later if required by policy.

## Translation-key strategy

Proposed key shape: `domain.screen.element`  
Examples: `operator.tasks.title`, `auth.login.error_generic`, `sync.state.saved_on_device`

- Keys are English identifiers; values localized.
- Never hard-code severity or limit numbers into translation strings without evidence IDs.

## Plain-language writing rules

- One idea per sentence on operator screens.
- Prefer verbs: Submit, Retry, Return, Verify.
- Avoid blame; describe next action.
- No jargon without plain gloss on first use.

## Error-message rules

- Say what happened + what to do.
- Auth: generic invalid credentials (no enumeration).
- Prefer: “Not saved on server. Check connection and retry.”
- Avoid: “Submitted locally.”

## Success-message rules

- Reserve “Saved on server” / “Submitted” for server ACK only.
- Include record reference when available.

## Offline / sync terminology (mandatory)

| State | Preferred EN (SI TBD) |
| --- | --- |
| Offline but working | Offline — working on this device |
| Saved on this device | Saved on this device |
| Waiting to sync | Waiting to sync |
| Syncing | Syncing… |
| Evidence uploading | Uploading evidence… |
| Sync failed | Sync failed — not on server |
| Conflict | Sync conflict — review needed |
| Synchronized | Synchronized / Saved on server |

**Prohibited:** Calling any pre-ACK state “Submitted”.

## Critical-warning terminology

- Use explicit words: **Critical**, **Hold**, **LOADING BLOCKED** (loading phase).
- Pair with icon + text + non-colour pattern.
- Do not soften critical failures (“Please review when convenient”).

## Date / time / number formats

| Item | Proposed | Status |
| --- | --- | --- |
| Date | ISO display `YYYY-MM-DD` or locale SI format | [DECISION REQUIRED] |
| Time | 24-hour with timezone label | [DECISION REQUIRED] |
| Numbers | Locale-aware; decimal separator confirmed | [DECISION REQUIRED] |

## Temperature display

- Show value + unit from template configuration only.
- Never hard-code example limits as if Nelna-approved.
- Out-of-limit styling only when rule evidence exists.

## Confirmation and attestation wording

- Attestation text [OWNER REQUIRED] from QA.
- Confirm destructive/irreversible actions with explicit verb repeat (“Verify record”, not only “OK”).

## Prohibited ambiguous terms

| Avoid | Prefer |
| --- | --- |
| Done (ambiguous) | Saved on server / Synced / Verified |
| Failed (without subject) | Item failed / Sync failed / Login failed |
| OK status alone | Pass / Acceptable + icon |
| Compliant / Certified (software claim) | Record retrieved / Export ready |
| AI approved | (forbidden concept) |

## Glossary process

Maintain approved SI/EN glossary in later design phase after questionnaire responses; until then mark strings Pending review.
