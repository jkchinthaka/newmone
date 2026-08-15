<#
.SYNOPSIS
  Build a minimal production-only release package for Nelna FG Digital Recording System.

.DESCRIPTION
  Produces:
    dist/release/nelna-fg-<GIT_SHA>/
    dist/release/nelna-fg-<GIT_SHA>.zip
    dist/release/RELEASE_MANIFEST.txt
    dist/release/SHA256SUMS.txt

  Never packages secrets (.env, keys, credentials).
  Does not deploy to any server.

.PARAMETER SkipZip
  Skip ZIP creation.

.PARAMETER SkipSmoke
  Skip isolated package smoke test after build.
#>
[CmdletBinding()]
param(
    [switch]$SkipZip,
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found on PATH: $Name"
    }
}

Assert-Command "git"
Assert-Command "uv"
Assert-Command "npm"

$branch = (git branch --show-current).Trim()
$sha = (git rev-parse HEAD).Trim()
$shortSha = (git rev-parse --short=12 HEAD).Trim()
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "REPO=$RepoRoot"
Write-Host "BRANCH=$branch"
Write-Host "SHA=$sha"

$distRoot = Join-Path $RepoRoot "dist\release"
$releaseName = "nelna-fg-$sha"
$releaseDir = Join-Path $distRoot $releaseName
$zipPath = Join-Path $distRoot "$releaseName.zip"

