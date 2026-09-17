# Vendor Portal

Restricted vendor-facing API and UI for assigned external repair jobs.

## Access model

- Admins grant `VendorPortalAccess` linking a `User` to a `Supplier`.
- Portal APIs resolve supplier IDs from the authenticated user — no client-supplied supplier override.
- Responses omit internal costs, confidential notes, and unrelated tenants/vendors.

## Endpoints

- `POST /vendor-portal/access` — grant access (admin)
- `GET /vendor-portal/jobs` — assigned cases only
- `GET /vendor-portal/jobs/:id`
- `POST /vendor-portal/jobs/:id/quotations`
- `PATCH /vendor-portal/jobs/:id/progress` — limited statuses

## UI

- `/vendor-portal` — assigned jobs, quotation upload, progress actions

## Negative authorization

Users without portal links receive `403`. Cross-supplier case IDs return `404`.
