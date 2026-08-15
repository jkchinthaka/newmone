# Phase 09A Test Plan — Supervisor Review Foundation

## In scope

Immutable `SupervisorReview` bound to `ChecklistSubmission`; separate review permission;
eligibility queue; APPROVED / RETURNED_FOR_CORRECTION without downstream mutation;
idempotency/concurrency; audit minimization; UI CSRF/IDOR; admin read-only.

## Out of scope

FG-QA-001 publish; correction/resubmission; Submission #2; QA; HOLD/RELEASE/REJECT;
SoD self-review prohibition; automatic role mapping.
