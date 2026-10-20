# Go-Live Runbook — MaintainPro 2026-10-21

**Target go-live date:** 2026-10-21  
**Code freeze:** 2026-10-20 18:00  
**Branch:** `release/maintainpro-final-consolidation-20261013` (tagged `go-live-20261021`)  
**Worktree:** `C:\Users\chint\AppData\Local\MaintainPro\worktrees\golive-ops` (this worktree)  
**Production database:** `MaintainProProd` on `localhost:1433` (Windows integrated auth)

---

## 1. Server Prerequisites

| Component | Requirement | Verification |
|-----------|-------------|--------------|
| **OS** | Windows Server 2019/2022 (or Windows 10/11 Pro for workstation) | `systeminfo` |
| **Node.js** | 20.x LTS (exact: `v20.18.0` or later 20.x) | `node --version` |
| **npm** | 10.x (bundled with Node 20) | `npm --version` |
| **SQL Server** | 2019/2022 **Express** (or Standard), localhost:1433, mixed mode **disabled** (Windows auth only). **Express limit: 10 GB per database** — monitor `MaintainProProd` size. | `sqlcmd -E -C -Q "SELECT @@VERSION"` |
| **Process supervisor** | **NSSM** (Windows service) **or** PM2 (if Linux) | `nssm status MaintainProApi` / `pm2 list` |
| **Disk** | ≥ 20 GB free for app + logs + evidence + backups | `dir C:\` |
| **Evidence folder** | `C:\MaintainProData\evidence-prod` (NTFS, service account Modify) | `icacls C:\MaintainProData\evidence-prod` |
| **Backup folder** | `C:\MaintainProData\backups` (NTFS, service account Modify) | `icacls C:\MaintainProData\backups` |
| **Log folder** | `D:\MaintainProLogs\` (service account Modify) | `icacls D:\MaintainProLogs` |
| **Service account** | `.\maintainpro-svc` (local, non-admin, logon as service) | `lusrmgr.msc` |
| **Firewall** | Inbound 3000 (API), 3001 (Web) from load balancer / reverse proxy only | `netsh advfirewall firewall show rule name=all` |

> **Never use `sa` or SQL authentication.** Production uses Windows integrated auth only.
>
> **STORAGE_MODE=local blocker:** `env.validation.ts` blocks `STORAGE_MODE=local` with `STORAGE_UPLOADS_ENABLED=true` in production (line 255-258). Production must use `minio`, `s3`, `r2`, or `azure_blob`. If local storage is required, this validation must be changed by Cursor before go-live. Flow 4 (photo upload) tests real local storage in QA; production will need object storage.

---

## 2. Deploy the Build

```powershell
# On the production server, from the release checkout
cd C:\MaintainPro\maintainpro

# 1. Install from the lockfile
npm ci

# 2. Generate the Prisma client
npx prisma generate --schema ./prisma/schema.prisma

# 3. The three phase15 patch scripts (same three as npm run db:generate)
node ./scripts/phase15-patch-prisma-enums.mjs
node ./scripts/phase15-patch-prisma-types.mjs
node ./scripts/phase15-loosen-types.mjs

# 4. Build
npm run build

# 5. Start the web app with next start. Never next dev and never npm run dev.
cd apps/web
npx next start -p 3001
```

**Output artifacts:**
- `apps/api/dist/` — compiled NestJS API
- `apps/web/.next/` — compiled Next.js web

---

## 3. Prisma Migrate Deploy

```powershell
# Stop API service first (prisma generate locks the query engine DLL on Windows)
nssm stop MaintainProApi  # or: pm2 stop maintainpro-api

# Run migrations against production DB
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro
$env:DATABASE_URL = "sqlserver://localhost:1433;database=MaintainProProd;integratedSecurity=true;trustServerCertificate=true;encrypt=true"
npx prisma migrate deploy --schema=prisma/schema.prisma

