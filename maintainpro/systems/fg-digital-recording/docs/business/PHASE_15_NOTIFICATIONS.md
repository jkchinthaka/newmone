# Phase 15 - Quality Workflow Notifications

**Document status:** Technical foundation  
**Phase:** 15  
**ADR:** [ADR-027-QUALITY-WORKFLOW-NOTIFICATIONS.md](../architecture/ADR-027-QUALITY-WORKFLOW-NOTIFICATIONS.md)

## Goal

Reliable workflow notifications without leaking quality-sensitive information.

## Delivered

- In-app notifications (list + mark read)
- Optional email via configured SMTP only (env credentials; none in repo)
- SMS explicitly blocked pending provider/budget approval
- Org policy: events and email **disabled by default**
- Candidate event catalogue (assignment, due/overdue, submission, supervisor/QA pending, correction, HOLD/REJECT, CAPA due, integration failure)
- Privacy-safe title/message validation + template escaping for HTML email
- Idempotent create (`dedupe_key`) and email delivery (`idempotency_key` + retries)
- Audit events for policy update, create, read, email delivered/failed
- Tests: recipient auth, duplicates, retry/idempotent email, escaping, sensitive exclusion, SMS blocked

## Explicit non-claims

- No SMS integration
- Not all events are sent by default
- Email bodies never include full checklist answers or sensitive notes by default

## STATUS: PHASE 15 NOTIFICATIONS COMPLETE
