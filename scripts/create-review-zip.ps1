param([string]$OutputDirectory)
# Source-only export. No Git metadata, .env files, installed tools, or runtime data.
$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
Push-Location $ProjectRoot
try {
    & node scripts/check-secrets.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Source guard failed; no archive was created.' }
    if (!$OutputDirectory) { $OutputDirectory = Join-Path $ProjectRoot '.review' }
    $OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
    [IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
    $Stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
    $ArchivePath = Join-Path $OutputDirectory "OpsAtlas-review-$Stamp.zip"
    $RootFiles = @('.gitignore','.gitattributes','AGENTS.md','LICENSE','README.md','SECURITY.md','docker-compose.yml','docker-compose.cloud.yml')
    $RootDirectories = @('.github','backend','config','docs','frontend','infrastructure','scripts')
    $Extensions = @('.md','.txt','.java','.sql','.xml','.yml','.yaml','.json','.ts','.tsx','.js','.mjs','.cjs','.css','.html','.svg','.png','.ps1','.sh','.tf','.hcl','.tftpl','.example','.conf')
    $Candidates = @(& git -c core.quotepath=false ls-files --cached --others --exclude-standard) | Sort-Object -Unique
    if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate intended source with Git.' }
    $Entries = [Collections.Generic.List[object]]::new()
    foreach ($RelativePath in $Candidates) {
        $Normalized = $RelativePath.Replace('\','/')
        $Parts = $Normalized.Split('/')
        $Leaf = $Parts[-1]
        if ($Parts | Where-Object { $_ -in @('.git','.tools','.runtime','.review','node_modules','target','dist','coverage','test-results','playwright-report','.terraform') }) { throw "Prohibited candidate: $Normalized" }
        if ($Leaf.StartsWith('.env') -or $Leaf -in @('.npmrc','.pypirc','.git-credentials','tfplan','plan.out','terraform.rc') -or $Leaf -match '\.(tfstate.*|tfvars|tfvars\.json|tfplan.*|plan|log|pem|key|p12|pfx|jks|keystore|db|sqlite3?|dump|backup|hprof|har|jar|class|exe|dll|zip|gz|tgz|txz|tsbuildinfo)$') { throw "Prohibited candidate: $Normalized" }
        if ($Parts.Count -eq 1) {
            if ($Normalized -notin $RootFiles) { throw "Unreviewed root file: $Normalized" }
        } elseif ($Parts[0] -notin $RootDirectories -or [IO.Path]::GetExtension($Leaf) -notin $Extensions -and $Leaf -notin @('Dockerfile','Caddyfile','.dockerignore','.prettierignore')) { throw "Unreviewed source file: $Normalized" }
        if ($Normalized.EndsWith('.sql') -and !$Normalized.StartsWith('backend/src/main/resources/db/migration/')) { throw "SQL outside migration directory: $Normalized" }
        if ($Normalized.EndsWith('.png') -and !$Normalized.StartsWith('docs/screenshots/')) { throw "Image outside screenshot directory: $Normalized" }
        $AbsolutePath = [IO.Path]::GetFullPath((Join-Path $ProjectRoot $Normalized))
        if (!$AbsolutePath.StartsWith($ProjectRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Candidate escaped the project root.' }
        $Item = Get-Item -LiteralPath $AbsolutePath
        if ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked file is not allowed: $Normalized" }
        $Entries.Add([ordered]@{path=$Normalized;bytes=$Item.Length;sha256=(Get-FileHash -LiteralPath $AbsolutePath -Algorithm SHA256).Hash.ToLowerInvariant()})
    }
    if ($Entries.Count -lt 20) { throw 'Incomplete source inventory.' }
    $Manifest = [ordered]@{format='opsatlas-source-review-v1';createdUtc=[DateTime]::UtcNow.ToString('o');license='MIT';sourceFileCount=$Entries.Count;files=$Entries}
    $ManifestJson = $Manifest | ConvertTo-Json -Depth 5
    $Stream = [IO.File]::Open($ArchivePath,[IO.FileMode]::CreateNew)
    try {
        $Archive = [IO.Compression.ZipArchive]::new($Stream,[IO.Compression.ZipArchiveMode]::Create,$true)
        try {
            foreach ($Entry in $Entries) {
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($Archive,(Join-Path $ProjectRoot $Entry.path),"opsatlas/$($Entry.path)",[IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
            $ManifestEntry = $Archive.CreateEntry('opsatlas/REVIEW-MANIFEST.json')
            $Writer = [IO.StreamWriter]::new($ManifestEntry.Open(),[Text.UTF8Encoding]::new($false))
            try { $Writer.Write($ManifestJson) } finally { $Writer.Dispose() }
        } finally { $Archive.Dispose() }
    } finally { $Stream.Dispose() }
    # Verify every entry against the source hash before reporting the export ready.
    $Archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        if ($Archive.Entries.Count -ne $Entries.Count + 1) { throw 'Archive entry count mismatch.' }
        foreach ($Entry in $Entries) {
            $Archived = $Archive.GetEntry("opsatlas/$($Entry.path)")
            if (!$Archived) { throw "Missing entry: $($Entry.path)" }
            $Data = $Archived.Open()
            try { $Actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Data)).ToLowerInvariant() } finally { $Data.Dispose() }
            if ($Actual -ne $Entry.sha256) { throw "Archive hash mismatch: $($Entry.path)" }
        }
    } finally { $Archive.Dispose() }
    $ManifestJson | Set-Content -LiteralPath ($ArchivePath + '.manifest.json') -Encoding utf8
    $Hash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    "$Hash  $([IO.Path]::GetFileName($ArchivePath))" | Set-Content -LiteralPath ($ArchivePath + '.sha256') -Encoding utf8
    [PSCustomObject]@{Archive=$ArchivePath;SourceFiles=$Entries.Count;Bytes=(Get-Item -LiteralPath $ArchivePath).Length;SHA256=$Hash;Verified=$true} | Format-List
} finally { Pop-Location }
