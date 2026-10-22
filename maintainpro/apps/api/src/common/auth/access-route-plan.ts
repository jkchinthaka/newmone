export type AccessPlanRoute = {
  method: string;
  path: string;
  roles: readonly string[];
  isPublic?: boolean;
  controller?: string;
  handler?: string;
};

export type AccessKeyPlanEntry = {
  key: string;
  label: string;
  module: string;
  roles: string[];
};

export type AccessRoutePlan = {
  keyCount: number;
  routeCount: number;
  keys: AccessKeyPlanEntry[];
  routes: Array<{ method: string; path: string; key: string }>;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();
}

function moduleOf(path: string): string {
  const head = path.split("/").filter(Boolean)[0] ?? "root";
  return slug(head);
}

function staticParts(path: string): string[] {
  return path
    .split("/")
    .filter(Boolean)
    .filter((part) => !part.startsWith(":"))
    .map(slug);
}

function actionOf(routes: readonly AccessPlanRoute[]): "view" | "manage" | "access" {
  const hasWrite = routes.some((route) => WRITE_METHODS.has(route.method));
  const hasRead = routes.some((route) => !WRITE_METHODS.has(route.method));
  if (hasWrite && hasRead) return "access";
  if (hasWrite) return "manage";
  return "view";
}

function dominantToken(routes: readonly AccessPlanRoute[], pick: (route: AccessPlanRoute) => string): string {
  const counts = new Map<string, number>();
  for (const route of routes) {
    const token = pick(route);
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "records";
}

function labelFor(moduleName: string, area: string, action: string, extra?: string): string {
  const words = [moduleName, area, extra, action].filter((part): part is string => Boolean(part));
  const text = words.map((part) => part.replaceAll("_", " ")).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Group = {
  moduleName: string;
  roles: string[];
  routes: AccessPlanRoute[];
  area: string;
  action: "view" | "manage" | "access";
};

/**
 * One access key per module and role set. The key is chosen from the path and the
 * HTTP methods. Controller and handler names are ignored, so renaming a method
 * does not change the key.
 */
export function planAccessRouteKeys(routes: readonly AccessPlanRoute[]): AccessRoutePlan {
  const groups = new Map<string, Group>();
  for (const route of routes) {
    if (!route.roles.length) continue;
    const moduleName = moduleOf(route.path);
    const roles = [...route.roles].sort();
    const id = `${moduleName}::${roles.join("|")}`;
    const group = groups.get(id) ?? { moduleName, roles, routes: [], area: "", action: "access" as const };
    group.routes.push(route);
    groups.set(id, group);
  }

  const planned = [...groups.values()].map((group) => {
    const area = dominantToken(group.routes, (route) => {
      const parts = staticParts(route.path);
      return parts.length > 1 ? parts[parts.length - 1]! : "records";
    });
    return { ...group, area, action: actionOf(group.routes) };
  });

  const byBase = new Map<string, Group[]>();
  for (const group of planned) {
    const base = `${group.moduleName}.${group.area}.${group.action}`;
    const list = byBase.get(base) ?? [];
    list.push(group);
    byBase.set(base, list);
  }

  const assigned = planned.map((group) => {
    const base = `${group.moduleName}.${group.area}.${group.action}`;
    const peers = byBase.get(base) ?? [];
    let extra = "";
    if (peers.length > 1) {
      extra = distinctiveToken(group, peers) ?? distinctiveRole(group, peers);
    }
    const key = extra ? `${base}.${extra}` : base;
    return { group, key };
  });

  const used = new Map<string, number>();
  const routesOut: AccessRoutePlan["routes"] = [];
  const keysOut: AccessKeyPlanEntry[] = [];
  for (const item of assigned) {
    let key = item.key;
    const seen = used.get(key) ?? 0;
    if (seen > 0) key = `${item.key}.${seen + 1}`;
    used.set(item.key, seen + 1);
    const extra = key.startsWith(`${item.group.moduleName}.${item.group.area}.${item.group.action}.`)
      ? key.slice(`${item.group.moduleName}.${item.group.area}.${item.group.action}.`.length)
      : undefined;
    keysOut.push({
      key,
      label: labelFor(item.group.moduleName, item.group.area, item.group.action, extra),
      module: item.group.moduleName,
      roles: item.group.roles.filter((role) => role !== "SUPER_ADMIN")
    });
    for (const route of item.group.routes) {
      routesOut.push({ method: route.method, path: route.path, key });
    }
  }

  keysOut.sort((left, right) => left.key.localeCompare(right.key));
  routesOut.sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
  return { keyCount: keysOut.length, routeCount: routesOut.length, keys: keysOut, routes: routesOut };
}

function distinctiveToken(group: Group, peers: readonly Group[]): string | undefined {
  const counts = new Map<string, number>();
  for (const route of group.routes) {
    for (const part of staticParts(route.path)) {
      if (part === group.moduleName || part === group.area) continue;
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  for (const [token] of ranked) {
    const shared = peers.some(
      (peer) => peer !== group && peer.routes.some((route) => staticParts(route.path).includes(token))
    );
    if (!shared) return token;
  }
  return undefined;
}

function distinctiveRole(group: Group, peers: readonly Group[]): string {
  const others = new Set(peers.filter((peer) => peer !== group).flatMap((peer) => peer.roles));
  const extra = group.roles.find((role) => role !== "SUPER_ADMIN" && !others.has(role));
  if (extra) return slug(extra);
  const missing = [...others].find((role) => role !== "SUPER_ADMIN" && !group.roles.includes(role));
  if (missing) return `without_${slug(missing)}`;
  return "shared";
}
