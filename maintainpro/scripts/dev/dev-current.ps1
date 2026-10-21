# Starts the API on 3040 and the web app on 3041. Never selects another port.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

& (Join-Path $PSScriptRoot "free-ports.ps1")
Start-Sleep -Milliseconds 500

function Assert-PortFree([int]$Port) {
  $busy = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 })
  if ($busy.Count -eq 0) { return }
  $owner = [int]$busy[0].OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$owner" -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.Name } else { "unknown" }
  throw "Port $Port is still in use by PID $owner ($name). Refusing to pick another port."
}

Assert-PortFree 3040
Assert-PortFree 3041

$env:PORT = "3040"
$env:API_INTERNAL_URL = "http://127.0.0.1:3040/api"
Set-Location $root
npm exec -- concurrently -n api,web -c cyan,magenta "npm run dev --workspace @maintainpro/api" "npm run dev --workspace @maintainpro/web"
