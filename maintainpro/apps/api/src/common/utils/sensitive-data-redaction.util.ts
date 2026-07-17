/**
 * Recursive redaction of sensitive keys for audit logs, replication payloads,
 * and API response leak detection.
 *
 * Matching is case-insensitive on key names. Nested objects and arrays are walked.
 * Sensitive values are replaced with "[REDACTED]" (never deleted silently so
 * reviewers can see that a field was present).
 */

const DEFAULT_SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^password$/i,
  /^passwordhash$/i,
  /^refreshtoken$/i,
  /^accesstoken$/i,
  /^tokenhash$/i,
  /^resettoken$/i,
  /^temporarypassword$/i,
  /^apikey$/i,
  /^apisecret$/i,
  /^clientsecret$/i,
  /^smtppass$/i,
  /^secret$/i,
  /secret$/i,
  /password/i,
  /tokenhash/i,
  /^authorization$/i,
  /^privatekey$/i,
  /^connectionstring$/i
];

/** Status-like fields that may contain the substring "token" or similar but are not secrets. */
export const SENSITIVE_KEY_ALLOWLIST = new Set(
  [
    "tokenType",
    "hasRefreshToken",
    "mustChangePassword",
    "passwordChangedAt",
    "lastPasswordChangedAt",
    "tokenExpiresAt",
    "expiresAt",
    "csrfTokenPresent"
  ].map((k) => k.toLowerCase())
);

export const REDACTED_PLACEHOLDER = "[REDACTED]";

export type RedactOptions = {
  /** Extra regexes or exact keys (case-insensitive) treated as sensitive. */
  additionalKeys?: Array<string | RegExp>;
  /** Keys that must never be redacted even if they match patterns. */
  allowlist?: Iterable<string>;
  /** When true, omit the key entirely instead of replacing the value. */
  omit?: boolean;
};

function normalizeAllowlist(allowlist?: Iterable<string>): Set<string> {
  const set = new Set(SENSITIVE_KEY_ALLOWLIST);
  if (allowlist) {
    for (const key of allowlist) {
      set.add(key.toLowerCase());
    }
  }
  return set;
}

function isSensitiveKey(key: string, patterns: RegExp[], allowlist: Set<string>): boolean {
  if (allowlist.has(key.toLowerCase())) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(key));
}

function buildPatterns(additionalKeys?: Array<string | RegExp>): RegExp[] {
  const patterns = [...DEFAULT_SENSITIVE_KEY_PATTERNS];
  if (!additionalKeys) return patterns;
  for (const entry of additionalKeys) {
    if (typeof entry === "string") {
      patterns.push(new RegExp(`^${escapeRegExp(entry)}$`, "i"));
    } else {
      patterns.push(entry);
    }
  }
  return patterns;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Deep-clone `value` while redacting sensitive keys.
 */
export function redactSensitiveData<T>(value: T, options: RedactOptions = {}): T {
  const patterns = buildPatterns(options.additionalKeys);
  const allowlist = normalizeAllowlist(options.allowlist);
  return walk(value, patterns, allowlist, options.omit === true) as T;
}

function walk(
  value: unknown,
  patterns: RegExp[],
  allowlist: Set<string>,
  omit: boolean
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => walk(entry, patterns, allowlist, omit));
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    if (isSensitiveKey(key, patterns, allowlist)) {
      if (!omit) {
        output[key] = REDACTED_PLACEHOLDER;
      }
      continue;
    }
    output[key] = walk(nested, patterns, allowlist, omit);
  }
  return output;
}

/**
 * Returns true when any forbidden secret-like key is present with a non-redacted value.
 */
export function containsUnredactedSecrets(
  value: unknown,
  options: RedactOptions & { forbiddenExactKeys?: string[] } = {}
): { found: boolean; paths: string[] } {
  const extraPatterns: RegExp[] = (options.forbiddenExactKeys ?? []).map(
    (k) => new RegExp("^" + escapeRegExp(k) + "$", "i")
  );
  for (const entry of options.additionalKeys ?? []) {
    if (typeof entry === "string") {
      extraPatterns.push(new RegExp("^" + escapeRegExp(entry) + "$", "i"));
    } else {
      extraPatterns.push(entry);
    }
  }
  const patterns = buildPatterns(extraPatterns);
  const allowlist = normalizeAllowlist(options.allowlist);
  const paths: string[] = [];

  const visit = (node: unknown, path: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, path + "[" + index + "]"));
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, nested] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = path ? path + "." + key : key;
      if (isSensitiveKey(key, patterns, allowlist)) {
        if (nested !== REDACTED_PLACEHOLDER && nested !== null && nested !== undefined) {
          paths.push(nextPath);
        }
      }
      visit(nested, nextPath);
    }
  };

  visit(value, "");
  return { found: paths.length > 0, paths };
}

/** Model-specific fields that should always be redacted in audit snapshots. */
export const MODEL_AUDIT_EXTRA_KEYS: Record<string, string[]> = {
  User: [
    "passwordHash",
    "failedLoginAttempts",
    "lockedUntil",
    "temporaryPasswordExpiresAt"
  ],
  AppSetting: ["value"],
  PasswordResetToken: ["tokenHash"],
  RefreshToken: ["tokenHash", "familyId"],
  UserInvitation: ["tokenHash"],
  TenantInvitation: ["token"]
};

/**
 * Models that should never write field-level audit snapshots (security-only).
 * Prefer skip over redaction when the entire payload is sensitive.
 */
export const AUDIT_SECURITY_SKIP_MODELS = new Set<string>([
  "RefreshToken",
  "PasswordResetToken",
  "Session",
  "UserInvitation"
]);
