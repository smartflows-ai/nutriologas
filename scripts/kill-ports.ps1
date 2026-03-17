$ports = 3000, 3001, 3002, 3003
$pids = @()

foreach ($p in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if ($c.OwningProcess -and ($pids -notcontains $c.OwningProcess)) {
      $pids += $c.OwningProcess
    }
  }
}

if ($pids.Count -eq 0) {
  Write-Output "No LISTENING processes found on ports 3000-3003"
  exit 0
}

Write-Output ("Killing PIDs: " + ($pids -join ", "))
foreach ($procId in $pids) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Output ("Killed " + $procId)
  } catch {
    Write-Output ("Failed " + $procId + ": " + $_.Exception.Message)
  }
}

