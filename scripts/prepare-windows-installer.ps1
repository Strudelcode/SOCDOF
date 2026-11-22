#requires -version 5.1
<#
.SYNOPSIS
  Stages the WebView2 files the NSIS installer packs.

.DESCRIPTION
  crates/app/installer/native-windows.nsi packs both files from SOURCE_DIR:

    WebView2Loader.dll              next to socdof-ui-desktop.exe (the app imports it)
    MicrosoftEdgeWebview2Setup.exe  the Evergreen bootstrapper the setup runs

  A plain `cargo build` produces neither, so the installer build fails with
  "File: failed opening file" on a clean runner. This script downloads both with
  pinned SHA-256 checksums into the given directory (normally target/release).

.PARAMETER SourceDir
  Directory that already contains socdof-ui-desktop.exe and receives both files.
#>
param(
  [Parameter(Mandatory = $true)][string]$SourceDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$loaderVersion = '1.0.2903.40'
$loaderSha256 = '462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf'
$bootstrapperUrl = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
$bootstrapperSha256 = 'fc2972da71d43e0c57b8d85a5cb9b200ed221f723cf43052d08ca722eb0bb22e'

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "source directory does not exist: $SourceDir"
}
$SourceDir = (Resolve-Path -LiteralPath $SourceDir).Path
if (-not (Test-Path -LiteralPath (Join-Path $SourceDir 'socdof-ui-desktop.exe'))) {
  throw "socdof-ui-desktop.exe is missing in $SourceDir; build the native executable first"
}

$cache = Join-Path ([System.IO.Path]::GetTempPath()) 'socdof-webview2'
New-Item -ItemType Directory -Force -Path $cache | Out-Null

function Assert-Hash {
  param([string]$Path, [string]$Expected, [string]$Label)
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Expected) {
    throw "$Label checksum mismatch: expected $Expected, got $actual"
  }
}

# WebView2Loader.dll comes from the pinned NuGet package, like the cross-build script.
$loader = Join-Path $SourceDir 'WebView2Loader.dll'
if (-not (Test-Path -LiteralPath $loader)) {
  $nupkg = Join-Path $cache "Microsoft.Web.WebView2.$loaderVersion.nupkg"
  if (-not (Test-Path -LiteralPath $nupkg)) {
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$loaderVersion" -OutFile $nupkg -UseBasicParsing
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($nupkg)
  try {
    $entry = $archive.Entries |
      Where-Object { $_.FullName -eq 'build/native/x64/WebView2Loader.dll' } |
      Select-Object -First 1
    if (-not $entry) {
      throw "build/native/x64/WebView2Loader.dll not found in $nupkg"
    }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $loader, $true)
  } finally {
    $archive.Dispose()
  }
}
Assert-Hash -Path $loader -Expected $loaderSha256 -Label 'WebView2Loader.dll'

# Evergreen bootstrapper: the setup runs it silently when the runtime is missing.
$bootstrapper = Join-Path $SourceDir 'MicrosoftEdgeWebview2Setup.exe'
if (-not (Test-Path -LiteralPath $bootstrapper)) {
  Invoke-WebRequest -Uri $bootstrapperUrl -OutFile $bootstrapper -UseBasicParsing
}
Assert-Hash -Path $bootstrapper -Expected $bootstrapperSha256 -Label 'MicrosoftEdgeWebview2Setup.exe'

Write-Host "WebView2 files ready in $SourceDir"
Get-ChildItem -LiteralPath $SourceDir -File |
  Where-Object { $_.Name -in @('socdof-ui-desktop.exe', 'WebView2Loader.dll', 'MicrosoftEdgeWebview2Setup.exe') } |
  ForEach-Object { Write-Host ("  {0,-32} {1,10} bytes" -f $_.Name, $_.Length) }