if (Test-Path $releaseDir) {
    Remove-Item -Recurse -Force $releaseDir
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null

# ---------------------------------------------------------------------------
# 1) Frontend build
# ---------------------------------------------------------------------------
Write-Host "==> npm ci + npm run build"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

# ---------------------------------------------------------------------------
# 2) collectstatic with safe offline settings (no production secrets)
# ---------------------------------------------------------------------------
Write-Host "==> collectstatic (config.settings.release_build)"
$env:DJANGO_SETTINGS_MODULE = "config.settings.release_build"
# Ensure no accidental .env override of settings module for this step
uv run python manage.py collectstatic --noinput --clear
if ($LASTEXITCODE -ne 0) { throw "collectstatic failed" }

# ---------------------------------------------------------------------------
# 3) Copy runtime tree
# ---------------------------------------------------------------------------
function Copy-FilteredTree {
    param(
        [string]$Source,
        [string]$Destination,
        [string[]]$ExcludeDirNames = @(),
        [string[]]$ExcludeFilePatterns = @()
    )
    if (-not (Test-Path $Source)) { return }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -Path $Source -Force | ForEach-Object {
        if ($_.PSIsContainer) {
            if ($ExcludeDirNames -contains $_.Name) { return }
            Copy-FilteredTree -Source $_.FullName -Destination (Join-Path $Destination $_.Name) `
                -ExcludeDirNames $ExcludeDirNames -ExcludeFilePatterns $ExcludeFilePatterns
        } else {
            foreach ($pat in $ExcludeFilePatterns) {
                if ($_.Name -like $pat) { return }
            }
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Destination $_.Name) -Force
        }
    }
}

$excludeDirs = @(
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "tests",
    "htmlcov",
    "node_modules",
    ".venv",
    ".git"
)
$excludeFiles = @(
    "*.pyc",
    "*.pyo",
    ".coverage",
    "*.sqlite3",
    ".DS_Store",
    "Thumbs.db"
)

Write-Host "==> copying runtime files"
Copy-FilteredTree -Source (Join-Path $RepoRoot "apps") -Destination (Join-Path $releaseDir "apps") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles

# Drop POC-only apps if present (not in production INSTALLED_APPS)
foreach ($pocApp in @("mongo_poc", "mongo_compat")) {
    $p = Join-Path $releaseDir "apps\$pocApp"
    if (Test-Path $p) {
        Remove-Item -Recurse -Force $p
        Write-Host "Excluded POC app: apps/$pocApp"
    }
}

Copy-FilteredTree -Source (Join-Path $RepoRoot "config") -Destination (Join-Path $releaseDir "config") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles
Copy-FilteredTree -Source (Join-Path $RepoRoot "templates") -Destination (Join-Path $releaseDir "templates") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles

# Built static + collectstatic output
Copy-FilteredTree -Source (Join-Path $RepoRoot "static\dist") -Destination (Join-Path $releaseDir "static\dist") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles
# Optional source CSS/JS for Docker frontend rebuilds (no node_modules)
Copy-FilteredTree -Source (Join-Path $RepoRoot "static\src") -Destination (Join-Path $releaseDir "static\src") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles
Copy-FilteredTree -Source (Join-Path $RepoRoot "staticfiles") -Destination (Join-Path $releaseDir "staticfiles") `
    -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles

# Design tokens required by Dockerfile frontend stage / rebuild
if (Test-Path (Join-Path $RepoRoot "design")) {
    Copy-FilteredTree -Source (Join-Path $RepoRoot "design") -Destination (Join-Path $releaseDir "design") `
        -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles
}

# mongo_migrations (Mongo same-DB path) — runtime migrations for contrib ObjectId apps
if (Test-Path (Join-Path $RepoRoot "mongo_migrations")) {
    Copy-FilteredTree -Source (Join-Path $RepoRoot "mongo_migrations") -Destination (Join-Path $releaseDir "mongo_migrations") `
        -ExcludeDirNames $excludeDirs -ExcludeFilePatterns $excludeFiles
}

# Root runtime files
foreach ($f in @(
        "manage.py",
        "pyproject.toml",
        "uv.lock",
        "README.md",
        ".env.example",
        "Dockerfile",
        ".dockerignore",
        "compose.yaml",
        "compose.staging.yaml",
        "package.json",
        "package-lock.json"
    )) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $releaseDir $f) -Force
    }
}

# Production scripts (exclude developer-only / migration inventory generators)
$scriptsDest = Join-Path $releaseDir "scripts"
New-Item -ItemType Directory -Path $scriptsDest -Force | Out-Null
$scriptInclude = @(
    "scripts\__init__.py",
    "scripts\wait_for_postgres.py",
    "scripts\build_design_tokens.py",
    "scripts\copy_frontend_vendor_assets.js",
    "scripts\copy_frontend_vendor_assets.py",
    "scripts\ops\backup_postgres.sh",
    "scripts\ops\backup_evidence_tree.sh",
    "scripts\ops\backup_critical_config.sh",
    "scripts\ops\restore_drill.py",
    "scripts\migration\fg_mongo_backup.py",
    "scripts\migration\fg_mongo_restore.py",
    "scripts\deployment\required_paths.txt",
    "scripts\deployment\verify_release_package.ps1",
    "scripts\deployment\smoke_release_package.ps1",
    "scripts\deployment\build_release.ps1"
)
foreach ($rel in $scriptInclude) {
    $src = Join-Path $RepoRoot $rel
    if (Test-Path $src) {
        $dest = Join-Path $releaseDir $rel
        $destParent = Split-Path $dest -Parent
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }
}

# Infra runtime templates (no staging README prose required)
$infraInclude = @(
    "infra\docker\entrypoint.sh",
    "infra\nginx\nginx.conf",
    "infra\nginx\default.conf",
    "infra\staging\env.staging.example",
    "infra\staging\nginx.staging.conf.example"
)
foreach ($rel in $infraInclude) {
    $src = Join-Path $RepoRoot $rel
    if (Test-Path $src) {
        $dest = Join-Path $releaseDir $rel
        New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }
}

# Thin deployment note (not full docs tree)
$deployNote = @"
# Nelna FG — release package

Git SHA: $sha
Branch: $branch
Built (UTC): $timestamp

## Server deploy concept

1. Copy this package to the server (or extract the ZIP).
2. Configure secrets via external environment / vault (never commit .env).
3. Install runtime deps: ``uv sync --frozen --no-dev --no-group development --no-group testing --no-group security``
   (add ``--group mongo-poc`` only when Mongo runtime is authorized).
4. Migrate / collectstatic if required by IT procedure.
5. Start gunicorn + celery worker + celery beat with Redis + DB services.

See repository docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md on the engineering workstation.
Do not copy the full development repository to production hosts.
"@
Set-Content -Path (Join-Path $releaseDir "DEPLOY.txt") -Value $deployNote -Encoding UTF8

# ---------------------------------------------------------------------------
# 4) Hard secret / junk scrub
# ---------------------------------------------------------------------------
$scrubNames = @(".env", ".env.local", ".env.production", ".env.staging", ".coverage")
Get-ChildItem -Path $releaseDir -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object { $scrubNames -contains $_.Name -or $_.Name -like "*.pem" -or $_.Name -like "*.key" } |
    ForEach-Object {
        Write-Host "SCRUB removing $($_.FullName)"
        Remove-Item -Force $_.FullName
    }

# ---------------------------------------------------------------------------
# 5) Verify before ZIP
# ---------------------------------------------------------------------------
Write-Host "==> verify_release_package"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "verify_release_package.ps1") -ReleaseDir $releaseDir
if ($LASTEXITCODE -ne 0) { throw "verify_release_package failed" }

