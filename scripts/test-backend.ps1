. "$PSScriptRoot/native-db.ps1"
$env:TEST_DATABASE_URL='jdbc:postgresql://127.0.0.1:55432/opsatlas_test'
$env:TEST_DATABASE_USER=$env:DATABASE_USER
$env:TEST_DATABASE_PASSWORD=$env:DATABASE_PASSWORD
& $Maven -B -ntp -f backend/pom.xml verify
exit $LASTEXITCODE
