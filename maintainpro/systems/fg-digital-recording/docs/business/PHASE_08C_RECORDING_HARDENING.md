# Phase 08C — Shop-floor Checklist Recording Hardening

**Document status:** Technical foundation — production recording still BLOCKED  
**Phase:** 08C  

---

## Preserved flow

`start record` → **Save Draft** → **Submit** → immutable submission (08A/08B unchanged).

## Autosave

- Debounced client autosave posts to `recording/<id>/autosave/`
- Same validation + optimistic concurrency as manual Save Draft
- Server remains authoritative; successful autosave returns new `draft_version`

## Concurrency

- `ChecklistRecord.draft_version` optimistic token
- Clients must send `expected_draft_version`
- Mismatch → `DraftConcurrencyConflict` / HTTP 409 — **no silent last-write-wins**

## Session recovery (online)

- Session stores `recording_resume_url` for post-login return
- Browser `sessionStorage` keeps a non-authoritative recovery snapshot across navigation / temporary network / session expiry
- **Not** IndexedDB offline sync (Phase 14)

## UX

- Section progress, validation summary with jump links, sticky save bar
- Touch-sized targets, clearer required markers, error focus
- Repeating sample layout stacking

## Equipment / evidence hooks

- Optional `ChecklistResponse.equipment` when item `requires_equipment_reference`
- `evidence_hook` JSON metadata only — attachment upload remains Phase 11
- Calibration overdue block/warn remains **EVIDENCE REQUIRED**

## Security

- Org-scoped `record_checklisttask` — no cross-org draft leakage
- CSRF on autosave; XSS escaped via Django templates
- Audit metadata excludes answer values; includes `draft_version` / `save_mode`

---

## STATUS: PHASE 08C RECORDING HARDENING COMPLETE
