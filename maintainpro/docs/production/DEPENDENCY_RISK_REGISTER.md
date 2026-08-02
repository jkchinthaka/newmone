# Dependency Risk Register — Phase 7B (read-only assessment)

**Status:** `DEPENDENCY_SECURITY_REVIEW_REQUIRED`  
**Assessment date:** 2026-08-02  
**Method:** `npm audit` (read-only) — no `npm audit fix --force`, no broad upgrades  
**CI-reported totals:** 68 (8 low / 35 moderate / 21 high / 4 critical)  
**Node note:** Cloudflare tooling wants Node >=22; MaintainPro CI/app build historically uses Node 20. Engine mismatch is a build-tooling concern for Cloudflare Workers paths, not proof of Nelna Compose runtime compromise.

**Nelna runtime context (for exploitability notes):** Docker Compose stack (API NestJS, Web Next.js behind Nginx HTTP edge). Cloudflare Workers / Wrangler / Miniflare paths are primarily alternate deploy targets and may be **not production-reachable on Nelna** unless that path is enabled.

Owner default until assigned: **Security + Tech Lead**  
Due date default: **before GO_FOR_CUTOVER**

## High / critical findings (summary disposition)

| Package | Sev | Direct? | Runtime component | Nelna exploitability (initial) | Decision | Mitigation | Owner | Due |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| concurrently / shell-quote | critical | concurrently direct (dev orchestration) | local/CI scripts | Low on Nelna containers if not shipped in runtime image | deferred — confirm not in prod image | Keep out of runtime images; upgrade in controlled change | Sec+TL | pre-cutover |
| fast-xml-parser | critical | transitive (AWS SDK clients) | possible API/cloud tooling | Medium if AWS SDK XML parsing is exercised with untrusted XML | review_required | Confirm usage; pin/upgrade SDK path in controlled PR | Sec+TL | pre-cutover |
| websocket-driver | critical | transitive | likely Firebase/legacy websocket stack | Confirm whether package is present in API/Web runtime | review_required | Inventory image contents; remove unused | Sec+TL | pre-cutover |
| next | high | direct | Web (Next.js) | Medium — Internet-facing via Nginx | review_required | Targeted Next patch after regression suite | Web+Sec | pre-cutover |
| axios | high | direct | Web/API clients | Medium | review_required | Patch within minor line after tests | App+Sec | pre-cutover |
| multer / @nestjs/platform-express | high | direct | API uploads / Express adapter | Medium if upload endpoints exposed | review_required | Patch Nest/multer with upload regression tests | API+Sec | pre-cutover |
| nodemailer | high | direct | API mail | Low–Medium if SMTP enabled on Nelna | review_required | Patch when mail enabled; keep disabled if unused | API+Sec | pre-cutover |
| xlsx | high | direct | report export | Medium if untrusted spreadsheets parsed | deferred / accept-with-mitigation pending owner | Restrict upload sources; prefer alternate lib when available (no fixAvailable in audit) | App+Sec | pre-cutover |
| postcss | high | direct (via Next toolchain) | build / Next | Mainly build-time / XSS via CSS stringify | deferred for build chain | Follow Next upgrade path | Web | with Next |
| engine.io / ws | high | transitive | Socket.IO path | Medium if websockets exposed publicly | review_required | Confirm Nginx WS config; patch socket stack | API+Sec | pre-cutover |
| brace-expansion / js-yaml / lodash / form-data / protobufjs / tmp / @grpc/grpc-js | high | mostly transitive | mixed | Varies — often transitive tooling | deferred pending reachability map | Prefer lockfile-targeted updates; no force | Sec | pre-cutover |
| @opennextjs/cloudflare / miniflare / sharp / undici / wrangler chain | high | Cloudflare path | Cloudflare Workers tooling | **Likely not Nelna Compose reachable** if Workers deploy unused | deferred (alt-target) | Track separately if Cloudflare prod path enabled; Node 22 engine follow-up | Platform | if CF path used |

## Explicit non-actions for Phase 7B

- Did **not** run `npm audit fix --force`
- Did **not** introduce broad dependency upgrades
- Did **not** change production lockfiles in this pack
- Did **not** expose tokens, credentials, or private registry details

## Gate rule

Until every **high/critical production-reachable** finding has an approved disposition (`accepted` with expiry, `deferred` with date, or `fix_required` completed), status remains:

**DEPENDENCY_SECURITY_REVIEW_REQUIRED**

This register alone does **not** authorize cutover.