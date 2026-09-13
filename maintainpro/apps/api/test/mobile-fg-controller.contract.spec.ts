import { readFileSync } from "fs";
import { join } from "path";

describe("MobileFgController contract", () => {
  const source = readFileSync(
    join(__dirname, "../src/modules/mobile-fg/mobile-fg.controller.ts"),
    "utf8"
  );

  it("does not expose a generic proxy route", () => {
    expect(source.toLowerCase()).not.toContain("proxy");
  });

  it("does not accept arbitrary upstream url from body", () => {
    expect(source).not.toMatch(/@Body\(\)\s*body:\s*\{\s*url/);
    expect(source).not.toMatch(/body\.url/);
  });

  it("is mounted under mobile/fg", () => {
    expect(source).toContain('@Controller("mobile/fg")');
  });
});