# ---------------------------------------------------------------------------
# 6) Manifest + checksums
# ---------------------------------------------------------------------------
$pyVer = (uv run python -c "import sys; print(sys.version.split()[0])").Trim()
$djVer = (uv run python -c "import django; print(django.get_version())").Trim()
$mongoBackend = "not-installed-in-default-groups"
try {
    $mongoBackend = (uv run python -c "import importlib.metadata as m; print(m.version('django-mongodb-backend'))" 2>$null).Trim()
    if (-not $mongoBackend) { $mongoBackend = "not-installed" }
} catch {
    $mongoBackend = "not-installed"
}

$topLevel = (Get-ChildItem $releaseDir -Force | Select-Object -ExpandProperty Name | Sort-Object) -join ", "
$pkgBytes = (Get-ChildItem $releaseDir -Recurse -File -Force | Measure-Object Length -Sum).Sum
$pkgMb = [math]::Round($pkgBytes / 1MB, 2)

$manifest = @"
Nelna FG Digital Recording System — RELEASE MANIFEST
====================================================
Git SHA: $sha
Short SHA: $shortSha
Branch: $branch
Build timestamp (UTC): $timestamp
Python: $pyVer
Django: $djVer
Mongo backend (build host): $mongoBackend
Package folder: dist/release/$releaseName
Package size (bytes): $pkgBytes
Package size (MB): $pkgMb

Top-level entries:
$topLevel

INCLUDED (runtime):
- apps/ (excluding tests/ and POC-only apps)
- config/
- templates/
- static/dist/ (built frontend)
- static/src/ (for optional Docker frontend rebuild)
- staticfiles/ (collectstatic output)
- mongo_migrations/ (when present)
- manage.py, pyproject.toml, uv.lock, README.md
- .env.example (template only — no secrets)
- Dockerfile, compose.yaml, compose.staging.yaml
- package.json / package-lock.json (no node_modules)
- design/ tokens for rebuild
- production scripts (wait_for_postgres, ops backups, FG mongo backup/restore)
- infra/docker entrypoint + nginx examples
- DEPLOY.txt

EXCLUDED (development):
- .git / .github
- node_modules / .venv
- __pycache__ / .pytest_cache / .mypy_cache / .ruff_cache
- coverage / htmlcov
- tests/ and apps/*/tests
- docs/ (full tree), UAT evidence, screenshots
- local logs, Mongo POC dumps, developer-only scripts
- .env and all real secrets / credentials / private keys

SECRETS_INCLUDED: NO
"@
Set-Content -Path (Join-Path $distRoot "RELEASE_MANIFEST.txt") -Value $manifest -Encoding UTF8
Copy-Item (Join-Path $distRoot "RELEASE_MANIFEST.txt") (Join-Path $releaseDir "RELEASE_MANIFEST.txt") -Force

# SHA256 for package tree files (relative paths) + zip later
$sumsPath = Join-Path $distRoot "SHA256SUMS.txt"
$lines = New-Object System.Collections.Generic.List[string]
Get-ChildItem $releaseDir -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    $rel = $_.FullName.Substring($releaseDir.Length).TrimStart('\', '/').Replace('\', '/')
    $lines.Add("$hash  $releaseName/$rel")
}
Set-Content -Path $sumsPath -Value ($lines -join "`n") -Encoding ASCII

# ---------------------------------------------------------------------------
# 7) ZIP
# ---------------------------------------------------------------------------
if (-not $SkipZip) {
    if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
    Write-Host "==> creating ZIP $zipPath"
    Compress-Archive -Path $releaseDir -DestinationPath $zipPath -CompressionLevel Optimal
    $zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
    Add-Content -Path $sumsPath -Value "`n$zipHash  $releaseName.zip" -Encoding ASCII
}

# ---------------------------------------------------------------------------
# 8) Isolated smoke
# ---------------------------------------------------------------------------
$smokeOk = "SKIPPED"
if (-not $SkipSmoke) {
    Write-Host "==> smoke_release_package"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "smoke_release_package.ps1") -ReleaseDir $releaseDir
    if ($LASTEXITCODE -ne 0) { throw "smoke_release_package failed" }
    $smokeOk = "PASSED"
}

Write-Host ""
Write-Host "RELEASE_SHA=$sha"
Write-Host "RELEASE_FOLDER=$releaseDir"
Write-Host "ZIP_FILE=$(if (Test-Path $zipPath) { $zipPath } else { 'N/A' })"
Write-Host "PACKAGE_SIZE_MB=$pkgMb"
Write-Host "RUNTIME_SMOKE=$smokeOk"
Write-Host "SECRETS_INCLUDED=NO"
Write-Host "READY_FOR_SERVER_COPY=$(if ($smokeOk -eq 'PASSED') { 'YES' } else { 'NO' })"
