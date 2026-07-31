<#
.SYNOPSIS
  Read-only server release audit for MaintainPro.

.DESCRIPTION
  Reports Git identity, container/image summary, local health probes, and
  Git/runtime SHA match. Never reads or prints .env values. Never restarts
  containers. Never connects to MongoDB directly.
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1",
  [string]$ApiHealthPath = "/api/health",
  [string]$WebBuildInfoPath = "/api/build-info"
)

$ErrorActionPreference = "Continue"
$pass = 0; $warn = 0; $fail = 0

function Write-Result([string]$Level, [string]$Message) {
  switch ($Level) {
    "PASS" { $script:pass++ }
    "WARN" { $script:warn++ }
    "FAIL" { $script:fail++ }
  }
  Write-Host "[$Level] $Message"
}

Write-Host "=== MaintainPro read-only server release audit ==="
Write-Host "cwd: $(Get-Location)"

# Git
try {
  $branch = (git branch --show-current 2>$null)
  $sha = (git rev-parse HEAD 2>$null)
  $status = (git status --short 2>$null)
  Write-Result "PASS" "git branch=$branch"
  Write-Result "PASS" "git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>"=$sha"
  if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Result "PASS" "working tree clean"
  } else {
    Write-Result "FAIL" "working tree dirty (direct source changes suspected)"
  }
  $remote = (git remote get-url origin 2>$null)
  if ($remote) {
    $sanitized = $remote -replace '://[^@]+@', '://***@'
    Write-Result "PASS" "remote identity sanitized=$sanitized"
  } else {
    Write-Result "WARN" "origin remote not configured"
  }
} catch {
  Write-Result "FAIL" "git audit failed"
}

# Docker compose version
try {
  $composeVersion = docker compose version 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Result "PASS" "compose: $composeVersion" }
  else { Write-Result "WARN" "docker compose unavailable" }
} catch { Write-Result "WARN" "docker compose unavailable" }

# Containers (names/states only — no inspect Env)
try {
  $rows = docker ps -a --format "{{.Names}}|{{.Status}}|{{.Image}}" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Result "PASS" "container listing acquired"
    $rows | ForEach-Object { Write-Host "  container: $_" }
  } else {
    Write-Result "WARN" "docker ps failed"
  }
} catch { Write-Result "WARN" "docker ps failed" }

# Images (name/id/tag only)
try {
  $images = docker images --format "{{.Repository}}:{{.Tag}}|{{.ID}}" 2>$null |
    Where-Object { $_ -match 'maintainpro-(api|web)' }
  if ($images) {
    Write-Result "PASS" "maintainpro images present"
    $images | ForEach-Object { Write-Host "  image: $_" }
  } else {
    Write-Result "WARN" "no maintainpro-api/web images found"
  }
} catch { Write-Result "WARN" "docker images failed" }

function Get-JsonSafe([string]$Url) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
    return $resp.Content
  } catch {
    return $null
  }
}

$apiJson = Get-JsonSafe ($BaseUrl.TrimEnd('/') + $ApiHealthPath)
$webJson = Get-JsonSafe ($BaseUrl.TrimEnd('/') + $WebBuildInfoPath)

$runtimeSha = $null
if ($apiJson) {
  Write-Result "PASS" "local API health reachable"
  if ($apiJson -match '"commit"\s*:\s*"([^"]+)"') { $runtimeSha = $Matches[1] }
  elseif ($apiJson -match '"commitSha"\s*:\s*"([^"]+)"') { $runtimeSha = $Matches[1] }
} else {
  Write-Result "WARN" "local API health not reachable at configured BaseUrl"
}

if ($webJson) {
  Write-Result "PASS" "local Web build-info reachable"
  if (-not $runtimeSha -and $webJson -match '"commitSha"\s*:\s*"([^"]+)"') {
    $runtimeSha = $Matches[1]
  }
} else {
  Write-Result "WARN" "local Web build-info not reachable at configured BaseUrl"
}

if ($sha -and $runtimeSha) {
  $a = $sha.ToLower(); $b = $runtimeSha.ToLower()
  if ($a -eq $b -or $a.StartsWith($b) -or $b.StartsWith($a)) {
    Write-Result "PASS" "Git/runtime SHA match ($runtimeSha)"
  } else {
    Write-Result "FAIL" "Git/runtime SHA mismatch git=$sha runtime=$runtimeSha"
  }
} else {
  Write-Result "WARN" "unable to compare Git/runtime SHA"
}

Write-Host "=== SUMMARY PASS=$pass WARN=$warn FAIL=$fail ==="
if ($fail -gt 0) { exit 2 }
exit 0