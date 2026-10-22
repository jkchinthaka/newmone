import "reflect-metadata";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import * as barrel from "./access-inventory-barrel";

const METHOD_NAMES = ["GET", "POST", "PUT", "DELETE", "PATCH", "ALL", "OPTIONS", "HEAD"];

function override<T>(key: string, handler: object, cls: object): T | undefined {
  const onHandler = Reflect.getMetadata(key, handler) as T | undefined;
  if (onHandler !== undefined) return onHandler;
  return Reflect.getMetadata(key, cls) as T | undefined;
}

function joinPath(controllerPath: string, methodPath: string): string {
  const joined = [controllerPath.replace(/\/$/, ""), methodPath.replace(/^\//, "")].filter(Boolean).join("/");
  return `/${joined}`.replace(/\/+/g, "/");
}

describe("access route inventory", () => {
  it("writes decorator metadata for every controller", () => {
    const routes: Array<Record<string, unknown>> = [];
    for (const value of Object.values(barrel)) {
      if (typeof value !== "function") continue;
      const controllerPath = Reflect.getMetadata(PATH_METADATA, value) as string | string[] | undefined;
      if (controllerPath === undefined) continue;
      const bases = Array.isArray(controllerPath) ? controllerPath : [controllerPath];
      const prototype = value.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === "constructor") continue;
        const handler = prototype[name];
        if (typeof handler !== "function") continue;
        const methodMeta = Reflect.getMetadata(METHOD_METADATA, handler) as number | number[] | undefined;
        if (methodMeta === undefined) continue;
        const methods = (Array.isArray(methodMeta) ? methodMeta : [methodMeta]).map(
          (method) => METHOD_NAMES[method] ?? String(method)
        );
        const rawPath = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        const methodPaths = rawPath === undefined ? [""] : Array.isArray(rawPath) ? rawPath : [rawPath];
        for (const base of bases) {
          for (const methodPath of methodPaths) {
            for (const method of methods) {
              routes.push({
                method,
                path: joinPath(String(base ?? ""), String(methodPath ?? "")),
                controller: value.name,
                handler: name,
                roles: override<string[]>(ROLES_KEY, handler, value) ?? [],
                permissions: override<string[]>(PERMISSIONS_KEY, handler, value) ?? [],
                isPublic: override<boolean>(IS_PUBLIC_KEY, handler, value) === true
              });
            }
          }
        }
      }
    }
    routes.sort(
      (a, b) => String(a.path).localeCompare(String(b.path)) || String(a.method).localeCompare(String(b.method))
    );
    const out = path.resolve(__dirname, "../../../docs/handover/access/route-inventory.json");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(
      out,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), routeCount: routes.length, routes }, null, 2)}\n`
    );
    const runtime = path.resolve(__dirname, "../src/database/access-route-inventory.json");
    writeFileSync(
      runtime,
      `${JSON.stringify({
        routes: routes.map((route) => ({
          method: route.method,
          path: route.path,
          roles: route.roles,
          permissions: route.permissions,
          isPublic: route.isPublic
        }))
      })}\n`
    );
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.some((route) => (route.permissions as string[]).some((permission) => permission.startsWith("access.")))).toBe(
      false
    );
  });
});
