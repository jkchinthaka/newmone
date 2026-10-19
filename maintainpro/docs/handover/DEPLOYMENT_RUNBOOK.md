# API deployment runbook (supervised service)

The API must run as a supervised process: `node dist/main.js`, never watch mode. On a fatal error it logs one line and exits with code 1 (unhandled rejection, uncaught exception, or boot failure). The supervisor must restart it.

## Build

```bash
cd maintainpro
npm ci
npm run build --workspace @maintainpro/shared-types
npm run build --workspace @maintainpro/api      # prisma generate + tsc
npm run db:migrate:deploy                        # once per release, before start
```

Stop the running API before `prisma generate` on Windows. The engine DLL is locked while the API runs.

## Option A — Windows service with NSSM

```powershell
nssm install MaintainProApi "C:\Program Files\nodejs\node.exe" "dist\main.js"
nssm set MaintainProApi AppDirectory "D:\MaintainPro\maintainpro\apps\api"
nssm set MaintainProApi AppEnvironmentExtra NODE_ENV=production PORT=3000 HOST=127.0.0.1
# Secrets: set them in the service environment or a protected env file. Never put them in the repo.
nssm set MaintainProApi AppExit Default Restart
nssm set MaintainProApi AppRestartDelay 3000
nssm set MaintainProApi AppStopMethodConsole 15000      # sends Ctrl+C -> graceful shutdown
nssm set MaintainProApi AppStdout "D:\MaintainProLogs\api.out.log"
nssm set MaintainProApi AppStderr "D:\MaintainProLogs\api.err.log"
nssm set MaintainProApi AppRotateFiles 1
nssm set MaintainProApi ObjectName ".\maintainpro-svc" "<password>"   # dedicated service account
nssm start MaintainProApi
```

The service account needs read access to the app folder and modify access to `STORAGE_LOCAL_DIR` (see `EVIDENCE_STORAGE.md`).

## Option B — PM2 (Linux or Windows)

```bash
pm2 start dist/main.js --name maintainpro-api --cwd maintainpro/apps/api \
  --max-restarts 20 --restart-delay 3000 --kill-timeout 15000 --time
pm2 save && pm2 startup
```

Do not use `--watch`.

## Health checks

| Endpoint | Use | Behaviour |
| --- | --- | --- |
| `GET /health/live` | Liveness | 200 while the process serves HTTP. |
| `GET /health/ready` | Readiness and load-balancer gate | 503 `not_ready` until the primary SQL Server query (`checkPrimary`) succeeds. Also 503 when a required dependency is down (database; object storage when required; required queues). |
| `GET /health/readiness` | Detailed operator view | Needs a readiness key or an authorised token in production. |

Nothing listens until Nest has finished booting. Before that the port refuses connections, and the BFF answers 503 with `Retry-After: 3`.

## Graceful shutdown

- `app.enableShutdownHooks()` and `prismaService.enableShutdownHooks(app)` are wired.
- SIGTERM/SIGINT close Nest, then disconnect Prisma, then exit 0.
- Give the supervisor a stop timeout of at least 15 s.

## Keep-alive behind a proxy

The API sets `server.keepAliveTimeout = 65000` and `server.headersTimeout = 66000` after `listen`. Override them with `HTTP_KEEP_ALIVE_TIMEOUT_MS` and `HTTP_HEADERS_TIMEOUT_MS`; the headers timeout is always kept above the keep-alive timeout. Any proxy in front (nginx `keepalive_timeout`, a load balancer idle timeout) must close idle upstream sockets **before** the API does, so keep its timeout below 65 s.

## BFF behaviour during a restart

- GET/HEAD/OPTIONS are retried on refused, reset or socket errors: 3 attempts in total, 250 ms then 750 ms apart.
- A mutation is retried only on connection refused, and only when it carries an `Idempotency-Key`.
- Timeouts are never retried (504).
- On final failure the BFF returns 503 with `Retry-After: 3` and the message "Server is restarting or unreachable. Your change was not saved — please try again."

## Upload size limits

- The Next.js route handler reads the full request body with no limit of its own, so local and self-hosted deployments accept evidence uploads up to `STORAGE_MAX_FILE_SIZE_MB`. The API (multer) enforces that limit and returns 413.
- nginx: `client_max_body_size` must be at least `STORAGE_MAX_FILE_SIZE_MB`.
- **Vercel serverless functions reject request bodies above about 4.5 MB.** Vercel is a retired target. If it is ever used again, larger evidence uploads will fail there before they reach the API.
