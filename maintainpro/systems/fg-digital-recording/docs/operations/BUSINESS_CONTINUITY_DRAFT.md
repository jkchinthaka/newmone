# Business Continuity Draft

**Document status:** DRAFT — requires QA approval before operational use
**Phase:** 00 — Discovery and governance
**Last updated:** 2026-08-09
**Related:** [CONTINUITY_AND_HANDOVER_PLAN.md](CONTINUITY_AND_HANDOVER_PLAN.md) (engineering/handover continuity; not a legal opinion)

This draft outlines expected factory fallback continuity behaviors. It is **not** an approved SOP.

## System outage

If the digital system is unavailable, authorized personnel declare fallback to emergency paper forms for in-scope recording. Digital tasks are suspended until service returns or partial capability is confirmed.

## Power outage

Follow site power-outage procedures. If devices and network are unavailable, use emergency paper forms. Do not invent offline digital workarounds outside approved offline features.

## Network outage

For MVP (online-only), treat sustained network loss as a fallback-to-paper condition. Future offline PWA capability may reduce this impact only after Phase 14 controls and QA approval.

## Emergency paper forms

Keep controlled paper forms available for the in-scope checklist types. Form versions must match the currently approved content owners designate.

## Authority to declare fallback

Named roles authorized to declare fallback and return-to-digital must be confirmed by QA (**OWNER REQUIRED**). Until confirmed, do not assume names.

## Retrospective data entry

When digital service returns, paper records created during fallback may be entered retrospectively **only** under an approved procedure.

## Retrospective-entry flag

Every retrospectively entered digital record must be clearly flagged as retrospective, with reference to the paper original (identifier/date) as required by QA.

## QA verification

QA verifies retrospective entries according to the approved procedure (sampling or 100% — **DECISION REQUIRED**).

## Reconciliation

Reconcile paper log counts with digital retrospective entries before declaring the fallback closed.

## Return to digital operation

Return-to-digital requires confirmation that core services (app, database, auth, evidence storage as needed) are healthy and that users are notified.

## Approval

| Item | Role | Status |
| --- | --- | --- |
| BC draft acceptance | QA owner | Pending |
| Fallback authority list | QA / Operations | OWNER REQUIRED |
| Retrospective procedure | QA owner | Pending |

**Do not treat this document as approved for factory use.**
