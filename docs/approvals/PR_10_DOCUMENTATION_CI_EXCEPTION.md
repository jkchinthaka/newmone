# PR #10 Documentation-Only CI Exception

**Document status:** Approved — one-time documentation-only CI exception
**Created:** 2026-08-07
**Updated:** 2026-08-07

This record is an **owner risk-acceptance** decision. It is **not** a CI success result and does **not** create retroactive GitHub Actions evidence.

## Identification

| Field | Entry |
| --- | --- |
| Title | PR #10 Documentation-Only CI Exception |
| Repository | jkchinthaka/nelna-fg-digital-recording-system |
| Pull request | #10 |
| Branch | `docs/phase-04-scope-reconciliation` |
| Exact reviewed head SHA | `b1c3f18` |
| Base branch | `main` |
| Owner | Chinthaka Jayaweera |
| Decision date | 2026-08-07 |
| Decision | **APPROVED — ONE-TIME DOCUMENTATION-ONLY CI EXCEPTION** |

### Commit identity note

| Commit | Role |
| --- | --- |
| `3251c5c` | Documentation reconciliation implementation |
| `b1c3f18` | Owner approval baseline for Phase 04 scope reconciliation; **exact reviewed PR head when this exception was decided** |
| Exception commit (this record and index updates) | Documentation-only exception paperwork; **does not introduce code or runtime changes** |

Recording this exception on the branch **changes the PR head after `b1c3f18`**. Final merge verification must inspect the **new latest head**, confirm `b1c3f18` remains an ancestor, and confirm that changes after `b1c3f18` are documentation-only exception records.

## CI status

- No GitHub Actions checks were reported for PR #10 head `b1c3f18`.
- The missing check is **not** treated as passed.
- This exception does **not** create retroactive CI evidence.
- Local validation is **not** described as a substitute GitHub Actions result.
- The exception is an owner risk-acceptance decision, **not** a CI success result.

## Reason for exception

- PR #10 is limited to documentation reconciliation and approval records.
- Independent review confirmed that no application, configuration, dependency, workflow, template, static, migration, or test code changes exist in the reviewed documentation diff.
- Independent review passed with no blocking or major findings.
- Owner approval with conditions is already present (`PHASE_04_SCOPE_RECONCILIATION_APPROVAL.md`).
- Required GitHub Actions evidence remains unavailable for the exact reviewed head `b1c3f18`.

No unsupported claim is made about the root cause of the missing CI beyond the observed fact that checks were not reported for that head.

## Scope of exception

The exception applies only to:

- PR #10
- Commit `b1c3f18` as the reviewed documentation implementation and owner-approval baseline
- The currently reviewed documentation-only diff through `b1c3f18`
- The subsequent documentation-only exception commit that records this decision

The exception becomes **invalid** when:

- A new commit is pushed that is not limited to this exception documentation
- The PR head SHA changes in a way that adds non-documentation content
- A non-documentation file is added or modified
- The base branch changes materially
- A merge conflict changes the effective diff
- Approval conditions are modified

Any new non-exception commit requires a new merge-gate decision.

## Owner acceptance

The owner, **Chinthaka Jayaweera**, explicitly accepts merging PR #10 without GitHub Actions evidence for `b1c3f18` because:

- The PR is documentation only
- Independent review passed
- No code or runtime behavior changes are introduced by the reviewed content or this exception record
- No deployment occurs
- Missing CI is not represented as passed
- The exception is restricted to PR #10 and the `b1c3f18` baseline (plus this documentation-only exception commit)

## Conditions

1. PR #10 must remain documentation only.
2. The reviewed implementation and owner-approval baseline remains exactly `b1c3f18`; final merge verification must confirm `b1c3f18` is still an ancestor of the PR head.
3. Independent review and owner approval records must remain present.
4. ASM-004, ASM-005, and ASM-006 remain unresolved implementation gates.
5. No Shift implementation is authorized.
6. No FG product, checklist, recording, review, or evidence implementation is authorized.
7. DEBT-01C-R-NOTO remains open.
8. Sinhala operator UI approval and Sinhala UAT remain deferred.
9. No pilot, deployment, or production authorization is granted.
10. Missing GitHub Actions evidence must never be reported as passed.
11. Any new commit that is not limited to this exception documentation invalidates this exception and requires a new merge-gate decision.
12. Final merge verification must confirm the latest PR head and that changes after `b1c3f18` are documentation-only exception records.

## Authorization

This exception authorizes PR #10 to proceed to final merge verification and merge only when all non-CI merge gates remain satisfied.

It does **not** authorize:

- Application implementation
- Shift implementation
- FG workflow implementation
- Deployment
- Production use
- Bypassing CI on future PRs
- Reusing this exception for another commit or pull request

## Signature

| Field | Entry |
| --- | --- |
| Owner name | Chinthaka Jayaweera |
| Role | Project Owner |
| Date | 2026-08-07 |
| Signature | Approved — one-time documentation-only CI exception for PR #10 / `b1c3f18` |

## Related

- [PHASE_04_SCOPE_RECONCILIATION_APPROVAL.md](PHASE_04_SCOPE_RECONCILIATION_APPROVAL.md)
- PR #10: https://github.com/jkchinthaka/nelna-fg-digital-recording-system/pull/10
