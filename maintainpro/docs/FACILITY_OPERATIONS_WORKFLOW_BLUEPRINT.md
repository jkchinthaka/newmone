# Facility Operations Workflow Blueprint

This blueprint defines how MaintainPro should grow from a broad maintenance platform into a professional facility, building maintenance, and operations management system. It is intended to guide implementation across the API, web app, mobile app, database schema, reports, and integrations.

For a copy-paste implementation prompt with phased execution and todo-list monitoring, see [Master Implementation Prompt](MASTER_IMPLEMENTATION_PROMPT.md).

## Product scope

MaintainPro should use one clear product identity:

- Product name: MaintainPro
- Product subtitle: Facility, Asset & Maintenance Operations Platform
- Core purpose: manage buildings, assets, repair requests, work orders, technicians, vendors, inventory, procurement, budgets, compliance, documents, and management reporting in one tenant-aware workflow.

## Core operating model

The main workflow should connect all modules through building/location and work-order history.

```text
Requester reports issue
  -> Facility team reviews and classifies request
  -> Priority, SLA, location, asset, and category are assigned
  -> Technician or vendor is assigned
  -> Parts, permits, and approvals are checked
  -> Work is executed with notes, photos, labor, and parts
  -> Supervisor verifies completion
  -> Requester signs off or reopens
  -> Costs, documents, audit, and reports are updated
```

## Location hierarchy

All building maintenance records should attach to a consistent location hierarchy.

```text
Tenant / Company
  -> Site / Property
    -> Building
      -> Floor
        -> Room / Area / Zone
          -> Asset / Equipment
            -> Repair Requests
            -> Work Orders
            -> Preventive Maintenance
            -> Inspections
            -> Documents
            -> Costs
```

## Recommended navigation structure

```text
Dashboard
Facility Management
  - Sites
  - Buildings
  - Floors
  - Rooms / Areas
  - Building Inspections
Repair Requests
Work Orders
Preventive Maintenance
Assets
Inventory
Procurement
Vendors
Cleaning Management
Utilities
Budgeting
Compliance & Safety
Documents
Reports / Power BI
Notifications
Admin Console
Mobile App
Requester Portal
```

## Role-based landing pages

- SUPER_ADMIN: system health, tenants, subscriptions, integrations, audit, security alerts.
- ADMIN: operations dashboard, pending approvals, overdue work, low stock, SLA breaches.
- MANAGER: team workload, assigned buildings, costs, approvals, vendor performance.
- TECHNICIAN: assigned jobs, urgent jobs, today's tasks, QR scan, start/pause/complete.
- CLEANER: today's cleaning schedule, QR scan, checklist, missed visits, sign-off status.
- VENDOR: assigned vendor jobs, quotations, progress updates, invoices, documents.
- REQUESTER: submit issue, track requests, provide feedback, reopen unresolved work.
- VIEWER: read-only KPIs, reports, dashboards, and exported summaries.

## 1. Facility Management Module

### Purpose

Maintain the master data and operational context for all buildings and physical locations.

### Records

- Site / property
- Building
- Floor
- Room / area / zone
- Common area
- Parking area
- Plant room
- Electrical room
- Pump room
- Generator room
- AC/HVAC room
- Elevator area
- Washroom
- Roof and drainage area
- Security post
- Emergency assembly point

### Required fields

- Name and code
- Parent location
- Location type
- Address or coordinates
- Responsible manager
- Assigned maintenance team
- Emergency contacts
- Operating hours
- Access instructions
- Criticality level
- Active/inactive status

### Key workflows

1. Create site/property.
2. Add buildings under the site.
3. Add floors, rooms, and areas under each building.
4. Attach assets, utility meters, cleaning schedules, documents, inspections, and work orders to the correct location.
5. Show building-wise cost, open issues, overdue work, safety status, and cleaning compliance.

### Professional features

- Building profile page
- Floor/area issue heatmap
- Maintenance calendar by building
- Cost history by building/floor/area
- Vendor contract mapping by building
- Emergency contact and escalation tree
- Building document library

