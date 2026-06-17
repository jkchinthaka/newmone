# MaintainPro Master Implementation Prompt

Use this prompt with Cursor Agent, Claude Code, or another coding agent when you want the repository improved in a controlled, trackable way. It consolidates the repository review, live-system observations, UI/UX requests, security issues, business workflow gaps, and new facility-management modules into one implementation instruction.

## How to use

Copy the prompt below into the coding agent. Ask the agent to start with **Phase 0: Repository audit and todo setup**, then continue phase by phase. Do not ask the agent to build every module in one uncontrolled pass.

Recommended command to the coding agent:

```text
Use the full prompt below. Start with Phase 0 only. Create and maintain the todo list exactly as instructed. After Phase 0, give me the implementation plan and ask me which phase to execute first.
```

---

# Copy-paste prompt starts here

You are a senior full-stack engineer working on the existing GitHub repository:

```text
https://github.com/jkchinthaka/newmone.git
```

The product is **MaintainPro - Enterprise Maintenance & Facility Operations Platform**.

The system must become a professional enterprise CMMS / Facility / Fleet / Building Maintenance / Operations Management platform, not a basic CRUD application.

## Existing technology stack

- Backend: NestJS, TypeScript, Prisma ORM, MongoDB
- Frontend: Next.js App Router, React, Tailwind CSS, React Query
- Mobile: Flutter
- Database schema: `maintainpro/prisma/schema.prisma`
- API app: `maintainpro/apps/api`
- Web app: `maintainpro/apps/web`
- Mobile app: `maintainpro/apps/mobile`
- Shared packages: `maintainpro/packages`
- Deployment context: Cloudflare Workers for web, Render/Docker for API

## Important operating rules

1. Work inside the existing repository. Do not create a separate new project.
2. Inspect the current schema, controllers, services, routes, pages, and mobile screens before adding anything.
3. Reuse existing models/modules where possible. Do not duplicate models that already exist.
4. Implement in small phases. Do not attempt every module in one giant change.
5. Security fixes must be prioritized before large business-feature work.
6. Every backend change must be tenant-aware.
7. Every workflow change must include role/permission implications.
8. Every UI change must include loading, error, empty, and responsive states.
9. Every important change must be tested or verified.
10. Keep a clear todo list throughout the work.

## Mandatory todo-monitoring protocol

Before making code changes, create a todo list with these sections:

```text
P0 - Repository audit and implementation plan
P1 - Critical security and authentication fixes
P2 - Branding, login, navigation, role-based dashboards, and UI/UX foundation
P3 - Work order lifecycle and repair request workflow maturity
P4 - Facility/building/location hierarchy and building maintenance records
P5 - File upload, document management, photos, evidence, and signed storage
P6 - Inventory, procurement, vendor, budgeting, compliance, and safety
P7 - Mobile technician app, requester portal, notifications, and offline flow
P8 - Reports, dashboards, analytics, Power BI export, and predictive maintenance
P9 - Performance, testing, deployment readiness, and final verification
```

For every todo item, track:

```text
id
title
status: pending | in_progress | completed | blocked | cancelled
files_changed
verification
notes
```

Rules:

- Only one item should be `in_progress` at a time.
- Update the todo list whenever a task starts or finishes.
- If a task is blocked, write the exact blocker and suggested next action.
- At the end of each phase, provide:
  - Completed items
  - Remaining items
  - Files changed
  - Tests/checks run
  - Known risks
  - Next recommended phase

Use this todo format in responses:

```markdown
## Todo Status

| ID | Task | Status | Files | Verification | Notes |
|---|---|---|---|---|---|
| P1-01 | Remove demo credentials | completed | login/page.tsx | manual UI check | Production login no longer shows credentials |
```

## Phase 0 - Repository audit and implementation plan

Start by auditing the repository.

Return a concise but specific report with:

