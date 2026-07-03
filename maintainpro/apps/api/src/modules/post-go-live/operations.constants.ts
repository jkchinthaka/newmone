import { SupportTicketCategory, SupportTicketPriority, SupportTicketSeverity } from "@prisma/client";

export type SlaRule = {
  priority: SupportTicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export const DEFAULT_SLA_RULES: SlaRule[] = [
  { priority: "URGENT", firstResponseMinutes: 15, resolutionMinutes: 4 * 60 },
  { priority: "HIGH", firstResponseMinutes: 30, resolutionMinutes: 8 * 60 },
  { priority: "MEDIUM", firstResponseMinutes: 4 * 60, resolutionMinutes: 3 * 8 * 60 },
  { priority: "LOW", firstResponseMinutes: 8 * 60, resolutionMinutes: 5 * 8 * 60 }
];

export const TRAINING_CHECKLISTS: Record<string, string[]> = {
  ADMIN_TRAINING: [
    "Create user",
    "Assign role",
    "Deactivate user",
    "Reset password",
    "View audit logs",
    "Manage master data",
    "View reports"
  ],
  MANAGER_TRAINING: [
    "View dashboard",
    "Approve/reject requests",
    "Verify reports",
    "View exception dashboard",
    "Review high-risk items"
  ],
  SUPERVISOR_TRAINING: [
    "Assign work orders",
    "Verify technician completion",
    "Reject/rework work orders",
    "Monitor team workload"
  ],
  TECHNICIAN_TRAINING: [
    "View assigned work orders",
    "Start work",
    "Add notes",
    "Upload before/after evidence",
    "Complete work order",
    "Request spare parts"
  ],
  STORE_KEEPER_TRAINING: [
    "View parts requests",
    "Issue parts",
    "Record returns",
    "Check stock",
    "Prevent no-work-order parts issue"
  ],
  FINANCE_TRAINING: [
    "Verify approved vendor repair",
    "Check invoice linkage",
    "Prevent payment without verified work order"
  ],
  SECURITY_OFFICER_TRAINING: [
    "Gate check",
    "QR/vehicle verification",
    "Block unauthorized movement if required"
  ],
  GENERAL_USER_TRAINING: ["Login", "Navigate workspace", "Submit support ticket", "Logout"]
};

export const DEFAULT_ESCALATION_RULES = [
  {
    category: null as SupportTicketCategory | null,
    severity: "CRITICAL" as SupportTicketSeverity,
    escalationLevel: 2,
    responsibleRole: "IT_MANAGER",
    escalationAfterMinutes: 15,
    notificationMethod: "SYSTEM" as const
  },
  {
    category: null,
    severity: "HIGH" as SupportTicketSeverity,
    escalationLevel: 2,
    responsibleRole: "IT_MANAGER",
    escalationAfterMinutes: 30,
    notificationMethod: "SYSTEM" as const
  },
  {
    category: "PERMISSION_ISSUE" as SupportTicketCategory,
    severity: null as SupportTicketSeverity | null,
    escalationLevel: 3,
    responsibleRole: "MANAGER",
    escalationAfterMinutes: 60,
    notificationMethod: "EMAIL" as const
  }
];

export const HYPERCARE_DAILY_CHECKLIST = [
  "Check API health",
  "Check DB health",
  "Check open tickets",
  "Check SLA breaches",
  "Check critical reports",
  "Check user feedback",
  "Check backup status",
  "Check deployment status"
];

export function getSlaRule(priority: SupportTicketPriority): SlaRule {
  return DEFAULT_SLA_RULES.find((r) => r.priority === priority) ?? DEFAULT_SLA_RULES[2];
}

export function computeSlaDueDates(priority: SupportTicketPriority, createdAt: Date = new Date()) {
  const rule = getSlaRule(priority);
  return {
    firstResponseDueAt: new Date(createdAt.getTime() + rule.firstResponseMinutes * 60_000),
    resolutionDueAt: new Date(createdAt.getTime() + rule.resolutionMinutes * 60_000)
  };
}

export function mapPriorityToSla(priority: SupportTicketPriority, severity: SupportTicketSeverity): SupportTicketPriority {
  if (severity === "CRITICAL") return "URGENT";
  if (severity === "HIGH" && priority === "LOW") return "MEDIUM";
  return priority;
}
