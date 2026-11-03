import { BadRequestException } from "@nestjs/common";

import { explicitJobDomainFitsTarget, resolveTargetJobDomain } from "../src/common/utils/job-domain.util";
import {
  DailyRemindersService,
  latestVehicleDocuments,
  reminderDay,
  vehicleDocumentNotificationType
} from "../src/modules/notifications/daily-reminders.service";
import { PmAutoSchedulerService, sweepMeterValue } from "../src/modules/planning/pm-auto-scheduler.service";
import { ReliabilityService, downtimeCategoryForHold } from "../src/modules/reliability/reliability.service";
import { vehicleServiceState } from "../src/modules/work-orders/vehicle-jobs-overview";
import {
  WorkOrderDomainService,
  cancelReleaseStatus,
  closeReleaseStatus
} from "../src/modules/work-orders/work-order-domain.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

const tenantId = "t-1";
const actor = { sub: "admin-1", tenantId, role: "ADMIN" } as never;

describe("1-2: machine / vehicle status after close and cancel", () => {
  it("close follows Return to service rules", () => {
    expect(closeReleaseStatus({ target: "asset" })).toBe("ACTIVE");
    expect(closeReleaseStatus({ target: "asset", temporaryRepair: true })).toBe("OUT_OF_SERVICE");
    expect(closeReleaseStatus({ target: "vehicle" })).toBe("AVAILABLE");
    expect(closeReleaseStatus({ target: "vehicle", operatingRestriction: "Max 40 km/h" })).toBe("OUT_OF_SERVICE");
    expect(closeReleaseStatus({ target: "vehicle", vehicleComplianceStatus: "NON_COMPLIANT" })).toBe("OUT_OF_SERVICE");
  });

  it("cancel restores the status from before the job started", () => {
    expect(cancelReleaseStatus("asset", "INACTIVE")).toBe("INACTIVE");
    expect(cancelReleaseStatus("asset", null)).toBe("ACTIVE");
    expect(cancelReleaseStatus("vehicle", "AVAILABLE")).toBe("AVAILABLE");
    expect(cancelReleaseStatus("vehicle", "UNDER_MAINTENANCE")).toBe("AVAILABLE");
    expect(cancelReleaseStatus("vehicle", "NOT_A_STATUS")).toBe("AVAILABLE");
  });

  function domainPrisma(job: Record<string, unknown>, others = 0, beforeStatus = "INACTIVE") {
    return {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue(job),
        count: jest.fn().mockResolvedValue(others)
      },
      asset: { update: jest.fn().mockResolvedValue({}) },
      vehicle: { update: jest.fn().mockResolvedValue({}) },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ beforeData: JSON.stringify({ status: beforeStatus }) })
      }
    };
  }

  it("cancelling a started job gives the machine back its old status", async () => {
    const prisma = domainPrisma({ id: "wo-1", woNumber: "WO-1", assetId: "a-1", asset: { id: "a-1", status: "UNDER_MAINTENANCE" } });
    const service = new WorkOrderDomainService(prisma as never);
    await service.releaseTargetAfterCancel("wo-1", actor);
    expect(prisma.asset.update).toHaveBeenCalledWith({ where: { id: "a-1" }, data: { status: "INACTIVE" } });
  });

  it("another open job keeps it under maintenance", async () => {
    const prisma = domainPrisma({ id: "wo-1", woNumber: "WO-1", assetId: "a-1", asset: { id: "a-1", status: "UNDER_MAINTENANCE" } }, 1);
    const service = new WorkOrderDomainService(prisma as never);
    await service.releaseTargetAfterCancel("wo-1", actor);
    expect(prisma.asset.update).not.toHaveBeenCalled();
  });

  it("closing a temporary repair leaves the vehicle out of service", async () => {
    const prisma = domainPrisma({
      id: "wo-2",
      woNumber: "WO-2",
      temporaryRepair: true,
      vehicleId: "v-1",
      vehicle: { id: "v-1", status: "UNDER_MAINTENANCE", complianceStatus: "" }
    });
    const service = new WorkOrderDomainService(prisma as never);
    await service.releaseTargetIfLastOpenWorkOrder("wo-2", actor);
    expect(prisma.vehicle.update).toHaveBeenCalledWith({ where: { id: "v-1" }, data: { status: "OUT_OF_SERVICE" } });
  });
});

