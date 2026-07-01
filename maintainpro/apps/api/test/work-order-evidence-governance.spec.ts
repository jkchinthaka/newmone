import { BadRequestException } from "@nestjs/common";
import { EvidenceType, EvidenceVerificationStatus, QrVerificationStatus, WorkOrderType } from "@prisma/client";

import {
  assertEvidenceForSupervisorVerification,
  assertEvidenceForTechnicianCompletion,
  evaluateEvidenceRequirements
} from "../src/common/utils/work-order-evidence-governance";
import { calculateWorkOrderRiskScore } from "../src/common/utils/maintenance-risk-score";

describe("work order evidence governance", () => {
  const originalStorageFlag = process.env.STORAGE_UPLOADS_ENABLED;

  beforeAll(() => {
    process.env.STORAGE_UPLOADS_ENABLED = "true";
  });

  afterAll(() => {
    process.env.STORAGE_UPLOADS_ENABLED = originalStorageFlag;
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

  it("adds risk score factors for evidence and QR issues", () => {
    const score = calculateWorkOrderRiskScore({
      requiredEvidenceMissing: true,
      qrMismatch: true,
      evidenceRejected: true,
      offlineSyncFailed: true
    });
    expect(score).toBe(20 + 15 + 10 + 5);
  });
});
