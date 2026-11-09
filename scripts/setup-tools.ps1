# Optional Windows native development, without Docker or administrator changes.
# Downloads stay under .tools; no PATH or system configuration changes are made.
$ErrorActionPreference='Stop'
$ProjectRoot=Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot
New-Item -ItemType Directory -Force .tools | Out-Null
$ProgressPreference='SilentlyContinue'
function Get-VerifiedFile($Url,$Destination,$HashUrl,$Algorithm) {
    Invoke-WebRequest $Url -OutFile $Destination
    $Expected=((Invoke-WebRequest $HashUrl).Content -split '\s+')[0].ToLower()
    $Actual=(Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash.ToLower()
    if ($Expected -ne $Actual) { throw "Checksum mismatch for $Destination" }
}
if (!(Test-Path '.tools/apache-maven-3.9.11')) {
    $MavenUrl='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip'
    Get-VerifiedFile $MavenUrl '.tools/maven.zip' "$MavenUrl.sha512" 'SHA512'
    Expand-Archive .tools/maven.zip .tools -Force
}
if (!(Test-Path '.tools/package/bin/npm-cli.js') -and !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    $NpmPackage=Invoke-RestMethod 'https://registry.npmjs.org/npm/11.6.2'
    Invoke-WebRequest $NpmPackage.dist.tarball -OutFile .tools/npm.tgz
    $ActualIntegrity='sha512-'+[Convert]::ToBase64String([Security.Cryptography.SHA512]::HashData([IO.File]::ReadAllBytes("$ProjectRoot/.tools/npm.tgz")))
    if ($ActualIntegrity -ne $NpmPackage.dist.integrity) { throw 'npm integrity check failed' }
    tar -xf .tools/npm.tgz -C .tools
    if ($LASTEXITCODE -ne 0) { throw 'npm extraction failed' }
}
if (!(Test-Path '.tools/postgres/bin/postgres.exe')) {
    $PgUrl='https://repo.maven.apache.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-windows-amd64/17.11.0/embedded-postgres-binaries-windows-amd64-17.11.0.jar'
    Get-VerifiedFile $PgUrl '.tools/postgres.jar' "$PgUrl.sha256" 'SHA256'
    tar -xf .tools/postgres.jar -C .tools postgres-windows-x86_64.txz
    New-Item -ItemType Directory -Force .tools/postgres | Out-Null
    $PythonExecutable = if ($env:PYTHON) { $env:PYTHON } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) { (Get-Command python.exe).Source } else { $null }
    if(!$PythonExecutable){throw 'Install Python 3.12+ or set PYTHON to its executable to extract portable PostgreSQL.'}
    & $PythonExecutable -c "import tarfile; tarfile.open('.tools/postgres-windows-x86_64.txz').extractall('.tools/postgres',filter='data')"
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL extraction failed' }
}
Write-Output 'Native tools are ready. Set JAVA_HOME to Java 21, then run ./scripts/dev.ps1.'
