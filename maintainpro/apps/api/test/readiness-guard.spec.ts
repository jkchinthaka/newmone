import jwt from "jsonwebtoken";

import { isAuthorizedForReadiness } from "../src/bootstrap/readiness-guard";

describe("isAuthorizedForReadiness", () => {
  const accessJwtSecret = "test-secret";

  it("allows all requests outside production", () => {
    expect(isAuthorizedForReadiness({}, { isProd: false, accessJwtSecret })).toBe(true);
  });

  it("rejects requests with no credentials in production", () => {
    expect(isAuthorizedForReadiness({}, { isProd: true, accessJwtSecret })).toBe(false);
  });

  it("allows a request with a matching READINESS_API_KEY header", () => {
    const headers = { "x-readiness-key": "secret-key" };
    expect(
      isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret, readinessApiKey: "secret-key" })
    ).toBe(true);
  });

  it("rejects a request with a non-matching READINESS_API_KEY header", () => {
    const headers = { "x-readiness-key": "wrong-key" };
    expect(
      isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret, readinessApiKey: "secret-key" })
    ).toBe(false);
  });

  it("allows an ADMIN bearer token in production", () => {
    const token = jwt.sign({ sub: "user-1", role: "ADMIN" }, accessJwtSecret);
    const headers = { authorization: `Bearer ${token}` };
    expect(isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret })).toBe(true);
  });

  it("allows a SUPER_ADMIN bearer token in production", () => {
    const token = jwt.sign({ sub: "user-1", role: "SUPER_ADMIN" }, accessJwtSecret);
    const headers = { authorization: `Bearer ${token}` };
    expect(isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret })).toBe(true);
  });

  it("rejects a non-admin bearer token in production", () => {
    const token = jwt.sign({ sub: "user-1", role: "TECHNICIAN" }, accessJwtSecret);
    const headers = { authorization: `Bearer ${token}` };
    expect(isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret })).toBe(false);
  });

  it("rejects an invalid/expired bearer token in production", () => {
    const headers = { authorization: "Bearer not-a-real-token" };
    expect(isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret })).toBe(false);
  });

  it("rejects a token signed with a different secret in production", () => {
    const token = jwt.sign({ sub: "user-1", role: "ADMIN" }, "other-secret");
    const headers = { authorization: `Bearer ${token}` };
    expect(isAuthorizedForReadiness(headers, { isProd: true, accessJwtSecret })).toBe(false);
  });
});
