# Owner-operated static-only replacement. Run on HYPRBOX; no gateway restart.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Candidate,
 [switch]$Apply
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($env:COMPUTERNAME -ine 'HYPRBOX'){throw 'Run on HYPRBOX, the ngrok host.'}
$cfg=Join-Path $env:LOCALAPPDATA 'MarketCompass\PrivateAI\gateway-settings.json'
$config=Get-Content -LiteralPath $cfg -Raw|ConvertFrom-Json
if(!$config.pwaDist -or ![IO.Path]::IsPathRooted([string]$config.pwaDist)){throw 'Invalid configured gateway static directory.'}
$live=(Resolve-Path -LiteralPath $config.pwaDist).Path.TrimEnd('\')
$source=(Resolve-Path -LiteralPath $Candidate).Path.TrimEnd('\')
if($live -eq [IO.Path]::GetPathRoot($live).TrimEnd('\') -or $source -eq $live -or
 $source.StartsWith($live+'\',[StringComparison]::OrdinalIgnoreCase) -or
 $live.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Candidate and live directories must be separate non-root paths.'}
foreach($p in @($live,$source)){
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked directory rejected.'}
 foreach($f in @('index.html','sw.js','manifest.webmanifest')){
  if(!(Test-Path -LiteralPath (Join-Path $p $f) -PathType Leaf)){throw "Required PWA file missing: $f"}
 }
 if(@(Get-ChildItem -LiteralPath $p -Recurse -Force|Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count){throw 'Linked files/directories rejected.'}
}
$oldManifest=Get-Content -LiteralPath (Join-Path $live 'manifest.webmanifest') -Raw|ConvertFrom-Json
$newManifest=Get-Content -LiteralPath (Join-Path $source 'manifest.webmanifest') -Raw|ConvertFrom-Json
if($oldManifest.name -eq 'Compass Personal' -or $newManifest.name -ne 'Compass Financial Advisor'){throw 'Refusing to replace Personal or use non-Finance candidate.'}
$html=Get-Content -LiteralPath (Join-Path $source 'index.html') -Raw
$sw=Get-Content -LiteralPath (Join-Path $source 'sw.js') -Raw
if(!$html.Contains('<title>Compass Financial Advisor</title>') -or !$html.Contains('/market-compass-ios/assets/') -or $sw.Contains('__PRECACHE_JSON__') -or $sw.Contains('__BUILD_ID__')){throw 'Candidate build prefix, branding or offline shell invalid.'}
if(!(Select-String -Path (Join-Path $source 'assets\*.js') -SimpleMatch 'finance-material-dock' -Quiet)){throw 'Material UI dock is absent from candidate assets.'}
$listener=@(Get-NetTCPConnection -LocalPort 8790 -State Listen -ErrorAction SilentlyContinue)
if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1'){throw 'Expected one loopback Finance gateway on 8790.'}
$parent=Split-Path -Parent $live
$leaf=Split-Path -Leaf $live
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stage=Join-Path $parent ($leaf+'.mui-stage-'+$stamp)
$backup=Join-Path $parent ($leaf+'.before-mui-'+$stamp)
Write-Host "Finance live directory: $live"
Write-Host "Candidate directory: $source"
Write-Host "Gateway PID: $($listener[0].OwningProcess)"
Write-Host "Rollback directory: $backup"
if(!$Apply){Write-Host 'Preflight passed. No changes. Re-run with -Apply only after encrypted vault export and confirming the gateway uses this path.';return}
if((Read-Host 'Confirm encrypted vault backup and Finance-only static swap. Type APPLY') -cne 'APPLY'){throw 'Cancelled.'}
if((Test-Path $stage) -or (Test-Path $backup)){throw 'Backup/stage collision.'}
New-Item -ItemType Directory -Path $stage|Out-Null
Get-ChildItem -LiteralPath $source -Force|ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force}
# Keep old hashed bundles available for currently open tabs during the transition.
$oldAssets=Join-Path $live 'assets'
$newAssets=Join-Path $stage 'assets'
if(Test-Path -LiteralPath $oldAssets){
 foreach($asset in Get-ChildItem -LiteralPath $oldAssets -File -Recurse){
  $relative=$asset.FullName.Substring($oldAssets.Length).TrimStart('\')
  $target=Join-Path $newAssets $relative
  if(Test-Path -LiteralPath $target){
   if((Get-FileHash -LiteralPath $target).Hash -ne (Get-FileHash -LiteralPath $asset.FullName).Hash){throw 'Asset collision; live directory untouched.'}
  }else{
   New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force|Out-Null
   Copy-Item -LiteralPath $asset.FullName -Destination $target
  }
 }
}
# Same-volume directory renames. Short gap possible; restore on failed second rename.
Rename-Item -LiteralPath $live -NewName (Split-Path -Leaf $backup)
try{Rename-Item -LiteralPath $stage -NewName $leaf}
catch{
 Rename-Item -LiteralPath $backup -NewName $leaf
 throw 'Static swap failed; original directory restored.'
}
Write-Host 'Finance static swap complete. Gateway, model, ngrok and credentials unchanged.'
Write-Host "Rollback copy: $backup"
Write-Host 'Open the existing ngrok URL and confirm the Material UI dock. Do not clear browser data.'
