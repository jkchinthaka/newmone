import { of } from "rxjs";

import { requestContext } from "../src/common/context/request-context";
import { RequestContextInterceptor } from "../src/common/context/request-context.interceptor";

function mockExecutionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as never;
}

/**
 * Regression coverage for the tenant-context propagation bug: services that read
 * requestContext.getTenantId() (vehicles, fleet, notifications, trips, cleaning)
 * threw "Tenant context is required" for a fully authenticated, single-tenant
 * user whenever the caller did not also send X-Tenant-Id — because the context
 * used to be populated by middleware, which NestJS always runs *before* guards,
 * so request.user / request.tenantId were not yet resolved. This interceptor
 * runs after guards instead.
 */
describe("RequestContextInterceptor", () => {
  const interceptor = new RequestContextInterceptor();

  function run(request: Record<string, unknown>) {
    let seen: ReturnType<typeof requestContext.get>;
    const handler = { handle: () => of(null) };

    // Exercise the interceptor the same way Nest would: within a base async
    // context already established by RequestIdMiddleware (requestId only).
    return requestContext.run(
      {
        actorId: null,
        actorEmail: null,
        actorRole: null,
        tenantId: null,
        module: null,
        ipAddress: null,
        userAgent: null,
        requestPath: null,
        requestId: "pre-existing-request-id"
      },
      () => {
        interceptor.intercept(mockExecutionContext(request), handler as never).subscribe();
        seen = requestContext.get();
        return seen;
      }
    );
  }

  it("resolves tenantId from the guard-populated request.tenantId even without an X-Tenant-Id header", () => {
    const ctx = run({
      headers: {},
      user: { sub: "user-1", email: "u@test.com", role: "ADMIN", tenantId: "tenant-a", permissions: ["vehicles.view"] },
      tenantId: "tenant-a",
      originalUrl: "/api/vehicles"
    });

    expect(ctx?.tenantId).toBe("tenant-a");
    expect(ctx?.actorId).toBe("user-1");
    expect(ctx?.actorRole).toBe("ADMIN");
    expect(ctx?.permissions).toEqual(["vehicles.view"]);
  });

  it("preserves the requestId established earlier by RequestIdMiddleware", () => {
    const ctx = run({
      headers: {},
      user: { sub: "user-1", tenantId: "tenant-a" },
      tenantId: "tenant-a",
      originalUrl: "/api/vehicles"
    });

    expect(ctx?.requestId).toBe("pre-existing-request-id");
  });

  it("leaves tenantId null for unauthenticated requests", () => {
    const ctx = run({ headers: {}, originalUrl: "/api/health" });

    expect(ctx?.tenantId).toBeNull();
    expect(ctx?.actorId).toBeNull();
  });
});
