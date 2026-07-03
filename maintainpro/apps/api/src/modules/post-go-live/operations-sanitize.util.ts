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

export function sanitizeOperationsText(text: string | null | undefined): string {
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
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*at\s+.+\(.+\)/.test(line) && !/node_modules|internal\//.test(line))
    .join("\n")
    .trim();
}

export function sanitizeTicketForViewer(ticket: Record<string, unknown>, canViewSensitive: boolean) {
  const fields = ["description", "businessImpact", "workaround", "resolutionNote", "rootCause"];
  const result = { ...ticket };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      result[field] = sanitizeOperationsText(result[field] as string);
      if (!canViewSensitive) result[field] = stripStackTrace(result[field] as string);
    }
  }
  if (ticket.isSensitive && !canViewSensitive) {
    result.technicalDetailsRestricted = true;
  }
  return result;
}

export function sanitizeHandoverDoc(doc: Record<string, unknown>) {
  const fields = [
    "systemUrls",
    "rolesResponsibilities",
    "supportContacts",
    "escalationMatrix",
    "backupProcess",
    "restoreProcess",
    "deploymentProcess",
    "rollbackProcess",
    "knownLimitations",
    "commonIssuesFixes",
    "trainingMaterials",
    "changeRequestProcess",
    "incidentProcess"
  ];
  const result = { ...doc };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      result[field] = sanitizeOperationsText(result[field] as string);
    }
  }
  return result;
}
