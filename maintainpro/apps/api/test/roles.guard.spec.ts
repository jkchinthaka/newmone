import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RolesGuard } from "../src/common/guards/roles.guard";

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

    expect(guard.canActivate(context)).toBe(false);
  });
});