describe("3: scheduled service runs by itself", () => {
  it("uses the vehicle odometer for km plans and the machine meter for hour plans", () => {
    const meters = new Map([["m-1", 1520]]);
    expect(
      sweepMeterValue(
        { id: "p", tenantId, vehicleId: "v", nextDueMeterId: null, vehicle: { currentMileage: 40200 }, triggers: [{ kind: "METER", meterId: null, isActive: true }] },
        meters
      )
    ).toBe(40200);
    expect(
      sweepMeterValue(
        { id: "p", tenantId, vehicleId: null, nextDueMeterId: null, triggers: [{ kind: "METER", meterId: "m-1", isActive: true }] },
        meters
      )
    ).toBe(1520);
    expect(sweepMeterValue({ id: "p", tenantId, vehicleId: "v", nextDueMeterId: null, triggers: [{ kind: "CALENDAR", meterId: null, isActive: true }] }, meters)).toBeUndefined();
  });

  it("checks every active plan with an admin as creator", async () => {
    const prisma = {
      pmPlan: {
        findMany: jest.fn().mockResolvedValue([
          { id: "p-1", tenantId, vehicleId: "v-1", nextDueMeterId: null, vehicle: { currentMileage: 50000 }, triggers: [{ kind: "METER", meterId: null, isActive: true }] },
          { id: "p-2", tenantId, vehicleId: null, nextDueMeterId: null, triggers: [{ kind: "CALENDAR", meterId: null, isActive: true }] }
        ])
      },
      assetMeter: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "admin-1", email: "a@x", role: { name: "ADMIN" } }) }
    };
    const planning = {
      autoCreateWorkOrderIfDue: jest
        .fn()
        .mockResolvedValueOnce({ created: true, reason: "CREATED" })
        .mockResolvedValueOnce({ created: false, reason: "NOT_DUE" })
    };
    const scheduler = new PmAutoSchedulerService(prisma as never, planning as never);
    const now = new Date("2026-10-29T03:00:00Z");
    const result = await scheduler.runOnce(now);
    expect(result).toEqual({ checked: 2, created: 1, failed: 0 });
    expect(planning.autoCreateWorkOrderIfDue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sub: "admin-1", tenantId }),
      "p-1",
      { now, currentMeterValue: 50000 }
    );
  });
});

describe("4: request category follows the target", () => {
  it("drops a stale category that does not fit the new target", () => {
    expect(explicitJobDomainFitsTarget("MACHINERY", { vehicleId: "v-1" })).toBe(false);
    expect(resolveTargetJobDomain({ jobDomain: "MACHINERY", vehicleId: "v-1" })).toBe("VEHICLE");
    expect(resolveTargetJobDomain({ jobDomain: "VEHICLE", assetId: "a-1" })).toBe("MACHINERY");
    expect(resolveTargetJobDomain({ jobDomain: "MACHINERY" })).toBe("SERVICE");
    expect(resolveTargetJobDomain({ jobDomain: "SERVICE", assetId: "a-1" })).toBe("SERVICE");
  });
});

describe("5: machine downtime follows the job", () => {
  function downtimePrisma(open: Array<{ id: string; category: string }>) {
    return {
      downtimeSegment: {
        findMany: jest.fn().mockResolvedValue(open),
        updateMany: jest.fn().mockResolvedValue({ count: open.length }),
        create: jest.fn().mockResolvedValue({})
      },
      workOrder: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }
    };
  }
  const job = { id: "wo-1", assetId: "a-1", jobDomain: "MACHINERY", type: "BREAKDOWN" };

  it("maps hold reasons", () => {
    expect(downtimeCategoryForHold("WAITING_SPARE_PARTS")).toBe("WAITING_PARTS");
    expect(downtimeCategoryForHold("VENDOR")).toBe("WAITING_VENDOR");
    expect(downtimeCategoryForHold("OTHER")).toBe("OTHER");
  });

  it("start opens ACTIVE_REPAIR, hold switches to waiting, completion ends it", async () => {
    let prisma = downtimePrisma([]);
    await new ReliabilityService(prisma as never).syncAutoDowntime({ tenantId, workOrder: job, targetStatus: "IN_PROGRESS" });
    expect(prisma.downtimeSegment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ category: "ACTIVE_REPAIR", planned: false }) });

    prisma = downtimePrisma([{ id: "s-1", category: "ACTIVE_REPAIR" }]);
    await new ReliabilityService(prisma as never).syncAutoDowntime({ tenantId, workOrder: job, targetStatus: "ON_HOLD", holdReasonCode: "PARTS" });
    expect(prisma.downtimeSegment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId, id: { in: ["s-1"] } } }));
    expect(prisma.downtimeSegment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ category: "WAITING_PARTS" }) });

    prisma = downtimePrisma([{ id: "s-2", category: "WAITING_PARTS" }]);
    await new ReliabilityService(prisma as never).syncAutoDowntime({ tenantId, workOrder: job, targetStatus: "TECHNICIAN_COMPLETED" });
    expect(prisma.downtimeSegment.updateMany).toHaveBeenCalled();
    expect(prisma.downtimeSegment.create).not.toHaveBeenCalled();
  });

  it("does nothing for vehicle and service jobs", async () => {
    const prisma = downtimePrisma([]);
    await new ReliabilityService(prisma as never).syncAutoDowntime({
      tenantId,
      workOrder: { ...job, jobDomain: "VEHICLE" },
      targetStatus: "IN_PROGRESS"
    });
    expect(prisma.downtimeSegment.findMany).not.toHaveBeenCalled();
  });
});

