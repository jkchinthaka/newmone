<#
.SYNOPSIS
  Verify a Nelna FG release package contains required runtime files.

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
$ManifestPath = Join-Path $PSScriptRoot "required_paths.txt"

if (-not (Test-Path $ManifestPath)) {
    throw "Missing required_paths.txt at $ManifestPath"
}

$missing = @()
Get-Content $ManifestPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $target = Join-Path $ReleaseDir $line
    if (-not (Test-Path $target)) {
        $missing += $line
    }
}

# Migrations must exist under apps
$migrationDirs = Get-ChildItem -Path (Join-Path $ReleaseDir "apps") -Recurse -Directory -Filter "migrations" -ErrorAction SilentlyContinue
if (-not $migrationDirs -or $migrationDirs.Count -lt 5) {
    $missing += "apps/*/migrations (insufficient migration packages)"
}

# No secrets
$secretHits = @()
$secretNames = @(".env", ".env.local", ".env.production", ".env.staging")
foreach ($name in $secretNames) {
    if (Test-Path (Join-Path $ReleaseDir $name)) {
        $secretHits += $name
    }
}

# Forbidden development payloads
$forbidden = @(
    ".git",
    "node_modules",
    ".venv",
    "htmlcov",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "tests"
)
$forbiddenHits = @()
foreach ($name in $forbidden) {
    if (Test-Path (Join-Path $ReleaseDir $name)) {
        $forbiddenHits += $name
    }
}

# apps/**/tests must not be present
$appTests = Get-ChildItem -Path (Join-Path $ReleaseDir "apps") -Recurse -Directory -Filter "tests" -ErrorAction SilentlyContinue
if ($appTests) {
    $forbiddenHits += ($appTests | ForEach-Object { $_.FullName.Substring($ReleaseDir.Length).TrimStart('\','/') })
}

Write-Host "VERIFY_RELEASE_DIR=$ReleaseDir"
if ($missing.Count -gt 0) {
    Write-Host "MISSING_REQUIRED:"
    $missing | ForEach-Object { Write-Host "  - $_" }
}
if ($secretHits.Count -gt 0) {
    Write-Host "SECRETS_FOUND:"
    $secretHits | ForEach-Object { Write-Host "  - $_" }
}
if ($forbiddenHits.Count -gt 0) {
    Write-Host "FORBIDDEN_FOUND:"
    $forbiddenHits | ForEach-Object { Write-Host "  - $_" }
}

if ($missing.Count -gt 0 -or $secretHits.Count -gt 0 -or $forbiddenHits.Count -gt 0) {
    throw "Release package verification FAILED."
}

# Static assets sanity
$css = Join-Path $ReleaseDir "static\dist\css\app.css"
$staticfiles = Join-Path $ReleaseDir "staticfiles"
if (-not (Test-Path $css)) { throw "Missing built CSS: static/dist/css/app.css" }
if (-not (Test-Path $staticfiles)) { throw "Missing collectstatic output: staticfiles/" }

Write-Host "VERIFY_RELEASE: OK"
exit 0
