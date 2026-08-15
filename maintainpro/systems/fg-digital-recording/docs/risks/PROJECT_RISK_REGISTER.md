# Project Risk Register

**Document status:** Provisional ratings — for owner review
**Phase:** 00 — Discovery and governance
**Last updated:** 2026-08-09
**Canonical current register:** [../governance/RISK_REGISTER.md](../governance/RISK_REGISTER.md) (prefer for updates; this file retains Phase 00 origin rows)

## Scoring (provisional)

Probability and impact use 1 (low) to 5 (high). Risk score = Probability × Impact. **All ratings are provisional** until owners review.

| ID | Risk | Probability | Impact | Risk score | Owner | Mitigation | Trigger | Contingency | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSK-001 | Shared accounts undermine accountability | 3 | 5 | 15 | IT / QA (TBC) | Named accounts only; policy + tests; audit | Shared login detected | Disable shared IDs; retrain; incident review | Open — provisional |
| RSK-002 | Incorrect business assumptions encoded as rules | 4 | 5 | 20 | QA / Business (TBC) | No invented data rule; assumption register; evidence gates | Unverified limit found in code/config | Quarantine feature; correct from evidence | Open — provisional |
| RSK-003 | Operator workflow slower than paper | 3 | 4 | 12 | Business / UX (TBC) | Mobile-first UX; minimize typing; time trials in UAT | Pilot cycle time worse than baseline | UX remediation sprint; reduce fields | Open — provisional |
| RSK-004 | Weak Wi-Fi in recording areas | 3 | 4 | 12 | IT (TBC) | Coverage survey; online MVP honesty; offline phase later | Repeated submit failures | Paper fallback; accelerate offline only with controls | Open — provisional |
| RSK-005 | Device failure during shift | 3 | 3 | 9 | IT / Operations (TBC) | Spare devices; PWA reinstall path | Device outage | Loaner device; paper fallback | Open — provisional |
| RSK-006 | Lost offline draft data (future offline) | 3 | 5 | 15 | IT / QA (TBC) | Deferred to Phase 14 design; durable queue; tests | Offline feature enabled without tests | Disable offline; recover from paper | Open — provisional |
| RSK-007 | Duplicate sync creating duplicate records | 3 | 5 | 15 | IT / QA (TBC) | Idempotent sync keys; server dedupe | Duplicate detections in pilot | Quarantine duplicates; amend process | Open — provisional |
| RSK-008 | ERP outage blocks recording if wrongly coupled | 2 | 5 | 10 | IT / Business (TBC) | No ERP dependency for MVP recording | Recording fails when ERP down | Remove hard dependency; continue local recording | Open — provisional |
| RSK-009 | Unapproved temperature limits configured | 4 | 5 | 20 | QA (TBC) | Evidence-required content approval | Limit without document ID | Remove config; stop affected templates | Open — provisional |
| RSK-010 | Missing audit evidence for important actions | 3 | 5 | 15 | QA / IT (TBC) | Mandatory audit events; export tests | Audit gap found | Backfill policy if possible; process CAPA | Open — provisional |
| RSK-011 | Lack of trained administrator | 3 | 4 | 12 | IT / Business (TBC) | Admin training before pilot | Admin unable to operate | Extend parallel paper; coaching | Open — provisional |
| RSK-012 | Backup restore failure | 3 | 5 | 15 | IT (TBC) | Restore tests before production claims | Failed restore drill | Block production; fix backups | Open — provisional |
| RSK-013 | Scope creep beyond approved MVP | 4 | 3 | 12 | Project owner (TBC) | Phase gates; MVP non-goals | Unplanned features in PR | Defer to roadmap phases | Open — provisional |
| RSK-014 | Surveillance concerns from evidence photos | 2 | 4 | 8 | QA / HR / Management (TBC) | Purpose limitation; access control; policy comms | Workforce concern raised | Pause photo types; policy clarification | Open — provisional |
| RSK-015 | Security incident (account takeover, data leak) | 2 | 5 | 10 | IT (TBC) | Security baseline; rate limits; reviews | Suspected incident | Incident response; revoke sessions | Open — provisional |
| RSK-016 | Vendor dependency (hosting, SMS, storage) | 3 | 3 | 9 | IT (TBC) | Prefer portable S3 APIs; document exit | Vendor outage/price shock | Alternate provider runbook | Open — provisional |
| RSK-017 | AI hallucination influencing critical decisions | 3 | 5 | 15 | QA / IT (TBC) | AI safety policy; no final AI decisions; audits | AI output treated as approval | Disable AI feature; retrain users | Open — provisional |
| RSK-018 | Solo developer dependency | 4 | 4 | 16 | Project owner (TBC) | Documentation; modular design; PR review discipline | Developer unavailable | Pause delivery; bring backup capacity | Open — provisional |

Owner review checkbox: _Not completed_.
