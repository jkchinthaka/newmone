# API Response & Replication Data Classification Policy

**Status:** Implemented in code as of enterprise hardening Phase 1  
**Code:** `apps/api/src/common/selects/public-user.select.ts`, `apps/api/src/common/utils/sensitive-data-redaction.util.ts`, `apps/api/src/database/replication-classification.ts`

## Public API responses

API-facing Prisma `User` relations must use one of:

| Select | Use |
|--------|-----|
| `PUBLIC_USER_SUMMARY_SELECT` | Nested assignee / cleaner / creator identity |
| `PUBLIC_USER_SELECT` | Profile fields without role object |
| `PUBLIC_USER_WITH_ROLE_SELECT` | Driver / member lists needing role label |

Forbidden in responses unless an explicit security-admin endpoint documents the need:

`passwordHash`, `password`, `refreshToken`, `accessToken`, `tokenHash`, `resetToken`, `temporaryPassword`, `temporaryPasswordExpiresAt`, `failedLoginAttempts`, `lockedUntil`, `apiKey`, `apiSecret`, `clientSecret`, `smtpPass`

Automated regression: `apps/api/test/sensitive-data-hardening.spec.ts` (`containsUnredactedSecrets`).

## Audit logs

Prisma audit middleware redacts sensitive keys recursively before writing `beforeData` / `afterData`.  
Security-only models skipped entirely: `RefreshToken`, `PasswordResetToken`, `Session`, `UserInvitation`.

## Replication classification

| Model | Class | Decision |
|-------|-------|----------|
| User | REPLICABLE_WITH_REDACTION | Profile syncs; `passwordHash` and lockout fields omitted from outbox. Backup create without hash is skipped; updates never clobber existing backup hashes with redacted placeholders. Full credential DR requires encrypted field sync (operator: introduce `REPLICATION_FIELD_ENCRYPTION_KEY`) or primary restore. |
| RefreshToken | NEVER_REPLICATE | Session material stays on primary; logout/revoke uses primary. |
| PasswordResetToken | NEVER_REPLICATE | Reset tokens are short-lived; do not copy to backup. |
| UserInvitation / TenantInvitation | METADATA_ONLY | Status/email/expiry only; token hashes omitted. |
| AppSetting | REPLICABLE_WITH_REDACTION | `value` omitted (may contain provider secrets). |
| AuditLog | REPLICABLE_WITH_REDACTION | JSON columns re-scrubbed; prefer primary as forensic source of truth. |
| ReplicationOutbox / OutboxEvent / MongoSyncResume / Usage* | NEVER_REPLICATE | Plumbing / high-volume noise. |
| All other domain models | FULLY_REPLICABLE | Default business data. |

## Operator follow-ups

1. Add field-level encryption for User credential DR if backup must support standalone auth failover.
2. Review AppSetting keys; migrate secrets out of `value` JSON into a secrets manager.
3. After deploy, sample AuditLog and ReplicationOutbox rows in staging to confirm no plaintext hashes.
