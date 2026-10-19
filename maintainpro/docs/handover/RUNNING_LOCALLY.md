# Running MaintainPro locally

## Two modes

| Mode | Command (from `maintainpro/`) | Use for |
| --- | --- | --- |
| Watch | `npm run dev:api` / `npm run dev` | Active coding only |
| QA | `npm run start:qa` (API) plus a production web build | QA, UAT, demos, Playwright, soak tests |

**QA and UAT must use `start:qa`.** It builds the API once (`prisma generate` + `tsc`) and runs `node dist/main.js` with no file watcher.

## Why watch mode is not for QA

The API dev script is `node --watch --watch-path=src -r ts-node/register/transpile-only src/main.ts`. Each restart boots about 73 Nest modules through ts-node. While it boots, the web BFF gets `ECONNREFUSED`, and users see a burst of failures.

Watch mode restarts on more than edits. Verified on this machine on 2026-10-15 (Windows, NTFS last-access updates enabled, `fsutil behavior query disablelastaccess` = 2):

- **Reading** a file under `apps/api/src` whose last-access time is more than an hour old restarts the API. Node's watcher on Windows also reports last-access changes.
- Anything can trigger it: a `grep`, an IDE indexer, an antivirus scan, `git` hashing, or an AI agent reading code.
- A second read within the hour does not trigger it.

Measured restart window from `dist` with the same database: about 4 s of `ECONNREFUSED`. ts-node boots take longer.

## QA stack on free ports (example used for the 2026-10-15 fix round)

API:

```bash
# env comes from a scratch file you keep outside the repo (never commit it)
cd maintainpro/apps/api
npx tsc -p tsconfig.build.json   # or: npm run build (needs prisma generate; see note)
PORT=3110 HOST=127.0.0.1 node dist/main.js
```

Web (production build, isolated dist dir):

```bash
cd maintainpro/apps/web
NEXT_PUBLIC_API_URL=/api/backend NEXT_PUBLIC_USE_BFF=true NEXT_DIST_DIR=.next-qa npx next build
NODE_ENV=production API_INTERNAL_URL=http://127.0.0.1:3110/api \
  ALLOW_INSECURE_HTTP=true COOKIE_SECURE=false FRONTEND_URL=http://127.0.0.1:3111 \
  NEXT_DIST_DIR=.next-qa npx next start -p 3111 -H 127.0.0.1
```

`ALLOW_INSECURE_HTTP=true` with `COOKIE_SECURE=false` is the approved plain-HTTP workstation mode. Never use it on a server.

## Notes

- **`prisma generate` and a running API.** On Windows, a running API (watch or QA) locks `node_modules/.prisma/client/query_engine-windows.dll.node`, and `prisma generate` then fails halfway. If that happens, re-run the three patch scripts and confirm typecheck exits 0:

  ```bash
  node scripts/phase15-patch-prisma-enums.mjs
  node scripts/phase15-patch-prisma-types.mjs
  node scripts/phase15-loosen-types.mjs
  npm run typecheck
  ```

  Stop the API before regenerating the client.
- **Isolated Next dist dirs.** Any `NEXT_DIST_DIR` other than `.next` makes Next use the gitignored `apps/web/tsconfig.isolated.json`, so the tracked `tsconfig.json` never gains `.next-*` entries. `.next-*/` is gitignored. Delete your own dist folders when you are done.
- **Evidence storage (local disk).** For your own API only, set `STORAGE_MODE=local`, `STORAGE_UPLOADS_ENABLED=true` and `STORAGE_LOCAL_DIR` to an absolute folder outside the repo (for example `C:\MaintainProData\evidence-dev`). See `EVIDENCE_STORAGE.md`.
