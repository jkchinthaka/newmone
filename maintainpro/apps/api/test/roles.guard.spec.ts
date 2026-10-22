import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ACCESS_ROUTE_KEYS } from "../src/common/auth/access-route-keys";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OperationsController } from "../src/modules/operations/operations.controller";

describe("RolesGuard", () => {
  it("allows access when no roles metadata exists", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "ADMIN" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it("blocks access when role does not match", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["SUPER_ADMIN"])
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "TECHNICIAN" } })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("blocks viewers from the phase 6 operations scan endpoint", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => OperationsController.prototype.scanLookup,
      getClass: () => OperationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "VIEWER" } })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows security officers to access the operations scan endpoint", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => OperationsController.prototype.scanLookup,
      getClass: () => OperationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "SECURITY_OFFICER" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it("does not skip the role list just because the route has permissions", () => {
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === "roles" ? ["ADMIN"] : undefined))
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "TECHNICIAN" }, method: "GET", route: { path: "/not-in-the-access-map" } })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    process.env.ACCESS_STUDIO_ENABLED = previous;
  });

  it("skips the role list for a non-super-admin when the flag is on and the route has an access key", () => {
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const [routeId] = Object.keys(ACCESS_ROUTE_KEYS);
    const [method, ...pathParts] = routeId!.split(" ");
    const reflector = {
      getAllAndOverride: jest.fn(() => ["ADMIN"])
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "TECHNICIAN" }, method, route: { path: pathParts.join(" ") } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    process.env.ACCESS_STUDIO_ENABLED = previous;
  });

  it("still checks roles when the flag is off even if the route has an access key", () => {
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const [routeId] = Object.keys(ACCESS_ROUTE_KEYS);
    const [method, ...pathParts] = routeId!.split(" ");
    const reflector = {
      getAllAndOverride: jest.fn(() => ["ADMIN"])
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "TECHNICIAN" }, method, route: { path: pathParts.join(" ") } })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    process.env.ACCESS_STUDIO_ENABLED = previous;
  });

  it("still checks SUPER_ADMIN against the role list when the flag is on", () => {
    const previous = process.env.ACCESS_STUDIO_ENABLED;
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === "permissions" ? ["work_orders.view"] : ["ADMIN"]))
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "SUPER_ADMIN" } })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    process.env.ACCESS_STUDIO_ENABLED = previous;
  });
});