# Verify migration status
npx prisma migrate status --schema=prisma/schema.prisma
# Expected: "Database schema is up to date with 0 drift."
```

> **Rollback note:** If migration fails, restore the pre-migration DB backup (see §9) and investigate. Do not `prisma migrate reset` in production.

> **SQL Server Express:** All `sqlcmd` commands below use `-C` to trust the self-signed certificate.

---

## 4. Minimal Seed (No Demo Data)

```powershell
# Seed only: tenant, RBAC catalog, SUPER_ADMIN, ADMIN, default tax 18%, maintenance configs
# Does NOT create demo work orders, assets, extra users, or audit rows.
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro

# Password must be set in a gitignored file BEFORE running seed
# Create C:\MaintainProData\.seed-password.local with one line: the strong password (≥12 chars)
$env:MAINTAINPRO_SEED_PASSWORD = Get-Content C:\MaintainProData\.seed-password.local -Raw
$env:DATABASE_URL = "sqlserver://localhost:1433;database=MaintainProProd;integratedSecurity=true;trustServerCertificate=true;encrypt=true"
$env:NODE_ENV = "production"
$env:SEED_DEMO = "false"  # Critical: gates demo data off

npx ts-node --transpile-only apps/api/src/database/seed.ts

# Verify seed baseline
# Should output: "Seed complete" and verification passes
```

**What the minimal seed creates:**
- Tenant: "Nelna Group" (slug: `default`)
- `TenantMaintenanceSetting`: `defaultTaxRatePercent = 18`
- All permissions from `permission-catalog.ts`
- All roles from `RoleName` enum with permission mappings
- One `SUPER_ADMIN` user: `superadmin@maintainpro.local`
- One `ADMIN` user: `admin@maintainpro.local`
- Default maintenance job categories, SLA rules, reason codes, fault codes
- Asset taxonomy defaults (domains, categories, types)
- Tenant feature flags

**What it does NOT create (SEED_DEMO=false):**
- Demo work orders, assets, vehicles, spare parts
- Demo users (supervisor, cleaner, security, tech, mechanic, inventory, drivers)
- Cleaning locations, meter readings, utility bills
- Workforce employees

---

## 5. First SUPER_ADMIN Login & Password Rotation

1. Open `https://app.maintainpro.local/login` (or `http://localhost:3001` if direct)
2. Sign in as `superadmin@maintainpro.local` with the password from `.seed-password.local`
3. Immediately: **Profile → Change Password** to a strong unique password
4. Store the new password in a password manager; delete `.seed-password.local`

---

## 6. Start Services

### Option A — NSSM (Windows Service)

```powershell
# API service (already installed per DEPLOYMENT_RUNBOOK.md)
nssm start MaintainProApi

# Verify API health
curl -f http://127.0.0.1:3000/health/live
curl -f http://127.0.0.1:3000/health/ready

# Web service (install if not present)
nssm install MaintainProWeb "C:\Program Files\nodejs\node.exe" "node_modules/.bin/next" "start"
nssm set MaintainProWeb AppDirectory "C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro\apps\web"
nssm set MaintainProWeb AppEnvironmentExtra "NODE_ENV=production PORT=3001 HOST=127.0.0.1 API_INTERNAL_URL=http://127.0.0.1:3000/api FRONTEND_URL=https://app.maintainpro.local COOKIE_SECURE=true ALLOW_INSECURE_HTTP=false NEXT_DIST_DIR=.next"
nssm set MaintainProWeb AppExit Default Restart
nssm set MaintainProWeb AppRestartDelay 3000
nssm set MaintainProWeb AppStopMethodConsole 15000
nssm set MaintainProWeb AppStdout "D:\MaintainProLogs\web.out.log"
nssm set MaintainProWeb AppStderr "D:\MaintainProLogs\web.err.log"
nssm set MaintainProWeb AppRotateFiles 1
nssm set MaintainProWeb ObjectName ".\maintainpro-svc" "<password>"
nssm start MaintainProWeb
```

### Option B — PM2 (if Linux)

```bash
pm2 start dist/main.js --name maintainpro-api --cwd maintainpro/apps/api --max-restarts 20 --restart-delay 3000 --kill-timeout 15000 --time
cd apps/web && NODE_ENV=production PORT=3001 pm2 start node_modules/.bin/next --name maintainpro-web -- start
pm2 save && pm2 startup
```

