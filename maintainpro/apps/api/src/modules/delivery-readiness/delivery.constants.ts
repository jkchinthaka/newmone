import { DeliveryChecklistCategory } from "@prisma/client";

export type DeliveryCatalogItem = {
  title: string;
  description: string;
  requiredForDelivery?: boolean;
  blocker?: boolean;
  signOffRequired?: boolean;
};

export type DeliveryCategoryMeta = {
  key: DeliveryChecklistCategory;
  label: string;
  description: string;
  signOffRequired: boolean;
  items: DeliveryCatalogItem[];
};

export const DELIVERY_CATEGORY_CATALOG: DeliveryCategoryMeta[] = [
  {
    key: "REQUIREMENTS",
    label: "Requirements",
    description: "Requirement completeness — requested features, business rules, roles, and known limitations.",
    signOffRequired: true,
    items: [
      { title: "Requested features available", description: "All agreed scope features are present in the build.", requiredForDelivery: true, blocker: true },
      { title: "Missing features identified", description: "Out-of-scope or deferred items documented with client approval.", requiredForDelivery: true },
      { title: "Business rules verified", description: "Approval thresholds, SLAs, and workflow rules match signed requirements.", requiredForDelivery: true, blocker: true },
      { title: "Approval flows verified", description: "Multi-step approvals block unauthorized actions.", requiredForDelivery: true, blocker: true },
      { title: "User roles verified", description: "Role matrix matches client org structure.", requiredForDelivery: true },
      { title: "Client requirement list mapped", description: "Each requirement traced to module/page/test evidence.", requiredForDelivery: true },
      { title: "Known limitations documented", description: "Limitations visible to management before go-live.", requiredForDelivery: true },
      { title: "Requirement changes approved", description: "Change requests signed off by product owner.", requiredForDelivery: true, signOffRequired: true }
    ]
  },
  {
    key: "CORE_FUNCTIONS",
    label: "Core Functions",
    description: "Core Functions — login, CRUD, search, reports, and MaintainPro work order lifecycle.",
    signOffRequired: true,
    items: [
      { title: "Login works", description: "Valid credentials authenticate successfully.", requiredForDelivery: true, blocker: true },
      { title: "Logout works", description: "Session cleared and protected routes blocked after logout.", requiredForDelivery: true },
      { title: "Create record", description: "Primary entities can be created without error.", requiredForDelivery: true },
      { title: "Update record", description: "Edits persist and reflect in lists/detail views.", requiredForDelivery: true },
      { title: "Delete/cancel record", description: "Cancel/delete rules enforced per module policy.", requiredForDelivery: true },
      { title: "Search and filter", description: "List views support search/filter with correct results.", requiredForDelivery: true },
      { title: "Report generate", description: "Key reports load and return data.", requiredForDelivery: true },
      { title: "Approval flow", description: "Approval steps advance status correctly.", requiredForDelivery: true, blocker: true },
      { title: "Notification dispatch", description: "Assignment/approval triggers notification or documented fallback.", requiredForDelivery: true },
      { title: "Export feature", description: "CSV/Excel/PDF export works where promised.", requiredForDelivery: false },
      { title: "Create Work Order", description: "Work order creation with required fields.", requiredForDelivery: true, blocker: true },
      { title: "Assign Technician", description: "Assignable technician list respects availability rules.", requiredForDelivery: true },
      { title: "Add Spare Parts", description: "Parts issue updates inventory correctly.", requiredForDelivery: true },
      { title: "Upload Before/After Photos", description: "Evidence upload accepts safe file types.", requiredForDelivery: true },
      { title: "Technician Complete", description: "Technician can mark work complete.", requiredForDelivery: true },
      { title: "Supervisor Verify", description: "Supervisor verification gate enforced.", requiredForDelivery: true },
      { title: "Close Work Order", description: "Closed status requires completed verification.", requiredForDelivery: true, blocker: true },
      { title: "Generate Work Order Report", description: "Work order report matches record data.", requiredForDelivery: true },
      { title: "View Audit Trail", description: "Sensitive work order actions appear in audit.", requiredForDelivery: true }
    ]
  },
  {
    key: "VALIDATION",
    label: "Validation",
    description: "Validation — required fields, formats, duplicates, and user-friendly messages.",
    signOffRequired: false,
    items: [
      { title: "Required fields enforced", description: "Empty required fields rejected on backend.", requiredForDelivery: true, blocker: true },
      { title: "Invalid email rejected", description: "Malformed email returns friendly validation.", requiredForDelivery: true },
      { title: "Phone format validated", description: "Invalid phone formats rejected.", requiredForDelivery: true },
      { title: "Date validation works", description: "Past/future date rules enforced where applicable.", requiredForDelivery: true },
      { title: "Negative amount/quantity rejected", description: "Numeric guards on costs and quantities.", requiredForDelivery: true },
      { title: "File type validation", description: "Unsafe uploads blocked server-side.", requiredForDelivery: true, blocker: true },
      { title: "File size validation", description: "Oversized uploads rejected with clear message.", requiredForDelivery: true },
      { title: "Duplicate record handling", description: "Duplicates blocked or warned per business rule.", requiredForDelivery: true },
      { title: "Friendly validation messages", description: "No generic 'Error occurred' for user input.", requiredForDelivery: true }
    ]
  },
  {
    key: "UI_UX",
    label: "UI / UX",
    description: "UI / UX — clarity, spacing, navigation, and professional appearance.",
    signOffRequired: false,
    items: [
      { title: "Buttons are clear", description: "Primary actions labeled unambiguously.", requiredForDelivery: true },
      { title: "Text readable", description: "Font sizes and contrast meet usability baseline.", requiredForDelivery: true },
      { title: "Professional colors", description: "Consistent brand-neutral palette.", requiredForDelivery: false },
      { title: "Good spacing", description: "Forms and tables not cramped on desktop.", requiredForDelivery: true },
      { title: "Forms easy to use", description: "Logical field order and helper text.", requiredForDelivery: true },
      { title: "Tables readable", description: "Columns align; empty states present.", requiredForDelivery: true },
      { title: "Error messages understandable", description: "Users know what to fix.", requiredForDelivery: true },
      { title: "Navigation simple", description: "Role workspace highlights primary tasks.", requiredForDelivery: true },
      { title: "Important actions visible", description: "Create/approve actions discoverable.", requiredForDelivery: true },
      { title: "Avoid excessive clicks", description: "Common flows complete in reasonable steps.", requiredForDelivery: false },
      { title: "Role-based workspace works", description: "Dashboard matches role responsibilities.", requiredForDelivery: true },
      { title: "Client professional impression", description: "Overall UX rated acceptable for handover.", requiredForDelivery: true, signOffRequired: true }
    ]
  },
  {
    key: "RESPONSIVE_DESIGN",
    label: "Responsive Design",
    description: "Mobile / tablet / desktop responsive layout verification.",
    signOffRequired: false,
    items: [
      { title: "Mobile 360px layout", description: "Sidebar, nav, forms usable at 360px.", requiredForDelivery: true },
      { title: "Mobile 390px layout", description: "Common phone width verified.", requiredForDelivery: true },
      { title: "Tablet 768px layout", description: "Tablet breakpoints for tables/forms.", requiredForDelivery: true },
      { title: "Laptop 1366px layout", description: "Standard laptop layout verified.", requiredForDelivery: true },
      { title: "Desktop 1920px layout", description: "Wide desktop layout verified.", requiredForDelivery: false },
      { title: "Work order cards responsive", description: "Cards readable on mobile.", requiredForDelivery: true },
      { title: "Reports responsive", description: "Charts/tables scroll or stack on small screens.", requiredForDelivery: true }
    ]
  },
  {
    key: "SECURITY",
    label: "Security",
    description: "Security — RBAC, secrets, audit, uploads, and API protection.",
    signOffRequired: true,
    items: [
      { title: "Passwords hashed", description: "No plain text password storage.", requiredForDelivery: true, blocker: true },
      { title: "Secrets not in repo", description: ".env and keys not committed.", requiredForDelivery: true, blocker: true },
      { title: "Private APIs protected", description: "Unauthenticated API calls rejected.", requiredForDelivery: true, blocker: true },
      { title: "Role permissions correct", description: "Permission matrix matches policy.", requiredForDelivery: true, blocker: true },
      { title: "Staff cannot access Admin", description: "Admin routes return 403 for staff roles.", requiredForDelivery: true, blocker: true },
      { title: "Backend RBAC enforced", description: "Direct API access blocked without permission.", requiredForDelivery: true, blocker: true },
      { title: "File upload safe", description: "Executable uploads blocked.", requiredForDelivery: true, blocker: true },
      { title: "Audit logs exist", description: "Sensitive actions recorded.", requiredForDelivery: true, blocker: true },
      { title: "Secrets not in frontend", description: "No DATABASE_URL/JWT in client bundle.", requiredForDelivery: true, blocker: true },
      { title: "CORS configured", description: "Only allowed origins permitted.", requiredForDelivery: true, blocker: true },
      { title: "Unauthorized URL blocked", description: "Direct URL to forbidden page blocked.", requiredForDelivery: true, blocker: true }
    ]
  },
  {
    key: "DATABASE_DATA",
    label: "Database & Data",
    description: "Database data correctness, relationships, and audit integrity.",
    signOffRequired: true,
    items: [
      { title: "Create saves correctly", description: "Records persist with correct tenant scope.", requiredForDelivery: true, blocker: true },
      { title: "Update persists correctly", description: "Updates reflected in DB and UI.", requiredForDelivery: true },
      { title: "Delete/cancel logic correct", description: "Soft delete/cancel rules enforced.", requiredForDelivery: true },
      { title: "Duplicate data blocked", description: "Unique constraints enforced.", requiredForDelivery: true },
      { title: "Relationships valid", description: "Foreign keys and references intact.", requiredForDelivery: true },
      { title: "Reports match DB", description: "Report totals match underlying queries.", requiredForDelivery: true, blocker: true },
      { title: "Inventory stock after issue", description: "Stock decrements on part issue.", requiredForDelivery: true },
      { title: "Work order status transitions", description: "Invalid transitions blocked.", requiredForDelivery: true, blocker: true },
      { title: "Audit log written", description: "Critical mutations create audit entries.", requiredForDelivery: true },
      { title: "Master data available", description: "Departments, roles, branches seeded.", requiredForDelivery: true },
      { title: "No invalid required nulls", description: "Required fields not null in production data.", requiredForDelivery: true }
    ]
  },
  {
    key: "PERFORMANCE",
    label: "Performance",
    description: "Performance — page load, pagination, and acceptable response times.",
    signOffRequired: false,
    items: [
      { title: "Login time acceptable", description: "Login completes within guideline (1–3s).", requiredForDelivery: true },
      { title: "Dashboard load acceptable", description: "Dashboard within 3–8s under normal load.", requiredForDelivery: true },
      { title: "Work order list load", description: "Paginated list loads within guideline.", requiredForDelivery: true },
      { title: "Search/filter speed", description: "Filtered queries respond promptly.", requiredForDelivery: true },
      { title: "Report generation speed", description: "Reports complete or show progress within 8s.", requiredForDelivery: true },
      { title: "Large lists paginated", description: "No unbounded list fetch.", requiredForDelivery: true, blocker: true },
      { title: "Server-side filtering", description: "Heavy filters run server-side.", requiredForDelivery: true },
      { title: "No unnecessary API repeats", description: "No runaway polling on main pages.", requiredForDelivery: true },
      { title: "No browser lag", description: "UI remains responsive during navigation.", requiredForDelivery: false },
      { title: "No timeout on main pages", description: "Primary routes avoid 504/timeout.", requiredForDelivery: true, blocker: true }
    ]
  },
  {
    key: "ERROR_HANDLING",
    label: "Error Handling",
    description: "Error handling — friendly messages, no stack traces, controlled retries.",
    signOffRequired: true,
    items: [
      { title: "API fail does not blank page", description: "Error states shown instead of white screen.", requiredForDelivery: true, blocker: true },
      { title: "Network error friendly", description: "Offline/timeout shows actionable message.", requiredForDelivery: true },
      { title: "Unauthorized handled", description: "401 redirects or prompts re-login.", requiredForDelivery: true },
      { title: "404 handled", description: "Unknown routes show not-found page.", requiredForDelivery: true },
      { title: "500 handled", description: "Server errors show support message.", requiredForDelivery: true, blocker: true },
      { title: "503 handled", description: "Maintenance/unavailable state communicated.", requiredForDelivery: true },
      { title: "No raw DB errors", description: "Prisma/Mongo errors not shown to users.", requiredForDelivery: true, blocker: true },
      { title: "No stack trace to user", description: "Technical traces restricted to logs.", requiredForDelivery: true, blocker: true },
      { title: "Retry behavior controlled", description: "No infinite retry loops.", requiredForDelivery: true },
      { title: "Try Again works", description: "Retry actions recover from transient failures.", requiredForDelivery: false }
    ]
  },
  {
    key: "DEPLOYMENT",
    label: "Deployment",
    description: "Production deployment readiness — URLs, SSL, builds, smoke tests.",
    signOffRequired: true,
    items: [
      { title: "Production backend URL correct", description: "Frontend points to live API.", requiredForDelivery: true, blocker: true },
      { title: "Frontend env vars correct", description: "NEXT_PUBLIC_* vars set for production.", requiredForDelivery: true, blocker: true },
      { title: "Database URL correct", description: "Production DB connection verified.", requiredForDelivery: true, blocker: true },
      { title: "CORS domains correct", description: "Client domain allowed.", requiredForDelivery: true, blocker: true },
      { title: "Production build passes", description: "npm run build succeeds.", requiredForDelivery: true, blocker: true },
      { title: "SSL/HTTPS enabled", description: "All client URLs use HTTPS.", requiredForDelivery: true, blocker: true },
      { title: "Domain working", description: "Client-facing domain resolves.", requiredForDelivery: true, blocker: true },
      { title: "Render backend live", description: "API health returns 200.", requiredForDelivery: true, blocker: true },
      { title: "Cloudflare frontend live", description: "Web app loads on Workers domain.", requiredForDelivery: true, blocker: true },
      { title: "Version mismatch checked", description: "API and web versions aligned.", requiredForDelivery: true },
      { title: "Smoke test passed", description: "Post-deploy smoke checks green.", requiredForDelivery: true, blocker: true },
      { title: "No localhost in production", description: "No localhost URLs in prod config.", requiredForDelivery: true, blocker: true }
    ]
  },
  {
    key: "USER_ROLES",
    label: "User Roles",
    description: "Role-wise testing — login, pages, APIs, and button visibility per role.",
    signOffRequired: true,
    items: [
      { title: "Admin role tested", description: "Admin login, pages, APIs verified.", requiredForDelivery: true, blocker: true },
      { title: "Manager role tested", description: "Manager scope and reports verified.", requiredForDelivery: true, blocker: true },
      { title: "Technician role tested", description: "Technician work order flows verified.", requiredForDelivery: true, blocker: true },
      { title: "Store Keeper role tested", description: "Inventory/issue permissions verified.", requiredForDelivery: true },
      { title: "Finance role tested", description: "Finance approval paths verified.", requiredForDelivery: true },
      { title: "Security Officer role tested", description: "Security module access verified.", requiredForDelivery: false },
      { title: "Viewer role tested", description: "Read-only enforced.", requiredForDelivery: true },
      { title: "Direct URL blocked", description: "Forbidden routes return 403 for each role.", requiredForDelivery: true, blocker: true },
      { title: "Disallowed APIs return 403", description: "API RBAC verified per role.", requiredForDelivery: true, blocker: true }
    ]
  },
  {
    key: "REPORTS",
    label: "Reports",
    description: "Reports accuracy — counts, filters, exports, and dashboard alignment.",
    signOffRequired: true,
    items: [
      { title: "Total count correct", description: "List totals match report headers.", requiredForDelivery: true, blocker: true },
      { title: "Date filter correct", description: "Date ranges filter accurately.", requiredForDelivery: true },
      { title: "Department filter correct", description: "Department scoping works.", requiredForDelivery: true },
      { title: "Status filter correct", description: "Status filters match list.", requiredForDelivery: true },
      { title: "Export correct", description: "Export matches on-screen data.", requiredForDelivery: false },
      { title: "Currency/amount correct", description: "Financial totals accurate.", requiredForDelivery: true },
      { title: "Chart data correct", description: "Charts match underlying data.", requiredForDelivery: true },
      { title: "Dashboard matches list", description: "Dashboard counts equal filtered lists.", requiredForDelivery: true, blocker: true }
    ]
  },
  {
    key: "NOTIFICATIONS",
    label: "Notifications",
    description: "Email, SMS, and in-app notifications configuration and delivery.",
    signOffRequired: false,
    items: [
      { title: "Password reset email", description: "Reset email sends or limitation documented.", requiredForDelivery: true },
      { title: "User invitation email", description: "Invite email sends or fallback documented.", requiredForDelivery: true },
      { title: "Work order assigned notification", description: "Assignment notifies assignee.", requiredForDelivery: true },
      { title: "Approval notification", description: "Approvers notified on pending items.", requiredForDelivery: true },
      { title: "Critical alert path", description: "Critical alerts route to responsible team.", requiredForDelivery: true },
      { title: "Email provider configured", description: "SMTP/provider status verified in system health.", requiredForDelivery: false },
      { title: "SMS gateway if configured", description: "SMS mode verified or marked N/A.", requiredForDelivery: false },
      { title: "Failure message friendly", description: "Notification failures show clear UI message.", requiredForDelivery: true },
      { title: "SMTP limits documented", description: "Free-tier limits documented if applicable.", requiredForDelivery: false }
    ]
  },
  {
    key: "BACKUP_RECOVERY",
    label: "Backup & Recovery",
    description: "Backup, restore, rollback, and data loss risk documentation.",
    signOffRequired: true,
    items: [
      { title: "Database backup enabled", description: "Atlas/backup strategy confirmed.", requiredForDelivery: true, blocker: true },
      { title: "Manual backup possible", description: "Manual export/backup procedure documented.", requiredForDelivery: true, blocker: true },
      { title: "Restore process documented", description: "Restore runbook exists.", requiredForDelivery: true, blocker: true },
      { title: "Restore tested non-prod", description: "Restore validated in staging.", requiredForDelivery: true, blocker: true },
      { title: "Deployment rollback possible", description: "Previous commit/version identified.", requiredForDelivery: true, blocker: true },
      { title: "Pre-deploy backup taken", description: "Backup before latest production deploy.", requiredForDelivery: true, blocker: true },
      { title: "Backup owner assigned", description: "Named owner for backup operations.", requiredForDelivery: true },
      { title: "Data loss risk documented", description: "Residual risks recorded in handover pack.", requiredForDelivery: true, signOffRequired: true }
    ]
  },
  {
    key: "DOCUMENTATION",
    label: "Documentation",
    description: "Handover documentation — guides, URLs, support, and SOPs.",
    signOffRequired: true,
    items: [
      { title: "User manual prepared", description: "At minimum one-page user guide.", requiredForDelivery: true, blocker: true },
      { title: "Admin guide prepared", description: "Admin operations documented.", requiredForDelivery: true },
      { title: "Login credentials delivery", description: "Secure credential delivery method defined.", requiredForDelivery: true, blocker: true },
      { title: "System URL documented", description: "Production URL in handover pack.", requiredForDelivery: true, blocker: true },
      { title: "Known limitations listed", description: "Linked from QA known issues.", requiredForDelivery: true },
      { title: "Support contact documented", description: "IT/support escalation path defined.", requiredForDelivery: true },
      { title: "Deployment details documented", description: "Render/Cloudflare runbook included.", requiredForDelivery: true },
      { title: "Backup instructions documented", description: "Backup/restore steps in handover.", requiredForDelivery: true, blocker: true },
      { title: "Incident reporting process", description: "QA & Incidents process explained to client.", requiredForDelivery: true },
      { title: "Change request process", description: "Post go-live change process defined.", requiredForDelivery: true }
    ]
  },
  {
    key: "FINAL_DEMO",
    label: "Client Demo Flow",
    description: "End-to-end client demonstration script for MaintainPro.",
    signOffRequired: true,
    items: [
      { title: "Demo 1: Login as Admin/Manager", description: "Successful login with demo account.", requiredForDelivery: true },
      { title: "Demo 2: Open Action Center", description: "Action center loads with role tasks.", requiredForDelivery: true },
      { title: "Demo 3: Create Work Order", description: "Create WO with required fields.", requiredForDelivery: true, blocker: true },
      { title: "Demo 4: Assign Technician", description: "Assign available technician.", requiredForDelivery: true },
      { title: "Demo 5: Issue Parts", description: "Parts issue from inventory.", requiredForDelivery: true },
      { title: "Demo 6: Upload Evidence", description: "Before/after photos uploaded.", requiredForDelivery: true },
      { title: "Demo 7: Supervisor Verify", description: "Verification step completed.", requiredForDelivery: true },
      { title: "Demo 8: Close Work Order", description: "WO closed successfully.", requiredForDelivery: true, blocker: true },
      { title: "Demo 9: Management Report", description: "Report opened with correct data.", requiredForDelivery: true },
      { title: "Demo 10: Export Report", description: "Export downloaded if available.", requiredForDelivery: false },
      { title: "Demo 11: Audit Trail", description: "Audit entries visible for demo actions.", requiredForDelivery: true },
      { title: "Demo 12: Logout", description: "Clean logout demonstrated.", requiredForDelivery: true }
    ]
  },
  {
    key: "CLIENT_SIGN_OFF",
    label: "Client Sign-off",
    description: "Final client delivery sign-off and acceptance.",
    signOffRequired: true,
    items: [
      { title: "Final QA checklist complete", description: "All mandatory QA items reviewed.", requiredForDelivery: true, blocker: true, signOffRequired: true },
      { title: "Open blockers resolved or accepted", description: "No unresolved critical blockers.", requiredForDelivery: true, blocker: true, signOffRequired: true },
      { title: "Client demo completed", description: "Demo walkthrough done with client.", requiredForDelivery: true, signOffRequired: true },
      { title: "Handover pack delivered", description: "Documentation pack shared securely.", requiredForDelivery: true, blocker: true, signOffRequired: true },
      { title: "Client sign-off recorded", description: "Formal sign-off captured in system.", requiredForDelivery: true, blocker: true, signOffRequired: true }
    ]
  }
];

export const FINAL_QA_CHECKLIST_ITEMS = [
  "Requirement list checked",
  "Login/logout working",
  "All main modules tested",
  "Create/update/delete tested",
  "Search/filter tested",
  "Reports tested",
  "User roles tested",
  "Mobile responsive tested",
  "Form validation tested",
  "Error messages checked",
  "API errors handled",
  "Database save/update checked",
  "Security checked",
  ".env/secrets not committed",
  "Production build passed",
  "Production deployment tested",
  "Domain/SSL working",
  "Email/SMS tested",
  "Backup taken",
  "User guide prepared",
  "Client demo account created"
];

export function isBlockingStatus(status: string): boolean {
  return status === "FAIL" || status === "BLOCKED";
}

export function isPassingStatus(status: string): boolean {
  return status === "PASS" || status === "NOT_APPLICABLE" || status === "ACCEPTED_RISK";
}
