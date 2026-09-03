# Mobile Parity Matrix (V1 closure)

Web/Nest capability vs Mobile V2. Status: **DONE** | **PARTIAL** | **BLOCKED** | **NOT_SUPPORTED**

| Domain | Web/Nest | Mobile V2 | Status | Notes |
|--------|----------|-----------|--------|-------|
| Auth / JWT | Yes | Yes | DONE | Same Nest users |
| Home / Tasks | Yes | Yes | DONE | |
| Work Orders | Yes | Yes | DONE | Offline note draft partial |
| Gate | Yes | Yes | DONE | |
| Fleet vehicles | Yes | Yes | DONE | Assign + unassign |
| Fleet live map | Yes | Stub | NOT_SUPPORTED | No real GPS feed |
| Assets / PM | Yes | Yes | DONE | Read + PM |
| Inventory | Yes | Read | PARTIAL | Mutations blocked server safety |
| Facilities | Yes | Read + issue | PARTIAL | Cleaning/meter write blocked |
| Compliance | Yes | Read + accident | PARTIAL | |
| Notifications | Yes | List + FCM register | PARTIAL | Live delivery needs Firebase |
| Camera scan | Yes | Yes | PARTIAL | Real device UAT pending |
| FG CL18/24/30/39 | Yes | Yes | DONE | Live UAT blocked config |
| Admin users | Yes | List/create/edit/status | PARTIAL | No account lock API |
| Admin people | Yes | List/detail/status | PARTIAL | Role assign via users API |
| Admin roles | Yes | Read-only | PARTIAL | Mutations Web-first |
| Admin tenants | Yes | List | PARTIAL | No member roster API |
| Admin invitations | Yes | List/create | PARTIAL | Resend/revoke API_GAP |
| Admin audit | Yes | Yes | DONE | Read-only |
| Reports dashboard | Yes | Yes | DONE | Date filters |
| Reports modules | Yes | Yes | DONE | Filters + export |
| Reports maintenance detail | Yes | Cards only | PARTIAL | Detail/export Web-first |
| Farm fields–traceability | Yes | Read lists | PARTIAL | Mutations Web-first |
| Farm spray/soil/weather/finance | Yes | — | NOT_SUPPORTED | V1 read scope cut |
| Draft / Sync | Yes | Partial | PARTIAL | Outbox enqueue not fully wired |
| Android release ID | — | `com.maintainpro.mobile` | DONE | Debug signing remains |

Last updated: 2026-09-01
