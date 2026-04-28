import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditRequestContext {
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  tenantId: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export const requestContext = {
  run<T>(value: AuditRequestContext, fn: () => T): T {
    return storage.run(value, fn);
  },
  get(): AuditRequestContext | undefined {
    return storage.getStore();
  },
  getActorId(): string | null {
    return storage.getStore()?.actorId ?? null;
  },
  getTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
  }
};
