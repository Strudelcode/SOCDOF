import { sounds } from './sound';
import { db } from './db';
import { APP_VERSION } from './version';

export interface WindowsInstallerConfig {
  installPath?: string;
  createDesktopShortcut?: boolean;
  createStartMenuShortcut?: boolean;
  createDataFolders?: boolean;
}

export const DEFAULT_INSTALL_CONFIG: WindowsInstallerConfig = {
  installPath: 'C:\\SOCDOF',
  createDesktopShortcut: true,
  createStartMenuShortcut: true,
  createDataFolders: true,
};

/**
 * Converts a UTF-8 string to a UTF-16LE Base64 string for PowerShell -EncodedCommand
 */
function toUtf16LeBase64(str: string): string {
  const codeUnits = new Uint16Array(str.length);
  for (let i = 0; i < str.length; i++) {
    codeUnits[i] = str.charCodeAt(i);
  }
  const bytes = new Uint8Array(codeUnits.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Pure, clean PowerShell script that opens a native Windows FolderBrowserDialog,
 * creates directory structure, app config, local desktop launcher, and desktop shortcut.
 */
export function getPowerShellInstallerCode(version: string = APP_VERSION): string {
  return `# ============================================================================
# SOCDOF - Windows Desktop Setup & Installation Wizard
# Strudel's Organization, Commerce & Documentation Offline Flow
# Version: ${version} | 100% Lokale Offline-Ausführung
# ============================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  SOCDOF Windows Desktop Setup (v${version})" -ForegroundColor Yellow
Write-Host "  Strudel's Organization, Commerce & Documentation Offline Flow" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[*] Oeffne grafisches Windows-Ordnerauswahl-Fenster..." -ForegroundColor White
Write-Host "    Bitte waehlen Sie im Dialog Ihren gewuenschten Zielordner aus." -ForegroundColor Gray
Write-Host ""

$folderDialog = New-Object System.Windows.Forms.FolderBrowserDialog
$folderDialog.Description = "Wählen Sie den Installationsordner für SOCDOF (z. B. C:\\SOCDOF oder D:\\Programme\\SOCDOF):"
$folderDialog.ShowNewFolderButton = $true
$folderDialog.SelectedPath = "C:\\SOCDOF"

$result = $folderDialog.ShowDialog()

if ($result -ne [System.Windows.Forms.DialogResult]::OK -or [string]::IsNullOrWhiteSpace($folderDialog.SelectedPath)) {
    Write-Host "[!] Keine Ordnerauswahl getroffen oder abgebrochen." -ForegroundColor Yellow
    [System.Windows.Forms.MessageBox]::Show("Die Installation wurde abgebrochen. Es wurden keine Dateien angelegt.", "SOCDOF Setup", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    exit 0
}

$targetDir = $folderDialog.SelectedPath
Write-Host "[OK] Gewaehlter Installationspfad: $targetDir" -ForegroundColor Green
Write-Host ""

# 1. Create directory hierarchy
Write-Host "[+] Erstelle Ordnerstruktur..." -ForegroundColor White
$dataDir = Join-Path $targetDir "Data"
$backupDir = Join-Path $targetDir "Backups"
$exportDir = Join-Path $targetDir "Exports"
$configDir = Join-Path $targetDir "Config"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

Write-Host "    • Data:    $dataDir" -ForegroundColor Gray
Write-Host "    • Backups: $backupDir" -ForegroundColor Gray
Write-Host "    • Exports: $exportDir" -ForegroundColor Gray
Write-Host "    • Config:  $configDir" -ForegroundColor Gray

# 2. Write local config JSON
$configJson = @"
{
  "appName": "SOCDOF",
  "version": "${version}",
  "installPath": "$($targetDir -replace '\\\\', '\\\\')",
  "dataPath": "$($dataDir -replace '\\\\', '\\\\')",
  "backupPath": "$($backupDir -replace '\\\\', '\\\\')",
  "exportPath": "$($exportDir -replace '\\\\', '\\\\')",
  "installedAt": "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}
"@
Set-Content -Path (Join-Path $configDir "app_config.json") -Value $configJson -Encoding UTF8

# 3. Create desktop launcher BAT
$launcherBat = Join-Path $targetDir "SOCDOF_Starten.bat"
$launcherContent = @"
@echo off
title SOCDOF - Windows Desktop Suite
cls
echo ============================================================================
echo   Starte SOCDOF Windows Desktop Suite...
echo   Pfad: $targetDir
echo ============================================================================
echo.
start msedge.exe --app="https://strudelcode.github.io/SOCDOF/" --window-size=1360,900
if %ERRORLEVEL% NEQ 0 (
    start chrome.exe --app="https://strudelcode.github.io/SOCDOF/" --window-size=1360,900
)
if %ERRORLEVEL% NEQ 0 (
    start "" "https://strudelcode.github.io/SOCDOF/"
)
exit
"@
Set-Content -Path $launcherBat -Value $launcherContent -Encoding UTF8

# 4. Create Desktop Shortcut (.lnk)
try {
    $wsh = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktopPath "SOCDOF Desktop.lnk"
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $launcherBat
    $shortcut.WorkingDirectory = $targetDir
    $shortcut.Description = "SOCDOF Windows Desktop ERP Suite"
    $shortcut.Save()
    Write-Host "[+] Desktop-Verknuepfung 'SOCDOF Desktop.lnk' erfolgreich erstellt." -ForegroundColor Green
} catch {
    Write-Host "[!] Desktop-Verknuepfung konnte nicht automatisch angelegt werden: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "  Installation erfolgreich abgeschlossen!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
Write-Host ""

[System.Windows.Forms.MessageBox]::Show("SOCDOF v${version} wurde erfolgreich installiert in:\`n\`n$targetDir\`n\`nOrdner eingerichtet:\`n• \\Data\`n• \\Backups\`n• \\Exports\`n• \\Config\`n\`nEine Desktop-Verknüpfung wurde auf Ihrem Desktop angelegt!", "SOCDOF Installation Abgeschlossen", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)

Start-Process -FilePath $launcherBat
`;
}

/**
 * Builds the Windows Setup .cmd / .bat script content using PowerShell -EncodedCommand.
 * This completely avoids cmd.exe syntax errors, quoting bugs, or premature window closing.
 */
export function generateWindowsSetupScript(version: string = APP_VERSION): string {
  const psCode = getPowerShellInstallerCode(version);
  const encodedPs = toUtf16LeBase64(psCode);

  return `@echo off
setlocal EnableDelayedExpansion
title SOCDOF Windows Setup & Installations-Assistent (v${version})
color 1F
cls

echo ============================================================================
echo   SOCDOF Windows Desktop Setup (v${version})
echo   Strudel's Organization, Commerce & Documentation Offline Flow
echo ============================================================================
echo.
echo   [*] Starte Windows Setup-Assistent...
echo   [*] Oeffne grafischen Windows-Ordnerauswahldialog...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedPs}

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Das Setup-Fenster wurde beendet oder abgebrochen.
) else (
    echo.
    echo [OK] Setup erfolgreich durchgefuehrt!
)

echo.
echo Druecken Sie eine beliebige Taste zum Beenden...
pause >nul
exit /b
`;
}

/**
 * Downloads Setup_SOCDOF_Windows.cmd
 */
export async function downloadWindowsInstallerCmd() {
  sounds.playSuccess();
  const scriptContent = generateWindowsSetupScript(APP_VERSION);
  const blob = new Blob([scriptContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Setup_SOCDOF_Windows.cmd';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads Setup_SOCDOF_Windows.bat
 */
export async function downloadWindowsInstallerBat() {
  sounds.playSuccess();
  const scriptContent = generateWindowsSetupScript(APP_VERSION);
  const blob = new Blob([scriptContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Setup_SOCDOF_Windows.bat';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a PowerShell Graphical Setup Wizard with Windows folder picker dialog (.ps1)
 */
export function downloadPowerShellSetupWizard() {
  sounds.playSuccess();
  const psScript = getPowerShellInstallerCode(APP_VERSION);
  const blob = new Blob([psScript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Install_SOCDOF_Wizard.ps1';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const OFFICIAL_RELEASE_EXE_URL = 'https://github.com/Strudelcode/SOCDOF/releases/download/v18/SOCDOF.Setup.18.3.5.exe';
export const OFFICIAL_RELEASES_PAGE_URL = 'https://github.com/Strudelcode/SOCDOF/releases';

export function downloadWindowsExecutablePackage() {
  sounds.playSuccess();
  window.open(OFFICIAL_RELEASE_EXE_URL, '_blank');
}

export function downloadWindowsInstallerPackage(config?: WindowsInstallerConfig) {
  downloadWindowsInstallerCmd();
}
