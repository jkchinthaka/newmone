# MaintainPro UI component inventory

Reuse these before adding a component. Paths are under `maintainpro/apps/web`.

| Need | Use |
| --- | --- |
| App shell and sidebar | `components/layout` dashboard shell |
| Mobile navigation | `components/layout/mobile-nav.tsx` |
| Breadcrumbs | `components/ui/breadcrumbs.tsx` via `PageBreadcrumbs` |
| Page title | `.page-title` in `app/globals.css` |
| Primary and quiet buttons | `.btn-primary`, `.btn-quiet` |
| Loading, empty, error | `components/ui/page-state.tsx` |
| Confirm and prompt | `components/ui/confirm-dialog.tsx`, `prompt-dialog.tsx` |
| Focus trap | `lib/use-focus-trap.ts` |
| Entity search | `components/ui/entity-picker.tsx` |
| Work order drawer | `components/work-orders/work-order-editor-modal.tsx` |
| Work order mobile cards | `components/work-orders/work-order-mobile-card-list.tsx` |
| Asset register | `components/assets/assets-management-page.tsx` |
| Inventory | `components/inventory/inventory-control-page.tsx` |
| Notifications | `app/(dashboard)/notifications/page.tsx` and `lib/notification-inbox.ts` |
| Role home cards | `lib/role-home.ts` |

Do not add a second button, modal, or empty-state system for a single screen.
