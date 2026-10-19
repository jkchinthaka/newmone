import { validationErrorText } from "../src/common/utils/validation-error-text";
import { calculateCostVariance } from "../src/common/utils/vendor-repair-governance";

describe("QA-FRESH-MAINT-047", () => {
  it("names the field on a validation error", () => {
    const formatted = validationErrorText([
      { property: "title", constraints: { isNotEmpty: "should not be empty" }, children: [] }
    ]);
    expect(formatted.messages[0]).toBe("title: should not be empty");
    expect(formatted.fieldErrors.title).toEqual(["should not be empty"]);
  });
});

describe("QA-FRESH-MAINT-043", () => {
  it("does not report a variance before an invoice exists", () => {
    expect(calculateCostVariance(1000, 0).varianceAmount).toBe(0);
  });
});
