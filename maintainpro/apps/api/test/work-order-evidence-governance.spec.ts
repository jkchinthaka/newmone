import { BadRequestException } from "@nestjs/common";
import { EvidenceType, EvidenceVerificationStatus, QrVerificationStatus, WorkOrderType } from "@prisma/client";

import {
  assertEvidenceForSupervisorVerification,
  assertEvidenceForTechnicianCompletion,
  evaluateEvidenceRequirements,
  isStorageUploadsEnabled
} from "../src/common/utils/work-order-evidence-governance";
import { calculateWorkOrderRiskScore } from "../src/common/utils/maintenance-risk-score";

describe("work order evidence governance", () => {
  const originalStorageFlag = process.env.STORAGE_UPLOADS_ENABLED;
  const originalRoot = process.env.STORAGE_LOCAL_ROOT;

  beforeAll(() => {
    // Uploads count as enabled only when the storage provider is ready (local root configured).
    process.env.STORAGE_UPLOADS_ENABLED = "true";
    process.env.STORAGE_LOCAL_ROOT = "/srv/maintainpro-evidence-test";
  });

  afterAll(() => {
    process.env.STORAGE_UPLOADS_ENABLED = originalStorageFlag;
    if (originalRoot === undefined) delete process.env.STORAGE_LOCAL_ROOT;
    else process.env.STORAGE_LOCAL_ROOT = originalRoot;
  });
  const beforePhoto = {
    evidenceType: EvidenceType.BEFORE_PHOTO,
    status: "UPLOADED",
    verificationStatus: EvidenceVerificationStatus.PENDING
  };
  const afterPhoto = {
    evidenceType: EvidenceType.AFTER_PHOTO,
    status: "UPLOADED",
    verificationStatus: EvidenceVerificationStatus.PENDING
  };

  it("calculates required evidence checklist correctly", () => {
    const checklist = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [beforePhoto], {
      storageEnabled: true
    });
    expect(checklist.required).toBe(true);
    expect(checklist.hasBefore).toBe(true);
    expect(checklist.missingAfter).toBe(true);
    expect(checklist.complete).toBe(false);
  });

  it("marks complete only when required before and after photos are present", () => {
    const incomplete = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [beforePhoto], {
      storageEnabled: true
    });
    const complete = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [beforePhoto, afterPhoto], {
      storageEnabled: true
    });

    expect(incomplete.complete).toBe(false);
    expect(complete.complete).toBe(true);
  });

  it("does not mark complete when evidence is not required", () => {
    const checklist = evaluateEvidenceRequirements(WorkOrderType.IMPROVEMENT, [], {
      storageEnabled: true
    });

    expect(checklist.required).toBe(false);
    expect(checklist.complete).toBe(false);
  });

  it("blocks technician completion when before photo missing", () => {
    expect(() =>
      assertEvidenceForTechnicianCompletion({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [afterPhoto],
        completionNote: "Done",
        qrStatus: QrVerificationStatus.VERIFIED,
        assetId: "asset-1"
      })
    ).toThrow(new BadRequestException("Before photo is required before completion."));
  });

  it("blocks technician completion when after photo missing", () => {
    expect(() =>
      assertEvidenceForTechnicianCompletion({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [beforePhoto],
        completionNote: "Done",
        qrStatus: QrVerificationStatus.VERIFIED,
        assetId: "asset-1"
      })
    ).toThrow(new BadRequestException("After photo is required before completion."));
  });

  it("blocks technician completion when note missing", () => {
    expect(() =>
      assertEvidenceForTechnicianCompletion({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [beforePhoto, afterPhoto],
        completionNote: "  ",
        qrStatus: QrVerificationStatus.VERIFIED,
        assetId: "asset-1"
      })
    ).toThrow(new BadRequestException("Technician completion note is required."));
  });

  it("blocks supervisor verification when evidence missing", () => {
    expect(() =>
      assertEvidenceForSupervisorVerification({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [beforePhoto]
      })
    ).toThrow(
      new BadRequestException("Supervisor verification blocked because required evidence is missing.")
    );
  });

  it("allows supervisor verification when evidence complete", () => {
    expect(() =>
      assertEvidenceForSupervisorVerification({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [beforePhoto, afterPhoto]
      })
    ).not.toThrow();
  });

  it.each(["minio", "s3", "cloudinary", "mock"])(
    "blocks required photo completion in production when STORAGE_MODE is %s",
    (mode) => {
      const previousEnv = process.env.NODE_ENV;
      const previousMode = process.env.STORAGE_MODE;
      process.env.NODE_ENV = "production";
      process.env.STORAGE_MODE = mode;
      try {
        const checklist = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, []);
        expect(checklist.required).toBe(true);
        expect(checklist.complete).toBe(false);
        expect((checklist as { waived?: boolean }).waived).not.toBe(true);
        expect(checklist.storageUnavailableBlocking || checklist.missingBefore).toBe(true);
        expect(() =>
          assertEvidenceForTechnicianCompletion({
            workOrderType: WorkOrderType.CORRECTIVE,
            items: [],
            completionNote: "Completed without photos"
          })
        ).toThrow(BadRequestException);
      } finally {
        process.env.NODE_ENV = previousEnv;
        if (previousMode === undefined) delete process.env.STORAGE_MODE;
        else process.env.STORAGE_MODE = previousMode;
      }
    }
  );

  it("adds risk score factors for evidence and QR issues", () => {
    const score = calculateWorkOrderRiskScore({
      requiredEvidenceMissing: true,
      qrMismatch: true,
      evidenceRejected: true,
      offlineSyncFailed: true
    });
    expect(score).toBe(20 + 15 + 10 + 5);
  });

  it("does not require photos when MinIO byte transfer is not implemented", () => {
    const previous = process.env.STORAGE_MODE;
    process.env.STORAGE_MODE = "minio";
    try {
      expect(isStorageUploadsEnabled()).toBe(false);
      expect(() =>
        assertEvidenceForTechnicianCompletion({
          workOrderType: WorkOrderType.CORRECTIVE,
          items: [],
          completionNote: "note only"
        })
      ).not.toThrow();
    } finally {
      if (previous === undefined) delete process.env.STORAGE_MODE;
      else process.env.STORAGE_MODE = previous;
    }
  });
});