## 2. Building Maintenance / Repair Module

### Purpose

Record, repair, track, approve, and report all building maintenance issues.

### Repair request fields

- Request number
- Tenant
- Site
- Building
- Floor
- Room / area
- Related asset
- Category
- Priority
- SLA policy
- Description
- Photos/videos
- Reported by
- Contact details
- Preferred visit time
- Access instructions
- Status
- Assigned reviewer
- Converted work order

### Categories

- Electrical
- Plumbing
- HVAC / AC
- Lift / elevator
- Civil work
- Carpentry
- Painting
- Cleaning
- Pest control
- Fire safety
- Security
- Utility
- General maintenance

### Status flow

```text
Submitted
  -> Under Review
  -> Approved
  -> Converted to Work Order
  -> Assigned
  -> In Progress
  -> Completed
  -> Supervisor Verified
  -> Requester Signed Off
  -> Closed
```

### Exception statuses

- Rejected
- Duplicate
- On Hold
- Waiting for Parts
- Waiting for Vendor
- Waiting for Approval
- Reopened
- Cancelled

### Work order execution fields

- Work order number
- Technician/vendor assignment
- Priority
- SLA response deadline
- SLA resolution deadline
- Planned start and due date
- Actual start and completion date
- Labor hours
- Parts used
- Cost estimate
- Actual cost
- Before photos
- After photos
- Technician notes
- Supervisor notes
- Completion checklist
- Digital signature
- Reopen reason

### Professional features

- SLA timers and breach alerts
- Repeat issue detection by location/asset/category
- Before/after photo comparison
- Assignment by skill, workload, and location
- Cost approval thresholds
- Supervisor verification
- Requester feedback and rating
- Maintenance history by building, location, and asset

## 3. Preventive Maintenance Module

### Purpose

Generate planned maintenance before breakdowns happen.

### Schedule types

- Calendar based: daily, weekly, monthly, quarterly, annually.
- Meter based: mileage, running hours, cycle count, utility reading.
- Condition based: risk score, repeated issue count, inspection failure.
- Compliance based: statutory certificate or inspection expiry.

### Records

- PM schedule
- Asset/building/location
- Frequency
- Checklist template
- Assigned team
- Required parts
- Estimated duration
- SLA policy
- Next due date
- Last completed date
- Auto-create work order flag

### Workflow

```text
Schedule created
  -> Upcoming PM alert
  -> Work order auto-created
  -> Technician completes checklist
  -> Supervisor verifies
  -> Next due date recalculated
  -> PM compliance updated
```

### Reports

- PM compliance percentage
- Overdue PM
- PM cost by building/asset
- Missed PM list
- Breakdown after missed PM

## 4. Vendor Portal

### Purpose

Allow external contractors to participate in controlled maintenance workflows.

### Vendor records

- Vendor company
- Contact person
- Services offered
- Approved buildings/sites
- Contract start/end
- Insurance documents
- License/certification documents
- Tax details
- Bank details
- Rating
- Status: Pending, Approved, Suspended, Blocked

### Vendor portal actions

- View assigned jobs
- Accept/reject job
- Submit quotation
- Update job progress
- Upload photos/documents
- Submit invoice
- Mark vendor work complete
- View payment status

### Admin controls

- Vendor approval
- Contract expiry alerts
- Document expiry alerts
- Performance scoring
- Vendor cost report
- Vendor SLA compliance

## 5. Inventory & Procurement Module

### Purpose

Connect spare parts, tools, materials, purchasing, and stock control to work-order execution.

### Inventory records

- Item code
- Item name
- Category
- Unit of measure
- Current stock
- Minimum stock
- Reorder level
- Store/location
- Supplier
- Unit cost
- Expiry date
- Warranty details
- Related assets/categories

### Stock workflow

```text
Item created
  -> Stock received
  -> Reserved for work order
  -> Issued to technician
  -> Used or returned
  -> Stock movement audited
```

### Procurement workflow

