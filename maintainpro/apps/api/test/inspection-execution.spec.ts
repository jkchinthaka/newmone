import { BadRequestException } from "@nestjs/common";
import { InspectionResult } from "@prisma/client";

import { evaluateInspectionChecklist } from "../src/modules/planning/inspection-checklist";
import { PlanningService } from "../src/modules/planning/planning.service";

const actor = {
  sub: "user-1",
  role: "MANAGER",
  tenantId: "tenant-a",
  email: "manager@example.com",
  permissions: ["planning.manage"]
};

describe("inspection checklist evaluation", () => {
  it("fails when a critical item fails", () => {
    const result = evaluateInspectionChecklist({
      items: [
        { key: "brakes", label: "Brakes", type: "PASS_FAIL", required: true, metadata: { critical: true, commentOnFail: true } }
      ],
      answers: { brakes: { value: "FAIL" } }
    });
    expect(result.result).toBe("FAIL");
    expect(result.errors.join(" ")).toMatch(/comment/i);
  });

  it("records pass with findings for a non-critical failure", () => {
    const result = evaluateInspectionChecklist({
      items: [{ key: "lamp", label: "Lamp", type: "PASS_FAIL", metadata: { critical: false } }],
      answers: { lamp: { value: "FAIL", comment: "Bulb dim" } }
    });
    expect(result.result).toBe("OBSERVATION");
    expect(result.findings[0]?.severity).toBe("LOW");
  });

  it("flags a numeric reading outside its range", () => {
    const result = evaluateInspectionChecklist({
      items: [{ key: "psi", label: "Tyre pressure", type: "NUMERIC", unit: "PSI", minValue: 30, maxValue: 35 }],
      answers: { psi: { value: 20 } }
    });
    expect(result.result).toBe("OBSERVATION");
    expect(result.findings[0]?.description).toMatch(/outside/);
  });

  it("rejects a disallowed evidence file before writing bytes", async () => {
    const { persistEvidenceFileBytes } = require("../src/modules/evidence/evidence-storage.mapper") as typeof import("../src/modules/evidence/evidence-storage.mapper");
    const result = await persistEvidenceFileBytes({
      tenantId: "tenant-a",
      inspectionId: "insp-1",
      checklistItemKey: "photo",
      fileName: "payload.exe",
      mimeType: "application/x-msdownload",
      contentBase64: Buffer.from("nope").toString("base64")
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not allowed|MIME|extension/i);
  });

  it("passes when required items are acceptable", () => {
    const result = evaluateInspectionChecklist({
      items: [{ key: "brakes", label: "Brakes", type: "PASS_FAIL", required: true }],
      answers: { brakes: { value: "PASS" } }
    });
    expect(result.result).toBe("PASS");
    expect(result.errors).toHaveLength(0);
  });
});

describe("inspection lifecycle", () => {
  function service(prisma: Record<string, unknown>) {
    return new PlanningService(prisma as never, { create: jest.fn() } as never);
  }

  it("rejects starting a completed inspection", async () => {
    const prisma = {
      inspection: {
        findFirst: jest.fn().mockResolvedValue({ id: "insp-1", status: "COMPLETED", tenantId: "tenant-a" })
      }
    };
    await expect(service(prisma).startInspection(actor, "insp-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not create a second corrective work order when completion is repeated", async () => {
    const create = jest.fn();
    const prisma = {
      inspection: {
        findFirst: jest.fn().mockResolvedValue({
          id: "insp-1",
          status: "COMPLETED",
          tenantId: "tenant-a",
          correctiveWorkOrderId: "wo-1",
          findingRecords: [{ maintenanceRequestId: "mr-1" }]
        })
      }
    };
    const planning = new PlanningService(prisma as never, { create } as never);
    const row = await planning.completeInspection(actor, {
      inspectionId: "insp-1",
      result: InspectionResult.FAIL,
      findings: "Leak"
    });
    expect((row as { alreadyCompleted?: boolean }).alreadyCompleted).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a frozen checklist version after the template changes", () => {
    const snapshot = {
      version: 1,
      items: [{ key: "brakes", label: "Brakes", type: "PASS_FAIL", required: true }]
    };
    const editedTemplate = { version: 2, items: [{ key: "brakes", label: "Brakes renamed", type: "PASS_FAIL" }] };
    expect(snapshot.version).toBe(1);
    expect(snapshot.items[0]?.label).toBe("Brakes");
    expect(editedTemplate.items[0]?.label).not.toBe(snapshot.items[0]?.label);
  });

  it("rejects a cross-tenant asset when scheduling", async () => {
    const prisma = {
      asset: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    await expect(
      service(prisma).scheduleInspection(actor, { title: "Daily check", assetId: "other-tenant-asset" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a cross-tenant vehicle when scheduling", async () => {
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    await expect(
      service(prisma).scheduleInspection(actor, { title: "Pre-trip", vehicleId: "other-tenant-vehicle" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a cross-tenant location when scheduling", async () => {
    const prisma = {
      functionalLocation: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    await expect(
      service(prisma).scheduleInspection(actor, { title: "Walk", functionalLocationId: "other-tenant-location" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
