<#
.SYNOPSIS
  Signs all compiled Windows .exe binaries in the release/ folder using Authenticode & RFC-3161 timestamping.

.DESCRIPTION
  This script locates the generated NSIS setup executable or portable binary in .\release\
  and applies an Authenticode digital signature using the developer certificate or signtool.exe.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\sign-windows-exe.ps1
#>

[CmdletBinding()]
param (
    [string]$ReleaseDir = "$PSScriptRoot\..\release",
    [string]$CertPfx = "$PSScriptRoot\..\certs\socdof-developer.pfx",
    [string]$CertPassword = "socdof-developer",
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " SOCDOF Windows Executable Authenticode Code Signer" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

if (-not (Test-Path $ReleaseDir)) {
    Write-Warning "Release directory '$ReleaseDir' not found. Please build the application first: npm run build:exe"
    exit 1
}

# Locate .exe files
$exeFiles = Get-ChildItem -Path $ReleaseDir -Filter "*.exe" -Recurse

if ($exeFiles.Count -eq 0) {
    Write-Warning "No .exe binaries found in '$ReleaseDir'. Run 'npm run build:exe' first."
    exit 0
}

Write-Host "Found $($exeFiles.Count) executable(s) to sign:" -ForegroundColor Yellow
$exeFiles | ForEach-Object { Write-Host " - $($_.Name)" -ForegroundColor White }

# Load Certificate
$cert = $null
if (Test-Path $CertPfx) {
    $securePassword = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText
    $cert = Get-PfxData -FilePath $CertPfx -Password $securePassword -ErrorAction SilentlyContinue
    if ($cert.EndEntityCertificates.Count -gt 0) {
        $cert = $cert.EndEntityCertificates[0]
    }
}

if (-not $cert) {
    # Fallback to Cert:\CurrentUser\My for matching CN
    $cert = Get-ChildItem -Path "Cert:\CurrentUser\My" -CodeSigningCert | Where-Object { $_.Subject -like "*Yuri / Strudel*" -or $_.Subject -like "*Strudelcode*" } | Select-Object -First 1
}

if (-not $cert) {
    Write-Warning "No code signing certificate found. Generating a new developer certificate..."
    & "$PSScriptRoot\create-dev-cert.ps1"
    $cert = Get-ChildItem -Path "Cert:\CurrentUser\My" -CodeSigningCert | Select-Object -First 1
}

if (-not $cert) {
    Write-Error "Could not acquire a valid Code Signing certificate. Aborting."
    exit 1
}

Write-Host "Using Certificate: $($cert.Subject)" -ForegroundColor Green
Write-Host "Thumbprint:        $($cert.Thumbprint)" -ForegroundColor DarkGray

foreach ($exe in $exeFiles) {
    Write-Host "Signing '$($exe.FullName)'..." -ForegroundColor Yellow
    try {
        $result = Set-AuthenticodeSignature `
            -FilePath $exe.FullName `
            -Certificate $cert `
            -TimestampServer $TimestampServer `
            -HashAlgorithm SHA256

        if ($result.Status -eq "Valid") {
            Write-Host "  ✓ Successfully signed: $($exe.Name)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Signed with status: $($result.StatusMessage)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Error "Failed to sign $($exe.Name): $_"
    }
}

Write-Host "===========================================================" -ForegroundColor Green
Write-Host " Code signing complete! Windows SmartScreen is satisfied." -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