```text
Purchase request
  -> Manager approval
  -> Quotation collection
  -> Finance approval
  -> Purchase order
  -> Goods received note
  -> Invoice matching
  -> Payment status update
  -> Stock updated
```

### Professional features

- Low stock alerts
- Auto purchase request from reorder point
- Parts reservation for work orders
- Stock adjustment approval
- GRN workflow
- Supplier comparison
- Inventory valuation report
- Stock movement audit

## 6. Budgeting Module

### Purpose

Control maintenance spending by building, department, category, and project.

### Budget types

- Building budget
- Department budget
- Monthly maintenance budget
- Annual maintenance budget
- Emergency repair budget
- Project budget
- Vendor contract budget
- Preventive maintenance budget

### Records

- Budget name
- Budget period
- Scope: building, department, category, asset type, vendor, project
- Approved amount
- Committed amount
- Actual amount
- Remaining amount
- Approval threshold
- Owner/approver

### Workflow

```text
Budget created
  -> Work/order procurement costs committed
  -> Actual costs recorded
  -> Over-budget alert generated
  -> Manager reviews variance
  -> Budget adjustment approved or rejected
```

### Reports

- Budget vs actual
- Cost by building
- Cost by category
- Cost by vendor
- Monthly variance
- Forecasted overspend

## 7. Compliance & Safety Module

### Purpose

Track statutory inspections, safety incidents, permits, corrective actions, and document expiry.

### Compliance records

- Fire extinguisher inspection
- Fire alarm test
- Emergency exit inspection
- Lift/elevator certification
- Generator service
- Electrical panel inspection
- Water tank cleaning
- Pest control certificate
- Insurance document
- Safety training record
- Contractor safety document

### Safety workflows

```text
Inspection scheduled
  -> Checklist completed
  -> Issue/non-compliance found
  -> Corrective work order created
  -> Responsible person assigned
  -> Evidence uploaded
  -> Supervisor approval
  -> Compliance closed
```

### Incident workflow

```text
Incident reported
  -> Severity assigned
  -> Immediate action recorded
  -> Investigation opened
  -> Corrective actions assigned
  -> Evidence and documents attached
  -> Management review
  -> Closed with audit trail
```

### Professional features

- Permit-to-work
- PPE checklist
- Risk assessment
- Corrective action register
- Expiry alerts
- Safety dashboard
- Compliance calendar

## 8. Mobile Technician App

### Purpose

Give field workers a simple mobile workflow for job execution.

### Technician features

- My assigned jobs
- Today's tasks
- Urgent jobs
- QR scan asset/location
- Start job
- Pause/on-hold job
- Add notes
- Upload photos
- Add labor hours
- Use/reserve parts
- Complete checklist
- Capture signature
- Mark complete
- Offline queue and later sync
- Push notifications

### Cleaner features

- Today's cleaning schedule
- Scan QR location
- Complete checklist
- Upload proof photos
- Submit visit
- See missed tasks
- Track supervisor sign-off

### Mobile design rules

- Large action buttons
- Minimal charts
- Fast task list
- Offline-first forms
- Camera and QR scanner support
- Clear sync status

## 9. Requester Portal

### Purpose

Let employees, tenants, residents, or departments report issues without admin intervention.

### Requester actions

- Submit repair request
- Select building/floor/room
- Add photos/videos
- Select category
- Add preferred time/access notes
- Track request status
- Receive notifications
- Provide feedback/rating
- Reopen unresolved issue

### Requester workflow

```text
Requester submits issue
  -> Receives request number
  -> Tracks status changes
  -> Gets completion notification
  -> Signs off or reopens
  -> Rates service
```

### Controls

- CAPTCHA/rate limit for public request forms
- Tenant-aware requester access
- Privacy controls for photos/documents
- Duplicate request suggestion

## 10. Predictive Maintenance Module

### Purpose

Use operational history to identify failure risk and recommend action.

### Inputs

- Asset age
- Breakdown frequency
- Repair history
- PM history
- Meter readings
- Runtime hours
- Utility consumption
- Inspection failures
- Sensor/IoT data
- Cost trend

### Outputs