---

## 7. Smoke Checks

Run **after both services report healthy** (production ports 3000/3001):

| Check | Command / Action | Expected |
|-------|------------------|----------|
| API liveness | `curl -f http://127.0.0.1:3000/health/live` | HTTP 200 |
| API readiness | `curl -f http://127.0.0.1:3000/health/ready` | HTTP 200, `{"status":"ok","checks":{"database":"ok"}}` |
| Web loads | Open `https://app.maintainpro.local` in browser | Login page renders, no console errors |
| SUPER_ADMIN login | Sign in as `superadmin@maintainpro.local` | Redirects to dashboard, cookies set |
| Create one WO | As SUPER_ADMIN: create a CORRECTIVE WO with title "Go-live smoke test" | WO created, appears in list, woNumber assigned |
| Evidence upload | Attach a small test image to the WO | Upload succeeds, file in `C:\MaintainProData\evidence-prod\...` (or MinIO/S3 bucket) |
| Audit log | Check `AuditLog` table for the WO create row | 1 row with `entity="WorkOrder"`, `action="CREATE"` |

**Automated smoke script:**
```powershell
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro
.\scripts\ops\health-check.ps1 -ApiBase http://127.0.0.1:3000 -WebBase http://127.0.0.1:3001
# Should print: OK — all checks passed
```

---

## 8. Post-Go-Live Verification (First 2 Hours)

| Time | Action | Owner |
|------|--------|-------|
| T+0 | Smoke checks (§7) | DevOps |
| T+15m | Invite ADMIN, MANAGER, TECHNICIAN users via Admin Console | Admin |
| T+30m | Each role creates one WO / part request / meter reading per UAT checklist | Role users |
| T+60m | Verify evidence uploads land in `evidence-prod` with correct tenant folder | DevOps |
| T+90m | Check audit log for all actions — no missing rows | Security |
| T+120m | Confirm no error spikes in API logs (`D:\MaintainProLogs\api.err.log`) | DevOps |

---

## 9. Rollback Procedure

**Trigger:** Critical regression blocking all users (data corruption, auth failure, migration failure).

### 9.1 Rollback API + Web (Code)

```powershell
# 1. Stop services
nssm stop MaintainProApi
nssm stop MaintainProWeb

# 2. Restore previous build artifacts (keep last 2 builds in C:\MaintainProBuilds\)
#    Previous build tag: go-live-20261021-prev
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro
git fetch origin
git checkout go-live-20261021-prev -- apps/api/dist apps/web/.next
# Or copy from C:\MaintainProBuilds\go-live-20261021-prev\

# 3. Restart services
nssm start MaintainProApi
nssm start MaintainProWeb

# 4. Verify smoke checks (§7)
```

### 9.2 Rollback Database (If Migration Applied)

```powershell
# ONLY if prisma migrate deploy ran and caused corruption
# 1. Stop API
nssm stop MaintainProApi

# 2. Restore latest clean backup
#    Backup naming: MaintainProProd_YYYYMMDD_HHMMSS.bak
$latestBackup = Get-ChildItem C:\MaintainProData\backups\MaintainProProd_*.bak | Sort-Object LastWriteTime -Descending | Select-Object -First 1
sqlcmd -E -C -Q "ALTER DATABASE MaintainProProd SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
sqlcmd -E -C -Q "RESTORE DATABASE MaintainProProd FROM DISK='$($latestBackup.FullName)' WITH REPLACE, RECOVERY"

# 3. Verify schema version matches previous build
#    (Run prisma migrate status — should show applied migrations matching previous tag)

# 4. Start API
nssm start MaintainProApi
```

### 9.3 Post-Rollback

- Document incident in `docs/handover/INCIDENT_YYYYMMDD.md`
- Root cause analysis within 24h
- Re-apply fix on feature branch → qa-reviewer PASS → new release tag

---

## 11. Backup Scheduling (Windows Task Scheduler — No SQL Agent on Express)

