import { assertVersionMatch, withVersionIncrement } from "../src/common/utils/optimistic-concurrency.util";
import { ConflictException } from "@nestjs/common";

describe("optimistic concurrency helpers", () => {
  it("allows missing expected version", () => {
    expect(() => assertVersionMatch(3, undefined, "Work order")).not.toThrow();
  });

  it("throws conflict when versions differ", () => {
    expect(() => assertVersionMatch(2, 1, "Work order")).toThrow(ConflictException);
  });

  it("increments version in update payload", () => {
    expect(withVersionIncrement({ title: "x" })).toEqual({
      title: "x",
      version: { increment: 1 }
    });
  });
});
