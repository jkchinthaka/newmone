# Production Domain Cutover — maintenance.nelna.lk

**Status:** Prepared — **not cut over** until operator explicitly executes DNS and env updates.

---

## Target topology

| Component | Staging (current) | Production (planned) |
|-----------|-------------------|----------------------|
| Web | `newmone.chinthakajayaweera1.workers.dev` | `https://maintenance.nelna.lk` |
| API | `newmone.onrender.com` | Dedicated Render service or custom domain `api.maintenance.nelna.lk` |
| Database | Atlas `maintainpro_staging` | Isolated Atlas `maintainpro_production` |

---

## DNS checklist

| Record | Type | Target | Notes |
|--------|------|--------|-------|
| `maintenance.nelna.lk` | CNAME or A/AAAA | Cloudflare Workers route / proxy | Enable Cloudflare proxy (orange cloud) for WAF + CDN |
| `api.maintenance.nelna.lk` (optional) | CNAME | Render custom domain | If API on subdomain |
| `_acme-challenge.*` | TXT | Auto (Cloudflare/Render) | TLS certificate validation |

**Pre-cutover:** Lower TTL on existing records to 300s 24h before change.

---

## SSL / TLS

| Layer | Requirement |
|-------|-------------|
| Cloudflare | Full (strict) mode; valid origin cert on Workers |
| Render API | Auto TLS on custom domain |
| HSTS | Enabled via `next.config.mjs` on web (`Strict-Transport-Security`) |
| Min TLS | 1.2+ |

Verify after DNS: `curl -I https://maintenance.nelna.lk` shows HSTS + CSP headers.

---

## Application configuration

### Render API

```env
CORS_ORIGIN=https://maintenance.nelna.lk
FRONTEND_URL=https://maintenance.nelna.lk
# If cookie domain scoping added later:
# COOKIE_DOMAIN=.nelna.lk
```

### Cloudflare Workers (web)

```env
NEXT_PUBLIC_API_URL=https://newmone.onrender.com/api
# Update to prod API URL when API domain is finalized:
# NEXT_PUBLIC_API_URL=https://api.maintenance.nelna.lk/api
NEXT_PUBLIC_API_ORIGIN=https://newmone.onrender.com
```

### Secure cookies (refresh token)

- Refresh JWT already HttpOnly cookie path
- Ensure `Secure` flag in production (`NODE_ENV=production`)
- SameSite=Lax or Strict per auth module config
- Cross-subdomain cookies require explicit `Domain` — test refresh flow after DNS cutover

---

## CORS verification

```bash
curl -X OPTIONS "https://<api-host>/api/auth/login" \
  -H "Origin: https://maintenance.nelna.lk" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

Expect: `Access-Control-Allow-Origin: https://maintenance.nelna.lk` and credentials allowed.

---

## Cloudflare checklist

- [ ] Workers project bound to `maintenance.nelna.lk` route
- [ ] `wrangler deploy` from approved commit
- [ ] Environment variables set in Cloudflare dashboard (no secrets in repo)
- [ ] WAF rules reviewed (rate limit login if available)
- [ ] Previous staging URL remains reachable until cutover validated

---

## Render checklist

- [ ] Production Web Service (or separate service) with prod env group
- [ ] `render.yaml` or dashboard env synced
- [ ] Health check path: `/health`
- [ ] Auto-deploy from `main` disabled until cutover window (optional)
- [ ] `READINESS_API_KEY` set for ops monitoring

---

## Rollback (DNS)

1. Revert DNS to staging Workers URL or maintenance page placeholder
2. Restore `CORS_ORIGIN` / `FRONTEND_URL` on API to last known good
3. Redeploy previous web/API builds
4. Communicate rollback to users

Document rollback decision in change ticket with timestamp.

---

## Cutover sequence (operator-owned)

1. Maintenance window announced
2. Prod DB schema push + backup verified
3. Render prod env applied; API deploy
4. Cloudflare web deploy with prod API URL
5. DNS switched to production targets
6. Smoke + `npm run uat:005:validate` against production URLs
7. Product owner sign-off

**Do not execute DNS cutover from CI without explicit operator approval.**

---

## Related

- [PRODUCTION_CUTOVER_RUNBOOK.md](PRODUCTION_CUTOVER_RUNBOOK.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
