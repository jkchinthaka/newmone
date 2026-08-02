# Production Configuration Contract

**Validator:** `scripts/lib/production-config-contract.mjs` + `npm run validate:production-configuration`
**Fixture only:** `.env.production.security-fixture.example` (never real `.env`)

## Classifications

REQUIRED_SECRET | REQUIRED_NON_SECRET | OPTIONAL_FEATURE | DERIVED_RELEASE_METADATA | DEPRECATED | DEVELOPMENT_ONLY | E2E_ONLY | FORBIDDEN_IN_PRODUCTION

## Production rules

1. No development fallback secrets.
2. No localhost public URL.
3. No weak default credential.
4. Exact 40-hex `APP_COMMIT_SHA`.
5. Valid `APP_BUILD_TIMESTAMP`.
6. Secure cookies by default (`COOKIE_SECURE=true`).
7. HTTPS mode rejects insecure cookies.
8. HTTP compatibility requires `ALLOW_INSECURE_HTTP=true` **and** `COOKIE_SECURE=false`.
9. Swagger disabled unless explicitly enabled and credential-protected.
10. Detailed readiness protected (`READINESS_API_KEY` / admin JWT).
11. E2E/mock flags forbidden (`E2E_TEST_MODE`, `RECOVERY_REHEARSAL`, `OPERATIONS_REHEARSAL`).
12. MOCK ERP forbidden unless `ALLOW_NON_INTEGRATED_PILOT=true`.
13. Real notification sending requires explicit enablement.
14. Production must not use `.env.compose-ci`.