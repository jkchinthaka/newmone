import "reflect-metadata";

import { INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory, Reflector } from "@nestjs/core";
import {
  ComplianceStatus,
  DriverTrainingStatus,
  VehicleServiceStatus
} from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { PrismaService } from "../src/database/prisma.service";
import { DriverIntelligenceController } from "../src/modules/driver-intelligence/driver-intelligence.controller";
import { DriverIntelligenceService } from "../src/modules/driver-intelligence/driver-intelligence.service";

const DRIVER_ID = "507f1f77bcf86cd799439011";
const OTHER_DRIVER_ID = "507f1f77bcf86cd799439099";
const VEHICLE_ID = "507f1f77bcf86cd799439012";

const createPrismaMock = () => ({
  driver: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  accidentReport: {
    findMany: jest.fn()
  },
  trafficFine: {
    findMany: jest.fn()
  },
  tripLog: {
    findMany: jest.fn()
  },
  fuelLog: {
    findMany: jest.fn()
  },
  workOrder: {
    findMany: jest.fn()
  },
  maintenanceLog: {
    findMany: jest.fn()
  },
  vehicle: {
    findUnique: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
});

const prisma = createPrismaMock();

const buildDriver = (overrides: Record<string, unknown> = {}) => ({
  id: DRIVER_ID,
  userId: "user-driver-1",
  tenantId: "tenant-1",
  licenseNumber: "DL-9001",
  licenseClass: "B",
  licenseExpiry: new Date("2099-12-31T00:00:00.000Z"),
  trainingStatus: DriverTrainingStatus.CURRENT,
  trainingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  trainingExpiry: new Date("2027-01-01T00:00:00.000Z"),
  supervisorReviewScore: 90,
  pendingDisciplinaryIssues: 0,
  user: {
    id: "user-driver-1",
    firstName: "Ari",
    lastName: "Fleet",
    email: "ari@example.com",
    phone: "+155555501"
  },
  department: {
    id: "dept-1",
    name: "Operations",
    code: "OPS"
  },
  vehicles: [
    {
      id: VEHICLE_ID,
      registrationNo: "KAA-1001",
      vehicleModel: "Transit",
      type: "VAN",
      currentMileage: 16000,
      complianceStatus: ComplianceStatus.COMPLIANT,
      serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
      nextServiceDate: null,
      nextServiceMileage: 20000,
      status: "AVAILABLE",
      departmentId: "dept-1"
    }
  ],
  ...overrides
});

@Module({
  controllers: [DriverIntelligenceController],
  providers: [
    DriverIntelligenceService,
    Reflector,
    {
      provide: PrismaService,
      useValue: prisma
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
class DriverIntelligenceHttpTestModule {}

describe("Driver Intelligence HTTP e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, DriverIntelligenceController);

    app = await NestFactory.create(DriverIntelligenceHttpTestModule, {
      logger: false
    });

    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      const permissionsHeader = req.headers["x-test-permissions"];
      const permissions =
        typeof permissionsHeader === "string" && permissionsHeader.trim().length > 0
          ? permissionsHeader
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];

      req.user = {
        sub: req.headers["x-test-user-id"] ?? "user-actor",
        email: req.headers["x-test-email"] ?? "actor@example.com",
        role: req.headers["x-test-role"] ?? "ADMIN",
        tenantId: req.headers["x-tenant-id"] ?? "tenant-1",
        permissions
      };

      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.accidentReport.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.trafficFine.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.tripLog.findMany.mockResolvedValue([]);
    prisma.fuelLog.findMany.mockResolvedValue([]).mockResolvedValue([]);
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.maintenanceLog.findMany.mockResolvedValue([]);
  });

  it("returns a driver intelligence profile for a permitted actor", async () => {
    prisma.driver.findUnique.mockResolvedValue(buildDriver());

    const response = await request(app.getHttpServer())
      .get(`/driver-intelligence/drivers/${DRIVER_ID}`)
      .set("x-test-permissions", "driver_intelligence.view")
      .set("x-tenant-id", "tenant-1")
      .expect(200);

    expect(response.body.data.id).toBe(DRIVER_ID);
    expect(response.body.data.displayName).toBe("Ari Fleet");
    expect(response.body.data.eligibility.eligible).toBe(true);
  });

  it("returns 403 when the driver belongs to a different tenant", async () => {
    prisma.driver.findUnique.mockResolvedValue(
      buildDriver({ id: OTHER_DRIVER_ID, tenantId: "tenant-2" })
    );

    await request(app.getHttpServer())
      .get(`/driver-intelligence/drivers/${OTHER_DRIVER_ID}`)
      .set("x-test-permissions", "driver_intelligence.view")
      .set("x-tenant-id", "tenant-1")
      .expect(403);
  });

  it("returns 403 on input updates without manage permission", async () => {
    await request(app.getHttpServer())
      .patch(`/driver-intelligence/drivers/${DRIVER_ID}/inputs`)
      .send({ supervisorReviewScore: 94 })
      .set("x-test-permissions", "driver_intelligence.view")
      .set("x-tenant-id", "tenant-1")
      .expect(403);

    expect(prisma.driver.update).not.toHaveBeenCalled();
  });
});