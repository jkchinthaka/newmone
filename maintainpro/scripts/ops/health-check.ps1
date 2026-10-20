<#>
.SYNOPSIS
    Health check for MaintainPro production: hits /health/live, /health/ready, and web login page.

.DESCRIPTION
    Exits 0 (OK) if all checks pass, 1 (FAIL) otherwise.
    Prints one-line summary: "OK — all checks passed" or "FAIL — <details>".

.EXAMPLE
    .\health-check.ps1

.EXAMPLE
    .\health-check.ps1 -ApiBase http://127.0.0.1:3000 -WebBase http://127.0.0.1:3001
#>

param(
    [string]$ApiBase = "http://127.0.0.1:3000",
    [string]$WebBase = "http://127.0.0.1:3001",
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Stop"
$failures = @()

function Test-Endpoint {
    param([string]$Name, [string]$Url, [int]$ExpectedStatus = 200, [scriptblock]$Validate = $null)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -ne $ExpectedStatus) {
            return "FAIL: $Name returned HTTP $($response.StatusCode) (expected $ExpectedStatus)"
        }
        if ($Validate) {
            $result = & $Validate $response
            if ($result -ne $true) {
                return "FAIL: $Name validation failed: $result"
            }
        }
        return $null
    }
    catch {
        return "FAIL: $Name threw: $($_.Exception.Message)"
    }
}

# 1. API Liveness
$fail = Test-Endpoint "API /health/live" "$ApiBase/health/live" 200
if ($fail) { $failures += $fail }

# 2. API Readiness (detailed)
$fail = Test-Endpoint "API /health/ready" "$ApiBase/health/ready" 200 {
    param($r)
    $body = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if (-not $body) { return "invalid JSON" }
    if ($body.status -ne "ok") { return "status=$($body.status)" }
    if ($body.checks.database -ne "ok") { return "database check=$($body.checks.database)" }
    return $true
}
if ($fail) { $failures += $fail }

# 3. Web Login Page (checks Next.js is serving, no 500)
$fail = Test-Endpoint "Web login page" "$WebBase/login" 200 {
    param($r)
    if ($r.Content -notmatch 'sign in|Sign In|email|password') {
        return "login form not found in HTML"
    }
    return $true
}
if ($fail) { $failures += $fail }

# 4. API Readiness (detailed) - requires readiness key in production, so skip if 401/403
$detailed = Test-Endpoint "API /health/readiness" "$ApiBase/health/readiness" 200 {
    param($r)
    $body = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if (-not $body) { return "invalid JSON" }
    return $true
}
if ($detailed -and $detailed -notmatch "401|403") { $failures += $detailed }

# Output
if ($failures.Count -eq 0) {
    Write-Host "OK — all checks passed"
    exit 0
}
else {
    Write-Host "FAIL — $($failures.Count) check(s) failed:"
    $failures | ForEach-Object { Write-Host "  $_" }
    exit 1
}