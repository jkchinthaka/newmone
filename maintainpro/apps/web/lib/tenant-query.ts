import { getActiveTenantId } from "@/lib/tenant-context";

export function activeTenantQueryScope(): string {
  return getActiveTenantId() ?? "none";
}

export function withTenantScope<T extends readonly unknown[]>(base: T): [...T, string] {
  return [...base, activeTenantQueryScope()];
}
