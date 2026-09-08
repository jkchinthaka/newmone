$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$shots = "C:\Users\chint\OneDrive\Pictures\newmone\newmone\maintainpro\apps\mobile\.uat_screenshots"
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$pwdLine = (Get-Content "C:\Users\chint\OneDrive\Pictures\newmone\newmone\maintainpro\.env" | Where-Object { $_ -match '^MAINTAINPRO_SEED_PASSWORD=' } | Select-Object -First 1)
$seedPwd = $pwdLine.Split('=',2)[1].Trim().Trim('"').Trim("'")
$email = 'superadmin@maintainpro.local'
$results = @()

function Take-Shot([string]$name) {
  $path = Join-Path $shots $name
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $adb
  $psi.Arguments = '-s emulator-5554 exec-out screencap -p'
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $p = [Diagnostics.Process]::Start($psi)
  $fs = [IO.File]::Create($path)
  $p.StandardOutput.BaseStream.CopyTo($fs)
  $fs.Close(); $p.WaitForExit()
  return (Get-Item $path).Length -gt 1000
}

function Tap-Point($x,$y) { & $adb -s emulator-5554 shell input tap $x $y; Start-Sleep -Milliseconds 700 }
function Go-Back { & $adb -s emulator-5554 shell input keyevent 4; Start-Sleep -Milliseconds 900 }

function Get-UiDump {
  & $adb -s emulator-5554 shell uiautomator dump /sdcard/uat.xml 2>$null | Out-Null
  Start-Sleep -Milliseconds 400
  return (& $adb -s emulator-5554 shell cat /sdcard/uat.xml 2>$null)
}

