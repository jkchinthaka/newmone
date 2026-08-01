import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { assertMakerCheckerSeparation } from "../src/common/utils/fraud-control.util";

describe("purchase-order-approval-maker-checker", () => {
  it("blocks creator approving own operational step", () => {
    expect(() =>
      assertMakerCheckerSeparation({
        requesterId: "creator-1",
        approverId: "creator-1",
        approverRole: RoleName.MANAGER,
        flow: "purchase order operational approval"
      })
    ).toThrow(ForbiddenException);
  });

  it("allows different approver", () => {
    expect(() =>
      assertMakerCheckerSeparation({
        requesterId: "creator-1",
        approverId: "manager-1",
        approverRole: RoleName.MANAGER,
        flow: "purchase order operational approval"
      })
    ).not.toThrow();
  });

  it("allows admin self-approval", () => {
    expect(() =>
      assertMakerCheckerSeparation({
        requesterId: "admin-1",
        approverId: "admin-1",
        approverRole: RoleName.ADMIN,
        flow: "purchase order finance approval"
      })
    ).not.toThrow();
  });
});