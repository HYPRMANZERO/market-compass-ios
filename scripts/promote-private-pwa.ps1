# Safe static-only promotion to the existing authenticated HYPRBOX gateway.
# Reads pwaDist only. Never changes OAuth, ngrok, local AI, or browser vaults.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CandidateDir
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$cfgPath = Join-Path $env:LOCALAPPDATA 'MarketCompass\PrivateAI\gateway-settings.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { throw 'Gateway configuration missing.' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$active = [IO.Path]::GetFullPath([string]$cfg.pwaDist).TrimEnd('\')
$candidate = [IO.Path]::GetFullPath($CandidateDir).TrimEnd('\')
if (-not (Test-Path -LiteralPath $active -PathType Container) -or
    -not (Test-Path -LiteralPath $candidate -PathType Container) -or
    $active -eq $candidate -or $candidate.StartsWith($active + '\')) {
    throw 'Invalid release candidate or protected live destination.'
}
$indexFile = Join-Path $candidate 'index.html'
$swFile = Join-Path $candidate 'sw.js'
$manifestFile = Join-Path $candidate 'manifest.webmanifest'
foreach($f in @($indexFile,$swFile,$manifestFile)) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { throw 'Candidate shell incomplete.' }
}
$index = Get-Content -LiteralPath $indexFile -Raw
$sw = Get-Content -LiteralPath $swFile -Raw
if ($index -notmatch '/market-compass-ios/assets/(?:index|main)-[A-Za-z0-9_-]+\.js' -or
    $index -notmatch '/market-compass-ios/manifest.webmanifest' -or
    $sw -match '__PRECACHE_JSON__|__BUILD_ID__' -or
    $sw -notmatch 'notificationclick') {
    throw 'Candidate has incorrect base path or unprepared service worker.'
}
$existingIndex = Get-Content (Join-Path $active 'index.html') -Raw
if ($existingIndex -notmatch '/market-compass-ios/assets/(?:index|main)-[A-Za-z0-9_-]+\.js') {
    throw 'Unexpected live base path; refusing promotion.'
}
$time = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path (Split-Path $active -Parent) ('public-before-finance-ux-' + $time)
if (Test-Path -LiteralPath $backup) { throw 'Backup path collision.' }
# Entire old static bundle saved outside the active directory, including its
# previous service worker and hashed assets for exact rollback.
Copy-Item -LiteralPath $active -Destination $backup -Recurse -Force
if (-not (Test-Path -LiteralPath (Join-Path $backup 'index.html'))) {
    throw 'Could not verify the protected static backup.'
}
$before = (Get-FileHash -LiteralPath (Join-Path $active 'index.html') -Algorithm SHA256).Hash
$copied = (Get-FileHash -LiteralPath (Join-Path $backup 'index.html') -Algorithm SHA256).Hash
if ($before -ne $copied) { throw 'Backup verification failed; live build untouched.' }
try {
    # Copy all supporting static files first; leave existing hashed assets for
    # already-running clients and do not delete anything from the live tree.
    foreach($item in (Get-ChildItem -LiteralPath $candidate -Recurse -File)) {
        $relative = $item.FullName.Substring($candidate.Length).TrimStart('\')
        if ($relative -in @('index.html','sw.js','404.html')) { continue }
        $destination = Join-Path $active $relative
        $parent = Split-Path $destination -Parent
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
    }
    # Publish the new entry last, after all its referenced assets exist.
    Copy-Item -LiteralPath $indexFile -Destination (Join-Path $active 'index.html') -Force
    Copy-Item -LiteralPath $indexFile -Destination (Join-Path $active '404.html') -Force
    Copy-Item -LiteralPath $swFile -Destination (Join-Path $active 'sw.js') -Force
    $after = (Get-FileHash -LiteralPath (Join-Path $active 'index.html') -Algorithm SHA256).Hash
    $expected = (Get-FileHash -LiteralPath $indexFile -Algorithm SHA256).Hash
    if($after -ne $expected) { throw 'Promoted index hash did not match candidate.' }
    Write-Output 'PRIVATE STATIC PROMOTION PASS: hashed assets, index and service worker installed.'
    Write-Output ('Previous static rollback: ' + $backup)
} catch {
    Copy-Item -LiteralPath (Join-Path $backup 'index.html') -Destination (Join-Path $active 'index.html') -Force
    Copy-Item -LiteralPath (Join-Path $backup 'sw.js') -Destination (Join-Path $active 'sw.js') -Force
    if (Test-Path -LiteralPath (Join-Path $backup '404.html')) {
        Copy-Item -LiteralPath (Join-Path $backup '404.html') -Destination (Join-Path $active '404.html') -Force
    }
    throw
}
