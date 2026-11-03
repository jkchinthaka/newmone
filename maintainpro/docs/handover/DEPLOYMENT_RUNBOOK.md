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

## Client IP for BFF throttling (X-Real-IP)

The API keys login/refresh at 5 requests per minute and other routes at 100 per minute with `resolveTrustedClientIp`. The Next.js BFF forwards `X-Real-IP` only when the incoming request already has a single valid value. It does not read `X-Forwarded-For`.

Without a reverse proxy, every browser is seen as the BFF's loopback peer and shares the `127.0.0.1` bucket. The proxy in front of the web process must set `X-Real-IP` to that connection's client address, one IP, with no comma-separated list.

Do not point `X-Real-IP` at `{HTTP_X_FORWARDED_FOR}` or `$proxy_add_x_forwarded_for`. Those values can be client-supplied. ARR's "Enable X-Forwarded-For" does not satisfy this, because the BFF ignores that header.

The API honors `X-Real-IP` only when the TCP peer is a private hop (`127.0.0.1`, `::1`, or RFC1918). The Next.js process on the same host meets that condition.

### nginx

This is the web-facing server block from `maintainpro/infra/nginx/default.conf`. Both the BFF location and the page location set `X-Real-IP` to `$remote_addr`.

```nginx
upstream maintainpro_web {
  server web:3001;
}

upstream maintainpro_api {
  server api:3000;
}

map $http_x_request_id $maintainpro_request_id {
  ""      $request_id;
  default $http_x_request_id;
}

server {
  listen 80;
  server_name _;

  location ^~ /api/backend/ {
    proxy_pass http://maintainpro_web;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $maintainpro_request_id;
    proxy_buffer_size 32k;
    proxy_buffers 8 32k;
    proxy_busy_buffers_size 64k;
  }

  location / {
    proxy_pass http://maintainpro_web;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $maintainpro_request_id;
  }
}
```

`$remote_addr` is the address nginx accepted. `web:3001` is the Docker network name. The local Windows services listen on `127.0.0.1:3040` (API) and `127.0.0.1:3041` (web), which is the address the IIS rewrite below already uses.

### IIS ARR and URL Rewrite

Allow the server variable once, at the server level. URL Rewrite rejects `HTTP_X_REAL_IP` until it is listed. In `applicationHost.config` (IIS Manager: server node → URL Rewrite → View Server Variables → Add):

```xml
<system.webServer>
  <rewrite>
    <allowedServerVariables>
      <add name="HTTP_X_REAL_IP" />
    </allowedServerVariables>
  </rewrite>
</system.webServer>
```

Site `web.config`. `{REMOTE_ADDR}` is the TCP client of the IIS connection. `HTTP_X_REAL_IP` is sent to Next.js as the `X-Real-IP` header. The rewrite target is the Next.js site, not the API, because the browser talks to the BFF.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="MaintainPro client IP" stopProcessing="true">
          <match url="(.*)" />
          <serverVariables>
            <set name="HTTP_X_REAL_IP" value="{REMOTE_ADDR}" />
          </serverVariables>
          <action type="Rewrite" url="http://127.0.0.1:3041/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

ARR must be installed and the proxy enabled (`appcmd set config -section:system.webServer/proxy /enabled:true`). Leave ARR's X-Forwarded-For option off for throttle identity; this rule is the header the BFF forwards.
