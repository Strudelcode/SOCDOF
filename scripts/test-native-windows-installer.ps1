param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$smokeRoot = Join-Path $env:RUNNER_TEMP 'SOCDOF Native Installer Smoke'
$installDir = Join-Path $smokeRoot 'Custom Install Location'
$dataDir = Join-Path $env:APPDATA 'SOCDOF'
$dataMarker = Join-Path $dataDir 'installer-smoke-preservation.txt'
$programsDir = [Environment]::GetFolderPath('Programs')
$startMenuDir = Join-Path $programsDir 'SOCDOF'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SOCDOF.lnk'
$startupDir = [Environment]::GetFolderPath('Startup')
$startupLink = Join-Path $startupDir 'SOCDOF.lnk'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SOCDOF Native'
$installed = $false

function Invoke-Nsis {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Arguments
    )
    $process = Start-Process -FilePath $Path -ArgumentList $Arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Installer process failed with exit code $($process.ExitCode): $Path"
    }
}

try {
    if (Test-Path -LiteralPath $smokeRoot) {
        Remove-Item -LiteralPath $smokeRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $smokeRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Set-Content -LiteralPath $dataMarker -Value 'SOCDOF user data must survive uninstall.' -Encoding UTF8

    # /D must be the final NSIS argument. Its value deliberately contains spaces.
    Invoke-Nsis -Path $installer -Arguments "/S /D=$installDir"
    $installed = $true

    $exe = Join-Path $installDir 'socdof-ui-desktop.exe'
    $uninstaller = Join-Path $installDir 'Uninstall.exe'
    if (-not (Test-Path -LiteralPath $exe)) { throw "Native executable was not installed: $exe" }
    if ((Get-Item -LiteralPath $exe).Length -lt 1MB) { throw 'Installed native executable is implausibly small.' }
    if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Uninstaller was not installed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $startMenuDir 'SOCDOF.lnk'))) { throw 'Start Menu shortcut is missing.' }
    if (-not (Test-Path -LiteralPath $desktopLink)) { throw 'Desktop shortcut is missing.' }

    $registration = Get-ItemProperty -LiteralPath $uninstallKey
    if ($registration.InstallLocation -ne $installDir) { throw "Uninstall registration points to '$($registration.InstallLocation)' instead of '$installDir'." }
    if ([string]::IsNullOrWhiteSpace($registration.UninstallString)) { throw 'Uninstall command is missing from the registry.' }

    # The installed binary must at least start its native command-line entry point successfully.
    $help = Start-Process -FilePath $exe -ArgumentList '--help' -Wait -PassThru
    if ($help.ExitCode -ne 0) { throw "Installed executable --help failed with exit code $($help.ExitCode)." }

    # Simulate an existing user's opt-in and verify that an upgrade preserves it.
    New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
    Set-Content -LiteralPath $startupLink -Value 'existing startup preference' -Encoding ASCII
    New-ItemProperty -LiteralPath $uninstallKey -Name 'StartWithWindows' -Value 1 -PropertyType DWord -Force | Out-Null
    Invoke-Nsis -Path $installer -Arguments "/S /D=$installDir"
    if (-not (Test-Path -LiteralPath $startupLink)) { throw 'Upgrade removed the existing startup shortcut.' }
    $registration = Get-ItemProperty -LiteralPath $uninstallKey
    if ($registration.StartWithWindows -ne 1) { throw 'Upgrade did not preserve the startup preference.' }

    Invoke-Nsis -Path $uninstaller -Arguments '/S'
    $installed = $false

    if (Test-Path -LiteralPath $exe) { throw 'Uninstall left the native executable behind.' }
    if (Test-Path -LiteralPath $desktopLink) { throw 'Uninstall left the Desktop shortcut behind.' }
    if (Test-Path -LiteralPath (Join-Path $startMenuDir 'SOCDOF.lnk')) { throw 'Uninstall left the Start Menu shortcut behind.' }
    if (Test-Path -LiteralPath $startupLink) { throw 'Uninstall left the startup shortcut behind.' }
    if (Test-Path -LiteralPath $uninstallKey) { throw 'Uninstall left its registry entry behind.' }
    if (-not (Test-Path -LiteralPath $dataMarker)) { throw 'Uninstall removed user data from AppData.' }

    Write-Host 'Native Windows installer smoke passed: custom path, executable, shortcuts, registry, upgrade preference and AppData preservation.'
}
finally {
    # Clean only the test marker; never remove the user's SOCDOF data directory.
    if (Test-Path -LiteralPath $dataMarker) {
        Remove-Item -LiteralPath $dataMarker -Force
    }
    if (Test-Path -LiteralPath $smokeRoot) {
        Remove-Item -LiteralPath $smokeRoot -Recurse -Force
    }
    if ($installed) {
        $fallbackUninstaller = Join-Path $installDir 'Uninstall.exe'
        if (Test-Path -LiteralPath $fallbackUninstaller) {
            try { Start-Process -FilePath $fallbackUninstaller -ArgumentList '/S' -Wait | Out-Null } catch { }
        }
    }
}
