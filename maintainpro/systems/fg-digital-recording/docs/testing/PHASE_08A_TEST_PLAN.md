# Phase 08A Test Plan — Checklist Draft Recording

**Document status:** Phase 08A technical foundation
**Created:** 2026-08-08

## Coverage

- Start recording authz (view-only / manage-only denied; record allowed; cross-org denied)
- Idempotent + concurrent start → one ChecklistRecord
- Typed responses; YES_NO / YES_NO_NA / NUMBER / TEXT / SELECT validation
- Out-of-range NUMBER accepted; partial draft with unanswered required items
- Item/option IDOR; version integrity
- UI list/editor Save Draft; CSRF rejection; no Submit/HOLD/RELEASE/REJECT
- Audit without answer values; admin no hard delete; editor query budget
- Architecture boundary allows `recording`

## Explicitly excluded

FG-QA-001 publish; submission; Supervisor/QA; automatic evaluation; ERP generation.