function Tap-Text([string]$text, [switch]$Contains) {
  $xml = Get-UiDump
  if (-not $xml) { return $false }
  $pattern = if ($Contains) {
    "text=`"[^`"]*$([regex]::Escape($text))[^`"]*`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  } else {
    "text=`"$([regex]::Escape($text))`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  }
  if ($xml -match $pattern) {
    Tap-Point ([int](([int]$matches[1]+[int]$matches[3])/2)) ([int](([int]$matches[2]+[int]$matches[4])/2))
    return $true
  }
  return $false
}

function Scroll-Down { & $adb -s emulator-5554 shell input swipe 540 1700 540 700 350; Start-Sleep -Milliseconds 600 }

function Tap-TextScroll([string]$text, [int]$max=8) {
  for ($i=0; $i -lt $max; $i++) { if (Tap-Text $text) { return $true }; Scroll-Down }
  return $false
}

function Tap-Nav([string]$label) {
  $xml = Get-UiDump
  if ($xml -match "content-desc=`"$([regex]::Escape($label))`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"") {
    Tap-Point ([int](([int]$matches[1]+[int]$matches[3])/2)) ([int](([int]$matches[2]+[int]$matches[4])/2)); return $true
  }
  return (Tap-Text $label)
}

& $adb -s emulator-5554 shell am force-stop com.maintainpro.mobile
Start-Sleep 1
& $adb -s emulator-5554 shell am start -n com.maintainpro.mobile/.MainActivity | Out-Null
Start-Sleep 8

if (-not (Tap-Text 'Email')) { Tap-Point 540 820 }
Set-Clipboard -Value $email
& $adb -s emulator-5554 shell input keyevent 279
Start-Sleep 500
if (-not (Tap-Text 'Password')) { Tap-Point 540 980 }
Set-Clipboard -Value $seedPwd
& $adb -s emulator-5554 shell input keyevent 279
Start-Sleep 500
if (-not (Tap-Text 'Sign in')) { Tap-Point 540 1180 }
Start-Sleep 10
$xml = Get-UiDump
$loginOk = ($xml -match 'Hello,' -or ($xml -match 'MaintainPro' -and $xml -notmatch 'Sign in'))
$results += "login=$loginOk"
if (Take-Shot 'uat-home.png') { $results += 'home=pass' } else { $results += 'home=fail' }

if (Tap-Text 'Work Orders') { Start-Sleep 4; if (Take-Shot 'uat-work-orders.png') { $results += 'work-orders=pass' } else { $results += 'work-orders=fail' }; Go-Back } else { $results += 'work-orders=nav-fail' }

if (Tap-Text 'Admin Console') {
  Start-Sleep 4
  if (Take-Shot 'uat-admin.png') { $results += 'admin=pass' } else { $results += 'admin=fail' }
  if (Tap-Text 'Users') {
    Start-Sleep 4
    if (Take-Shot 'uat-admin-users.png') { $results += 'admin-users=pass' } else { $results += 'admin-users=fail' }
    if (-not (Tap-TextScroll 'Platform Admin' -max 3)) { Tap-TextScroll 'Super Admin' -max 3 | Out-Null }
    Start-Sleep 3
    if (Tap-TextScroll 'Set / reset password' -max 2) {
      $results += 'password-btn=pass'
      Start-Sleep 2
      if (Take-Shot 'uat-password-sheet.png') { $results += 'password-sheet=pass' } else { $results += 'password-sheet=fail' }
      Go-Back
    } else { $results += 'password-btn=fail' }
    Go-Back; Go-Back
  } else { $results += 'admin-users=nav-fail'; Go-Back }
} else { $results += 'admin=nav-fail' }

if (Tap-Text 'Management Reports') { Start-Sleep 4; if (Take-Shot 'uat-reports.png') { $results += 'reports=pass' } else { $results += 'reports=fail' }; Go-Back } else { $results += 'reports=nav-fail' }

Tap-Nav 'More' | Out-Null; Start-Sleep 3
if (Take-Shot 'uat-more.png') { $results += 'more=pass' } else { $results += 'more=fail' }
if (-not (Tap-Text 'Outbox and connectivity' -Contains)) { Tap-Text 'Sync' | Out-Null }
Start-Sleep 3; if (Take-Shot 'uat-sync.png') { $results += 'sync=pass' } else { $results += 'sync=fail' }; Go-Back
Tap-Nav 'More' | Out-Null; Start-Sleep 2
if (Tap-Text 'Drafts' -Contains) { Start-Sleep 3; if (Take-Shot 'uat-drafts.png') { $results += 'drafts=pass' } else { $results += 'drafts=fail' }; Go-Back } else { $results += 'drafts=nav-fail' }
Tap-Nav 'More' | Out-Null; Start-Sleep 2
if (Tap-TextScroll 'Fleet' -max 6) { Start-Sleep 4; if (Take-Shot 'uat-fleet.png') { $results += 'fleet=pass' } else { $results += 'fleet=fail' }; Go-Back; Go-Back } else { $results += 'fleet=nav-fail' }
Tap-Nav 'More' | Out-Null; Start-Sleep 2
if (Tap-TextScroll 'FG Digital Recording' -max 8) { Start-Sleep 4; if (Take-Shot 'uat-fg.png') { $results += 'fg=pass' } else { $results += 'fg=fail' }; Go-Back; Go-Back } else { $results += 'fg=nav-fail' }
Tap-Nav 'More' | Out-Null; Start-Sleep 2
if (Tap-TextScroll 'Farm Operations' -max 10) { Start-Sleep 4; if (Take-Shot 'uat-farm.png') { $results += 'farm=pass' } else { $results += 'farm=fail' }; Go-Back; Go-Back } else { $results += 'farm=nav-fail' }
Tap-Nav 'More' | Out-Null; Start-Sleep 2
if (Tap-Text 'Settings' -Contains) { Start-Sleep 3; if (Take-Shot 'uat-settings.png') { $results += 'settings=pass' } else { $results += 'settings=fail' }; Go-Back } else { $results += 'settings=nav-fail' }

Tap-Nav 'Alerts' | Out-Null; Start-Sleep 4; if (Take-Shot 'uat-alerts.png') { $results += 'alerts=pass' } else { $results += 'alerts=fail' }
Tap-Nav 'Home' | Out-Null; Start-Sleep 2
if (-not (Tap-Text 'Profile' -Contains)) { Tap-Point 950 120 }
Start-Sleep 3; if (Take-Shot 'uat-profile.png') { $results += 'profile=pass' } else { $results += 'profile=fail' }

$results -join '; '
