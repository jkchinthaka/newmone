# ADR-027 — Quality workflow notifications

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 15

## Context

Operators and reviewers need timely workflow alerts without leaking checklist answers, review notes, or other quality-sensitive content through email or future SMS.

## Decision

1. Introduce `apps.notifications` with in-app `Notification` rows (recipient, event type, title, safe_message, created_at, read_at, delivery status) plus optional `NotificationDeliveryAttempt` for async email.
2. Per-organization `OrganizationNotificationPolicy`: **all event types default OFF**; email channel defaults OFF even if SMTP exists.
3. Candidate event types (TASK_ASSIGNED, due/overdue, submission, supervisor/QA pending, correction returned, QA HOLD/REJECT, CAPA due, integration failure) are catalogues only — not auto-enabled.
4. Email uses Django SMTP settings from environment (`EMAIL_HOST`, credentials via env/secret store). No credentials in the repository. If SMTP is not configured, email attempts are skipped.
5. **SMS is not integrated** until company provider/budget approval (EVIDENCE REQUIRED).
6. Privacy: titles/messages validated to reject sensitive patterns; metadata forbids answer/note keys; email bodies state that checklist answers are excluded.
7. Idempotency: unique per-recipient `dedupe_key` for creates; unique `idempotency_key` on delivery attempts; Celery email task is retry-safe and no-ops when already DELIVERED.
8. In-app inbox lists own notifications only; only the recipient may mark read.

## Consequences

- Call sites must enable org policy before events create rows.
- Wiring producers (assignment, due, QA, CAPA) can adopt `create_in_app_notification` later without changing privacy rules.
- Production SMTP and which events to enable remain owner decisions.
