const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /mongodb(\+srv)?:\/\/[^\s"'`]+/gi, replacement: "[REDACTED_DATABASE_URL]" },
  { pattern: /(password|passwd|pwd)\s*[:=]\s*[^\s"'`,]+/gi, replacement: "$1=[REDACTED]" },
  { pattern: /(token|api[_-]?key|secret|authorization)\s*[:=]\s*[^\s"'`,]+/gi, replacement: "$1=[REDACTED]" },
  { pattern: /bearer\s+[a-z0-9._\-+/=]+/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /(smtp_pass|jwt_secret|database_url)\s*[:=]\s*[^\s"'`,]+/gi, replacement: "$1=[REDACTED]" },
  { pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: "[REDACTED_JWT]" }
];

export function containsSecretPatterns(text: string): boolean {
  return SECRET_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function sanitizeQaText(text: string | null | undefined): string {
  if (!text) return "";
  let sanitized = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function stripStackTrace(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter(
    (line) =>
      !/^\s*at\s+.+\(.+\)/.test(line) &&
      !/node_modules|internal\/|\.ts:\d+:\d+/.test(line)
  );
  return filtered.join("\n").trim();
}

export function sanitizeIssueForViewer(
  issue: Record<string, unknown>,
  canViewSensitive: boolean
): Record<string, unknown> {
  const textFields = [
    "description",
    "reproductionSteps",
    "expectedResult",
    "actualResult",
    "rootCause",
    "fixSummary",
    "workaround",
    "businessImpact",
    "userImpact",
    "resolutionNote"
  ];

  const result = { ...issue };
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      result[field] = sanitizeQaText(result[field] as string);
      if (!canViewSensitive) {
        result[field] = stripStackTrace(result[field] as string);
      }
    }
  }

  if (issue.isSensitive && !canViewSensitive) {
    result.technicalDetailsRestricted = true;
    result.affectedApi = issue.affectedApi ? "[RESTRICTED]" : null;
    result.linkedCommitHash = null;
    result.linkedDeployId = null;
  }

  return result;
}
