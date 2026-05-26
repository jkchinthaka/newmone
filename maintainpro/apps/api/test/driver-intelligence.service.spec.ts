import {
  AccidentResponsibility,
  AccidentSeverity,
  ComplianceStatus,
  DriverTrainingStatus,
  FinePaymentStatus,
  FineResponsibility,
  TripStatus,
  VehicleServiceStatus
} from "@prisma/client";

import { DriverIntelligenceService } from "../src/modules/driver-intelligence/driver-intelligence.service";

const DRIVER_ID = "507f1f77bcf86cd799439011";
const VEHICLE_ID = "507f1f77bcf86cd799439012";

const createPrismaMock = () => ({
  driver: {
    findUnique: jest.fn()
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
  supervisorReviewScore: 88,
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

describe("DriverIntelligenceService", () => {
  const actor = {
    sub: "admin-user",
    email: "admin@example.com",
    role: "ADMIN" as const,
    tenantId: "tenant-1"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks a driver high risk and ineligible when serious safety signals exist", async () => {
    const prisma = createPrismaMock();
    prisma.driver.findUnique.mockResolvedValue(
      buildDriver({
        pendingDisciplinaryIssues: 1,
        vehicles: [
          {
            id: VEHICLE_ID,
            registrationNo: "KAA-1001",
            vehicleModel: "Transit",
            type: "VAN",
            currentMileage: 16000,
            complianceStatus: ComplianceStatus.NON_COMPLIANT,
            serviceStatus: VehicleServiceStatus.OVERDUE,
            nextServiceDate: null,
            nextServiceMileage: 15000,
            status: "AVAILABLE",
            departmentId: "dept-1"
          }
        ]
      })
    );
    prisma.accidentReport.findMany
      .mockResolvedValueOnce([
        {
          id: "acc-1",
          reportNumber: "ACC-1",
          occurredAt: new Date("2026-03-04T00:00:00.000Z"),
          severity: AccidentSeverity.MAJOR,
          responsibility: AccidentResponsibility.DRIVER,
          location: "Highway",
          status: "CLOSED",
          vehicleId: VEHICLE_ID
        }
      ])
      .mockResolvedValueOnce([]);
    prisma.trafficFine.findMany
      .mockResolvedValueOnce([
        {
          id: "fine-driver-1",
          fineNumber: "TF-1",
          fineDate: new Date("2026-03-10T00:00:00.000Z"),
          fineAmount: 650,
          description: "Dangerous speeding",
          violationCode: "SPD-CRIT",
          responsibility: FineResponsibility.DRIVER,
          documentRelated: false,
          paymentStatus: FinePaymentStatus.PENDING,
          vehicleId: VEHICLE_ID
        },
        {
          id: "fine-org-1",
          fineNumber: "TF-ORG",
          fineDate: new Date("2026-03-11T00:00:00.000Z"),
          fineAmount: 90,
          description: "Permit document missing",
          violationCode: "DOC-1",
          responsibility: FineResponsibility.ORGANIZATION,
          documentRelated: true,
          paymentStatus: FinePaymentStatus.PENDING,
          vehicleId: VEHICLE_ID
        }
      ])
      .mockResolvedValueOnce([]);
    prisma.tripLog.findMany.mockResolvedValue([
      {
        id: "trip-1",
        vehicleId: VEHICLE_ID,
        distance: 120,
        startTime: new Date("2026-03-01T08:00:00.000Z"),
        endTime: new Date("2026-03-01T10:00:00.000Z"),
        status: TripStatus.COMPLETED
      }
    ]);
    prisma.fuelLog.findMany.mockResolvedValue([]);
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.maintenanceLog.findMany.mockResolvedValue([]);

    const service = new DriverIntelligenceService(prisma as any);
    const profile = await service.driverProfile(actor, DRIVER_ID, {});

    expect(profile.riskLevel).toBe("HIGH");
    expect(profile.eligibility.eligible).toBe(false);
    expect(profile.summary.driverFaultAccidents).toBe(1);
    expect(profile.summary.driverRelatedFines).toBe(1);
    expect(profile.summary.organizationFines).toBe(1);
    expect(profile.eligibility.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("risk level"),
        expect.stringContaining("serious driver-related fine"),
        expect.stringContaining("driver-fault accident")
      ])
    );
  });

  it("does not count organization or duplicate vehicle-defect fines as driver-related", async () => {
    const prisma = createPrismaMock();
    prisma.driver.findUnique.mockResolvedValue(buildDriver());
    prisma.accidentReport.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.trafficFine.findMany
      .mockResolvedValueOnce([
        {
          id: "fine-org-1",
          fineNumber: "TF-ORG",
          fineDate: new Date("2026-04-01T00:00:00.000Z"),
          fineAmount: 80,
          description: "Organization renewal lag",
          violationCode: "DOC-2",
          responsibility: FineResponsibility.ORGANIZATION,
          documentRelated: true,
          paymentStatus: FinePaymentStatus.PENDING,
          vehicleId: VEHICLE_ID
        },
        {
          id: "fine-veh-1",
          fineNumber: "TF-VEH",
          fineDate: new Date("2026-04-02T00:00:00.000Z"),
          fineAmount: 140,
          description: "Brake defect notice",
          violationCode: "BRK-1",
          responsibility: FineResponsibility.VEHICLE_DEFECT,
          documentRelated: false,
          paymentStatus: FinePaymentStatus.PENDING,
          vehicleId: VEHICLE_ID
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "fine-veh-1",
          fineNumber: "TF-VEH",
          fineDate: new Date("2026-04-02T00:00:00.000Z"),
          fineAmount: 140,
          description: "Brake defect notice",
          violationCode: "BRK-1",
          responsibility: FineResponsibility.VEHICLE_DEFECT,
          vehicleId: VEHICLE_ID
        }
      ]);
    prisma.tripLog.findMany.mockResolvedValue([]);
    prisma.fuelLog.findMany.mockResolvedValue([]);
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.maintenanceLog.findMany.mockResolvedValue([]);

    const service = new DriverIntelligenceService(prisma as any);
    const profile = await service.driverProfile(actor, DRIVER_ID, {});

    expect(profile.summary.driverRelatedFines).toBe(0);
    expect(profile.summary.organizationFines).toBe(1);
    expect(profile.summary.vehicleDefectFines).toBe(1);
    expect(profile.eligibility.eligible).toBe(true);
  });
});