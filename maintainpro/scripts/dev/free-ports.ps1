# Stops node processes that are listening on the fixed MaintainPro ports.
# It does not stop any other process, and it does not choose a different port.
$ErrorActionPreference = "Stop"

function Get-ListeningPids([int[]]$Ports) {
  $found = @()
  foreach ($port in $Ports) {
    $rows = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    foreach ($row in $rows) {
      if ($row.OwningProcess -and $row.OwningProcess -ne 0) {
        $found += [int]$row.OwningProcess
      }
    }
  }
  return @($found | Select-Object -Unique)
}

foreach ($procId in (Get-ListeningPids @(3040, 3041))) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
  if (-not $proc) { continue }
  if ($proc.Name -ne "node.exe") { continue }
  taskkill /F /PID $procId | Out-Null
}
