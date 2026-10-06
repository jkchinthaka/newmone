import { EvidenceType, WorkOrderType } from "@prisma/client";

import { evaluateEvidenceRequirements, evidenceDisplayStatus, isEvidenceAbsent } from "../src/common/utils/work-order-evidence-governance";

/**
 * QA: work orders with no evidence showed "Complete" in the list because the non-production
 * storage waiver set `complete=true`. The display status must reflect real evidence and be
 * the same everywhere (list, detail, reports, exceptions).
 */
describe("Evidence display status semantics", () => {
  const before = { evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED", verificationStatus: null };
  const after = { evidenceType: EvidenceType.AFTER_PHOTO, status: "UPLOADED", verificationStatus: null };

  it("shows Waived (never Complete) when storage is off and no photos exist in non-production", () => {
    const checklist = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [], { storageEnabled: false });
    expect(checklist.complete).toBe(true); // workflow waiver still allows completion outside production
    expect(checklist.evidenceWaivedForStorage).toBe(true);
    expect(checklist.displayStatus).toBe("Waived (no storage)");
    expect(isEvidenceAbsent(checklist.displayStatus)).toBe(true);
  });

  it("shows Complete only when both photos exist", () => {
    expect(evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [before, after], { storageEnabled: true }).displayStatus).toBe(
      "Complete"
    );
    expect(evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [before], { storageEnabled: true }).displayStatus).toBe(
      "Missing"
    );
  });

  it("uses Not required only when the work type does not require evidence", () => {
    expect(evidenceDisplayStatus({ required: false, photoComplete: false, rejectedCount: 0 })).toBe("Not required");
    expect(evidenceDisplayStatus({ required: true, photoComplete: true, rejectedCount: 1 })).toBe("Rejected");
  });
});
