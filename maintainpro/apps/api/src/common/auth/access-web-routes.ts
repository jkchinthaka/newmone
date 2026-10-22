import inventory from "../../database/access-route-inventory.json";
import { newAccessDecision } from "./access-studio-parity";
import { hasCompatiblePermission } from "../guards/permissions.guard";

/** Derived from the same effective keys and DENYs as PermissionsGuard, never JWT claims. */
export function effectiveWebRoutes(role: string, keys: readonly string[], denied: ReadonlySet<string>): string[] {
  const granted = new Set(keys);
  return inventory.routes.filter((route) => newAccessDecision(route, role, granted,
    (set, permission, name) => hasCompatiblePermission(set, permission, name, denied)
  )).map((route) => `${route.method} ${route.path}`);
}
