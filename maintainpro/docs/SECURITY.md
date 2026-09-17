# Security

## Authentication

- JWT access + refresh with revocation/logout
- Password hashing via existing auth service
- Rate limiting (`ThrottlerModule` / `HttpThrottlerGuard`)
- Google OAuth (optional)
- FG SSO exchange (optional)
- **Microsoft Entra adapter** (`entra-sso.adapter.ts`) — SSO-ready; production tenant IDs/secrets are external

## Authorization

- Global guards: JWT → Tenant → Roles → Permissions
- Vendor portal scoped by `VendorPortalAccess`
- SoD evaluator (`EnterpriseGovernanceService.assertSoD`)

## Upload / input

- Evidence MIME/size checks
- DTO validation (class-validator)
- Mass-assignment avoided via explicit Prisma `data` objects
- CORS from `CORS_ORIGIN`

## Audit

- `AuditLog` + `ConfigChangeHistory` append-only
- Ordinary admins cannot rewrite audit rows through API

## External

| Item | Status |
|------|--------|
| Entra production tenant | EXTERNAL_DEPENDENCY |
| SMTP/SMS credentials | EXTERNAL_DEPENDENCY |
| Live Bileeta credentials | EXTERNAL_DEPENDENCY |
