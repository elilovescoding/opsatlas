. "$PSScriptRoot/native-db.ps1"
function Start-LocalProcess($Name,$Executable,$Arguments,$Directory) {
    $PidFile=Join-Path $ProjectRoot ".runtime/$Name.pid"
    if (Test-Path $PidFile) {
        $ExistingProcess=Get-Process -Id ([int](Get-Content $PidFile)) -ErrorAction SilentlyContinue
        if ($ExistingProcess) { Write-Output "$Name is already running."; return }
    }
    $Child=Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput "$ProjectRoot/.runtime/$Name.log" -RedirectStandardError "$ProjectRoot/.runtime/$Name-error.log"
    $Child.Id | Set-Content $PidFile
}
& $Maven -B -ntp -f backend/pom.xml package -DskipTests
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
if (!(Test-Path frontend/node_modules)) {
    if ($Npm) { & node $Npm ci --prefix frontend --no-fund }
    else { & npm.cmd ci --prefix frontend --no-fund }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
}
$Node=(Get-Command node.exe).Source
Start-LocalProcess 'targets' $Node @('scripts/demo-targets.mjs') $ProjectRoot
if (!(Test-Path .runtime/backend.pid)) { Copy-Item -LiteralPath backend/target/opsatlas-1.0.0.jar -Destination .runtime/opsatlas.jar -Force }
Start-LocalProcess 'backend' "$env:JAVA_HOME/bin/java.exe" @('-Xmx512m','-jar','.runtime/opsatlas.jar') $ProjectRoot
Start-LocalProcess 'frontend' $Node @('node_modules/vite/bin/vite.js','--host','127.0.0.1') "$ProjectRoot/frontend"
Write-Output 'OpsAtlas: http://127.0.0.1:5173 — startup may take 20 seconds. Local credentials are in .env.'
