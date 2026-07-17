/**
 * Replication data classification for dual-database outbox sync.
 *
 * Decision summary (see docs/audits/api-response-data-classification.md):
 * - FULLY_REPLICABLE: all scalars may sync to backup
 * - REPLICABLE_WITH_REDACTION: sync with sensitive fields redacted / hashed
 * - METADATA_ONLY: sync id + non-secret operational metadata only
 * - NEVER_REPLICATE: do not enqueue outbox events (auth recovery uses primary)
 */

export enum ReplicationClass {
  FULLY_REPLICABLE = "FULLY_REPLICABLE",
  REPLICABLE_WITH_REDACTION = "REPLICABLE_WITH_REDACTION",
  METADATA_ONLY = "METADATA_ONLY",
  NEVER_REPLICATE = "NEVER_REPLICATE"
}

export const REPLICATION_MODEL_CLASSIFICATION: Record<string, ReplicationClass> = {
  // Auth / credentials — never put live secrets on the backup outbox wire unprotected
  RefreshToken: ReplicationClass.NEVER_REPLICATE,
  PasswordResetToken: ReplicationClass.NEVER_REPLICATE,
  Session: ReplicationClass.NEVER_REPLICATE,
  UserInvitation: ReplicationClass.METADATA_ONLY,
  TenantInvitation: ReplicationClass.METADATA_ONLY,

  // User accounts: replicate profile for DR, redact credential material
  User: ReplicationClass.REPLICABLE_WITH_REDACTION,

  // Settings / provider config may contain API keys in JSON values
  AppSetting: ReplicationClass.REPLICABLE_WITH_REDACTION,

  // Audit logs: replicate for forensics after redaction (secrets already scrubbed at write time)
  AuditLog: ReplicationClass.REPLICABLE_WITH_REDACTION,

  // Internal plumbing
  ReplicationOutbox: ReplicationClass.NEVER_REPLICATE,
  OutboxEvent: ReplicationClass.NEVER_REPLICATE,
  MongoSyncResume: ReplicationClass.NEVER_REPLICATE,
  UsageEvent: ReplicationClass.NEVER_REPLICATE,
  UsageMetric: ReplicationClass.NEVER_REPLICATE
};

/** Fields stripped or replaced when classifying as REPLICABLE_WITH_REDACTION / METADATA_ONLY. */
export const REPLICATION_REDACT_FIELDS: Record<string, string[]> = {
  User: [
    "passwordHash",
    "failedLoginAttempts",
    "lockedUntil",
    "temporaryPasswordExpiresAt"
  ],
  AppSetting: ["value"],
  AuditLog: ["beforeData", "afterData", "metadata"],
  UserInvitation: ["tokenHash"],
  TenantInvitation: ["token"]
};

/** Metadata-only allowlists (id always required). */
export const REPLICATION_METADATA_FIELDS: Record<string, string[]> = {
  UserInvitation: [
    "id",
    "tenantId",
    "userId",
    "status",
    "expiresAt",
    "acceptedAt",
    "invitedById",
    "lastInvitationSentAt",
    "createdAt",
    "updatedAt"
  ],
  TenantInvitation: [
    "id",
    "tenantId",
    "email",
    "firstName",
    "lastName",
    "membershipRole",
    "status",
    "expiresAt",
    "acceptedAt",
    "invitedById",
    "createdAt",
    "updatedAt"
  ]
};

export function getReplicationClass(modelName: string): ReplicationClass {
  return REPLICATION_MODEL_CLASSIFICATION[modelName] ?? ReplicationClass.FULLY_REPLICABLE;
}

export function shouldEnqueueReplication(modelName: string): boolean {
  return getReplicationClass(modelName) !== ReplicationClass.NEVER_REPLICATE;
}
