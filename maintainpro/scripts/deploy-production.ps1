<#
.SYNOPSIS
  Guarded MaintainPro production deployment helper.

.DESCRIPTION
  Defaults to dry-run. Never prints .env contents. Never uses down -v.
  Never resets/seeds DB. Never auto-runs schema changes.
  Real execution requires -Execute and is NOT performed during Phase 3 source work.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)][string]$ReleaseRef,
  [Parameter(Mandatory = $true)][string]$ChangeTicket,
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string[]]$Services,
  [switch]$Execute,
  [switch]$SkipDockerBuild
)

$ErrorActionPreference = "Stop"
$maintainproRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $maintainproRoot "package.json"))) {
  throw "Unable to locate maintainpro root from script path."
}

function Assert-CleanTree {
  Push-Location (Join-Path $maintainproRoot "..")
  try {
    $status = git status --short
    if (-not [string]::IsNullOrWhiteSpace($status)) {
      throw "DEPLOY-REL-001: Dirty working tree blocks deployment."
    }
  } finally { Pop-Location }
}

function Assert-ApprovedRef([string]$Ref) {
  $approvedBranches = @(
    "main",
    "fix/phase3-release-source-alignment",
    "fix/phase1-phase2-production-remediation"
  )
  if ($approvedBranches -contains $Ref) { return }
  if ($Ref -match '^[0-9a-f]{40}$') { return }
  if ($Ref -match '^maintainpro-v\d+\.\d+\.\d+$') { return }
  throw "DEPLOY-REL-015: Release from an unapproved branch/ref is rejected: $Ref"
}

function Assert-Services([string[]]$Selected) {
  $allowed = @("api", "web", "nginx")
  $forbidden = @("mongo", "redis", "minio", "minio-init", "db", "database", "volume")
  foreach ($s in $Selected) {
    $n = $s.ToLowerInvariant()
    if ($forbidden -contains $n) {
      throw "DEPLOY-REL-017: Deployment helper refuses destructive service selections: $n"
    }
    if (-not ($allowed -contains $n)) {
      throw "DEPLOY-REL-017: Unknown service selection: $n"
    }
  }
}

Write-Host "deploy-production.ps1 starting"
Write-Host "ChangeTicket=$ChangeTicket ReleaseRef=$ReleaseRef BaseUrl=$BaseUrl"
Write-Host "Services=$($Services -join ',')"

Assert-CleanTree
Assert-ApprovedRef $ReleaseRef
Assert-Services $Services

$envPath = Join-Path $maintainproRoot ".env"
if (-not (Test-Path $envPath)) {
  throw "DEPLOY-REL-006: Missing production .env blocks execution."
}
Write-Host "PASS DEPLOY-REL-006: production .env exists (contents not read)"

Push-Location $maintainproRoot
try {
  Write-Host "Running Phase 1-3 source validations..."
  npm run validate:secret-safety
  if ($LASTEXITCODE -ne 0) { throw "validate:secret-safety failed" }
  npm run validate:nginx-routing
  if ($LASTEXITCODE -ne 0) { throw "validate:nginx-routing failed" }
  npm run audit:tenant
  if ($LASTEXITCODE -ne 0) { throw "audit:tenant failed" }
  npm run audit:rbac
  if ($LASTEXITCODE -ne 0) { throw "audit:rbac failed" }
  node scripts/test/release-phase3.selftest.mjs
  if ($LASTEXITCODE -ne 0) { throw "release-phase3.selftest failed" }

  # Compose validation with structure fixture only (never dump real .env)
  $fixture = Join-Path $maintainproRoot ".env.production.structure-fixture.example"
  $env:MAINTAINPRO_COMPOSE_ENV_FILE = ".env.production.structure-fixture.example"
  docker compose --env-file $fixture -f docker-compose.yml -f docker-compose.production.yml config --quiet
  if ($LASTEXITCODE -ne 0) { throw "production compose structure validation failed" }

  $previousSha = (git rev-parse HEAD)
  Write-Host "Captured previous/current checkout SHA=$previousSha"

  $dryRun = -not $Execute
  if ($dryRun) {
    Write-Host "DEPLOY-REL-016: dry-run default active (pass -Execute for real deploy — not used in Phase 3)."
    Write-Host "Would build/select images maintainpro-api:<SHA> maintainpro-web:<SHA>"
    Write-Host "Would recreate only: $($Services -join ', ')"
    Write-Host "Would NOT touch mongo/redis/minio volumes"
    Write-Host "Would probe $BaseUrl health/BFF after recreate"
    $evidence = [ordered]@{
      mode = "dry-run"
      changeTicket = $ChangeTicket
      releaseRef = $ReleaseRef
      services = $Services
      baseUrl = $BaseUrl
      previousSha = $previousSha
    }
    $out = Join-Path $maintainproRoot "artifacts/deployment-evidence-dry-run.json"
    New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
    ($evidence | ConvertTo-Json -Depth 5) | Set-Content -Path $out -Encoding utf8
    Write-Host "Wrote secret-free dry-run evidence: artifacts/deployment-evidence-dry-run.json"
    Write-Host "deploy-production.ps1 DRY-RUN PASS"
    return
  }

  if ($Execute) {
    throw "Refusing real execution in this repository automation context. Operator must run -Execute intentionally outside Phase 3 source alignment after approvals."
  }
} finally {
  Pop-Location
}