1. Existing modules and routes.
2. Existing Prisma models that can be reused.
3. Missing models that truly need to be added.
4. Existing pages/components that can be improved.
5. Existing mobile screens and endpoint mismatches.
6. Current auth/session/token implementation.
7. Current tenant isolation pattern.
8. Current file upload/document storage pattern.
9. Current work-order status and lifecycle.
10. Current notification/report/dashboard implementation.

Do not add duplicate models until you confirm they do not already exist.

Expected repository locations to inspect:

```text
maintainpro/prisma/schema.prisma
maintainpro/apps/api/src/modules
maintainpro/apps/api/src/main.ts
maintainpro/apps/api/src/common
maintainpro/apps/web/app
maintainpro/apps/web/components
maintainpro/apps/web/lib
maintainpro/apps/mobile/lib
maintainpro/README.md
maintainpro/render.yaml
```

## Phase 1 - Critical security and authentication fixes

Fix these before large feature work.

### P1-01 Remove public demo credentials from login page

Problem:

- Admin username/password must never be visible in the public login UI.

Expected changes:

- Remove all testing credential hints from the login page.
- Show only professional placeholders.
- If a demo/staging hint is needed, make it environment-gated and disabled in production.

Files to inspect:

```text
maintainpro/apps/web/app/(auth)/login/page.tsx
maintainpro/apps/web/app/(auth)/register/page.tsx
```

### P1-02 Fix login field confusion

Problem:

- UI says "Username" while backend uses email, and frontend may normalize username to `@maintainpro.local`.

Expected changes:

- Label the field clearly as "Email or username" only if both are truly supported.
- If backend only supports email, label it as "Work Email".
- Use clear validation and generic auth errors.

### P1-03 Replace in-memory refresh/reset token storage

Problem:

- Refresh tokens and reset tokens must not be stored in process memory.
- Restart, crash, or multi-instance deployment invalidates sessions and reset links.

Expected changes:

- Store hashed refresh tokens in MongoDB or Redis.
- Store hashed password-reset tokens with TTL and one-time use.
- Never store raw tokens.
- Rotate refresh tokens on each refresh.
- Revoke old refresh token after rotation.
- Add session/device management endpoints.

Recommended models if not already present:

```prisma
model RefreshToken {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  tokenHash   String    @unique
  userId      String    @db.ObjectId
  tenantId    String?   @db.ObjectId
  deviceInfo  String?
  ipAddress   String?
  expiresAt   DateTime
  revokedAt   DateTime?
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
}

model PasswordResetToken {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  tokenHash String    @unique
  userId    String    @db.ObjectId
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}
```

Files to inspect:

```text
maintainpro/apps/api/src/modules/auth/auth.service.ts
maintainpro/apps/api/src/modules/auth/auth.controller.ts
maintainpro/apps/api/src/modules/auth/dto
maintainpro/apps/api/src/modules/auth/jwt.strategy.ts
```

### P1-04 Secure forgot-password flow

Expected changes:

- Do not return reset token in API response.
- Generate raw token.
- Hash token.
- Store hash.
- Send raw token only by email.
- API response must always be generic:

```text
If this email exists, a reset link has been sent.
```

Add:

- Expiry time.
- One-time use.
- Rate limiting.
- Audit logging.

### P1-05 Add brute-force protection

Expected changes:

- Add throttling on:
  - login
  - register
  - forgot-password
  - reset-password
  - refresh
  - invitation endpoints
- Add failed login counter and lockout if appropriate.
- Keep attacker-facing errors generic.

### P1-06 Disable or gate open self-registration

Expected changes:

- Public self-registration should be disabled by default.
- Use invitation-based registration for real tenants.
- Admin must create/invite users.
- Add tenant/admin setting such as `ALLOW_PUBLIC_REGISTRATION`, default false.

### P1-07 Enforce inactive/deleted user checks

Expected changes:

- Login must reject inactive users.
- Refresh must reject inactive users.
- JWT validation must load user and reject inactive/deleted users.
- Deactivating a user must revoke sessions where feasible.

### P1-08 Fix tenant isolation

Expected changes:

- Audit every `findMany`, `findFirst`, `findUnique`, `update`, `delete`, and `count` on tenant-owned records.
- Ensure backend uses authenticated tenant context, not caller-supplied body/query `tenantId`.
- Tenant-owned data should be scoped by `tenantId`.
- Super admin access should be explicit and audited.

High-risk areas to inspect:

```text
utilities
vehicles
users
roles
cleaning
farm
work-orders
inventory
reports
notifications
documents/uploads
```

### P1-09 Protect Swagger and detailed readiness endpoints

Expected changes:

- Swagger docs should not be public in production.
- Either disable Swagger in production or protect with admin/basic auth/IP allowlist.
- Public health endpoint should return minimal OK status.
- Detailed readiness should require admin/auth.

### P1-10 Fix localStorage token risk

Expected changes:

- Avoid storing refresh tokens in localStorage.
- Prefer HTTP-only, Secure, SameSite cookies for refresh/session.
- Add CSRF protection if using cookie-based auth.
- If access token remains in memory/client, document the decision and risk.

### P1-11 Authenticate WebSocket connections

Expected changes:

- Fleet and notification sockets must verify JWT.
- Join tenant-specific rooms.
- Never broadcast tenant-specific data globally.

## Phase 2 - Branding, login, navigation, role dashboards, and UI/UX foundation

### P2-01 Standardize product branding

Use one product identity:

```text
MaintainPro
Enterprise Maintenance & Facility Operations Platform
```

Replace inconsistent names:

- Maintenance Job
- FMS
- Operations Command, if inconsistent
- Any old legacy labels unless intentionally archived

Update:

- Login page
- Sidebar
- Dashboard
- Browser metadata
- Email templates
- Mobile app name
- Error pages
- PWA manifest/icons

### P2-02 Rebuild login page

Expected UI:

- Professional split layout.
- MaintainPro logo/brand.
- Secure access message.
- Work email field.
- Password field with show/hide.
- Forgot password link.
- Loading state.
- Generic error message.
- No public sign-up link unless invitation token is present.
- No admin credentials shown.
- Mobile responsive layout.

### P2-03 Role-based redirects after login

Expected routing:

```text
SUPER_ADMIN -> /admin/overview
ADMIN -> /dashboard
MANAGER -> /dashboard/manager or /dashboard
FACILITY_MANAGER -> /facility
BUILDING_SUPERVISOR -> /facility/issues
MAINTENANCE_SUPERVISOR -> /work-orders
TECHNICIAN -> /work-orders/my-jobs
CLEANER -> /cleaning/my-tasks
SECURITY_OFFICER -> /fleet/gate or security dashboard
INVENTORY_KEEPER -> /inventory
PROCUREMENT_OFFICER -> /procurement
FINANCE_APPROVER -> /budgets or approvals
VENDOR -> /vendor/dashboard
REQUESTER -> /requester/dashboard
VIEWER -> /reports or read-only dashboard
```

Do not redirect users to legacy `/home` after login.

### P2-04 Replace legacy landing path

Expected changes:

- Stop using `/home` as the default landing page.
- Either archive it, redirect it, or clearly mark it as legacy.
- Move real users to modern dashboard/workflow pages.

### P2-05 Responsive navigation

Expected behavior:

- Desktop: persistent sidebar.
- Tablet: collapsible sidebar.
- Mobile: drawer and/or bottom nav.
- Include Scan QR quick action for field users.
- Navigation items must be permission-aware.

Recommended nav groups:

```text
Operations
  Dashboard
  Repair Requests
  Work Orders
  Preventive Maintenance

Facility
  Properties / Sites
  Buildings
  Building Assets
  Cleaning
  Utilities
  Inspections

Fleet
  Vehicles
  Drivers
  Trips
  Fuel

Supply Chain
  Inventory
  Procurement
  Suppliers
  Vendors

Finance & Governance
  Budgets
  Compliance & Safety
  Documents
  Reports
  Audit
  Admin
```

### P2-06 Professional tables

All important list pages need:

- Search
- Sort
- Filter
- Pagination
- Saved filters/views
- Column visibility
- Export CSV/XLSX/PDF where suitable
- Bulk actions
- Status badges
- Priority badges
- Row action menu
- Loading skeleton
- Empty state with action
- Error state with retry
- Mobile card layout
- Role-based action visibility

Apply to:

- work orders
- repair requests
- assets
- building assets
- vehicles
- inventory
- procurement
- vendors
- budgets
- compliance
- documents
- users
- audit logs

### P2-07 Replace browser prompts/confirms

Search for:

```text
window.prompt
window.confirm
window.alert
```

Replace with professional components:

- Confirm dialog
- User picker modal
- Date/time picker modal
- Textarea modal
- Delete confirmation requiring entity name if destructive

### P2-08 Add global command search

Add command palette:

- Ctrl+K / Cmd+K
- Search assets, building assets, work orders, repair requests, vehicles, vendors, users, inventory, buildings, rooms, documents.
- Results must respect role and tenant permissions.

### P2-09 Add breadcrumbs

Every non-dashboard module page should show breadcrumbs.

Example:

```text
Dashboard > Facility > Buildings > Tower A > Floor 2 > Room 204
```

### P2-10 Standard UI states

Create reusable:

- EmptyState
- ErrorState
- LoadingSkeleton
- PageHeader
- ConfirmDialog
- DetailDrawer
- FilterBar
- MobileCardList

## Phase 3 - Work order and repair workflow maturity

### P3-01 Full work-order lifecycle

Implement professional lifecycle:

```text
Draft
Submitted
Pending Approval
Approved
Assigned
In Progress
Paused / On Hold
Waiting for Parts
Waiting for Vendor
Waiting for Approval
Completed Pending Verification
Verified
Requester Confirmed
Closed
Reopened
Cancelled
Rejected
```

Rules:

- Technician completion should not close the job.
- Supervisor verification is required before closure.
- Requester confirmation or timeout policy should finalize closure.
- Reopen requires reason.
- Cancellation requires reason and permission.

### P3-02 Repair request intake

Repair request fields:

- Reference number
- Requester name/contact
- Tenant/company
- Site/property
- Building
- Floor
- Zone/room/area
- Related asset/building asset
- Issue category
- Priority suggestion
- Safety risk flag
- Description
- Photos/videos
- Preferred access time
- Status
- Reviewer
- Converted work order

Issue categories:

- Electrical
- Plumbing
- AC/HVAC
- Lift/elevator
- Cleaning
- Pest control
- Civil/building damage
- Fire safety
- CCTV/security
- Water leakage
- Lighting
- Furniture
- Generator
- Utility
- Other

### P3-03 Approval workflow

Add approval types:

- Request approval
- Cost approval
- Parts approval
- Vendor approval
- Procurement approval
- Completion approval
- Asset disposal approval
- Permit-to-work approval

Approval should include:

- Approver
- Status
- Decision date
- Reason/comment
- Threshold/rule used
- Audit log

### P3-04 Technician assignment

Assignment should consider:

- Skill
- Location/building
- Availability
- Workload
- Shift
- Priority
- SLA deadline
- Vendor requirement

### P3-05 Time, cost, and evidence

Work orders should record:

- Estimated hours
- Actual start time
- Pause/resume records
- Actual hours
- Labor rate
- Parts used
- Vendor cost
- Other cost
- Total cost
- Before photos
- After photos
- Technician notes
- Root cause
- Corrective action
- Preventive action

### P3-06 Activity timeline

Every work order should have an activity timeline:

- Created
- Reviewed
- Approved/rejected
- Assigned
- Started
- Paused/resumed
- Parts requested
- Vendor assigned
- Note/photo added
- Completed
- Verified/rejected
- Reopened
- Closed

## Phase 4 - Facility and building maintenance module

### P4-01 Location hierarchy

Build or reuse:

```text
Site / Property
Building
Floor
Zone / Area
Room
Asset / Building Asset
```

Every building-maintenance record should link to this hierarchy.

### P4-02 Facility management records

Facility module must support:

- Sites/properties
- Buildings
- Floors
- Rooms/areas/zones
- Common areas
- Parking areas
- Washrooms
- Electrical rooms
- Pump rooms
- Generator rooms
- AC plant rooms
- Lift/elevator areas
- Fire exits
- Roof/drainage areas
- Security posts
- Floor plans
- QR codes

### P4-03 Building asset register

Track building assets:

- AC units
- HVAC systems
- Generators
- Electrical panels
- UPS
- Water pumps
- Water tanks
- Elevators/lifts
- Fire extinguishers
- Fire alarms
- Sprinklers
- CCTV
- Access control
- Door locks
- Lights
- Fans
- Toilets/wash basins
- Drainage/gutters
- Roof
- Furniture
- Office equipment

Asset fields:

- Asset code/tag
- Name
- Category
- Brand/model/serial number
- Location
- QR code
- Purchase/install date
- Warranty expiry
- Supplier/vendor
- Current condition
- Criticality
- Status
- Maintenance frequency
- Documents/photos
- Maintenance history
- Total maintenance cost

### P4-04 Preventive maintenance

Support PM schedules for:

- AC servicing
- Generator testing
- Fire extinguisher checks
- Electrical panel inspections
- Water tank cleaning
- Pest control
- CCTV inspections
- Lift/elevator inspections
- Plumbing inspections
- Roof/gutter cleaning
- Emergency light checks
- UPS inspections

Features:

- Calendar/list views
- Recurring schedules
- Meter-based schedules
- PM checklist templates
- Auto-create work orders
- Advance notifications
- Missed PM alerts
- PM compliance reports

### P4-05 Cleaning management

Features:

- Cleaning locations/areas
- Daily/weekly/monthly schedules
- Cleaner assignment
- Checklist template builder
- QR check-in/check-out
- Geolocation if appropriate
- Photo proof
- Cleaning material usage
- Supervisor sign-off
- Missed visit alerts
- Cleaning compliance dashboard

### P4-06 Utility tracking

Track:

- Electricity
- Water
- Diesel
- Generator fuel
- Solar generation
- Gas
- Chilled water, if applicable

Features:

- Meter location by building/floor/area
- Previous/current readings
- Consumption calculation
- Unit rates
- Budget vs actual
- Photo proof
- Abnormal usage detection
- Monthly reports

### P4-07 Inspections

Support inspection templates and records:

- Fire safety
- Electrical
- HVAC/AC
- Generator
- Lift/elevator
- Plumbing
- Roof/drainage
- Pest control
- Cleaning quality
- Emergency exits
- CCTV/security
- General building condition

If a critical inspection item fails, auto-create a high-priority issue/work order.

## Phase 5 - Documents, files, photos, and evidence

### P5-01 Proper file upload service

Do not rely on user-entered URL strings for important evidence.

Implement or complete:

- Multipart upload endpoint
- Private object storage: Cloudflare R2, S3, MinIO, or equivalent
- Signed URLs
- MIME allowlist
- Extension validation
- Size limits
- Virus scanning hook if feasible
- Upload audit log

### P5-02 Document management module

Documents should link to:

- Building
- Floor/room
- Asset/building asset
- Work order
- Repair request
- Vendor
- Contract
- Purchase order
- Invoice
- Inspection
- Compliance certificate
- Warranty

Document features:

- Category
- Tags
- Versioning
- Expiry date
- Renewal reminders
- Access permissions
- Download audit
- Preview PDF/image

Document types:

- Asset manuals
- Warranties
- Invoices
- Vendor contracts
- Compliance certificates
- Insurance documents
- Safety documents
- Inspection reports
- Floor plans
- Before/after photos
- Cleaning proof photos
- Work order attachments

## Phase 6 - Inventory, procurement, vendors, budgets, compliance, and safety

### P6-01 Inventory and spare parts

Features:

- Part categories
- Item code/name
- Unit
- Current stock
- Minimum stock
- Reorder point
- Reorder quantity
- Store/bin location
- Supplier
- Unit cost
- Average cost
- Stock value
- Stock in/out
- Parts reservation for work order
- Parts issue approval
- Stock adjustment reason
- Physical stock count
- Inventory valuation
- Low stock alerts

### P6-02 Procurement

Workflow:

```text
Part request
Manager approval
Purchase request
RFQ / quotations
Quotation comparison
Finance approval
Purchase order
Goods received note
Invoice matching
Payment status
Stock update
```

### P6-03 Vendor portal

Vendor features:

- Vendor login
- View assigned jobs
- Accept/reject job
- Upload quotation
- Update progress
- Upload completion photos
- Submit invoice
- Upload documents/certificates
- View payment status

Admin vendor management:

- Vendor profile
- Service categories
- Contract details
- Insurance/license expiry
- Vendor rating
- Performance reports
- Job history
- Cost history

### P6-04 Budgeting

Budget types:

- Building maintenance budget
- Department budget
- Utility budget
- Cleaning budget
- Vendor budget
- Preventive maintenance budget
- Emergency repair budget
- Project budget

Features:

- Budget vs actual
- Committed vs spent
- Approval thresholds
- Over-budget alerts
- Monthly trend
- Cost by building
- Cost by category
- Cost by vendor
- Cost center tracking

### P6-05 Compliance and safety

Features:

- Fire safety certificates
- Electrical safety certificates
- Elevator/lift certificates
- Generator tests
- Building permits
- Insurance
- Safety training
- Contractor compliance documents
- Certificate expiry alerts
- Permit-to-work
- PPE checklist
- Risk assessment
- Safety incidents
- Near-miss reporting
- Corrective actions

Permit-to-work types:

- Hot work
- Electrical work
- Confined space
- Height/roof work
- Excavation
- Chemical handling
- Lockout/tagout
- General contractor work

## Phase 7 - Mobile technician app, requester portal, notifications

### P7-01 Mobile technician app

Mobile screens:

- Login
- My jobs today
- Job detail
- Start/pause/resume job
- QR scanner
- Asset info after scan
- Checklist
- Add parts used
- Add notes
- Before/after photos
- Complete job
- Signature capture
- Notifications
- Offline sync queue

Offline support:

- Cache assigned jobs
- Cache checklists
- Queue updates while offline
- Queue photo uploads
- Show sync status
- Manual sync button

### P7-02 Requester portal

Public/staff issue reporting:

- Submit repair request
- QR scan location
- Upload photo
- Select category/priority
- Track status by reference number
- Add comments
- Confirm completion
- Reopen issue
- Rate service

Privacy:

- Requester sees only their own request.
- Internal notes are hidden from requester.
- Technician personal details should be limited.

### P7-03 Notifications

Channels:

- In-app
- Email
- SMS
- Push
- WhatsApp later if needed

Alert rules:

- New repair request
- Job assigned
- Job overdue
- SLA near breach
- SLA breached
- PM due soon
- PM missed
- Low stock
- Utility anomaly
- Cleaning missed
- Cost approval pending
- Vendor job delayed
- Certificate expiring
- Inspection failed

Escalation:

```text
Technician -> Supervisor -> Manager -> Director/Admin
```

Admin must see queue/integration failures.

## Phase 8 - Reports, analytics, Power BI, and predictive maintenance