describe("6: vehicle service due", () => {
  const now = new Date("2026-10-29T00:00:00Z");
  it("flags overdue and due soon by date or km", () => {
    expect(vehicleServiceState({ nextServiceDate: new Date("2026-10-20T00:00:00Z") }, now).state).toBe("OVERDUE");
    expect(vehicleServiceState({ currentMileage: 10100, nextServiceMileage: 10000 }, now).state).toBe("OVERDUE");
    expect(vehicleServiceState({ currentMileage: 9700, nextServiceMileage: 10000 }, now)).toEqual({ state: "DUE_SOON", daysLeft: null, kmLeft: 300 });
    expect(vehicleServiceState({ nextServiceDate: new Date("2026-11-30T00:00:00Z"), currentMileage: 1000, nextServiceMileage: 5000 }, now).state).toBe("OK");
  });
});

describe("8: is it fixed?", () => {
  function confirmService(job: Record<string, unknown>) {
    const service = Object.create(WorkOrdersService.prototype) as WorkOrdersService & Record<string, unknown>;
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue(job),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      workOrderAssignee: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: "mgr-1" }]) }
    };
    const notifications = { createNotification: jest.fn().mockResolvedValue({}) };
    Object.assign(service, {
      prisma,
      notificationsService: notifications,
      appendStatusHistory: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined)
    });
    return { service, prisma, notifications };
  }
  const verified = { id: "wo-1", tenantId, woNumber: "WO-1", status: "VERIFIED", version: 4, technicianId: "tech-1", requesterConfirmationStatus: "PENDING" };
  const reporter = { sub: "rep-1", tenantId, role: "TECHNICIAN" } as never;

  it("not fixed needs a note and sends the job back for rework", async () => {
    const { service, prisma, notifications } = confirmService(verified);
    await expect(service.applyRequesterConfirmation("wo-1", { fixed: false, note: "" }, reporter)).rejects.toBeInstanceOf(BadRequestException);
    await service.applyRequesterConfirmation("wo-1", { fixed: false, note: "Still leaking at the joint" }, reporter);
    expect(prisma.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REWORK_REQUIRED", requesterConfirmationOutcome: "UNRESOLVED" })
      })
    );
    const told = notifications.createNotification.mock.calls.map((call) => call[0].userId);
    expect(told).toEqual(expect.arrayContaining(["tech-1", "mgr-1"]));
  });

  it("fixed is recorded and managers are told the job can close", async () => {
    const { service, prisma, notifications } = confirmService(verified);
    await service.applyRequesterConfirmation("wo-1", { fixed: true }, reporter);
    const data = prisma.workOrder.updateMany.mock.calls[0][0].data;
    expect(data.requesterConfirmationOutcome).toBe("RESOLVED");
    expect(data.status).toBeUndefined();
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "mgr-1", title: "Reporter confirmed the fix" }));
  });

  it("refuses when the job is not waiting for confirmation", async () => {
    const { service } = confirmService({ ...verified, requesterConfirmationStatus: "NOT_REQUIRED" });
    await expect(service.applyRequesterConfirmation("wo-1", { fixed: true }, reporter)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("9: daily reminders", () => {
  it("keeps only the newest document per vehicle and type", () => {
    const docs = latestVehicleDocuments([
      { id: "old", vehicleId: "v", documentType: "INSURANCE", expiryDate: new Date("2026-10-01") },
      { id: "new", vehicleId: "v", documentType: "insurance", expiryDate: new Date("2027-10-01") },
      { id: "lic", vehicleId: "v", documentType: "REVENUE_LICENSE", expiryDate: new Date("2026-11-01") }
    ]);
    expect(docs.map((doc) => doc.id).sort()).toEqual(["lic", "new"]);
    expect(vehicleDocumentNotificationType("INSURANCE")).toBe("INSURANCE_EXPIRY");
    expect(vehicleDocumentNotificationType("REVENUE_LICENSE")).toBe("LICENSE_EXPIRY");
  });

  it("tells the technician and managers about overdue jobs once a day", async () => {
    const now = new Date("2026-10-29T03:00:00Z");
    const prisma = {
      workOrder: { findMany: jest.fn().mockResolvedValue([{ id: "wo-1", tenantId, woNumber: "WO-1", title: "Pump", technicianId: "tech-1" }]) },
      maintenanceRequest: { findMany: jest.fn().mockResolvedValue([]) },
      workPermit: { findMany: jest.fn().mockResolvedValue([]) },
      vehicleDocument: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: "mgr-1" }]) }
    };
    const notifications = { createNotification: jest.fn().mockResolvedValue({ id: "n" }) };
    const reminders = new DailyRemindersService(prisma as never, notifications as never);
    const sent = await reminders.runOnce(now);
    expect(sent.overdueJobs).toBe(2);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tech-1", dedupeKey: `reminder:wo-overdue:wo-1:${reminderDay(now)}` })
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "mgr-1", dedupeKey: `reminder:wo-overdue-summary:${tenantId}:${reminderDay(now)}` })
    );
  });
});
