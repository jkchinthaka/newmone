import { BadRequestException } from "@nestjs/common";
import { MaintenanceConfigService } from "../src/modules/maintenance-config/maintenance-config.service";

describe("Work order job category master data (HCI)", () => {
  const tenantId = "tenant-a";
  const otherTenant = "tenant-b";

  function buildService(overrides?: {
    findFirst?: jest.Mock;
    findMany?: jest.Mock;
  }) {
    const prisma = {
      maintenanceJobCategory: {
        findMany: overrides?.findMany ?? jest.fn().mockResolvedValue([]),
        findFirst: overrides?.findFirst ?? jest.fn().mockResolvedValue(null)
      }
    };
    return new MaintenanceConfigService(prisma as never);
  }

  const actor = { sub: "u1", tenantId, role: "MANAGER" as const };

  it("lists only active SUB categories for a domain", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: "c1", code: "MECHANICAL", name: "Mechanical", jobDomain: "MACHINERY", level: "SUB", active: true }
    ]);
    const service = buildService({ findMany });
    const rows = await service.listSelectableJobCategories(actor, {
      jobDomain: "MACHINERY",
      level: "SUB",
      activeOnly: true
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          jobDomain: "MACHINERY",
          level: "SUB",
          active: true
        })
      })
    );
    expect(rows).toHaveLength(1);
  });

  it("rejects missing Service Category when required", async () => {
    const service = buildService();
    await expect(
      service.assertJobCategoryForDomain(tenantId, undefined, "SERVICE", { required: true })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects inactive category", async () => {
    const service = buildService({
      findFirst: jest.fn().mockResolvedValue({
        id: "c1",
        code: "PLUMBING",
        name: "Plumbing",
        jobDomain: "SERVICE",
        active: false,
        level: "SUB"
      })
    });
    await expect(
      service.assertJobCategoryForDomain(tenantId, "c1", "SERVICE", { required: true })
    ).rejects.toThrow(/inactive/i);
  });

  it("rejects cross-domain category (SERVICE category on MACHINERY)", async () => {
    const service = buildService({
      findFirst: jest.fn().mockResolvedValue({
        id: "c1",
        code: "PLUMBING",
        name: "Plumbing",
        jobDomain: "SERVICE",
        active: true,
        level: "SUB"
      })
    });
    await expect(
      service.assertJobCategoryForDomain(tenantId, "c1", "MACHINERY")
    ).rejects.toThrow(/not applicable/i);
  });

  it("rejects category missing for tenant (cross-tenant fail-closed)", async () => {
    const service = buildService({
      findFirst: jest.fn().mockResolvedValue(null)
    });
    await expect(
      service.assertJobCategoryForDomain(otherTenant, "c1", "VEHICLE")
    ).rejects.toThrow(/not found/i);
  });

  it("accepts valid MACHINERY problem category when optional", async () => {
    const service = buildService({
      findFirst: jest.fn().mockResolvedValue({
        id: "c1",
        code: "MECHANICAL",
        name: "Mechanical",
        jobDomain: "MACHINERY",
        active: true,
        level: "SUB"
      })
    });
    const row = await service.assertJobCategoryForDomain(tenantId, "c1", "MACHINERY");
    expect(row).toEqual({ id: "c1", code: "MECHANICAL", name: "Mechanical" });
  });

  it("allows optional category omission for MACHINERY", async () => {
    const service = buildService();
    await expect(
      service.assertJobCategoryForDomain(tenantId, undefined, "MACHINERY")
    ).resolves.toBeNull();
  });
});
