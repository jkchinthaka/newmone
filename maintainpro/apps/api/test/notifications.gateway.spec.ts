import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";
import { sign } from "jsonwebtoken";

import { NotificationsGateway } from "../src/modules/notifications/notifications.gateway";

describe("NotificationsGateway", () => {
  const secret = "ws-test-secret";

  const configService = {
    get: jest.fn((key: string) => {
      if (key === "JWT_ACCESS_SECRET") return secret;
      if (key === "NODE_ENV") return "test";
      return undefined;
    })
  } as unknown as ConfigService;

  const buildGateway = (isActive = true) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(isActive ? { isActive: true } : { isActive: false })
      }
    } as any;
    const gateway = new NotificationsGateway(configService, prisma);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    return { gateway, prisma, to, emit };
  };

  const buildClient = (token: string | null) =>
    ({
      handshake: {
        auth: token ? { token } : {},
        headers: {}
      },
      join: jest.fn(),
      disconnect: jest.fn()
    }) as any;

  it("joins user and tenant rooms for valid tenant user", async () => {
    const { gateway } = buildGateway(true);
    const token = sign(
      { sub: "user-1", role: RoleName.ADMIN, tenantId: "tenant-a", email: "a@b.com" },
      secret,
      { expiresIn: "5m" }
    );
    const client = buildClient(token);

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user:user-1");
    expect(client.join).toHaveBeenCalledWith("tenant:tenant-a");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("rejects non-super-admin sockets without tenant id", async () => {
    const { gateway } = buildGateway(true);
    const token = sign(
      { sub: "user-2", role: RoleName.ADMIN, tenantId: null, email: "a@b.com" },
      secret,
      { expiresIn: "5m" }
    );
    const client = buildClient(token);

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("emits user-scoped events to user room", () => {
    const { gateway, to, emit } = buildGateway(true);

    gateway.emitToUser("user-1", { hello: true });
    gateway.emitMarkRead("user-1", { updated: true });

    expect(to).toHaveBeenNthCalledWith(1, "user:user-1");
    expect(emit).toHaveBeenNthCalledWith(1, "notifications.new", { hello: true });
    expect(to).toHaveBeenNthCalledWith(2, "user:user-1");
    expect(emit).toHaveBeenNthCalledWith(2, "notifications.updated", { updated: true });
  });
});
