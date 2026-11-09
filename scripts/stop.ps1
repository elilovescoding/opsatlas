. "$PSScriptRoot/native-env.ps1"
foreach ($Name in @('frontend','backend','targets')) {
    $PidFile=Join-Path $ProjectRoot ".runtime/$Name.pid"
    if (Test-Path $PidFile) {
        $ProcessId=[int](Get-Content $PidFile)
        $Running=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
        # Refuse to kill a reused PID belonging to an unrelated command.
        if ($Running -and ($Running.CommandLine -like '*opsatlas*' -or $Running.CommandLine -like '*demo-targets.mjs*' -or $Running.CommandLine -like '*node_modules/vite/bin/vite.js*')) { Stop-Process -Id $ProcessId }
        Remove-Item -LiteralPath $PidFile
    }
}
& "$PgBin/pg_ctl.exe" stop -D "$ProjectRoot/.runtime/postgres" -m fast -w
Write-Output 'Stopped local processes. Data and credentials were preserved.'
