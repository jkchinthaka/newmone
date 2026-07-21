import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditRequestContext {
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  tenantId: string | null;
  module: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestPath: string | null;
  permissions?: string[];
  requestId?: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export const requestContext = {
  run<T>(value: AuditRequestContext, fn: () => T): T {
    return storage.run(value, fn);
  },
  /**
   * Set the active context for the current async execution without a callback wrapper.
   * Primarily used by tests and bootstrap tasks that cannot wrap their body in run().
   */
  enterWith(value: AuditRequestContext): void {
    storage.enterWith(value);
  },
  get(): AuditRequestContext | undefined {
    return storage.getStore();
  },
  getActorId(): string | null {
    return storage.getStore()?.actorId ?? null;
  },
  getTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
  },
  getRequestId(): string | null {
    return storage.getStore()?.requestId ?? null;
  }
};
