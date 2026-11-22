#requires -version 5.1
<#
.SYNOPSIS
  Authenticode-signs the native Windows executable and installer.

.DESCRIPTION
  SmartScreen warnings disappear only for binaries signed with a certificate that
  has reputation (EV certificate or Azure Trusted Signing). This script signs the
  given files when signing credentials are configured in the environment and does
  nothing (with a warning) when they are not, so unsigned release builds keep
  working.

  Supported configuration, in order of precedence:

    WINDOWS_CERTIFICATE            base64 of a .pfx file (secret)
    WINDOWS_CERTIFICATE_PASSWORD   password of that .pfx (secret)
    WINDOWS_CERTIFICATE_THUMBPRINT thumbprint of a certificate in the store

  The timestamp keeps signatures valid after the certificate expires.

.PARAMETER Paths
  Files to sign. Missing files are skipped with a warning.
#>
param(
  [Parameter(Mandatory = $true)][string[]]$Paths,
  [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Find-SignTool {
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $roots = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'),
    (Join-Path $env:ProgramFiles 'Windows Kits\10\bin')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($root in $roots) {
    $candidate = Get-ChildItem -LiteralPath $root -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  return $null
}

$files = @()
foreach ($path in $Paths) {
  if (Test-Path -LiteralPath $path) {
    $files += (Resolve-Path -LiteralPath $path).Path
  } else {
    Write-Warning "sign-windows-artifacts: skipping missing file $path"
  }
}
if ($files.Count -eq 0) {
  Write-Warning 'sign-windows-artifacts: nothing to sign'
  exit 0
}

$pfxSecret = $env:WINDOWS_CERTIFICATE
$pfxPassword = $env:WINDOWS_CERTIFICATE_PASSWORD
$thumbprint = $env:WINDOWS_CERTIFICATE_THUMBPRINT

if ([string]::IsNullOrWhiteSpace($pfxSecret) -and [string]::IsNullOrWhiteSpace($thumbprint)) {
  Write-Warning 'sign-windows-artifacts: no signing certificate configured (WINDOWS_CERTIFICATE or WINDOWS_CERTIFICATE_THUMBPRINT); leaving files unsigned. SmartScreen will warn for unsigned downloads.'
  exit 0
}

$signTool = Find-SignTool
if (-not $signTool) { throw 'signtool.exe was not found; install the Windows SDK signing tools' }

$arguments = @('sign', '/fd', 'sha256', '/td', 'sha256', '/tr', $TimestampUrl)
$tempCertificate = $null
try {
  if (-not [string]::IsNullOrWhiteSpace($pfxSecret)) {
    $tempCertificate = Join-Path ([System.IO.Path]::GetTempPath()) 'socdof-signing.pfx'
    [System.IO.File]::WriteAllBytes($tempCertificate, [Convert]::FromBase64String($pfxSecret))
    $arguments += @('/f', $tempCertificate)
    if (-not [string]::IsNullOrWhiteSpace($pfxPassword)) {
      $arguments += @('/p', $pfxPassword)
    }
  } else {
    $arguments += @('/sha1', $thumbprint, '/s', 'My')
  }

  foreach ($file in $files) {
    & $signTool @arguments $file
    if ($LASTEXITCODE -ne 0) { throw "signtool failed for $file (exit $LASTEXITCODE)" }
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid') {
      throw "signature for $file is $($signature.Status); expected Valid"
    }
    Write-Host ("signed {0} ({1})" -f (Split-Path -Leaf $file), $signature.SignerCertificate.Subject)
  }
} finally {
  if ($tempCertificate -and (Test-Path -LiteralPath $tempCertificate)) {
    Remove-Item -LiteralPath $tempCertificate -Force
  }
}
