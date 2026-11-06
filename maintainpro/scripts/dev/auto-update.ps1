# One command for the laptop: keeps the app running AND follows branch "live".
# Every 15s it fetches; when new commits arrive it fast-forwards, and (only when needed)
# stops the servers, runs npm install / prisma generate / migrate deploy, then restarts them.
# Plain code changes are picked up by the dev servers' own hot reload (no restart).
# Safe by design: skips when you have local edits or the branch diverged; never force-pulls.
param(
  [string]$Branch = "live",
  [int]$IntervalSeconds = 15
)
$ErrorActionPreference = "Continue"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$repo = (git -C $root rev-parse --show-toplevel).Trim()
Set-Location $root

function Log($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

$script:server = $null
function Stop-Servers {
  if ($script:server -and -not $script:server.HasExited) {
    & taskkill /PID $script:server.Id /T /F | Out-Null
  }
  & (Join-Path $PSScriptRoot "stop-all.ps1")
  Start-Sleep -Seconds 1
}
function Start-Servers {
  $script:server = Start-Process powershell -PassThru -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "dev-current.ps1")
  )
  Log "Servers starting (API 3040, web 3041)..."
}

Log "Auto-update on branch '$Branch' every ${IntervalSeconds}s. Ctrl+C to stop."
# Startup sync: you may have pulled by hand before starting, so always make sure the client and DB are current.
Stop-Servers
Log "Startup: prisma generate + apply pending migrations..."
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
if ($LASTEXITCODE -ne 0) { Log "MIGRATION FAILED - check the output above. Servers will still start." }
Start-Servers

while ($true) {
  Start-Sleep -Seconds $IntervalSeconds
  try {
    git -C $repo fetch origin $Branch --quiet 2>$null
    if ($LASTEXITCODE -ne 0) { continue }
    $local = (git -C $repo rev-parse HEAD).Trim()
    $remote = (git -C $repo rev-parse "origin/$Branch").Trim()
    if ($local -eq $remote) { continue }

    if ((git -C $repo branch --show-current).Trim() -ne $Branch) { Log "Not on '$Branch' - skipping."; continue }
    if (git -C $repo status --porcelain) { Log "You have local changes - skipping update (commit or stash them)."; continue }
    git -C $repo merge-base --is-ancestor $local $remote
    if ($LASTEXITCODE -ne 0) { Log "Local '$Branch' diverged from origin - skipping."; continue }

    $changed = @(git -C $repo diff --name-only $local $remote)
    git -C $repo merge --ff-only "origin/$Branch" --quiet
    if ($LASTEXITCODE -ne 0) { Log "Fast-forward failed - skipping."; continue }
    Log ("Updated to {0} ({1} files)." -f $remote.Substring(0, 7), $changed.Count)

    $needInstall = [bool]($changed | Where-Object { $_ -match "(^|/)package(-lock)?\.json$" })
    $needMigrate = [bool]($changed | Where-Object { $_ -match "prisma/migrations/" })
    $needGenerate = $needMigrate -or [bool]($changed | Where-Object { $_ -match "prisma/schema\.prisma$" })
    if (-not ($needInstall -or $needGenerate)) { continue }

    Log "Dependencies/database changed - restarting."
    Stop-Servers
    if ($needInstall) {
      Log "npm install..."
      npm.cmd install --no-audit --no-fund
    }
    if ($needGenerate) {
      Log "prisma generate..."
      npm.cmd run db:generate
    }
    if ($needMigrate) {
      Log "Applying new migrations..."
      npm.cmd run db:migrate:deploy
      if ($LASTEXITCODE -ne 0) { Log "MIGRATION FAILED - check the output above. Servers will still start." }
    }
    Start-Servers
  } catch {
    Log ("Update check failed: " + $_.Exception.Message)
  }
}
