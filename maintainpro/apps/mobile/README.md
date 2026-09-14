# MaintainPro Mobile (Flutter)

> **Production status (Phase 2):** Flutter is **NOT** the production client.
> MaintainPro ships as a **single responsive Next.js web application + PWA**.
> This folder is retained temporarily as a **deprecated / knowledge archive** until
> equivalent web capability fully covers field workflows.

## Do not treat as production

- Do not deploy this app as the primary technician/requester client.
- Do not expand Flutter feature scope for V1.
- Prefer investing in `apps/web` responsive + PWA work.

## Reusable concepts (migrate / already mirrored on web)

| Concept | Flutter location (examples) | Web / PWA status |
|---------|----------------------------|------------------|
| Live QR scan | `lib/features/operations/...`, cleaning scan | Shared `components/qr/qr-scanner.tsx` (Phase 2) |
| Offline queue | `lib/core/offline/` (Hive) | `lib/offline-queue.ts` + WO evidence offline drafts |
| Connectivity banner | `offline_banner.dart` | `NetworkStatusBanner` |
| Evidence / photos | image_picker flows | `EvidencePicker` + WO evidence panel |
| Asset / ops lookup | operations screens | Existing Assets / WO web routes |

## Migrated in Phase 2 (web)

- Network online/offline awareness
- Offline action queue foundation + idempotency helpers
- Web QR scanner with camera release + manual fallback
- Mobile-friendly evidence picker (preview / remove)
- Responsive shell + bottom nav (Phase 1 CMMS scope)

## Deferred migration

- Full technician offline WO lifecycle (needs Phase 6+)
- Domain engines for Requests / Assets / Approvals (Phases 3–7)
- Any remaining Hive-specific sync kinds not yet modeled in web queue

## Final removal

Delete or archive this package only after product owners confirm web/PWA parity for
QR, evidence, and critical field actions — tracked after Phase 7+ integration.

## Local run (reference only)

1. `flutter doctor`
2. `flutter pub get`
3. `flutter run`
