import { INestApplication, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import { requestContext } from "../common/context/request-context";

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
  "UsageEvent",
  "UsageMetric"
]);

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
  after: Record<string, unknown> | null
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {})
  ]);
  for (const key of keys) {
    if (NOISY_FIELDS.has(key)) continue;
    const b = before?.[key];
    const a = after?.[key];
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

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.installAuditMiddleware();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on("beforeExit", async () => {
      await app.close();
    });
  }

  private installAuditMiddleware(): void {
    this.$use(async (params, next) => {
      const { model, action } = params;

      if (!model || !MUTATION_ACTIONS.has(action) || AUDIT_SKIP_MODELS.has(model)) {
        return next(params);
      }

      const ctx = requestContext.get();
      const delegate = (this as unknown as Record<string, any>)[camelCase(model)];

      let beforeRows: Array<Record<string, unknown>> = [];
      try {
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
      }

      const result = await next(params);

      this.writeAudit({ model, action, params, beforeRows, result, ctx, delegate }).catch(
        (err) => {
          this.logger.warn(
            `audit write failed for ${model}.${action}: ${(err as Error).message}`
          );
        }
      );

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
    const ctxTenantId = ctx?.tenantId ?? null;

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
        const changes = diffRecords(entry.before, entry.after);
        if (changes.length === 0) continue;
        // Store the field-level diff in BOTH columns: beforeData holds prev values, afterData holds new
        beforeData = changes.map((c) => ({ field: c.field, value: c.before })) as unknown as Json;
        afterData = changes.map((c) => ({ field: c.field, value: c.after })) as unknown as Json;
      } else if (entry.action === "CREATE") {
        const snapshot: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(entry.after ?? {})) {
          if (NOISY_FIELDS.has(k)) continue;
          snapshot[k] = clip(v);
        }
        afterData = snapshot as Json;
      } else {
        const snapshot: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(entry.before ?? {})) {
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
          entity: opts.model,
          entityId: entry.entityId,
          action: entry.action,
          beforeData,
          afterData
        }
      });
    }
  }
}