- Failure risk score
- Risk reason summary
- Recommended maintenance date
- Replacement recommendation
- High-risk asset list
- Repeated issue detection
- Forecasted maintenance cost
- Auto-generated alerts or draft work orders

### Example insight

```text
Generator 01
Risk: High
Reasons: 3 failures in 60 days, overdue PM, rising fuel consumption
Recommendation: Schedule inspection and oil/filter service within 7 days
```

## 11. Power BI Integration

### Purpose

Provide executive reporting and external BI integration.

### Integration options

- Reporting API endpoint
- Scheduled CSV export
- Power BI dataset endpoint
- Database reporting views
- Embedded dashboard iframe/page

### Datasets

- Work orders
- Repair requests
- Assets
- Buildings/locations
- Inventory movements
- Procurement
- Budgets
- Vendors
- Utilities
- Compliance
- Cleaning visits
- Technician performance

### Dashboards

- Monthly maintenance cost
- Work order aging
- SLA compliance
- Asset downtime
- Building cost comparison
- Vendor performance
- Inventory valuation
- Utility usage
- PM compliance
- Budget vs actual

## 12. Document Management Module

### Purpose

Centralize operational documents with secure storage, permissions, expiry alerts, and links to records.

### Document types

- Asset manuals
- Warranty documents
- Invoices
- Vendor contracts
- Compliance certificates
- Insurance documents
- Safety documents
- Inspection reports
- Floor plans
- Photos/videos
- Work order attachments

### Fields

- Document number
- Title
- Type
- Linked entity type
- Linked entity ID
- Version
- Expiry date
- Owner
- Access level
- Storage provider key
- File hash
- Uploaded by
- Approved by

### Professional features

- Version control
- Expiry alerts
- Secure private storage
- Signed download URLs
- Download history
- Access permissions
- Approval workflow
- Document audit trail

## 13. Cleaning Management Integration

### Purpose

Connect cleaning schedules and quality control to buildings and areas.

### Records

- Cleaning location
- Schedule
- Cleaner assignment
- Checklist
- QR code
- Visit record
- Missed visit
- Photo proof
- Supervisor sign-off
- Quality score

### Reports

- Cleaning compliance by building
- Missed visits
- Cleaner productivity
- Quality score trend
- Areas with repeated issues

## 14. Admin Console additions

The admin console should manage:

- Users
- Roles
- Permissions
- Tenants
- Departments
- Buildings and locations
- Vendor approval
- Budget settings
- SLA policies
- Workflow rules
- Notification templates
- Integrations
- Audit logs
- Security settings
- Billing/subscriptions

## 15. Dashboard KPIs

### Operations dashboard

- Open work orders
- New repair requests
- SLA breaches
- Overdue PM
- Critical assets
- Pending approvals
- Low stock
- Vendor delays
- Safety incidents
- Building cost this month

### Building dashboard

- Open issues by floor/area
- Cost by category
- Asset downtime
- PM compliance
- Cleaning compliance
- Utility usage
- Compliance status
- Repeated problems

### Technician dashboard

- My open jobs
- Today's jobs
- Urgent jobs
- Waiting for parts
- Jobs near SLA breach
- Completed this week

### Executive dashboard

- Budget vs actual
- Cost trend
- SLA compliance
- Asset replacement forecast
- Vendor performance
- Portfolio building comparison

## 16. Core database entities

Minimum new or expanded entities:

- Site
- Building
- Floor
- RoomArea
- RepairRequest
- WorkOrder
- PreventiveMaintenanceSchedule
- PreventiveMaintenanceChecklist
- Inspection
- InspectionChecklist
- TechnicianAssignment
- Vendor
- VendorContract
- VendorQuotation
- VendorInvoice
- InventoryItem
- StockMovement
- PurchaseRequest
- PurchaseOrder
- GoodsReceivedNote
- Budget
- BudgetLine
- Expense
- ComplianceRecord
- SafetyIncident
- PermitToWork
- Document
- Approval
- SlaPolicy
- NotificationRule
- AuditLog

