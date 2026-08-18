<#
.SYNOPSIS
  Isolated smoke test of a generated Nelna FG release package (no company deploy).

.DESCRIPTION
  Creates a temporary copy, installs locked runtime deps with uv, and proves:
  - Django imports
  - manage.py check (release_build settings)
  - migrations discoverable
  - static assets present
  - health endpoints when local infra is available (best-effort)

.PARAMETER ReleaseDir
  Path to dist/release/nelna-fg-<sha>/
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseDir
)

$ErrorActionPreference = "Stop"
$ReleaseDir = (Resolve-Path $ReleaseDir).Path
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("nelna-fg-release-smoke-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work -Force | Out-Null

try {
    Write-Host "SMOKE_WORK=$work"
    Write-Host "Copying release package to isolated workdir..."
    Copy-Item -Path (Join-Path $ReleaseDir "*") -Destination $work -Recurse -Force

    Push-Location $work
    $env:DJANGO_SETTINGS_MODULE = "config.settings.release_build"
    $env:DJANGO_SECRET_KEY = "smoke-only-not-for-production"
    # Prevent accidental use of developer .env from other locations
    Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue

    Write-Host "==> uv sync (runtime groups only)"
    uv sync --frozen --no-dev --no-group development --no-group testing --no-group security
    if ($LASTEXITCODE -ne 0) { throw "uv sync failed in smoke workdir" }

    Write-Host "==> Django import"
    uv run python -c "import django; import apps.core; import config.wsgi; print('IMPORT_OK', django.get_version())"
    if ($LASTEXITCODE -ne 0) { throw "Django import failed" }

    Write-Host "==> manage.py check"
    uv run python manage.py check
    if ($LASTEXITCODE -ne 0) { throw "manage.py check failed" }

    Write-Host "==> migrations discoverable"
    $show = uv run python manage.py showmigrations --list 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "showmigrations failed" }
    if ($show -notmatch "accounts" -or $show -notmatch "recording") {
        throw "Expected app migrations not listed by showmigrations"
    }
    Write-Host "MIGRATIONS_DISCOVERABLE=YES"

    Write-Host "==> static assets"
    if (-not (Test-Path "static\dist\css\app.css")) { throw "missing static/dist/css/app.css" }
    if (-not (Test-Path "staticfiles")) { throw "missing staticfiles/" }
    $sfCount = (Get-ChildItem "staticfiles" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($sfCount -lt 1) { throw "staticfiles/ is empty" }
    Write-Host "STATIC_OK files=$sfCount"

    Write-Host "==> WSGI application load"
    uv run python -c "from config.wsgi import application; print('WSGI_OK', type(application))"
    if ($LASTEXITCODE -ne 0) { throw "WSGI load failed" }

    # Best-effort health if Redis/Postgres available via env; otherwise skip gracefully
    Write-Host "==> health endpoint (best-effort with release_build + test client)"
    uv run python -c @"
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.release_build')
import django
django.setup()
from django.test import Client
c = Client()
live = c.get('/health/live/')
print('HEALTH_LIVE', live.status_code)
ready = c.get('/health/ready/')
print('HEALTH_READY', ready.status_code)
if live.status_code != 200:
    raise SystemExit('liveness failed')
# readiness depends on Redis/DB; accept 200 (infra up) or 503 (infra missing)
if ready.status_code not in (200, 503):
    raise SystemExit(f'unexpected readiness status {ready.status_code}')
"@
    if ($LASTEXITCODE -ne 0) { throw "health smoke failed" }

    Write-Host "SMOKE_RELEASE_PACKAGE: PASSED"
    exit 0
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if (Test-Path $work) {
        Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
    }
}
