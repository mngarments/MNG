# Registers a Windows scheduled task that runs the MNG Tally agent every 15
# minutes. Run once from an *Administrator* PowerShell in this folder:
#
#   powershell -ExecutionPolicy Bypass -File .\install-task.ps1
#
# The task runs as SYSTEM, so it keeps syncing when nobody is logged in and
# never pops up a window. It only needs TallyPrime itself to be running with
# the company open. Remove it with:
#
#   Unregister-ScheduledTask -TaskName "MNG Tally Sync" -Confirm:$false

param([int]$EveryMinutes = 15)
$ErrorActionPreference = "Stop"

$dir = $PSScriptRoot
if (-not (Test-Path (Join-Path $dir "config.json"))) {
    throw "config.json not found in $dir. Copy config.example.json to config.json and fill it in first."
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js is not installed (or not on PATH). Install the LTS version from nodejs.org." }

$action = New-ScheduledTaskAction -Execute $node -Argument "agent.mjs sync" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "MNG Tally Sync" -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force `
    -Description "Pushes Tally Prime ledgers, bills and vouchers to the MNG control panel." | Out-Null

Write-Host "Installed 'MNG Tally Sync' (every $EveryMinutes minutes, first run in about 1 minute)."
Write-Host "Progress is logged to $(Join-Path $dir 'agent.log')."
