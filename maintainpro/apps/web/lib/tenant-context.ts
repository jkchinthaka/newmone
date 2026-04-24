export const ACTIVE_TENANT_KEY = "maintainpro_active_tenant";

export function getActiveTenantId() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(ACTIVE_TENANT_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setActiveTenantId(tenantId: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  if (!tenantId || tenantId.trim().length === 0) {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_TENANT_KEY, tenantId.trim());
}
