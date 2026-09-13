export type RoleHomeCard = {
  id: string;
  title: string;
  href: string;
  description: string;
};

export type RoleHomeProfile = {
  roleKey: "REQUESTER" | "TECHNICIAN" | "SUPERVISOR" | "FLEET" | "MANAGER";
  title: string;
  cards: RoleHomeCard[];
};

export const ROLE_HOME_PROFILES: RoleHomeProfile[] = [
  {
    roleKey: "REQUESTER",
    title: "Home",
    cards: [
      { id: "report-issue", title: "Report Issue", href: "/qr/report-issue", description: "Raise a maintenance request" },
      { id: "my-requests", title: "My Requests", href: "/work-orders", description: "Track requests you raised" }
    ]
  },
  {
    roleKey: "TECHNICIAN",
    title: "My Work",
    cards: [
      { id: "my-jobs", title: "My Jobs", href: "/work-orders", description: "Assigned work orders" },
      { id: "due-today", title: "Due Today", href: "/work-orders?due=today", description: "Jobs due today" },
      { id: "waiting-parts", title: "Waiting Parts", href: "/work-orders?status=ON_HOLD", description: "Blocked on parts" },
      { id: "evidence", title: "Evidence Needed", href: "/work-orders", description: "Jobs needing photos/evidence" },
      { id: "start", title: "Start Work", href: "/work-orders", description: "Begin an assigned job" }
    ]
  },
  {
    roleKey: "SUPERVISOR",
    title: "Supervisor Home",
    cards: [
      { id: "new-requests", title: "New Requests", href: "/work-orders?status=OPEN", description: "Incoming requests" },
      { id: "unassigned", title: "Unassigned", href: "/work-orders?unassigned=1", description: "Needs technician" },
      { id: "critical", title: "Critical", href: "/work-orders?priority=CRITICAL", description: "Critical priority" },
      { id: "overdue", title: "Overdue", href: "/work-orders?status=OVERDUE", description: "Past due" },
      { id: "verification", title: "Verification Required", href: "/work-orders?verification=PENDING", description: "Awaiting verify" },
      { id: "pm-due", title: "PM Due", href: "/maintenance", description: "Preventive due list" }
    ]
  },
  {
    roleKey: "FLEET",
    title: "Fleet Home",
    cards: [
      { id: "service-due", title: "Service Due", href: "/vehicles", description: "Vehicles needing service" },
      { id: "doc-expiry", title: "Document Expiry", href: "/compliance", description: "Insurance/licence expiry" },
      { id: "repairs", title: "Repairs", href: "/work-orders?type=CORRECTIVE", description: "Open repairs" },
      { id: "blocks", title: "Vehicle Blocks", href: "/fleet/gate", description: "Gate blocks / overrides" },
      { id: "claims-fines", title: "Claims/Fines", href: "/insurance-claims", description: "Claims and traffic fines" }
    ]
  },
  {
    roleKey: "MANAGER",
    title: "Manager Home",
    cards: [
      { id: "availability", title: "Availability", href: "/reports", description: "Asset availability" },
      { id: "downtime", title: "Downtime", href: "/reports", description: "Downtime hours" },
      { id: "mttr", title: "MTTR", href: "/reports", description: "Mean time to repair" },
      { id: "mtbf", title: "MTBF", href: "/reports", description: "Mean time between failures" },
      { id: "pm", title: "PM Compliance", href: "/reports", description: "Preventive compliance" },
      { id: "cost", title: "Cost", href: "/reports", description: "Maintenance cost" },
      { id: "backlog", title: "Backlog", href: "/work-orders", description: "Open backlog" },
      { id: "repeat", title: "Repeat Failures", href: "/reports", description: "Repeat problem assets" },
      { id: "top", title: "Top Problem Assets", href: "/reports", description: "Highest impact assets" }
    ]
  }
];

export function resolveRoleHome(roleName: string | null | undefined): RoleHomeProfile {
  const role = String(roleName ?? "").toUpperCase();
  if (["TECHNICIAN", "MECHANIC"].includes(role)) {
    return ROLE_HOME_PROFILES.find((p) => p.roleKey === "TECHNICIAN")!;
  }
  if (["SUPERVISOR", "OPERATIONS_MANAGER", "ASSET_MANAGER"].includes(role)) {
    return ROLE_HOME_PROFILES.find((p) => p.roleKey === "SUPERVISOR")!;
  }
  if (["FLEET_MANAGER", "DRIVER", "SECURITY_OFFICER"].includes(role)) {
    return ROLE_HOME_PROFILES.find((p) => p.roleKey === "FLEET")!;
  }
  if (["MANAGER", "ADMIN", "SUPER_ADMIN", "FINANCE"].includes(role)) {
    return ROLE_HOME_PROFILES.find((p) => p.roleKey === "MANAGER")!;
  }
  return ROLE_HOME_PROFILES.find((p) => p.roleKey === "REQUESTER")!;
}
