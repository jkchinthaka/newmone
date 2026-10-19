import { applyHttpServerTimeouts, resolveHttpServerTimeouts } from "../src/bootstrap/http-server-timeouts";

describe("HTTP server keep-alive timeouts", () => {
  it("defaults to 65 s keep-alive and 66 s headers timeout", () => {
    expect(resolveHttpServerTimeouts({})).toEqual({ keepAliveTimeoutMs: 65_000, headersTimeoutMs: 66_000 });
  });

  it("reads both values from env", () => {
    expect(
      resolveHttpServerTimeouts({ HTTP_KEEP_ALIVE_TIMEOUT_MS: "70000", HTTP_HEADERS_TIMEOUT_MS: "75000" })
    ).toEqual({ keepAliveTimeoutMs: 70_000, headersTimeoutMs: 75_000 });
  });

  it("keeps headersTimeout greater than keepAliveTimeout", () => {
    expect(
      resolveHttpServerTimeouts({ HTTP_KEEP_ALIVE_TIMEOUT_MS: "70000", HTTP_HEADERS_TIMEOUT_MS: "60000" })
    ).toEqual({ keepAliveTimeoutMs: 70_000, headersTimeoutMs: 71_000 });
  });

  it("ignores invalid values", () => {
    expect(resolveHttpServerTimeouts({ HTTP_KEEP_ALIVE_TIMEOUT_MS: "abc", HTTP_HEADERS_TIMEOUT_MS: "-5" })).toEqual({
      keepAliveTimeoutMs: 65_000,
      headersTimeoutMs: 66_000
    });
  });

  it("applies the values to the server", () => {
    const server = { keepAliveTimeout: 5_000, headersTimeout: 60_000 };
    applyHttpServerTimeouts(server, {});
    expect(server).toEqual({ keepAliveTimeout: 65_000, headersTimeout: 66_000 });
  });
});
