import { ACCESS_KEY_CATALOG, ACCESS_ROUTE_KEYS, ACCESS_STUDIO_ROUTE_GRANTS } from "./access-route-key-data";

export { ACCESS_KEY_CATALOG, ACCESS_ROUTE_KEYS, ACCESS_STUDIO_ROUTE_GRANTS };

const STUDIO_KEYS = new Set(Object.keys(ACCESS_STUDIO_ROUTE_GRANTS));

export function isAccessStudioKey(key: string): boolean {
  return STUDIO_KEYS.has(key);
}

export function accessKeyForMethodPath(method: string, path: string): string | undefined {
  return ACCESS_ROUTE_KEYS[`${method.toUpperCase()} ${path}`];
}

/** Join Express baseUrl + route pattern and drop the /api prefix used in the inventory. */
export function normalizeAccessPath(baseUrl: string, routePath: string): string {
  const base = baseUrl.trim();
  const route = routePath.trim();
  let joined: string;
  if (!base) joined = route;
  else if (!route || route === "/") joined = base;
  else if (route === base || route.startsWith(`${base}/`)) joined = route;
  else joined = `${base.replace(/\/$/, "")}/${route.replace(/^\//, "")}`;
  joined = joined.replace(/\/+/g, "/");
  if (joined.startsWith("/api/")) joined = joined.slice(4);
  else if (joined === "/api") joined = "/";
  if (!joined.startsWith("/")) joined = `/${joined}`;
  if (joined.length > 1 && joined.endsWith("/")) joined = joined.slice(0, -1);
  return joined || "/";
}

export function accessKeyForRequest(request: {
  method?: string;
  baseUrl?: string;
  route?: { path?: string | string[] };
}): string | undefined {
  const method = request.method?.toUpperCase();
  const routePath = Array.isArray(request.route?.path) ? request.route.path[0] : request.route?.path;
  if (!method || !routePath) return undefined;
  return accessKeyForMethodPath(method, normalizeAccessPath(request.baseUrl ?? "", routePath));
}
