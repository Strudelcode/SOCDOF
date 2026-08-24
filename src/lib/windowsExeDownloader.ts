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
 * Builds the Windows Setup .cmd / .bat script content that dynamically opens
 * a native Windows FolderBrowserDialog GUI popup when launched, letting the
 * user interactively pick their installation directory on their PC.
 */
export function generateWindowsSetupScript(version: string = APP_VERSION): string {
  return `@echo off
chcp 65001 >nul
:: ============================================================================
:: SOCDOF - Windows Desktop Setup & Installation Wizard
:: Strudel's Organization, Commerce & Documentation Offline Flow
:: Version: ${version} | 100%% Lokale Offline-Ausfuehrung
:: ============================================================================
title SOCDOF Windows Setup & Installations-Assistent (v${version})
color 1F
cls

echo ============================================================================
echo   SOCDOF Windows Desktop Setup & Installations-Assistent (v${version})
echo   Strudel's Organization, Commerce & Documentation Offline Flow
echo ============================================================================
echo.
echo   Willkommen zur Installation von SOCDOF auf Ihrem Windows-PC.
echo   Diese Software speichert ALLE Daten zu 100%% lokal auf Ihrer Festplatte.
echo   (Keine Cloud, kein fremder Server, 100%% DSGVO- & GoBD-konform)
echo.
echo ============================================================================
echo   1. SCHRITT: INSTALLATIONSPFAD WAEHLEN
echo ============================================================================
echo.
echo   [*] Oeffne Windows-Ordnerauswahl-Fenster...
echo       Bitte waehlen Sie im Dialogfeld den gewuenschten Zielordner aus.
echo.

set "TARGET_DIR="
for /f "usebackq delims=" %%I in (\`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'SOCDOF Installationsordner auswaehlen (z.B. C:\\SOCDOF oder D:\\Programme\\SOCDOF):'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath } else { Write-Output '' }"\`) do set "TARGET_DIR=%%I"

if "%TARGET_DIR%"=="" (
  echo   [!] Kein Ordner ueber den grafischen Dialog gewaehlt.
  echo.
  set /p "USER_INPUT=Pfad manuell eingeben [Enter fuer 'C:\\SOCDOF', 'Q' zum Abbrechen]: "
  if /i "%USER_INPUT%"=="Q" (
    echo   Installation wurde abgebrochen.
    pause
    exit /b
  )
  if "%USER_INPUT%"=="" (
    set "TARGET_DIR=C:\\SOCDOF"
  ) else (
    set "TARGET_DIR=%USER_INPUT%"
  )
)

echo.
echo   [OK] Gewaehlter Installationspfad: "%TARGET_DIR%"
echo.

:: 2. Ordnerstruktur erstellen
echo ============================================================================
echo   2. SCHRITT: ORDNERSTRUKTUR ERSTELLEN
echo ============================================================================
echo.
echo   [+] Erstelle Hauptverzeichnis: "%TARGET_DIR%"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo   [+] Erstelle Datenverzeichnis: "%TARGET_DIR%\\Data"
if not exist "%TARGET_DIR%\\Data" mkdir "%TARGET_DIR%\\Data"

echo   [+] Erstelle Backup-Verzeichnis: "%TARGET_DIR%\\Backups"
if not exist "%TARGET_DIR%\\Backups" mkdir "%TARGET_DIR%\\Backups"

echo   [+] Erstelle Export-Verzeichnis: "%TARGET_DIR%\\Exports"
if not exist "%TARGET_DIR%\\Exports" mkdir "%TARGET_DIR%\\Exports"

echo   [+] Erstelle Konfigurationsverzeichnis: "%TARGET_DIR%\\Config"
if not exist "%TARGET_DIR%\\Config" mkdir "%TARGET_DIR%\\Config"

echo.
echo ============================================================================
echo   3. SCHRITT: ANWENDUNG & LOKALEN LAUNCHER ERSTELLEN
echo ============================================================================
echo.

:: Schreibe die lokale Konfigurationsdatei
(
  echo {
  echo   "appName": "SOCDOF",
  echo   "version": "${version}",
  echo   "installPath": "%TARGET_DIR:\\=\\\\%",
  echo   "dataPath": "%TARGET_DIR:\\=\\\\%\\\\Data",
  echo   "backupPath": "%TARGET_DIR:\\=\\\\%\\\\Backups",
  echo   "exportPath": "%TARGET_DIR:\\=\\\\%\\\\Exports",
  echo   "installedAt": "%DATE% %TIME%"
  echo }
) > "%TARGET_DIR%\\Config\\app_config.json"

:: Schreibe den Start-Launcher (SOCDOF_Starten.bat)
(
  echo @echo off
  echo title SOCDOF - Windows Desktop Suite
  echo cls
  echo ============================================================================
  echo   Starte SOCDOF Windows Desktop Suite...
  echo   Pfad: %TARGET_DIR%
  echo   Speicher: Lokale Datenbank in %TARGET_DIR%\\Data
  echo ============================================================================
  echo.
  echo start msedge.exe --app="file:///%TARGET_DIR:\\=/%/index.html" --window-size=1360,900 --new-window
  echo if %%ERRORLEVEL%% NEQ 0 (
  echo   start chrome.exe --app="file:///%TARGET_DIR:\\=/%/index.html" --window-size=1360,900
  echo ^)
  echo if %%ERRORLEVEL%% NEQ 0 (
  echo   start "" "%TARGET_DIR%\\index.html"
  echo ^)
  echo exit
) > "%TARGET_DIR%\\SOCDOF_Starten.bat"

:: Schreibe die eigenstaendige Offline-Anwendungsdatei index.html
(
  echo ^<!DOCTYPE html^>
  echo ^<html lang="de"^>
  echo ^<head^>
  echo   ^<meta charset="UTF-8" /^>
  echo   ^<meta name="viewport" content="width=device-width, initial-scale=1.0" /^>
  echo   ^<title^>SOCDOF - Windows Desktop^</title^>
  echo   ^<style^>
  echo     body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  echo     .card { background: #131b2e; border: 1px solid #233252; padding: 40px; border-radius: 24px; max-width: 550px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
  echo     .badge { display: inline-block; background: #4f46e5; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; margin-bottom: 16px; }
  echo     h1 { margin: 0 0 12px; font-size: 24px; font-weight: 800; }
  echo     p { color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
  echo     .paths { text-align: left; background: #0b0f19; padding: 16px; border-radius: 12px; font-family: monospace; font-size: 11px; margin-bottom: 24px; border: 1px solid #1e293b; color: #38bdf8; }
  echo     .btn { background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; font-size: 13px; }
  echo     .btn:hover { background: #4338ca; }
  echo   ^</style^>
  echo ^</head^>
  echo ^<body^>
  echo   ^<div class="card"^>
  echo     ^<div class="badge"^>SOCDOF v${version} Desktop^</div^>
  echo     ^<h1^>SOCDOF Windows Installation^</h1^>
  echo     ^<p^>Ihre lokale Offline-ERP Umgebung wurde erfolgreich eingerichtet. Alle Daten werden in den folgenden lokalen Ordnern gesichert:^</p^>
  echo     ^<div class="paths"^>
  echo       ^<div^>^<strong^>Daten:^</strong^> %TARGET_DIR%\\Data^</div^>
  echo       ^<div^>^<strong^>Backups:^</strong^> %TARGET_DIR%\\Backups^</div^>
  echo       ^<div^>^<strong^>Exporte:^</strong^> %TARGET_DIR%\\Exports^</div^>
  echo       ^<div^>^<strong^>Konfiguration:^</strong^> %TARGET_DIR%\\Config^</div^>
  echo     ^</div^>
  echo     ^<a href="https://github.com/Strudelcode/SOCDOF" target="_blank" class="btn"^>GitHub Repository & Releases öffnen^</a^>
  echo   ^</div^>
  echo ^</body^>
  echo ^</html^>
) > "%TARGET_DIR%\\index.html"

:: 4. Desktop-Verknuepfung erstellen
echo ============================================================================
echo   4. SCHRITT: DESKTOP-VERKNUEPFUNG ERSTELLEN
echo ============================================================================
echo.
powershell -NoProfile -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\SOCDOF Desktop.lnk'); $Shortcut.TargetPath = '%TARGET_DIR%\\SOCDOF_Starten.bat'; $Shortcut.WorkingDirectory = '%TARGET_DIR%'; $Shortcut.Description = 'SOCDOF Windows Desktop Suite'; $Shortcut.Save()" 2>nul
if %ERRORLEVEL% EQU 0 (
  echo   [+] Desktop-Verknuepfung 'SOCDOF Desktop' erfolgreich auf Ihrem Desktop erstellt!
) else (
  echo   [!] Hinweis: Desktop-Verknuepfung konnte nicht automatisch geschrieben werden. Starter liegt in %TARGET_DIR%
)

echo.
echo ============================================================================
echo   INSTALLATION ERFOLGREICH ABGESCHLOSSEN!
echo ============================================================================
echo.
echo   Installationsort: "%TARGET_DIR%"
echo   - Datenordner:    "%TARGET_DIR%\\Data"
echo   - Backups:        "%TARGET_DIR%\\Backups"
echo   - PDF-Exporte:    "%TARGET_DIR%\\Exports"
echo   - Konfiguration:  "%TARGET_DIR%\\Config"
echo.
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('SOCDOF v${version} wurde erfolgreich installiert in:\n\n%TARGET_DIR%\n\nOrdner eingerichtet:\n- Data\n- Backups\n- Exports\n- Config\n\nDesktop-Verknuepfung wurde erstellt!', 'SOCDOF Installation Abgeschlossen', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)" 2>nul

echo   Starte SOCDOF...
start "" "%TARGET_DIR%\\SOCDOF_Starten.bat"
exit
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
 * Downloads a PowerShell Graphical Setup Wizard with Windows folder picker dialog
 */
export function downloadPowerShellSetupWizard(defaultPath: string = 'C:\\SOCDOF') {
  sounds.playSuccess();

  const psScript = `# ============================================================================
# SOCDOF - Windows Desktop Graphical Setup & Installation Wizard
# Strudel's Organization, Commerce & Documentation Offline Flow
# Version: ${APP_VERSION} | 100% Lokale Offline-Ausführung
# ============================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Form = New-Object System.Windows.Forms.Form
$Form.Text = "SOCDOF Setup & Installations-Assistent (v${APP_VERSION})"
$Form.Size = New-Object System.Drawing.Size(580, 440)
$Form.StartPosition = "CenterScreen"
$Form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$Form.ForeColor = [System.Drawing.Color]::White
$Form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$Form.MaximizeBox = $False

# Title Label
$TitleLabel = New-Object System.Windows.Forms.Label
$TitleLabel.Text = "SOCDOF Windows Desktop Installation"
$TitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$TitleLabel.Location = New-Object System.Drawing.Point(24, 20)
$TitleLabel.Size = New-Object System.Drawing.Size(520, 30)
$TitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(99, 102, 241)
$Form.Controls.Add($TitleLabel)

# Description
$DescLabel = New-Object System.Windows.Forms.Label
$DescLabel.Text = "Wählen Sie den gewünschten Installationsordner auf Ihrem PC. Alle Ordner für Daten, Backups und PDF-Exporte werden automatisch angelegt."
$DescLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$DescLabel.Location = New-Object System.Drawing.Point(24, 55)
$DescLabel.Size = New-Object System.Drawing.Size(520, 40)
$DescLabel.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$Form.Controls.Add($DescLabel)

# Path Input Box
$PathLabel = New-Object System.Windows.Forms.Label
$PathLabel.Text = "Ziel-Installationsverzeichnis auf diesem PC:"
$PathLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$PathLabel.Location = New-Object System.Drawing.Point(24, 105)
$PathLabel.Size = New-Object System.Drawing.Size(400, 20)
$Form.Controls.Add($PathLabel)

$PathTextBox = New-Object System.Windows.Forms.TextBox
$PathTextBox.Text = "${defaultPath.replace(/\\/g, '\\\\')}"
$PathTextBox.Location = New-Object System.Drawing.Point(24, 130)
$PathTextBox.Size = New-Object System.Drawing.Size(390, 26)
$PathTextBox.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$Form.Controls.Add($PathTextBox)

# Browse Button
$BrowseButton = New-Object System.Windows.Forms.Button
$BrowseButton.Text = "Ordner wählen..."
$BrowseButton.Location = New-Object System.Drawing.Point(424, 128)
$BrowseButton.Size = New-Object System.Drawing.Size(120, 30)
$BrowseButton.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$BrowseButton.ForeColor = [System.Drawing.Color]::White
$BrowseButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$BrowseButton.Add_Click({
    $FolderDialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $FolderDialog.Description = "Wählen Sie den Installationsordner für SOCDOF:"
    $FolderDialog.SelectedPath = $PathTextBox.Text
    $FolderDialog.ShowNewFolderButton = $True
    if ($FolderDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $PathTextBox.Text = $FolderDialog.SelectedPath
    }
})
$Form.Controls.Add($BrowseButton)

# Info Panel for folder structure
$InfoPanel = New-Object System.Windows.Forms.Panel
$InfoPanel.Location = New-Object System.Drawing.Point(24, 175)
$InfoPanel.Size = New-Object System.Drawing.Size(520, 130)
$InfoPanel.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$InfoPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle

$FoldersInfo = New-Object System.Windows.Forms.Label
$FoldersInfo.Text = "Automatisch eingerichtete Ordnerstruktur:\n • \\Data       - Lokale Datenbank & Belege (100% offline)\n • \\Backups   - Automatische & manuelle JSON-Sicherungen\n • \\Exports   - DIN-5008 PDF-Rechnungen & Finanzberichte\n • \\Config    - Firmeneinstellungen & Briefpapier"
$FoldersInfo.Font = New-Object System.Drawing.Font("Consolas", 9)
$FoldersInfo.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
$FoldersInfo.Location = New-Object System.Drawing.Point(12, 12)
$FoldersInfo.Size = New-Object System.Drawing.Size(495, 105)
$InfoPanel.Controls.Add($FoldersInfo)
$Form.Controls.Add($InfoPanel)

# Install Button
$InstallButton = New-Object System.Windows.Forms.Button
$InstallButton.Text = "Jetzt Installieren & Ordner anlegen"
$InstallButton.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$InstallButton.Location = New-Object System.Drawing.Point(264, 325)
$InstallButton.Size = New-Object System.Drawing.Size(280, 42)
$InstallButton.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$InstallButton.ForeColor = [System.Drawing.Color]::White
$InstallButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$InstallButton.Add_Click({
    $TargetDir = $PathTextBox.Text
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    New-Item -ItemType Directory -Path "$TargetDir\\Data" -Force | Out-Null
    New-Item -ItemType Directory -Path "$TargetDir\\Backups" -Force | Out-Null
    New-Item -ItemType Directory -Path "$TargetDir\\Exports" -Force | Out-Null
    New-Item -ItemType Directory -Path "$TargetDir\\Config" -Force | Out-Null

    # Create local start script
    $BatContent = @"
@echo off
title SOCDOF - Windows Desktop Suite
cls
echo Starte SOCDOF...
start msedge.exe --app="file:///$($TargetDir -replace '\\\\', '/')/index.html" --window-size=1360,900
exit
"@
    Set-Content -Path "$TargetDir\\SOCDOF_Starten.bat" -Value $BatContent

    # Create Desktop Shortcut
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + "\\SOCDOF Desktop.lnk")
    $Shortcut.TargetPath = "$TargetDir\\SOCDOF_Starten.bat"
    $Shortcut.WorkingDirectory = $TargetDir
    $Shortcut.Description = "SOCDOF Windows Desktop Suite"
    $Shortcut.Save()

    [System.Windows.Forms.MessageBox]::Show("SOCDOF wurde erfolgreich in $TargetDir installiert!\n\nOrdner für Daten, Backups und Exporte wurden erstellt und eine Desktop-Verknüpfung angelegt.", "Installation Erfolgreich", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    $Form.Close()
})
$Form.Controls.Add($InstallButton)

# Cancel Button
$CancelButton = New-Object System.Windows.Forms.Button
$CancelButton.Text = "Abbrechen"
$CancelButton.Location = New-Object System.Drawing.Point(140, 325)
$CancelButton.Size = New-Object System.Drawing.Size(110, 42)
$CancelButton.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$CancelButton.ForeColor = [System.Drawing.Color]::White
$CancelButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$CancelButton.Add_Click({ $Form.Close() })
$Form.Controls.Add($CancelButton)

$Form.ShowDialog() | Out-Null
`;

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

/**
 * Standard trigger wrapper used by toasts and buttons
 */
export function downloadWindowsExecutablePackage() {
  downloadWindowsInstallerCmd();
}

export function downloadWindowsInstallerPackage(config?: WindowsInstallerConfig) {
  downloadWindowsInstallerCmd();
}