## 17. Status and priority standards

### Priority

- Emergency
- High
- Medium
- Low

### Repair request status

- Submitted
- Under Review
- Approved
- Rejected
- Converted
- Cancelled

### Work order status

- Open
- Assigned
- In Progress
- On Hold
- Waiting for Parts
- Waiting for Vendor
- Waiting for Approval
- Completed
- Verified
- Closed
- Reopened
- Cancelled

### Approval status

- Pending
- Approved
- Rejected
- Escalated
- Cancelled

## 18. Security and tenancy requirements

Every new module must follow these rules:

- All tenant-owned records must include a non-null tenant ID.
- Backend queries must filter by authenticated tenant context.
- Frontend role-based hiding is not enough; backend permissions must enforce actions.
- Sensitive actions require audit logs.
- File uploads require validation, size limits, private storage, and signed URLs.
- Public requester endpoints require rate limiting and abuse protection.
- Vendor portal access must be restricted to assigned vendor records only.
- Power BI/report exports must respect tenant and permission boundaries.

## 19. UI/UX requirements

### Tables

- Search
- Sort
- Filter
- Pagination
- Export CSV/XLSX/PDF where appropriate
- Bulk actions
- Status and priority badges
- Row action menu
- Mobile card view
- Saved filters
- Empty/loading/error states

### Forms

- Clear required fields
- Inline validation
- File upload progress
- Autosave for long forms where useful
- Confirmation modals for destructive actions
- No browser `prompt` or `confirm` for professional workflows

### Mobile

- Drawer or bottom navigation
- Large action buttons
- Offline queue
- Camera upload
- QR scanner
- Sync status

## 20. Implementation order

### Phase 1: Foundation

1. Standardize branding and role-based landing pages.
2. Add facility location hierarchy: Site, Building, Floor, Room/Area.
3. Make work orders and assets location-aware.
4. Add repair request intake and conversion to work order.
5. Add professional tables, loading states, empty states, and mobile navigation.

### Phase 2: Operations workflow

1. Add SLA policies.
2. Add technician assignment rules.
3. Add PM schedules and auto-created work orders.
4. Add inventory reservation and parts usage.
5. Add approval workflows for cost and procurement.

### Phase 3: Business controls

1. Add vendor portal.
2. Add procurement lifecycle.
3. Add budgeting and budget vs actual reporting.
4. Add document management.
5. Add compliance and safety inspections.

### Phase 4: Field and analytics

1. Complete mobile technician/cleaner workflows.
2. Add requester portal.
3. Add predictive maintenance scoring.
4. Add Power BI datasets and executive reports.
5. Add advanced dashboards and scheduled reports.

## 21. Developer prompt for implementation

```text
Extend MaintainPro into a professional Facility, Building Maintenance, and Operations Management platform.

Implement the workflow in docs/FACILITY_OPERATIONS_WORKFLOW_BLUEPRINT.md step by step, following existing NestJS, Next.js, Flutter, Prisma MongoDB, and tenant/RBAC patterns.

Start with the foundation:
1. Add Site, Building, Floor, and Room/Area hierarchy.
2. Make assets, repair requests, work orders, inspections, documents, utilities, and cleaning locations attach to this hierarchy.
3. Add a Repair Request module with request intake, review, priority, SLA, conversion to work order, requester tracking, and sign-off.
4. Mature Work Orders with assignment, SLA status, parts used, labor hours, before/after photos, supervisor verification, requester sign-off, and reopen.
5. Add professional UI tables with search, filters, sort, pagination, status badges, row actions, exports, loading/error/empty states, and mobile card views.
6. Add role-based dashboards and routing for Admin, Manager, Technician, Cleaner, Vendor, Requester, Viewer, and Super Admin.
7. Enforce tenant isolation, backend RBAC, audit logs, secure file uploads, and rate limits.

Then continue with Vendor Portal, Inventory and Procurement, Budgeting, Compliance and Safety, Mobile Technician App, Requester Portal, Predictive Maintenance, Power BI Integration, and Document Management.
```
