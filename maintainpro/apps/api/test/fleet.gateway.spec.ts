import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";
import { sign } from "jsonwebtoken";

import { FleetGateway } from "../src/modules/fleet/fleet.gateway";

describe("FleetGateway", () => {
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
    const gateway = new FleetGateway(configService, prisma);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    return { gateway, to, emit };
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

  it("joins tenant room for valid tenant user", async () => {
    const { gateway } = buildGateway(true);
    const token = sign(
      { sub: "user-1", role: RoleName.ADMIN, tenantId: "tenant-a", email: "a@b.com" },
      secret,
      { expiresIn: "5m" }
    );
    const client = buildClient(token);

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("tenant:tenant-a");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("joins global room for super admin", async () => {
    const { gateway } = buildGateway(true);
    const token = sign(
      { sub: "user-2", role: RoleName.SUPER_ADMIN, tenantId: null, email: "a@b.com" },
      secret,
      { expiresIn: "5m" }
    );
    const client = buildClient(token);

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("fleet:global");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("routes location and alerts by room", () => {
    const { gateway, to, emit } = buildGateway(true);

    gateway.broadcastLocationUpdate({ id: 1 }, "tenant-a");
    gateway.broadcastAlertCreated(
      {
        id: "alt-1",
        type: "OVERSPEED",
        severity: "WARNING",
        vehicleId: "veh-1",
        registrationNo: "ABC-1234",
        message: "overspeed",
        createdAt: new Date().toISOString()
      },
      "tenant-a"
    );
    gateway.broadcastLocationUpdate({ id: 2 }, null);

    expect(to).toHaveBeenNthCalledWith(1, "tenant:tenant-a");
    expect(emit).toHaveBeenNthCalledWith(1, "fleet.location.updated", { id: 1 });
    expect(to).toHaveBeenNthCalledWith(2, "tenant:tenant-a");
    expect(emit).toHaveBeenNthCalledWith(2, "fleet.alert.created", expect.any(Object));
    expect(to).toHaveBeenNthCalledWith(3, "fleet:global");
    expect(emit).toHaveBeenNthCalledWith(3, "fleet.location.updated", { id: 2 });
  });
});
