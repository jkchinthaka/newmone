import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { INestApplication, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient, ReplicationOperation, ReplicationOutbox } from "@prisma/client";

import { requestContext } from "../common/context/request-context";
import {
  AUDIT_SECURITY_SKIP_MODELS,
  MODEL_AUDIT_EXTRA_KEYS,
  redactSensitiveData
} from "../common/utils/sensitive-data-redaction.util";
import {
  DatabaseReplicationConfig,
  getDatabaseReplicationConfig,
  sanitizeReplicationError
} from "./replication.config";
import {
  applyReplicationEventToBackup,
  isSyncableModel,
  sanitizeRecordForModel,
  toOutboxJson
} from "./replication.utils";

/**
 * Models that must NOT be audited:
 *  - AuditLog itself (would recurse forever)
 *  - High-volume / system records where field-level history is noise
 */
const AUDIT_SKIP_MODELS = new Set<string>([
  "AuditLog",
  "RefreshToken",
  "Notification",
  "MongoSyncResume",
  "Session",
  "OutboxEvent",
  "ReplicationOutbox",
  "UsageEvent",
  "UsageMetric",
  "PasswordResetToken",
  "UserInvitation",
  ...AUDIT_SECURITY_SKIP_MODELS
]);

const REPLICATION_SKIP_MODELS = new Set<string>(["ReplicationOutbox"]);

const REPLICATION_PREFETCH_LIMIT = 1_000;
type PrismaTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: unknown;
};
type PrismaBatchTransactionOptions = {
  isolationLevel?: unknown;
};
type PrismaPromiseValue<T> = T extends Prisma.PrismaPromise<infer R> ? R : never;
type PrismaBatchTransactionResult<T extends readonly Prisma.PrismaPromise<unknown>[]> = {
  [K in keyof T]: PrismaPromiseValue<T[K]>;
};

/** Field names that change on every write but carry no business meaning. */
const NOISY_FIELDS = new Set<string>(["updatedAt", "createdAt", "id"]);

/** Maximum size of a single field's serialized value retained in the audit log. */
const MAX_FIELD_BYTES = 4_000;

const MUTATION_ACTIONS = new Set<Prisma.PrismaAction>([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany"
]);

type Json = Prisma.InputJsonValue;

interface ReplicationCandidate {
  modelName: string;
  entityId: string;
  operation: ReplicationOperation;
  payload: Record<string, unknown> | null;
  tenantId: string | null;
  actorUserId: string | null;
  correlationId: string;
}

interface ReplicationTransactionContext {
  events: ReplicationCandidate[];
}

const replicationTransactionContext = new AsyncLocalStorage<ReplicationTransactionContext>();

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function clip(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.length > MAX_FIELD_BYTES) {
    return `${value.slice(0, MAX_FIELD_BYTES)}…[truncated]`;
  }
  if (typeof value === "object") {
    const serialized = safeStringify(value);
    if (serialized.length > MAX_FIELD_BYTES) {
      return `[truncated:${serialized.length}b]`;
    }
  }
  return value;
}

function redactForAudit(model: string, record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record) return null;
  const extra = MODEL_AUDIT_EXTRA_KEYS[model] ?? [];
  return redactSensitiveData(record, {
    additionalKeys: extra,
    // Keep mustChangePassword visible as a non-secret status flag when present
    allowlist: ["mustChangePassword"]
  }) as Record<string, unknown>;
}

interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === "object" && typeof b === "object") {
    return safeStringify(a) === safeStringify(b);
  }
  return false;
}

function diffRecords(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  model?: string
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const safeBefore = model ? redactForAudit(model, before) : before;
  const safeAfter = model ? redactForAudit(model, after) : after;
  const keys = new Set<string>([
    ...Object.keys(safeBefore ?? {}),
    ...Object.keys(safeAfter ?? {})
  ]);
  for (const key of keys) {
    if (NOISY_FIELDS.has(key)) continue;
    const b = safeBefore?.[key];
    const a = safeAfter?.[key];
    if (!deepEqual(b, a)) {
      diffs.push({ field: key, before: clip(b), after: clip(a) });
    }
  }
  return diffs;
}

function extractIdFromWhere(where: unknown): string | null {
  if (!where || typeof where !== "object") return null;
  const w = where as Record<string, unknown>;
  if (typeof w.id === "string") return w.id;
  return null;
}

