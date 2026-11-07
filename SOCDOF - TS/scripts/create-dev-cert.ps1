<#
.SYNOPSIS
  Generates a local self-signed Code Signing certificate for SOCDOF Desktop Suite (Yuri / Strudel - Strudelcode)
  and installs it into the Windows Certificate Store (Trusted Root) to bypass Windows SmartScreen warnings.

.DESCRIPTION
  This script creates an authentic Authenticode Code Signing certificate with SHA256 hashing
  and 2048-bit RSA key, valid for 5 years. It exports both .pfx (for signing) and .cer (for distribution/trust).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\create-dev-cert.ps1
#>

[CmdletBinding()]
param (
    [string]$PublisherName = "Yuri / Strudel",
    [string]$Organization = "Strudelcode",
    [string]$CertPassword = "socdof-developer",
    [string]$OutputDir = "$PSScriptRoot\..\certs"
)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " SOCDOF Developer Code-Signing Certificate Generator" -ForegroundColor Cyan
Write-Host " Publisher: $PublisherName ($Organization)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# 1. Create output directory if not exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$PfxPath = Join-Path $OutputDir "socdof-developer.pfx"
$CerPath = Join-Path $OutputDir "socdof-developer.cer"

Write-Host "[1/3] Generating self-signed Code Signing certificate..." -ForegroundColor Yellow

$subject = "CN=$PublisherName, O=$Organization, OU=Development, C=DE"
$validYears = 5

try {
    # Generate Code Signing Certificate in CurrentUser\My
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $subject `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears($validYears) `
        -FriendlyName "SOCDOF Desktop Authenticode Signature ($PublisherName)"

    Write-Host "      Certificate created successfully!" -ForegroundColor Green
    Write-Host "      Thumbprint: $($cert.Thumbprint)" -ForegroundColor DarkGray

    # 2. Export PFX and CER
    Write-Host "[2/3] Exporting certificate files to $OutputDir..." -ForegroundColor Yellow
    $securePassword = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $PfxPath -Password $securePassword | Out-Null
    Export-Certificate -Cert $cert -FilePath $CerPath | Out-Null

    Write-Host "      PFX (for signing): $PfxPath" -ForegroundColor Green
    Write-Host "      CER (for trust):   $CerPath" -ForegroundColor Green

    # 3. Prompt or auto-install to Trusted Root Certification Authorities
    Write-Host "[3/3] Installing to Trusted Root Certification Authorities (Current User)..." -ForegroundColor Yellow
    
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()

    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host " SUCCESS: Developer certificate installed and ready!" -ForegroundColor Green
    Write-Host " Windows SmartScreen will now recognize your signed .exe binaries without warnings." -ForegroundColor Green
    Write-Host "===========================================================" -ForegroundColor Green
}
catch {
    Write-Error "Failed to generate or install certificate: $_"
}
