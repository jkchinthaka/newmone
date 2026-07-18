import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext } from "../context/request-context";

/**
 * Mandatory tenant helper for business queries.
 * Throws 403 when tenant context is absent — never return an empty filter that fails open.
 */
export function requireTenantId(explicitTenantId?: string | null): string {
  const tenantId = explicitTenantId ?? requestContext.getTenantId();
  if (!tenantId || tenantId.trim().length === 0) {
    throw new ForbiddenException("Tenant context is required");
  }
  return tenantId;
}

/** Prisma where fragment that always includes tenantId (fail-closed). */
export function tenantWhere(explicitTenantId?: string | null): { tenantId: string } {
  return { tenantId: requireTenantId(explicitTenantId) };
}

/**
 * Minimal Prisma delegate shape for tenant-scoped ownership checks.
 * findFirst is used (not findUnique) so we can filter by both id and tenantId.
 */
type TenantScopedDelegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select?: Record<string, unknown>;
  }) => Promise<unknown>;
  findMany: (args: {
    where: Record<string, unknown>;
    select?: Record<string, unknown>;
  }) => Promise<Array<{ id: string }>>;
};

/**
 * Assert a single referenced entity belongs to the active tenant.
 * Returns a non-enumerating NotFoundException so callers cannot probe other tenants.
 */
export async function assertTenantEntityExists(
  delegate: TenantScopedDelegate,
  id: string,
  options: { tenantId?: string | null; entityName?: string; extraWhere?: Record<string, unknown> } = {}
): Promise<void> {
  const tenantId = requireTenantId(options.tenantId);
  const found = await delegate.findFirst({
    where: { id, tenantId, ...(options.extraWhere ?? {}) },
    select: { id: true }
  });
  if (!found) {
    throw new NotFoundException(`${options.entityName ?? "Referenced record"} not found`);
  }
}

/**
 * Fetch a referenced entity scoped to the active tenant, or throw NotFound.
 */
export async function findTenantEntityOrThrow<T>(
  delegate: TenantScopedDelegate,
  id: string,
  options: {
    tenantId?: string | null;
    entityName?: string;
    select?: Record<string, unknown>;
    extraWhere?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const tenantId = requireTenantId(options.tenantId);
  const found = (await delegate.findFirst({
    where: { id, tenantId, ...(options.extraWhere ?? {}) },
    ...(options.select ? { select: options.select } : {})
  })) as T | null;
  if (!found) {
    throw new NotFoundException(`${options.entityName ?? "Referenced record"} not found`);
  }
  return found;
}

/**
 * Assert every id in the batch belongs to the active tenant.
 * Deduplicates input and does not leak which ids exist in other tenants.
 */
export async function assertTenantEntitiesExist(
  delegate: TenantScopedDelegate,
  ids: Array<string | null | undefined>,
  options: { tenantId?: string | null; entityName?: string; extraWhere?: Record<string, unknown> } = {}
): Promise<void> {
  const tenantId = requireTenantId(options.tenantId);
  const uniqueIds = Array.from(
    new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  );
  if (uniqueIds.length === 0) {
    return;
  }
  const rows = await delegate.findMany({
    where: { id: { in: uniqueIds }, tenantId, ...(options.extraWhere ?? {}) },
    select: { id: true }
  });
  if (rows.length !== uniqueIds.length) {
    throw new NotFoundException(`${options.entityName ?? "Referenced record"} not found`);
  }
}