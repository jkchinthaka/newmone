import { ForbiddenException } from "@nestjs/common";

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