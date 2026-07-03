import { CutoverChecklistCategory } from "@prisma/client";

export type CutoverCatalogItem = {
  itemKey: string;
  title: string;
  description: string;
  blocker?: boolean;
};

export type CutoverCategoryMeta = {
  key: CutoverChecklistCategory;
  label: string;
  items: CutoverCatalogItem[];
};

export const CUTOVER_CATEGORY_CATALOG: CutoverCategoryMeta[] = [
  {
    key: "DATA_READY",
    label: "Data Ready",
    items: [
      { itemKey: "data.master_cleaned", title: "Master data cleaned", description: "Master data reviewed and cleaned.", blocker: true },
      { itemKey: "data.employees_ready", title: "Employees/users ready", description: "Employee records imported or verified.", blocker: true },
      { itemKey: "data.technicians_ready", title: "Technicians ready", description: "Technician roster complete.", blocker: true },
      { itemKey: "data.assets_vehicles_ready", title: "Assets/vehicles ready", description: "Asset and vehicle master data verified.", blocker: true },
      { itemKey: "data.inventory_ready", title: "Inventory/master data ready", description: "Inventory baseline verified.", blocker: true },
      { itemKey: "data.import_verified", title: "Old data import verified", description: "Legacy import reconciled if applicable." }
    ]
  },
  {
    key: "USERS_READY",
    label: "Users Ready",
    items: [
      { itemKey: "users.pilot_created", title: "Pilot users created", description: "Pilot user accounts exist.", blocker: true },
      { itemKey: "users.roles_assigned", title: "Roles assigned", description: "Roles mapped per org structure.", blocker: true },
      { itemKey: "users.scope_assigned", title: "Branch/department scope assigned", description: "Tenant scope configured.", blocker: true },
      { itemKey: "users.login_tested", title: "Login tested", description: "Pilot login smoke test passed.", blocker: true },
      { itemKey: "users.invite_completed", title: "Password/invite completed", description: "Invites accepted or passwords set." }
    ]
  },
  {
    key: "ROLES_READY",
    label: "Roles Ready",
    items: [
      { itemKey: "roles.matrix_verified", title: "Role matrix verified", description: "RBAC matrix matches signed-off design.", blocker: true },
      { itemKey: "roles.permissions_seeded", title: "Permissions seeded", description: "Role permissions applied in tenant." }
    ]
  },
  {
    key: "TRAINING_READY",
    label: "Training Ready",
    items: [
      { itemKey: "training.admin", title: "Admin trained", description: "Admin training completed.", blocker: true },
      { itemKey: "training.manager", title: "Manager trained", description: "Manager training completed.", blocker: true },
      { itemKey: "training.technician", title: "Technician trained", description: "Technician training completed.", blocker: true },
      { itemKey: "training.store_keeper", title: "Store keeper trained", description: "Store keeper training completed." },
      { itemKey: "training.supervisor", title: "Supervisor trained", description: "Supervisor training completed.", blocker: true }
    ]
  },
  {
    key: "BACKUP_READY",
    label: "Backup Ready",
    items: [
      { itemKey: "backup.database_taken", title: "Database backup taken", description: "Pre-cutover database backup completed.", blocker: true },
      { itemKey: "backup.code_identified", title: "Code backup/commit identified", description: "Release commit hash recorded.", blocker: true },
      { itemKey: "backup.rollback_version", title: "Rollback version identified", description: "Previous stable version documented.", blocker: true },
      { itemKey: "backup.restore_documented", title: "Restore process documented", description: "Restore runbook available.", blocker: true }
    ]
  },
  {
    key: "DEPLOYMENT_READY",
    label: "Deployment Ready",
    items: [
      { itemKey: "deploy.backend_live", title: "Backend live", description: "API deployed and reachable.", blocker: true },
      { itemKey: "deploy.frontend_live", title: "Frontend live", description: "Web app deployed and reachable.", blocker: true },
      { itemKey: "deploy.health_healthy", title: "Health check healthy", description: "/health and readiness pass.", blocker: true },
      { itemKey: "deploy.smoke_passed", title: "Smoke test passed", description: "Core smoke tests green.", blocker: true },
      { itemKey: "deploy.cors_correct", title: "CORS correct", description: "CORS allows production frontend.", blocker: true },
      { itemKey: "deploy.no_localhost", title: "No localhost URLs", description: "No localhost URLs in production config.", blocker: true }
    ]
  },
  {
    key: "SUPPORT_READY",
    label: "Support Ready",
    items: [
      { itemKey: "support.owner_assigned", title: "Support owner assigned", description: "Hypercare/support owner named.", blocker: true },
      { itemKey: "support.ticket_process", title: "Ticket process ready", description: "Support ticket workflow active." },
      { itemKey: "support.escalation_matrix", title: "Escalation matrix ready", description: "Escalation rules configured." },
      { itemKey: "support.sla_process", title: "SLA process ready", description: "SLA tracking enabled." }
    ]
  },
  {
    key: "COMMUNICATION_READY",
    label: "Communication Ready",
    items: [
      { itemKey: "comm.date_communicated", title: "Go-live date communicated", description: "Stakeholders notified of cutover date." },
      { itemKey: "comm.support_contact", title: "Support contact shared", description: "Support contacts published." },
      { itemKey: "comm.limitations_shared", title: "Known limitations shared", description: "Limitations communicated to users." },
      { itemKey: "comm.user_guide", title: "User guide shared", description: "Training materials distributed." }
    ]
  },
  {
    key: "ROLLBACK_READY",
    label: "Rollback Ready",
    items: [
      { itemKey: "rollback.criteria_defined", title: "Rollback criteria defined", description: "Rollback triggers documented.", blocker: true },
      { itemKey: "rollback.owner_assigned", title: "Rollback owner assigned", description: "Rollback responsible person named.", blocker: true },
      { itemKey: "rollback.steps_documented", title: "Rollback steps documented", description: "Step-by-step rollback plan exists.", blocker: true },
      { itemKey: "rollback.tested", title: "Rollback tested if possible", description: "Rollback drill completed or scheduled." }
    ]
  },
  {
    key: "MANAGEMENT_SIGNOFF_READY",
    label: "Management Sign-off Ready",
    items: [
      { itemKey: "signoff.it_manager", title: "IT Manager sign-off", description: "IT Manager approval recorded.", blocker: true },
      { itemKey: "signoff.department_manager", title: "Department Manager sign-off", description: "Department manager approval.", blocker: true },
      { itemKey: "signoff.business_owner", title: "Business Owner sign-off", description: "Business owner approval.", blocker: true }
    ]
  }
];

export type GoLiveReadinessVerdict =
  | "NOT_READY"
  | "PILOT_READY"
  | "GO_WITH_RISK"
  | "GO"
  | "NO_GO"
  | "LIVE"
  | "ROLLBACK";

export const REQUIRED_SIGN_OFF_ROLES = [
  "IT_MANAGER",
  "DEPARTMENT_MANAGER",
  "QA_TESTER",
  "BUSINESS_OWNER",
  "SYSTEM_ADMIN"
] as const;

export const PASSING_CUTOVER_STATUSES = new Set(["PASS", "ACCEPTED_RISK"]);

export function isCutoverPassing(status: string): boolean {
  return PASSING_CUTOVER_STATUSES.has(status);
}