Use section 14. Express has no SQL Agent, the per-database limit is 10 GB, and the task runs `scripts/ops/backup-maintainpro.ps1` with `sqlcmd -E -C` (Windows auth).

---

## 12. IIS ARR reverse proxy (X-Real-IP)

Copy of the IIS block in `DEPLOYMENT_RUNBOOK.md`. The proxy in front of Next.js must set `X-Real-IP` to the TCP client (`{REMOTE_ADDR}`), one address, not `{HTTP_X_FORWARDED_FOR}`. ARR "Enable X-Forwarded-For" does not count: the BFF does not read that header. The API trusts `X-Real-IP` only from a private hop (`127.0.0.1`, `::1`, or RFC1918).

Allow the server variable once in `applicationHost.config`:

```xml
<system.webServer>
  <rewrite>
    <allowedServerVariables>
      <add name="HTTP_X_REAL_IP" />
    </allowedServerVariables>
  </rewrite>
</system.webServer>
```

Site `web.config` (rewrite to the Next.js site, not the API):

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

ARR proxy enabled: `appcmd set config -section:system.webServer/proxy /enabled:true`. Leave ARR X-Forwarded-For off.

## 13. Post-deploy login burst

After the proxy above is in place, sign in 8 times within 60 seconds from distinct client addresses. Expect **0 × 429**. Login/refresh stays capped at 5 requests per minute per `X-Real-IP`. Eight attempts that all arrive as `127.0.0.1` will share one bucket and will 429; that means the proxy is not setting `X-Real-IP`.

## 14. SQL Server Express backups

Express limit: **10 GB per database**. Express has **no SQL Agent**. Windows auth only (`sqlcmd -E`). Trust the server certificate with `-C`. Do not use `sa`.

```powershell
schtasks /Create /TN "MaintainPro Nightly Backup" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\MaintainPro\maintainpro\scripts\ops\backup-maintainpro.ps1 -DatabaseName MaintainProProd -BackupRoot C:\MaintainProData\backups -EvidenceSource C:\MaintainProData\evidence-prod -RetentionDays 14" /SC DAILY /ST 02:00 /RU "maintainpro-svc" /F /RL HIGHEST
schtasks /Query /TN "MaintainPro Nightly Backup" /V /FO LIST
sqlcmd -E -C -d MaintainProProd -Q "SELECT SUM(size)*8.0/1024 AS size_mb FROM sys.database_files WHERE type=0"
```

Alert as `size_mb` approaches 10240. Do not write this job at `MaintainProDev` or `nelna`.

## 15. Production .env integration modes

`apps/api/src/config/env.validation.ts`. Production rejects `mock` unless `ALLOW_MOCK_IN_PRODUCTION=true`. `live` requires the listed keys. `ERP_MODE=sandbox` requires `ERP_BASE_URL` and `ERP_API_KEY`.

| Variable | Allowed | Default | Extra when live |
| --- | --- | --- | --- |
| ERP_MODE | disabled, mock, sandbox, live | mock | ERP_API_URL, ERP_API_KEY |
| SMS_MODE | disabled, mock, live | disabled | SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID |
| PUSH_MODE | disabled, mock, live | disabled | PUSH_PROVIDER_API_URL, PUSH_PROVIDER_API_KEY |

## 10. Contacts & Escalation

| Role | Name | Contact |
|------|------|---------|
| Release Engineer | (this agent) | — |
| DBA / SQL Server | — | — |
| Security Officer | — | — |
| Product Owner | — | — |

---

## Appendix: Key File Locations (Production)

| Artifact | Path |
|----------|------|
| API dist | `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro\apps\api\dist` |
| Web dist | `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro\apps\web\.next` |
| Evidence | `C:\MaintainProData\evidence-prod` |
| Backups | `C:\MaintainProData\backups` |
| Logs | `D:\MaintainProLogs` |
| Seed password (gitignored) | `C:\MaintainProData\.seed-password.local` |
| .env.production (gitignored) | `C:\MaintainProData\.env.production` |

---

**Sign-off:** All smoke checks pass → Go-live confirmed → Notify stakeholders.