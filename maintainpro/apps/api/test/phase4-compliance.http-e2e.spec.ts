import "reflect-metadata";

import { INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory, Reflector } from "@nestjs/core";
import {
  AccidentSeverity,
  AccidentStatus,
  AuditAction,
  ComplianceStatus,
  FinePaymentStatus,
  FineResponsibility,
  InsuranceClaimStatus,
  VehicleDocumentStatus,
  VehicleDocumentType,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { PrismaService } from "../src/database/prisma.service";

import { AccidentsController } from "../src/modules/accidents/accidents.controller";
import { AccidentsService } from "../src/modules/accidents/accidents.service";
import { ComplianceController } from "../src/modules/compliance/compliance.controller";
import { ComplianceService } from "../src/modules/compliance/compliance.service";
import { InsuranceClaimsController } from "../src/modules/insurance-claims/insurance-claims.controller";
import { InsuranceClaimsService } from "../src/modules/insurance-claims/insurance-claims.service";
import { TrafficFinesController } from "../src/modules/traffic-fines/traffic-fines.controller";
import { TrafficFinesService } from "../src/modules/traffic-fines/traffic-fines.service";
import { VehicleDocumentsController } from "../src/modules/vehicle-documents/vehicle-documents.controller";
import { VehicleDocumentsService } from "../src/modules/vehicle-documents/vehicle-documents.service";

const VALID_ID_1 = "507f1f77bcf86cd799439011";
const VALID_ID_2 = "507f1f77bcf86cd799439012";
const VALID_ID_3 = "507f1f77bcf86cd799439013";
const VALID_ID_4 = "507f1f77bcf86cd799439014";
const OTHER_TENANT_VEHICLE = "507f1f77bcf86cd799439099";

const buildPrismaMock = () => ({
  vehicle: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  vehicleDocument: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  accidentReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  accidentEvidence: {
    create: jest.fn()
  },
  insuranceClaim: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  trafficFine: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  workOrder: {
    create: jest.fn(),
    count: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
});

const prisma = buildPrismaMock();

@Module({
  controllers: [
    VehicleDocumentsController,
    ComplianceController,
    AccidentsController,
    InsuranceClaimsController,
    TrafficFinesController
  ],
  providers: [
    Reflector,
    VehicleDocumentsService,
    ComplianceService,
    AccidentsService,
    InsuranceClaimsService,
    TrafficFinesService,
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
class Phase4ComplianceHttpE2eModule {}

describe("Phase 4 Compliance HTTP e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, VehicleDocumentsController);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, ComplianceController);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, AccidentsController);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, InsuranceClaimsController);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, TrafficFinesController);

    app = await NestFactory.create(Phase4ComplianceHttpE2eModule, { logger: false });

    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      const permissionsHeader = req.headers["x-test-permissions"];
      const permissions =
        typeof permissionsHeader === "string" && permissionsHeader.trim().length > 0
          ? permissionsHeader.split(",").map((v) => v.trim()).filter(Boolean)
          : [];
      req.user = {
        sub: (req.headers["x-test-user-id"] as string) ?? "user-actor",
        email: (req.headers["x-test-email"] as string) ?? "actor@example.com",
        role: (req.headers["x-test-role"] as string) ?? "ADMIN",
        tenantId: (req.headers["x-tenant-id"] as string) ?? "tenant-1",
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
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  const vehicleOf = (tenant = "tenant-1", id = VALID_ID_1) => ({
    id,
    tenantId: tenant,
    registrationNo: "KA-01-AA-1234",
    make: "Tata",
    vehicleModel: "Ace"
  });

  // ── Vehicle Documents ──
  it("creates a vehicle document, persists audit CREATE and refreshes compliance", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.vehicleDocument.create.mockResolvedValue({
      id: "doc-1",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      documentType: VehicleDocumentType.INSURANCE,
      status: VehicleDocumentStatus.PENDING_VERIFICATION,
      expiryDate: new Date("2099-12-31")
    });
    prisma.vehicleDocument.findMany.mockResolvedValue([]);
    prisma.vehicle.update.mockResolvedValue({ id: VALID_ID_1 });

    const res = await request(app.getHttpServer())
      .post(`/vehicles/${VALID_ID_1}/documents`)
      .set("x-test-permissions", "vehicle_documents.manage")
      .send({ documentType: "INSURANCE", expiryDate: "2099-12-31", documentNumber: "POL-1" })
      .expect(201);

    expect(res.body.data.id).toBe("doc-1");
    expect(prisma.vehicleDocument.create).toHaveBeenCalled();
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.entity).toBe("VehicleDocument");
    expect(audit.action).toBe(AuditAction.CREATE);
    expect(audit.module).toBe("compliance");
  });

  it("verifies a vehicle document and records audit metadata.action=verify", async () => {
    prisma.vehicleDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      status: VehicleDocumentStatus.PENDING_VERIFICATION,
      expiryDate: new Date("2099-12-31"),
      documentType: VehicleDocumentType.INSURANCE
    });
    prisma.vehicleDocument.update.mockResolvedValue({ id: "doc-1", status: VehicleDocumentStatus.VERIFIED });
    prisma.vehicleDocument.findMany.mockResolvedValue([]);
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.vehicle.update.mockResolvedValue({ id: VALID_ID_1 });

    const res = await request(app.getHttpServer())
      .post("/vehicle-documents/doc-1/verify")
      .set("x-test-permissions", "vehicle_documents.verify")
      .expect(201);

    expect(res.body.data.status).toBe("VERIFIED");
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.metadata.action).toBe("verify");
  });

  it("rejects a vehicle document and stores rejection reason in audit metadata", async () => {
    prisma.vehicleDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      status: VehicleDocumentStatus.PENDING_VERIFICATION,
      expiryDate: new Date("2099-12-31"),
      documentType: VehicleDocumentType.INSURANCE
    });
    prisma.vehicleDocument.update.mockResolvedValue({ id: "doc-1", status: VehicleDocumentStatus.REJECTED });
    prisma.vehicleDocument.findMany.mockResolvedValue([]);
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.vehicle.update.mockResolvedValue({ id: VALID_ID_1 });

    const res = await request(app.getHttpServer())
      .post("/vehicle-documents/doc-1/reject")
      .set("x-test-permissions", "vehicle_documents.verify")
      .send({ reason: "Document illegible" })
      .expect(201);

    expect(res.body.data.status).toBe("REJECTED");
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.metadata.action).toBe("reject");
    expect(audit.metadata.rejectionReason).toBe("Document illegible");
  });

  // ── Compliance ──
  it("reports NON_COMPLIANT when a required document is missing", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.vehicleDocument.findMany.mockResolvedValue([
      // Only INSURANCE supplied — others are required and missing
      {
        id: "doc-ins",
        documentType: VehicleDocumentType.INSURANCE,
        status: VehicleDocumentStatus.VERIFIED,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    ]);

    const res = await request(app.getHttpServer())
      .get(`/compliance/vehicles/${VALID_ID_1}`)
      .set("x-test-permissions", "compliance.view")
      .expect(200);

    expect(res.body.data.status).toBe(ComplianceStatus.NON_COMPLIANT);
    expect(res.body.data.reasons.some((r: string) => r.includes("Missing required document"))).toBe(true);
  });

  it("returns NON_COMPLIANT when a required document has expired (gate-out blocking scenario)", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    prisma.vehicleDocument.findMany.mockResolvedValue([
      { documentType: VehicleDocumentType.REGISTRATION, status: VehicleDocumentStatus.VERIFIED, expiryDate: future },
      { documentType: VehicleDocumentType.INSURANCE, status: VehicleDocumentStatus.VERIFIED, expiryDate: expired },
      { documentType: VehicleDocumentType.FITNESS, status: VehicleDocumentStatus.VERIFIED, expiryDate: future },
      { documentType: VehicleDocumentType.POLLUTION, status: VehicleDocumentStatus.VERIFIED, expiryDate: future },
      { documentType: VehicleDocumentType.ROAD_TAX, status: VehicleDocumentStatus.VERIFIED, expiryDate: future }
    ]);

    const res = await request(app.getHttpServer())
      .get(`/compliance/vehicles/${VALID_ID_1}`)
      .set("x-test-permissions", "compliance.view")
      .expect(200);

    expect(res.body.data.status).toBe(ComplianceStatus.NON_COMPLIANT);
    expect(res.body.data.reasons.some((r: string) => r.startsWith("Document expired"))).toBe(true);
  });

  // ── Accidents ──
  it("creates an accident report and records audit CREATE", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.accidentReport.count.mockResolvedValue(0);
    prisma.accidentReport.create.mockResolvedValue({
      id: "acc-1",
      reportNumber: "ACC-2025-00001",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      severity: AccidentSeverity.MINOR,
      occurredAt: new Date("2025-01-01"),
      location: "Hosur Rd",
      description: "Side swipe"
    });

    const res = await request(app.getHttpServer())
      .post("/accidents")
      .set("x-test-permissions", "accidents.report")
      .send({
        vehicleId: VALID_ID_1,
        occurredAt: "2025-01-01T10:00:00.000Z",
        location: "Hosur Rd",
        description: "Side swipe"
      })
      .expect(201);

    expect(res.body.data.reportNumber).toMatch(/^ACC-/);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.entity).toBe("AccidentReport");
    expect(audit.action).toBe(AuditAction.CREATE);
  });

  it("links a work order to an accident and creates an ACCIDENT_REPAIR work order", async () => {
    prisma.accidentReport.findUnique.mockResolvedValue({
      id: "acc-1",
      tenantId: "tenant-1",
      reportNumber: "ACC-2025-00001",
      vehicleId: VALID_ID_1,
      occurredAt: new Date("2025-01-01"),
      location: "Hosur Rd",
      description: "Side swipe",
      evidence: [],
      workOrder: null
    });
    prisma.workOrder.count.mockResolvedValue(0);
    prisma.workOrder.create.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2025-00001",
      type: WorkOrderType.ACCIDENT_REPAIR,
      status: WorkOrderStatus.OPEN
    });

    const res = await request(app.getHttpServer())
      .post("/accidents/acc-1/work-order")
      .set("x-test-permissions", "accidents.manage")
      .send({ priority: "HIGH" })
      .expect(201);

    expect(res.body.data.type).toBe(WorkOrderType.ACCIDENT_REPAIR);
    expect(prisma.workOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WorkOrderType.ACCIDENT_REPAIR,
        accidentId: "acc-1"
      })
    });
  });

  // ── Insurance Claims ──
  it("creates an insurance claim and updates its status with audit before/after", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.insuranceClaim.count.mockResolvedValue(0);
    const createdClaim = {
      id: "claim-1",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      claimNumber: "INS-2025-00001",
      policyNumber: "POL-1",
      insurerName: "Acme",
      claimAmount: 1000,
      status: InsuranceClaimStatus.DRAFT
    };
    prisma.insuranceClaim.create.mockResolvedValue(createdClaim);

    const createRes = await request(app.getHttpServer())
      .post("/insurance-claims")
      .set("x-test-permissions", "insurance_claims.manage")
      .send({ vehicleId: VALID_ID_1, policyNumber: "POL-1", insurerName: "Acme", claimAmount: 1000 })
      .expect(201);
    expect(createRes.body.data.claimNumber).toMatch(/^INS-/);

    // Status update
    prisma.insuranceClaim.findUnique.mockResolvedValue({ ...createdClaim });
    prisma.insuranceClaim.update.mockResolvedValue({
      ...createdClaim,
      status: InsuranceClaimStatus.FILED,
      filedAt: new Date()
    });

    const statusRes = await request(app.getHttpServer())
      .post("/insurance-claims/claim-1/status")
      .set("x-test-permissions", "insurance_claims.approve")
      .send({ status: "FILED" })
      .expect(201);

    expect(statusRes.body.data.status).toBe(InsuranceClaimStatus.FILED);
    // Two audits created: CREATE then UPDATE status_change
    const lastAudit = prisma.auditLog.create.mock.calls.at(-1)![0].data;
    expect(lastAudit.action).toBe(AuditAction.UPDATE);
    expect(lastAudit.metadata.action).toBe("status_change");
    expect(lastAudit.metadata.previousStatus).toBe(InsuranceClaimStatus.DRAFT);
    expect(lastAudit.metadata.newStatus).toBe(InsuranceClaimStatus.FILED);
  });

  // ── Traffic Fines ──
  it("creates a traffic fine with default UNDETERMINED responsibility when no document context", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    prisma.trafficFine.count.mockResolvedValue(0);
    prisma.trafficFine.create.mockResolvedValue({
      id: "fine-1",
      fineNumber: "FIN-2025-00001",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      description: "Speeding",
      fineAmount: 500,
      responsibility: FineResponsibility.UNDETERMINED,
      paymentStatus: FinePaymentStatus.PENDING,
      documentRelated: false
    });

    const res = await request(app.getHttpServer())
      .post("/traffic-fines")
      .set("x-test-permissions", "traffic_fines.report")
      .send({
        vehicleId: VALID_ID_1,
        fineDate: "2025-05-01T00:00:00.000Z",
        offense: "Speeding",
        fineAmount: 500
      })
      .expect(201);

    expect(res.body.data.responsibility).toBe(FineResponsibility.UNDETERMINED);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.entity).toBe("TrafficFine");
    expect(audit.metadata.documentRelated).toBe(false);
  });

  it("classifies traffic fine as ORGANIZATION when related document was invalid on the fine date", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf());
    // No valid INSURANCE doc on fineDate
    prisma.vehicleDocument.findFirst.mockResolvedValue(null);
    prisma.trafficFine.count.mockResolvedValue(0);
    prisma.trafficFine.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "fine-2", ...data })
    );

    const res = await request(app.getHttpServer())
      .post("/traffic-fines")
      .set("x-test-permissions", "traffic_fines.report")
      .send({
        vehicleId: VALID_ID_1,
        fineDate: "2025-05-01T00:00:00.000Z",
        offense: "No insurance",
        fineAmount: 2000,
        relatedDocumentType: "INSURANCE"
      })
      .expect(201);

    expect(res.body.data.responsibility).toBe(FineResponsibility.ORGANIZATION);
    expect(res.body.data.documentRelated).toBe(true);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.metadata.docValidityCheck).toEqual({
      type: VehicleDocumentType.INSURANCE,
      valid: false,
      documentId: undefined
    });
  });

  it("links a CORRECTIVE work order to a traffic fine when responsibility is VEHICLE_DEFECT", async () => {
    prisma.trafficFine.findUnique.mockResolvedValue({
      id: "fine-3",
      tenantId: "tenant-1",
      fineNumber: "FIN-2025-00003",
      vehicleId: VALID_ID_1,
      description: "Defective brake light",
      responsibility: FineResponsibility.VEHICLE_DEFECT,
      workOrder: null
    });
    prisma.workOrder.count.mockResolvedValue(0);
    prisma.workOrder.create.mockResolvedValue({
      id: "wo-2",
      woNumber: "WO-2025-00001",
      type: WorkOrderType.CORRECTIVE,
      status: WorkOrderStatus.OPEN
    });

    const res = await request(app.getHttpServer())
      .post("/traffic-fines/fine-3/work-order")
      .set("x-test-permissions", "traffic_fines.manage")
      .send({})
      .expect(201);

    expect(res.body.data.type).toBe(WorkOrderType.CORRECTIVE);
    expect(prisma.workOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WorkOrderType.CORRECTIVE,
        trafficFineId: "fine-3"
      })
    });
  });

  it("rejects work-order link on traffic fine when responsibility is not VEHICLE_DEFECT", async () => {
    prisma.trafficFine.findUnique.mockResolvedValue({
      id: "fine-4",
      tenantId: "tenant-1",
      vehicleId: VALID_ID_1,
      responsibility: FineResponsibility.DRIVER,
      workOrder: null
    });

    await request(app.getHttpServer())
      .post("/traffic-fines/fine-4/work-order")
      .set("x-test-permissions", "traffic_fines.manage")
      .send({})
      .expect(400);
  });

  // ── Access control ──
  it("returns 403 when caller lacks the required permission", async () => {
    await request(app.getHttpServer())
      .post(`/vehicles/${VALID_ID_1}/documents`)
      .set("x-test-permissions", "unrelated.permission")
      .send({ documentType: "INSURANCE", expiryDate: "2099-12-31" })
      .expect(403);
  });

  it("enforces tenant isolation: returns 403 when the vehicle belongs to a different tenant", async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicleOf("tenant-other", OTHER_TENANT_VEHICLE));

    await request(app.getHttpServer())
      .post(`/vehicles/${OTHER_TENANT_VEHICLE}/documents`)
      .set("x-test-permissions", "vehicle_documents.manage")
      .set("x-tenant-id", "tenant-1")
      .send({ documentType: "INSURANCE", expiryDate: "2099-12-31" })
      .expect(403);
  });

  // ── Touch unused IDs to avoid lint complaints ──
  it("(reserved) keeps additional document IDs available for future scenarios", () => {
    expect(VALID_ID_2.length).toBe(24);
    expect(VALID_ID_3.length).toBe(24);
    expect(VALID_ID_4.length).toBe(24);
  });
});
