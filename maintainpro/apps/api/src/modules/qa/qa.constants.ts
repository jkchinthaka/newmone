import { QaIssueCategory, QaIssueSeverity } from "@prisma/client";

export type QaCategoryMeta = {
  key: QaIssueCategory;
  label: string;
  description: string;
  examples: string[];
  severityGuidance: string;
  recommendedOwner: string;
  recommendedFixApproach: string;
};

export const QA_CATEGORY_CATALOG: QaCategoryMeta[] = [
  {
    key: "REQUIREMENT_ERROR",
    label: "Requirement Error",
    description: "Requirement unclear, missing, wrong business rule, missing user role, missing approval flow.",
    examples: ["Missing approval step", "Wrong SLA rule", "Role not defined in matrix"],
    severityGuidance: "Usually HIGH when workflow blocked; MEDIUM when workaround exists.",
    recommendedOwner: "Product Owner / Business Analyst",
    recommendedFixApproach: "Clarify requirement, update SOP, adjust RBAC matrix, re-UAT affected flow."
  },
  {
    key: "UI_UX_ERROR",
    label: "UI/UX Error",
    description: "Hard to use screen, unclear button, mobile responsive issue, poor validation, poor error message.",
    examples: ["Button label unclear", "Mobile table overflow", "Empty state missing"],
    severityGuidance: "LOW to MEDIUM unless blocking task completion.",
    recommendedOwner: "Frontend / UX",
    recommendedFixApproach: "Improve layout, copy, validation messages, responsive breakpoints."
  },
  {
    key: "FRONTEND_ERROR",
    label: "Frontend Error",
    description: "Wrong API path, infinite retry, state bug, token missing, CORS issue.",
    examples: ["Wrong axios base URL", "Stale cache after logout", "Missing X-Tenant-Id"],
    severityGuidance: "MEDIUM to HIGH depending on feature impact.",
    recommendedOwner: "Frontend Developer",
    recommendedFixApproach: "Fix API client, state management, error boundaries, env configuration."
  },
  {
    key: "BACKEND_ERROR",
    label: "Backend Error",
    description: "400, 401, 403, 404, 500, 503, route missing, server timeout, business logic fail.",
    examples: ["500 on save", "404 missing route", "Validation mismatch"],
    severityGuidance: "HIGH when core workflow fails; CRITICAL if widespread.",
    recommendedOwner: "Backend Developer",
    recommendedFixApproach: "Fix controller/service logic, add validation, improve error handling."
  },
  {
    key: "DATABASE_ERROR",
    label: "Database Error",
    description: "Duplicate key, null value, schema mismatch, slow query, invalid relationship, migration issue.",
    examples: ["Unique index conflict", "Prisma schema drift", "Slow aggregation"],
    severityGuidance: "CRITICAL for data corruption/unavailability.",
    recommendedOwner: "Database / Backend Engineer",
    recommendedFixApproach: "Schema fix, index review, query optimization, safe migration."
  },
  {
    key: "AUTH_RBAC_ERROR",
    label: "Auth / RBAC Error",
    description: "Login fail, token expired, wrong permission, over-permission, tenant leak.",
    examples: ["Technician sees admin API", "Cross-tenant data visible", "JWT expired silently"],
    severityGuidance: "CRITICAL for tenant leak or privilege escalation.",
    recommendedOwner: "Security / Backend Lead",
    recommendedFixApproach: "Fix guards, permission checks, tenant scoping, token handling."
  },
  {
    key: "API_INTEGRATION_ERROR",
    label: "API Integration Error",
    description: "ERP sync fail, timeout, wrong data mapping, auth denied, duplicate sync, partial sync.",
    examples: ["ERP stock mismatch", "Webhook timeout", "Duplicate PO sync"],
    severityGuidance: "HIGH when operations depend on sync.",
    recommendedOwner: "Integration Engineer",
    recommendedFixApproach: "Fix mapping, retry policy, idempotency, integration health checks."
  },
  {
    key: "DEPLOYMENT_ERROR",
    label: "Deployment Error",
    description: "Missing env variable, wrong backend URL, build fail, version mismatch, CORS misconfiguration.",
    examples: ["Missing JWT_SECRET", "Wrong FRONTEND_URL", "Cloudflare build fail"],
    severityGuidance: "CRITICAL if production unavailable.",
    recommendedOwner: "DevOps / Release Engineer",
    recommendedFixApproach: "Fix env vars, deployment pipeline, smoke tests, rollback plan."
  },
  {
    key: "PERFORMANCE_ERROR",
    label: "Performance Error",
    description: "Slow page, heavy query, no pagination, repeated API calls, memory issue, cold start delay.",
    examples: ["Work order list >5s", "N+1 queries", "Missing pagination"],
    severityGuidance: "MEDIUM to HIGH based on user impact.",
    recommendedOwner: "Backend / Frontend Performance Lead",
    recommendedFixApproach: "Pagination, caching, query tuning, debounce, lazy loading."
  },
  {
    key: "SECURITY_ERROR",
    label: "Security Error",
    description: "Secrets exposed, injection risk, plain text password, weak JWT secret, no audit log, unsafe file upload.",
    examples: ["Secret in client bundle", "Missing audit on override", "Executable upload allowed"],
    severityGuidance: "CRITICAL until mitigated.",
    recommendedOwner: "Security Engineer",
    recommendedFixApproach: "Remove exposure, enforce RBAC, audit, sanitize inputs, rotate secrets."
  },
  {
    key: "DATA_QUALITY_ERROR",
    label: "Data Quality Error",
    description: "Wrong format, invalid characters, duplicate records, wrong calculation, missing master data, case mismatch.",
    examples: ["Duplicate employeeNo", "Wrong cost total", "Missing department master"],
    severityGuidance: "MEDIUM to HIGH when reports/decisions affected.",
    recommendedOwner: "Data Steward / Module Owner",
    recommendedFixApproach: "Validation rules, master data cleanup, reconciliation scripts."
  },
  {
    key: "TESTING_QA_ERROR",
    label: "Testing / QA Error",
    description: "Only happy path tested, mobile not tested, role-wise test missing, no production-like data, regression issue.",
    examples: ["UAT skipped mobile", "Role matrix not tested", "Regression after deploy"],
    severityGuidance: "MEDIUM; HIGH if escaped to production.",
    recommendedOwner: "QA Lead",
    recommendedFixApproach: "Expand test matrix, add automated checks, regression suite."
  }
];

export const QA_UAT_PHASES = [
  "UAT-017",
  "UAT-018",
  "UAT-019",
  "UAT-020",
  "UAT-021",
  "UAT-022",
  "UAT-023",
  "UAT-024",
  "UAT-025"
] as const;

export function categoryRequiresRca(severity: QaIssueSeverity, environment: string, reopened: boolean): boolean {
  if (reopened) return true;
  if (severity === "CRITICAL") return true;
  if (severity === "HIGH" && environment === "PRODUCTION") return true;
  return false;
}

export function isSecurityCategory(category: QaIssueCategory): boolean {
  return category === "SECURITY_ERROR" || category === "AUTH_RBAC_ERROR";
}