function camelCase(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private readonly replicationConfig: DatabaseReplicationConfig;
  private readonly backupClient: PrismaClient | null;

  constructor() {
    const replicationConfig = getDatabaseReplicationConfig();
    if (replicationConfig.primaryDatabaseUrl) {
      process.env.DATABASE_URL = replicationConfig.primaryDatabaseUrl;
      process.env.PRIMARY_DATABASE_URL = replicationConfig.primaryDatabaseUrl;
      if (!process.env.MONGODB_URI || process.env.MONGODB_URI === "${PRIMARY_DATABASE_URL}") {
        process.env.MONGODB_URI = replicationConfig.primaryDatabaseUrl;
      }
    }

    super();

    this.replicationConfig = replicationConfig;
    this.backupClient =
      replicationConfig.enabled && replicationConfig.backupDatabaseUrl
        ? new PrismaClient({
            datasources: {
              db: {
                url: replicationConfig.backupDatabaseUrl
              }
            }
          })
        : null;
  }

  async onModuleInit(): Promise<void> {
    this.installReplicationMiddleware();
    this.installAuditMiddleware();

    try {
      await this.$connect();
    } catch (error) {
      this.logger.error(
        "Database connection failed during startup; API will continue and report degraded health.",
        error instanceof Error ? error.stack : String(error)
      );
    }

    if (this.backupClient) {
      try {
        await this.backupClient.$connect();
      } catch (error) {
        this.logger.warn(
          `Backup database connection failed during startup: ${sanitizeReplicationError(error)}`
        );
      }
    }
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on("beforeExit", async () => {
      await app.close();
    });
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([this.$disconnect(), this.backupClient?.$disconnect()]);
  }

  getPrimary(): PrismaClient {
    return this;
  }

  getBackup(): PrismaClient | null {
    return this.backupClient;
  }

  getReplicationConfig(): DatabaseReplicationConfig {
    return this.replicationConfig;
  }

  isBackupConfigured(): boolean {
    return Boolean(this.backupClient);
  }

  async checkPrimary(): Promise<void> {
    await Promise.all([this.user.count(), this.tenant.count()]);
  }

  async checkBackup(): Promise<void> {
    if (!this.backupClient) {
      throw new Error("Backup database is not configured.");
    }

    await this.backupClient.$runCommandRaw({ ping: 1 });
  }

  $transaction<R>(
    fn: (prisma: Prisma.TransactionClient) => Promise<R>,
    options?: PrismaTransactionOptions
  ): Promise<R>;
  $transaction<T extends readonly Prisma.PrismaPromise<unknown>[]>(
    operations: [...T],
    options?: PrismaBatchTransactionOptions
  ): Promise<PrismaBatchTransactionResult<T>>;
  $transaction(input: unknown, options?: PrismaTransactionOptions | PrismaBatchTransactionOptions): Promise<unknown> {
    if (!this.shouldCaptureReplication()) {
      return (super.$transaction as any)(input, options);
    }

    const existingContext = replicationTransactionContext.getStore();
    if (existingContext) {
      return (super.$transaction as any)(input, options);
    }

    const context: ReplicationTransactionContext = { events: [] };

    return replicationTransactionContext.run(context, async () => {
      const result = await (super.$transaction as any)(input, options);
      await this.persistReplicationCandidates(context.events);
      return result;
    });
  }

  private shouldCaptureReplication(): boolean {
    return this.replicationConfig.enabled && this.replicationConfig.mode !== "disabled";
  }

  private installReplicationMiddleware(): void {
    if (!this.shouldCaptureReplication()) {
      return;
    }

    this.$use(async (params, next) => {
      const { model, action } = params;

      if (
        !model ||
        !MUTATION_ACTIONS.has(action) ||
        REPLICATION_SKIP_MODELS.has(model) ||
        !isSyncableModel(model)
      ) {
        return next(params);
      }

      const beforeRows = await this.readBeforeRowsForReplication(model, action, params);
      const result = await next(params);
      const candidates = await this.buildReplicationCandidates(model, action, params, beforeRows, result);
      await this.queueReplicationCandidates(candidates);

      return result;
    });
  }

  private async readBeforeRowsForReplication(
    model: string,
    action: Prisma.PrismaAction,
    params: Prisma.MiddlewareParams
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const delegate = (this as unknown as Record<string, any>)[camelCase(model)];
      const where = (params.args as { where?: unknown })?.where;

      if ((action === "update" || action === "delete" || action === "upsert") && where && delegate?.findUnique) {
        const found = await delegate.findUnique({ where });
        return found ? [found as Record<string, unknown>] : [];
      }

      if ((action === "updateMany" || action === "deleteMany") && delegate?.findMany) {
        const rows = await delegate.findMany({
          where: where ?? {},
          take: REPLICATION_PREFETCH_LIMIT
        });
        return (rows ?? []) as Array<Record<string, unknown>>;
      }
    } catch (error) {
      this.logger.warn(
        `replication pre-fetch failed for ${model}.${action}: ${sanitizeReplicationError(error)}`
      );
    }

    return [];
  }

  private async buildReplicationCandidates(
    modelName: string,
    action: Prisma.PrismaAction,
    params: Prisma.MiddlewareParams,
    beforeRows: Array<Record<string, unknown>>,
    result: unknown
  ): Promise<ReplicationCandidate[]> {
    const ctx = requestContext.get();
    const tenantIdFromContext = ctx?.tenantId ?? null;
    const actorUserId = ctx?.actorId ?? null;
    const correlationId = randomUUID();
    const createCandidate = (
      operation: ReplicationOperation,
      entityId: string,
      payload: Record<string, unknown> | null
    ): ReplicationCandidate | null => {
      if (!entityId) return null;
      return {
        modelName,
        entityId,
        operation,
        payload,
        tenantId: tenantIdFromContext ?? this.extractTenantId(payload),
        actorUserId,
        correlationId
      };
    };

    const candidates: Array<ReplicationCandidate | null> = [];

    if (action === "create") {
      const payload = await this.findCurrentReplicationPayload(modelName, result);
      const entityId = String(payload?.id ?? (result as { id?: unknown } | null)?.id ?? "");
      candidates.push(createCandidate(ReplicationOperation.CREATE, entityId, payload));
    } else if (action === "createMany") {
      const data = (params.args as { data?: unknown })?.data;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      for (const row of rows) {
        const payload = sanitizeRecordForModel(modelName, row);
        if (payload?.id && typeof payload.id === "string") {
          candidates.push(createCandidate(ReplicationOperation.CREATE, payload.id, payload));
        }
      }
    } else if (action === "update" || action === "upsert") {
      const payload = await this.findCurrentReplicationPayload(modelName, result);
      const entityId = String(
        (payload?.id as string | undefined) ??
          ((result as { id?: unknown } | null)?.id ?? extractIdFromWhere((params.args as { where?: unknown })?.where) ?? "")
      );
      candidates.push(
        createCandidate(
          action === "upsert" ? ReplicationOperation.UPSERT : ReplicationOperation.UPDATE,
          entityId,
          payload
        )
      );
    } else if (action === "updateMany") {
      for (const before of beforeRows) {
        if (typeof before.id !== "string") continue;
        const payload = await this.findCurrentReplicationPayload(modelName, before.id);
        candidates.push(createCandidate(ReplicationOperation.UPDATE, before.id, payload));
      }
    } else if (action === "delete") {
      const before = beforeRows[0] ?? null;
      const payload = sanitizeRecordForModel(modelName, before);
      const entityId = String(
        payload?.id ?? extractIdFromWhere((params.args as { where?: unknown })?.where) ?? ""
      );
      candidates.push(createCandidate(ReplicationOperation.DELETE, entityId, payload));
    } else if (action === "deleteMany") {
      for (const before of beforeRows) {
        const payload = sanitizeRecordForModel(modelName, before);
        if (payload?.id && typeof payload.id === "string") {
          candidates.push(createCandidate(ReplicationOperation.DELETE, payload.id, payload));
        }
      }
    }

    return candidates.filter((candidate): candidate is ReplicationCandidate => Boolean(candidate));
  }

  private async findCurrentReplicationPayload(
    modelName: string,
    valueOrId: unknown
  ): Promise<Record<string, unknown> | null> {
    const id = typeof valueOrId === "string" ? valueOrId : (valueOrId as { id?: unknown } | null)?.id;
    const delegate = (this as unknown as Record<string, any>)[camelCase(modelName)];

    if (typeof id === "string" && delegate?.findUnique) {
      const found = await delegate.findUnique({ where: { id } });
      const payload = sanitizeRecordForModel(modelName, found);
      if (payload) return payload;
    }

    return sanitizeRecordForModel(modelName, valueOrId);
  }

  private async queueReplicationCandidates(candidates: ReplicationCandidate[]): Promise<void> {
    if (candidates.length === 0) return;

    const context = replicationTransactionContext.getStore();
    if (context) {
      context.events.push(...candidates);
      return;
    }

    await this.persistReplicationCandidates(candidates);
  }

  private async persistReplicationCandidates(candidates: ReplicationCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const created = await this.replicationOutbox.create({
        data: {
          tenantId: candidate.tenantId,
          actorUserId: candidate.actorUserId,
          entityType: candidate.modelName,
          entityId: candidate.entityId,
          operation: candidate.operation,
          modelName: candidate.modelName,
          payload: toOutboxJson(candidate.payload),
          status: "PENDING",
          nextRetryAt: new Date(),
          sourceDatabase: "primary",
          targetDatabase: "backup",
          correlationId: candidate.correlationId
        }
      });

      if (this.replicationConfig.mode === "strict_dual_write") {
        await this.applyStrictReplication(created);
      }
    }
  }

  private async applyStrictReplication(event: ReplicationOutbox): Promise<void> {
    try {
      const backup = this.backupClient;
      if (!backup) {
        throw new Error("Backup database is not configured for strict_dual_write mode.");
      }

      await applyReplicationEventToBackup(backup, event);
      await this.replicationOutbox.update({
        where: { id: event.id },
        data: {
          status: "SYNCED",
          syncedAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 }
        }
      });
    } catch (error) {
      await this.replicationOutbox.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          attemptCount: { increment: 1 },
          lastError: sanitizeReplicationError(error),
          nextRetryAt: new Date(Date.now() + this.replicationConfig.retryDelayMs)
        }
      });

      if (this.replicationConfig.backupRequiredForStrictMode) {
        throw new Error(`Strict database replication failed: ${sanitizeReplicationError(error)}`);
      }
    }
  }

  private extractTenantId(payload: Record<string, unknown> | null): string | null {
    return typeof payload?.tenantId === "string" ? payload.tenantId : null;
  }

  private installAuditMiddleware(): void {
    this.$use(async (params, next) => {
      const { model, action } = params;

      if (!model || !MUTATION_ACTIONS.has(action) || AUDIT_SKIP_MODELS.has(model)) {
        return next(params);
      }

      let ctx: ReturnType<typeof requestContext.get> | undefined;
      let delegate: any;
      let beforeRows: Array<Record<string, unknown>> = [];

      try {
        ctx = requestContext.get();
        delegate = (this as unknown as Record<string, any>)[camelCase(model)];

        if (action === "update" || action === "delete" || action === "upsert") {
          const where = (params.args as { where?: unknown })?.where;
          if (where && delegate?.findUnique) {
            const found = await delegate.findUnique({ where });
            if (found) beforeRows = [found as Record<string, unknown>];
          }
        } else if (action === "updateMany" || action === "deleteMany") {
          const where = (params.args as { where?: unknown })?.where ?? {};
          if (delegate?.findMany) {
            const found = await delegate.findMany({ where, take: 100 });
            beforeRows = (found ?? []) as Array<Record<string, unknown>>;
          }
        }
      } catch (err) {
        this.logger.debug(
          `audit pre-fetch failed for ${model}.${action}: ${(err as Error).message}`
        );
        // swallow — audit must never break the business path
      }

      // Run the actual operation. Any error here is a real business error and must propagate.
      const result = await next(params);

      // Fire-and-forget audit write. Wrap in setImmediate so any sync work inside
      // writeAudit cannot interfere with the current request response cycle.
      setImmediate(() => {
        try {
          this.writeAudit({ model, action, params, beforeRows, result, ctx, delegate }).catch(
            (err) => {
              this.logger.warn(
                `audit write failed for ${model}.${action}: ${(err as Error).message}`
              );
            }
          );
        } catch (err) {
          this.logger.warn(
            `audit dispatch failed for ${model}.${action}: ${(err as Error).message}`
          );
        }
      });

      return result;
    });
  }

  private async writeAudit(opts: {
    model: string;
    action: Prisma.PrismaAction;
    params: Prisma.MiddlewareParams;
    beforeRows: Array<Record<string, unknown>>;
    result: unknown;
    ctx: ReturnType<typeof requestContext.get>;
    delegate: any;
  }): Promise<void> {
    const { model, action, params, beforeRows, result, ctx, delegate } = opts;

    const actorId = ctx?.actorId ?? null;
    const actorEmail = ctx?.actorEmail ?? null;
    const actorRole = ctx?.actorRole ?? null;
    const ctxTenantId = ctx?.tenantId ?? null;
    const module = ctx?.module ?? null;
    const ipAddress = ctx?.ipAddress ?? null;
    const userAgent = ctx?.userAgent ?? null;
    const requestPath = ctx?.requestPath ?? null;

    const entries: Array<{
      action: "CREATE" | "UPDATE" | "DELETE";
      entityId: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    }> = [];

    if (action === "create") {
      const after = result as Record<string, unknown> | null;
      if (after && typeof after === "object") {
        entries.push({
          action: "CREATE",
          entityId: String((after as { id?: unknown }).id ?? ""),
          before: null,
          after
        });
      }
    } else if (action === "createMany") {
      return; // result is { count }; skip noisy bulk-insert audit
    } else if (action === "update" || action === "upsert") {
      const after = result as Record<string, unknown> | null;
      const before = beforeRows[0] ?? null;
      const wasCreate = !before && action === "upsert";
      entries.push({
        action: wasCreate ? "CREATE" : "UPDATE",
        entityId: String(
          (after as { id?: unknown } | null)?.id ??
            extractIdFromWhere((params.args as { where?: unknown })?.where) ??
            ""
        ),
        before,
        after
      });
    } else if (action === "updateMany") {
      const ids = beforeRows
        .map((r) => (typeof r.id === "string" ? r.id : null))
        .filter((v): v is string => Boolean(v));
      if (ids.length === 0 || !delegate?.findMany) return;
      const afterRows: Array<Record<string, unknown>> = await delegate.findMany({
        where: { id: { in: ids } }
      });
      const afterById = new Map<string, Record<string, unknown>>(
        afterRows.map((r) => [String(r.id), r])
      );
      for (const before of beforeRows) {
        const id = String(before.id);
        const after = afterById.get(id) ?? null;
        entries.push({ action: "UPDATE", entityId: id, before, after });
      }
    } else if (action === "delete") {
      const before = beforeRows[0] ?? null;
      if (!before) return;
      entries.push({
        action: "DELETE",
        entityId: String(before.id ?? ""),
        before,
        after: null
      });
    } else if (action === "deleteMany") {
      for (const before of beforeRows) {
        entries.push({
          action: "DELETE",
          entityId: String(before.id ?? ""),
          before,
          after: null
        });
      }
    }

    for (const entry of entries) {
      if (!entry.entityId) continue;

      let beforeData: Json | undefined;
      let afterData: Json | undefined;

      if (entry.action === "UPDATE") {
        const changes = diffRecords(entry.before, entry.after, opts.model);
        if (changes.length === 0) continue;
        // Store the field-level diff in BOTH columns: beforeData holds prev values, afterData holds new
        beforeData = changes.map((c) => ({ field: c.field, value: c.before })) as unknown as Json;
        afterData = changes.map((c) => ({ field: c.field, value: c.after })) as unknown as Json;
      } else if (entry.action === "CREATE") {
        const snapshot: Record<string, unknown> = {};
        const safeAfter = redactForAudit(opts.model, entry.after);
        for (const [k, v] of Object.entries(safeAfter ?? {})) {
          if (NOISY_FIELDS.has(k)) continue;
          snapshot[k] = clip(v);
        }
        afterData = snapshot as Json;
      } else {
        const snapshot: Record<string, unknown> = {};
        const safeBefore = redactForAudit(opts.model, entry.before);
        for (const [k, v] of Object.entries(safeBefore ?? {})) {
          if (NOISY_FIELDS.has(k)) continue;
          snapshot[k] = clip(v);
        }
        beforeData = snapshot as Json;
      }

      const tenantForRow =
        ctxTenantId ??
        (typeof entry.before?.tenantId === "string"
          ? (entry.before?.tenantId as string)
          : typeof entry.after?.tenantId === "string"
            ? (entry.after?.tenantId as string)
            : null);

      await this.auditLog.create({
        data: {
          tenantId: tenantForRow,
          actorId,
          module,
          entity: opts.model,
          entityId: entry.entityId,
          action: entry.action,
          ipAddress,
          userAgent,
          requestPath,
          actorSnapshot:
            actorId || actorEmail || actorRole
              ? ({ id: actorId, email: actorEmail, role: actorRole } as Json)
              : undefined,
          beforeData,
          afterData
        }
      });
    }
  }
}
