/**
 * BFF CSRF exemption registry.
 * Mutations not listed here require matching CSRF cookie + X-CSRF-Token header.
 */
export type CsrfExemption = {
  path: string;
  match: "exact" | "prefix";
  reason: string;
  authRequirement: string;
  abuseRisk: string;
  testCoverage: string;
};

export const BFF_CSRF_EXEMPTIONS: readonly CsrfExemption[] = [
  {
    path: "auth/login",
    match: "exact",
    reason: "No session yet; CSRF cookie is issued on successful login",
    authRequirement: "Public",
    abuseRisk: "Credential stuffing — mitigated by API throttling",
    testCoverage: "CSRF-001 / BFF login tests"
  },
  {
    path: "auth/register",
    match: "exact",
    reason: "Public registration bootstraps a new session",
    authRequirement: "Public (if enabled)",
    abuseRisk: "Spam registration — mitigated by API throttling / invite policy",
    testCoverage: "Documented; invite-only product posture preferred"
  },
  {
    path: "auth/forgot-password",
    match: "exact",
    reason: "Unauthenticated recovery start; no session cookies yet",
    authRequirement: "Public",
    abuseRisk: "Email enumeration / flood — mitigated by API throttling",
    testCoverage: "CSRF exemption table review"
  },
  {
    path: "auth/reset-password",
    match: "exact",
    reason: "Tokenized recovery; request carries one-time reset token",
    authRequirement: "Public with reset token",
    abuseRisk: "Token guessing — mitigated by token entropy + throttling",
    testCoverage: "CSRF exemption table review"
  },
  {
    path: "auth/invite/accept",
    match: "exact",
    reason: "Invite token authenticates the action before session exists",
    authRequirement: "Public with invite token",
    abuseRisk: "Invite token theft — mitigated by single-use tokens",
    testCoverage: "CSRF exemption table review"
  },
  {
    path: "auth/invite/verify",
    match: "exact",
    reason: "Read-only invite validation before accept",
    authRequirement: "Public with invite token",
    abuseRisk: "Low (verification only)",
    testCoverage: "CSRF exemption table review"
  },
  {
    path: "billing/webhooks/",
    match: "prefix",
    reason: "Provider-signed webhooks cannot send browser CSRF double-submit",
    authRequirement: "Provider signature (Stripe etc.)",
    abuseRisk: "Forged webhooks if signature check fails — API must verify signatures",
    testCoverage: "CSRF-003 webhook exemption; API signature tests"
  }
] as const;

export function isBffCsrfExempt(path: string): boolean {
  return BFF_CSRF_EXEMPTIONS.some((rule) =>
    rule.match === "exact" ? path === rule.path : path.startsWith(rule.path)
  );
}

export function extractAuthTokens(body: unknown): { accessToken?: string; refreshToken?: string } {
  if (!body || typeof body !== "object") return {};
  const root = body as { data?: Record<string, unknown> & { data?: Record<string, unknown> } };
  const nested = root.data;
  if (nested && typeof nested === "object") {
    if (typeof nested.accessToken === "string" || typeof nested.refreshToken === "string") {
      return {
        accessToken: typeof nested.accessToken === "string" ? nested.accessToken : undefined,
        refreshToken: typeof nested.refreshToken === "string" ? nested.refreshToken : undefined
      };
    }
    if (nested.data && typeof nested.data === "object") {
      const inner = nested.data;
      return {
        accessToken: typeof inner.accessToken === "string" ? inner.accessToken : undefined,
        refreshToken: typeof inner.refreshToken === "string" ? inner.refreshToken : undefined
      };
    }
  }
  return {};
}

export function stripAuthTokensFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const clone = JSON.parse(JSON.stringify(body)) as { data?: Record<string, unknown> };
  if (clone.data && typeof clone.data === "object") {
    delete clone.data.accessToken;
    delete clone.data.refreshToken;
    if (clone.data.data && typeof clone.data.data === "object") {
      const nested = clone.data.data as Record<string, unknown>;
      delete nested.accessToken;
      delete nested.refreshToken;
    }
  }
  return clone;
}

export function browserVisibleBodyContainsTokenLiterals(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const json = JSON.stringify(body);
  return /"accessToken"\s*:/.test(json) || /"refreshToken"\s*:/.test(json);
}