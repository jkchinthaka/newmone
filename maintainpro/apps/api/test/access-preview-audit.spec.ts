import { ForbiddenException } from "@nestjs/common";

import { recordAccessPreviewEvent } from "../src/common/auth/access-preview";
import type { PrismaService } from "../src/database/prisma.service";

describe("access preview audit", () => {
  const actor = { sub: "actor-1", email: "sa@example.test", role: "SUPER_ADMIN", tenantId: "tenant-1" };
  const previous = process.env.ACCESS_STUDIO_ENABLED;

  afterEach(() => {
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
    else process.env.ACCESS_STUDIO_ENABLED = previous;
  });

  function prisma() {
    const auditLog = { create: jest.fn().mockResolvedValue({ id: "audit-1" }) };
    const user = {
      findFirst: jest.fn().mockResolvedValue({
        id: "target-1",
        email: "tech@example.test",
        tenantId: "tenant-1",
        lockedUntil: null,
        role: { name: "TECHNICIAN" }
      })
    };
    return { client: { auditLog, user } as unknown as PrismaService, auditLog, user };
  }

  it("writes actor, target, and tenant when preview starts and stops", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "true";
    const db = prisma();
    const started = await recordAccessPreviewEvent(db.client, actor, "tenant-1", "target-1", "start");
    const stopped = await recordAccessPreviewEvent(db.client, actor, "tenant-1", "target-1", "stop");
    expect(started).toEqual({ actorUserId: "actor-1", targetUserId: "target-1", tenantId: "tenant-1" });
    expect(stopped.tenantId).toBe("tenant-1");
    expect(db.auditLog.create).toHaveBeenCalledTimes(2);
    const events = db.auditLog.create.mock.calls.map((call) => JSON.parse(String(call[0].data.metadata)).event);
    expect(events).toEqual(["preview.start", "preview.stop"]);
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant-1",
      actorId: "actor-1",
      entity: "AccessPreview",
      entityId: "target-1"
    });
  });

  it("does not write an audit row when the studio flag is off", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const db = prisma();
    await expect(recordAccessPreviewEvent(db.client, actor, "tenant-1", "target-1", "start")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
