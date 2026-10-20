import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadTenantSession } from "../tenant-session-load";

describe("loadTenantSession", () => {
  it("starts the tenant membership read before the session read settles", async () => {
    let releaseMe: (value: { data: { data: { id: string } } }) => void = () => undefined;
    let tenantsStarted = false;
    const client = {
      get(url: string) {
        if (url === "/auth/me") {
          return new Promise<{ data: { data: { id: string } } }>((resolve) => {
            releaseMe = resolve;
          });
        }
        tenantsStarted = true;
        return Promise.resolve({
          data: { data: { memberships: [{ tenantId: "tenant-1", tenantName: "Plant" }] } }
        });
      }
    };

    const pending = loadTenantSession(client, null);
    await Promise.resolve();
    assert.equal(tenantsStarted, true);
    releaseMe({ data: { data: { id: "user-1" } } });
    const result = await pending;
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
