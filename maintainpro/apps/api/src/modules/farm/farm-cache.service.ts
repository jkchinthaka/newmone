import { Injectable } from "@nestjs/common";

type Entry<T> = { value: T; expiresAt: number };

/**
 * Lightweight in-process TTL cache for hot read endpoints.
 *
 * Used by farm modules where data churn is low (weather, finance summaries,
 * health alerts). NOT a substitute for Redis when the API runs multi-replica;
 * acceptable for single-node dev and small fleets where freshness windows of
 * a few minutes are acceptable. Keys MUST include the tenantId so that one
 * tenant's response is never served to another.
 */
@Injectable()
export class FarmCacheService {
  private readonly store = new Map<string, Entry<unknown>>();

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.store.get(key) as Entry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const value = await loader();
    this.store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  invalidate(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}
