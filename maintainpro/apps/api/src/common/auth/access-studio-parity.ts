import { accessKeyForMethodPath } from "./access-route-keys";

export const ACCESS_STUDIO_SEED_VERSION = 2;

export type AccessRoute = {
  method: string;
  path: string;
  roles: string[];
  permissions: string[];
  isPublic: boolean;
};

export function oldAccessDecision(route: AccessRoute, role: string, permissionKeys: ReadonlySet<string>, allows: (keys: ReadonlySet<string>, permission: string, role: string) => boolean): boolean {
  if (route.isPublic) return true;
  if (route.roles.length > 0 && !route.roles.includes(role)) return false;
  if (role === "SUPER_ADMIN" || route.permissions.length === 0) return true;
  return route.permissions.every((permission) => allows(permissionKeys, permission, role));
}

export function newAccessDecision(route: AccessRoute, role: string, permissionKeys: ReadonlySet<string>, allows: (keys: ReadonlySet<string>, permission: string, role: string) => boolean): boolean {
  if (route.isPublic) return true;
  if (role === "SUPER_ADMIN") return oldAccessDecision(route, role, permissionKeys, allows);
  const accessKey = accessKeyForMethodPath(route.method, route.path);
  if (!accessKey) return oldAccessDecision(route, role, permissionKeys, allows);
  return [...route.permissions, accessKey].every((permission) => allows(permissionKeys, permission, role));
}

export function firstAccessMismatch(
  routes: readonly AccessRoute[],
  keysByRole: ReadonlyMap<string, readonly string[]>,
  allows: (keys: ReadonlySet<string>, permission: string, role: string) => boolean
): string | null {
  for (const route of routes) {
    for (const [role, keys] of keysByRole) {
      const held = new Set(keys);
      if (oldAccessDecision(route, role, held, allows) !== newAccessDecision(route, role, held, allows)) {
        return `${route.method} ${route.path} ${role}`;
      }
    }
  }
  return null;
}
