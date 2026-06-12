import { toSafeDisplayMessage } from "../../web/lib/safe-display-message";

describe("safe display message helpers", () => {
  it("renders safe fallback for unsafe technical error details", () => {
    expect(
      toSafeDisplayMessage("Error: ECONNREFUSED at MongoClient.connect (/node_modules/mongodb)")
    ).toBe("Something went wrong. Please try again.");

    expect(toSafeDisplayMessage("Invalid refresh token for user jwt payload")).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("keeps user-friendly API messages when safe", () => {
    expect(toSafeDisplayMessage("Unable to load inventory data.")).toBe(
      "Unable to load inventory data."
    );
  });

  it("returns fallback for empty messages", () => {
    expect(toSafeDisplayMessage("", "Fallback message")).toBe("Fallback message");
  });

  it("returns fallback for overly long messages", () => {
    expect(toSafeDisplayMessage("x".repeat(281), "Fallback message")).toBe("Fallback message");
  });
});
