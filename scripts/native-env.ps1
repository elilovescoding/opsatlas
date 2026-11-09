$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot
New-Item -ItemType Directory -Force .runtime | Out-Null
if (!(Test-Path '.env')) {
    $DbSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).ToLower()
    $AdminSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(20)).ToLower()
    @"
DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/opsatlas
DATABASE_USER=opsatlas
DATABASE_PASSWORD=$DbSecret
POSTGRES_PASSWORD=$DbSecret
BOOTSTRAP_EMAIL=admin@opsatlas.local
BOOTSTRAP_PASSWORD=$AdminSecret
DEMO_ENABLED=true
COOKIE_SECURE=false
REGISTRATION_ENABLED=true
SERVER_ADDRESS=127.0.0.1
MANAGEMENT_ADDRESS=127.0.0.1
MONITOR_DELAY_MS=15000
"@ | Set-Content -Encoding utf8 .env
    Write-Output 'Generated local credentials in .env. Open that file privately to sign in.'
}
Get-Content .env | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $Pair = $_ -split '=',2
    [Environment]::SetEnvironmentVariable($Pair[0],$Pair[1],'Process')
}
if (!$env:DATABASE_PASSWORD) { $env:DATABASE_PASSWORD=$env:POSTGRES_PASSWORD }
if (!$env:DATABASE_PASSWORD) { throw 'Set POSTGRES_PASSWORD in .env before native startup.' }
if (!$env:DATABASE_USER) { $env:DATABASE_USER='opsatlas' }
if (!$env:DATABASE_URL) { $env:DATABASE_URL='jdbc:postgresql://127.0.0.1:55432/opsatlas' }
if (!$env:SERVER_ADDRESS) { $env:SERVER_ADDRESS='127.0.0.1' }
if (!$env:MANAGEMENT_ADDRESS) { $env:MANAGEMENT_ADDRESS='127.0.0.1' }
if (!$env:JAVA_HOME) {
    $JavaCommand = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($JavaCommand) { $env:JAVA_HOME = Split-Path (Split-Path $JavaCommand.Source -Parent) -Parent }
    else { throw 'Set JAVA_HOME to your installed Java 21 JDK, or add its bin directory to PATH.' }
}
if (!(Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'JAVA_HOME must point to a JDK directory containing bin/java.exe.' }
$PgBin = if (Test-Path '.tools/postgres/bin/pg_ctl.exe') { Join-Path $ProjectRoot '.tools/postgres/bin' } else { Split-Path (Get-Command pg_ctl.exe -ErrorAction Stop).Source }
$Maven = if (Test-Path '.tools/apache-maven-3.9.11/bin/mvn.cmd') { Join-Path $ProjectRoot '.tools/apache-maven-3.9.11/bin/mvn.cmd' } else { (Get-Command mvn.cmd -ErrorAction Stop).Source }
$Npm = if (Test-Path '.tools/package/bin/npm-cli.js') { Join-Path $ProjectRoot '.tools/package/bin/npm-cli.js' } else { $null }
