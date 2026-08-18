import { isFgBffSessionPath, normalizeFgBffPath } from "../../web/lib/fg-bff-path";

describe("FG BFF path normalization", () => {
  it("strips a duplicated v1 prefix from the App Router catch-all", () => {
    expect(normalizeFgBffPath(["v1", "dashboard"])).toEqual(["dashboard"]);
    expect(normalizeFgBffPath(["v1", "records", "open"])).toEqual(["records", "open"]);
  });

  it("leaves already-correct Django-relative paths unchanged", () => {
    expect(normalizeFgBffPath(["dashboard"])).toEqual(["dashboard"]);
    expect(normalizeFgBffPath(["session"])).toEqual(["session"]);
  });

  it("detects the session boot path after stripping v1", () => {
    expect(isFgBffSessionPath(["v1", "session"])).toBe(true);
    expect(isFgBffSessionPath(["session"])).toBe(true);
    expect(isFgBffSessionPath(["v1", "dashboard"])).toBe(false);
    expect(isFgBffSessionPath(["session", "extra"])).toBe(false);
  });
});