### P8-01 Operations dashboard

Dashboard KPIs:

- Open work orders
- Critical jobs
- Overdue jobs
- SLA breaches
- Pending approvals
- Assets due PM
- Low stock
- Utility anomalies
- Cleaning missed tasks
- Failed inspections
- Vendor delays
- Cost this month

### P8-02 Building dashboard

Show:

- Open issues by building/floor
- Cost by building
- Asset downtime
- PM compliance
- Cleaning compliance
- Utility usage
- Compliance status
- Repeated issues
- High-risk assets

### P8-03 Executive reports

Reports:

- Monthly maintenance cost
- Budget vs actual
- Work order aging
- SLA compliance
- Asset downtime
- Technician performance
- Vendor performance
- Inventory valuation
- Utility usage
- Preventive vs corrective maintenance
- Building cost comparison

### P8-04 Power BI integration

Provide tenant-safe export/API datasets:

- Work orders
- Assets
- Building hierarchy
- Costs
- Utility readings
- Cleaning compliance
- SLA
- Technician performance
- Vendor performance
- Budget vs actual
- Inventory usage

### P8-05 Predictive maintenance

Start with rule-based logic before advanced AI:

- Repeated failures
- High maintenance cost compared to asset value
- Overdue preventive maintenance
- Asset nearing end-of-life
- Utility consumption anomaly
- Repeated issue in same room/location
- Inventory demand prediction

Later:

- AI copilot with safe context injection.
- Replacement recommendations.
- Maintenance strategy suggestions.

## Phase 9 - Performance, testing, and production readiness

### P9-01 Performance

Fix:

- Slow health/readiness endpoints.
- Swagger timeout/performance.
- Unpaginated list endpoints.
- Heavy synchronous report generation.
- Settings page loading too many APIs at once.
- Large dashboard queries without caching.
- Missing indexes.
- Raw image usage instead of optimized images.

### P9-02 Pagination and filtering

Every list endpoint should accept:

```text
page
pageSize
sortBy
sortDirection
search
filters
```

Return:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 120,
    "totalPages": 5
  }
}
```

### P9-03 Testing

Add/verify:

- Auth security tests
- Tenant isolation tests
- Work order lifecycle tests
- Repair request conversion tests
- File upload validation tests
- RBAC tests
- Dashboard smoke tests
- Mobile endpoint contract tests where feasible

### P9-04 Production readiness

Verify:

- Environment variables documented.
- Secrets not committed.
- Swagger protected.
- Detailed health protected.
- Database backup/restore documented.
- Audit logs reliable.
- Error messages safe.
- Rate limits active.
- File storage private.
- Reports do not block request thread.

## Final output required from the coding agent

At the end of each implementation phase, provide:

1. Summary of work completed.
2. Todo table with statuses.
3. Files changed.
4. Tests/checks run.
5. Screens/pages affected.
6. Security risks fixed.
7. Remaining risks.
8. Next recommended phase.

At the end of the whole project, provide:

```markdown
# MaintainPro Production Readiness Completion Report

## Completed phases
## Security fixes
## UI/UX improvements
## Workflow improvements
## New modules added
## Database changes
## API changes
## Web app changes
## Mobile app changes
## Tests and verification
## Known limitations
## Deployment notes
## Recommended future improvements
```

# Copy-paste prompt ends here

---

## Practical recommendation

Do not ask a coding agent to implement all phases in one run. Start in this order:

1. Phase 0: audit and todo setup.
2. Phase 1: security/auth/tenant isolation.
3. Phase 2: branding, login, navigation, role dashboards, tables.
4. Phase 3: repair request and work-order lifecycle.
5. Phase 4: facility/building hierarchy.
6. Continue with documents, inventory, procurement, vendors, budgets, compliance, mobile, requester portal, reports, and predictive maintenance.

This keeps the project controlled, testable, and suitable for a real production system.
