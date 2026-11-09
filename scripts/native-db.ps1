. "$PSScriptRoot/native-env.ps1"
$DbDirectory = Join-Path $ProjectRoot '.runtime/postgres'
if (!(Test-Path "$DbDirectory/PG_VERSION")) {
    $PasswordFile = Join-Path $ProjectRoot '.runtime/db-password'
    $env:DATABASE_PASSWORD | Set-Content -NoNewline $PasswordFile
    try {
        & "$PgBin/initdb.exe" -D $DbDirectory -U opsatlas --auth=scram-sha-256 --pwfile=$PasswordFile --encoding=UTF8 --locale=C
        if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
    } finally { Remove-Item -LiteralPath $PasswordFile -ErrorAction SilentlyContinue }
}
& "$PgBin/pg_ctl.exe" status -D $DbDirectory *> $null
if ($LASTEXITCODE -ne 0) {
    $PgControl = Start-Process -FilePath "$PgBin/pg_ctl.exe" -ArgumentList @('start','-D',"`"$DbDirectory`"",'-l',"`"$ProjectRoot/.runtime/postgres.log`"",'-o','"-p 55432 -h 127.0.0.1"','-w') -WindowStyle Hidden -PassThru -RedirectStandardOutput "$ProjectRoot/.runtime/pg-start.log" -RedirectStandardError "$ProjectRoot/.runtime/pg-start-error.log"
    if (!$PgControl.WaitForExit(30000)) { throw 'PostgreSQL control command timed out' }
    if ($PgControl.ExitCode -ne 0) { throw 'PostgreSQL startup failed; inspect .runtime/pg-start-error.log' }
}
if (!(Test-Path scripts/node_modules/pg)) {
    if ($Npm) { & node $Npm install --prefix scripts --no-fund --no-audit }
    else { & npm.cmd install --prefix scripts --no-fund --no-audit }
    if ($LASTEXITCODE -ne 0) { throw 'Local tool dependency installation failed' }
}
& node scripts/init-db.cjs
if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed' }
