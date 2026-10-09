/**
 * Operations completion rate, as calculated by ReportsService.operationsReport.
 * Numerator: work orders in the selected created-date range whose status is COMPLETED.
 * Denominator: every work order created in that range, including open, closed, and cancelled.
 * CLOSED is not added to the numerator. Do not substitute a different population in the UI or export.
 */
export const OPERATIONS_COMPLETION_RATE_DEFINITION =
  "Completion rate is COMPLETED jobs divided by all jobs created in the selected date range. CLOSED and CANCELLED stay in the denominator and are not counted as completed.";

export const REPORT_TEMPLATE_COLUMNS_BY_TYPE = {
  operations: [
    "woNumber",
    "title",
    "status",
    "priority",
    "department",
    "technician",
    "dueDate",
    "completionHours",
    "actualCost",
    "workOrderId"
  ],
  assets: ["type", "identifier", "name", "status", "department", "breakdowns", "downtimeHours", "cost", "nextServiceDate"],
  performance: ["technician", "total", "completed", "overdue", "productivity"],
  financials: ["date", "source", "category", "department", "supplier", "description", "amount"]
} as const;

export const REPORT_TEMPLATE_TYPES = ["operations", "assets", "financials", "performance"] as const;

export type ReportTemplateType = (typeof REPORT_TEMPLATE_TYPES)[number];

export type ReportTemplateDefinition = {
  id: string;
  name: string;
  reportType: ReportTemplateType;
  description: string;
  active: boolean;
  roles: string[];
  columns: string[];
  sortBy: string;
  sortDirection: "asc" | "desc";
  exportFormat: "csv" | "xlsx";
  defaultStatus: string;
};

const UNSAFE = /<\s*script|javascript:|=\s*cmd|union\s+select|drop\s+table|xp_cmdshell/i;

export function assertSafeTemplateText(value: string, field: string) {
  if (UNSAFE.test(value)) {
    throw new Error(`${field} contains unsupported template content.`);
  }
}

export function validateReportTemplate(input: Partial<ReportTemplateDefinition>): ReportTemplateDefinition {
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Template name must be 2–80 characters.");
  assertSafeTemplateText(name, "name");
  assertSafeTemplateText(description, "description");
  if (!REPORT_TEMPLATE_TYPES.includes(input.reportType as ReportTemplateType)) {
    throw new Error("Report type is not supported.");
  }
  const reportType = input.reportType as ReportTemplateType;
  const allowed = REPORT_TEMPLATE_COLUMNS_BY_TYPE[reportType];
  const columns = (input.columns ?? []).map((column) => String(column));
  if (!columns.length || columns.some((column) => !(allowed as readonly string[]).includes(column))) {
    throw new Error("Choose columns from the MaintainPro report field list.");
  }
  const sortBy = input.sortBy && (allowed as readonly string[]).includes(input.sortBy) ? input.sortBy : allowed[0];
  return {
    id: String(input.id ?? "").trim() || `tpl-${Date.now()}`,
    name,
    reportType,
    description,
    active: input.active !== false,
    roles: (input.roles ?? []).map((role) => String(role).trim()).filter(Boolean),
    columns,
    sortBy,
    sortDirection: input.sortDirection === "asc" ? "asc" : "desc",
    exportFormat: input.exportFormat === "xlsx" ? "xlsx" : "csv",
    defaultStatus: String(input.defaultStatus ?? "").slice(0, 64)
  };
}

export const BUILTIN_REPORT_TEMPLATES: ReportTemplateDefinition[] = [
  {
    id: "builtin-operations",
    name: "Work orders",
    reportType: "operations",
    description: "Jobs created in the selected range.",
    active: true,
    roles: [],
    columns: ["woNumber", "title", "status", "technician", "dueDate"],
    sortBy: "dueDate",
    sortDirection: "desc",
    exportFormat: "csv",
    defaultStatus: ""
  },
  {
    id: "builtin-assets",
    name: "Asset and fleet maintenance",
    reportType: "assets",
    description: "Maintenance history, downtime, and cost signals.",
    active: true,
    roles: [],
    columns: ["identifier", "name", "status", "department", "cost"],
    sortBy: "cost",
    sortDirection: "desc",
    exportFormat: "xlsx",
    defaultStatus: ""
  },
  {
    id: "builtin-performance",
    name: "Completion performance",
    reportType: "performance",
    description: OPERATIONS_COMPLETION_RATE_DEFINITION,
    active: true,
    roles: [],
    columns: ["technician", "total", "completed", "productivity"],
    sortBy: "productivity",
    sortDirection: "desc",
    exportFormat: "csv",
    defaultStatus: ""
  },
  {
    id: "builtin-financials",
    name: "Maintenance cost",
    reportType: "financials",
    description: "Parts, labour, and vendor cost for roles allowed to see financials.",
    active: true,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "FINANCE"],
    columns: ["date", "category", "department", "amount"],
    sortBy: "amount",
    sortDirection: "desc",
    exportFormat: "xlsx",
    defaultStatus: ""
  }
];
