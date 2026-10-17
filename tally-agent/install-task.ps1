# Registers a Windows scheduled task that checks in with MNG every 5 minutes.
# *When* to actually sync is set in the MNG portal (Tally Accounts > Sync
# schedule). Run once from an *Administrator* PowerShell in this folder:
#
#   powershell -ExecutionPolicy Bypass -File .\install-task.ps1
#
# The task runs as SYSTEM, so it keeps syncing when nobody is logged in and
# never pops up a window. It only needs TallyPrime itself to be running with
# the company open. Remove it with:
#
#   Unregister-ScheduledTask -TaskName "MNG Tally Sync" -Confirm:$false

param([int]$EveryMinutes = 5)
$ErrorActionPreference = "Stop"

$dir = $PSScriptRoot
if (-not (Test-Path (Join-Path $dir "config.json"))) {
    throw "config.json not found in $dir. Copy config.example.json to config.json and fill it in first."
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js is not installed (or not on PATH). Install the LTS version from nodejs.org." }

$action = New-ScheduledTaskAction -Execute $node -Argument "agent.mjs tick" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "MNG Tally Sync" -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force `
    -Description "Checks in with MNG and syncs Tally Prime data on the schedule set in the portal." | Out-Null

Write-Host "Installed 'MNG Tally Sync' (checks in every $EveryMinutes minutes, first in about 1 minute)."
Write-Host "Set when it syncs in the MNG portal: Tally Accounts > Sync schedule."
Write-Host "Progress is logged to $(Join-Path $dir 'agent.log')."
