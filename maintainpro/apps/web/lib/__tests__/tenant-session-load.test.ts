import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadTenantSession, shouldFetchTenantMemberships } from "../tenant-session-load";

describe("loadTenantSession", () => {
  it("does not call /tenants/me for REQUESTER and uses the profile tenant", async () => {
    const calls: string[] = [];
    const client = {
      get(url: string) {
        calls.push(url);
        return Promise.resolve({
          data: {
            data: {
              id: "user-1",
              role: { name: "REQUESTER" },
              permissions: ["dashboard.view", "maintenance_requests.view_own"],
              tenantId: "tenant-requester"
            }
          }
        });
      }
    };

    const result = await loadTenantSession(client, "some-other-tenant");
    assert.deepEqual(calls, ["/auth/me"]);
    assert.equal(shouldFetchTenantMemberships({ role: { name: "REQUESTER" } }), false);
    assert.equal(result.kind, "ready");
    if (result.kind === "ready") {
      assert.equal(result.tenantId, "tenant-requester");
    }
  });

  it("loads memberships after the session for roles that may list tenants", async () => {
    const calls: string[] = [];
    const client = {
      get(url: string) {
        calls.push(url);
        if (url === "/auth/me") {
          return Promise.resolve({ data: { data: { id: "user-1", role: "MANAGER", tenantId: "tenant-1" } } });
        }
        return Promise.resolve({
          data: { data: { memberships: [{ tenantId: "tenant-1", tenantName: "Plant" }] } }
        });
      }
    };

    const result = await loadTenantSession(client, null);
    assert.deepEqual(calls, ["/auth/me", "/tenants/me"]);
    assert.equal(result.kind, "ready");
    if (result.kind === "ready") {
      assert.equal(result.tenantId, "tenant-1");
    }
  });

  it("does not accept a tenant when the session check is unauthorized", async () => {
    const client = {
      get(url: string) {
        if (url === "/auth/me") {
          return Promise.reject({ response: { status: 401 } });
        }
        return Promise.resolve({
          data: { data: { memberships: [{ tenantId: "tenant-1" }] } }
        });
      }
    };

    const result = await loadTenantSession(client, "tenant-1");
    assert.equal(result.kind, "session_expired");
  });

  it("keeps a required-dependency denial when membership is forbidden", async () => {
    const client = {
      get(url: string) {
        if (url === "/auth/me") {
          return Promise.resolve({ data: { data: { id: "user-1" } } });
        }
        return Promise.reject({ response: { status: 403, data: { error: { code: "TENANT_FORBIDDEN" } } } });
      }
    };

    const result = await loadTenantSession(client, null);
    assert.equal(result.kind, "access_denied");
  });
});
