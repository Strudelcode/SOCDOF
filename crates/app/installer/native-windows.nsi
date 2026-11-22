Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "Sections.nsh"


!ifndef APP_VERSION
  !define APP_VERSION "26.0.0"
!endif
!ifndef SOURCE_DIR
  !define SOURCE_DIR "target\release"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "SOCDOF-${APP_VERSION}-windows-x64-native-setup.exe"
!endif

!define APP_NAME "SOCDOF"
!define APP_EXE "socdof-ui-desktop.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SOCDOF Native"

; WebView2 is a runtime dependency of the app. The Evergreen bootstrapper (~1.8 MB) is
; shipped instead of the offline runtime: it installs the current runtime per user and
; works without administrator rights, which matches the per-user setup below.
!define WEBVIEW2_CLIENT_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define WEBVIEW2_DOWNLOAD_URL "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
!define WEBVIEW2_BOOTSTRAPPER "MicrosoftEdgeWebview2Setup.exe"
!define SETUP_LOG "$TEMP\SOCDOF-Setup.log"

; Exit code of the bundled WebView2 bootstrapper, kept for the hint text.
Var BootstrapperExit

Name "${APP_NAME} ${APP_VERSION}"
Caption "${APP_NAME} ${APP_VERSION} Setup"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\SOCDOF"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "Yuri / Strudel"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Yuri / Strudel"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "FileDescription" "${APP_NAME} Native Desktop Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"

; Branding: the wizard uses the SOCDOF icon plus the same header, welcome and uninstall
; bitmaps that ship with the desktop application.
!define MUI_ICON "assets/icon.ico"
!define MUI_UNICON "assets/icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets/installerHeader.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "assets/installerHeader.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets/installerSidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets/uninstallerSidebar.bmp"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to SOCDOF"
!define MUI_WELCOMEPAGE_TEXT "This wizard installs the native SOCDOF desktop application for the current Windows user.$\r$\n$\r$\nYour business database remains in your Windows application-data folder and is not removed when you uninstall the application."
!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose the folder in which SOCDOF should be installed."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch SOCDOF now"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "SOCDOF application" SecMain
  SectionIn RO
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /oname=${APP_EXE} "${SOURCE_DIR}\${APP_EXE}"
  ; The executable imports this DLL, so the WebView2 loader has to sit next to it.
  File "/oname=WebView2Loader.dll" "${SOURCE_DIR}\WebView2Loader.dll"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\SOCDOF"
  CreateShortCut "$SMPROGRAMS\SOCDOF\SOCDOF.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\SOCDOF\Uninstall SOCDOF.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\SOCDOF.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME} (Native)"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Yuri / Strudel"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section /o "Start SOCDOF when I sign in" SecStartup
  SetShellVarContext current
  CreateDirectory "$SMSTARTUP"
  CreateShortCut "$SMSTARTUP\SOCDOF.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

; Appends $R9 to %TEMP%\SOCDOF-Setup.log so a silent run leaves a trace.
Function LogLine
  FileOpen $9 "${SETUP_LOG}" a
  FileSeek $9 0 END
  FileWrite $9 "$R9$\r$\n"
  FileClose $9
FunctionEnd

; Sets $0 to 1 when the Evergreen WebView2 runtime is installed.
Function DetectWebView2
  StrCpy $0 0
  SetRegView 64
  ReadRegStr $1 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_CLIENT_GUID}" "pv"
  StrCmp $1 "" 0 wv2_found
  SetRegView 32
  ReadRegStr $1 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_CLIENT_GUID}" "pv"
  StrCmp $1 "" 0 wv2_found
  ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_CLIENT_GUID}" "pv"
  StrCmp $1 "" 0 wv2_found
  IfFileExists "$PROGRAMFILES32\Microsoft\EdgeWebView\Application\*.*" wv2_found
  IfFileExists "$LOCALAPPDATA\Microsoft\EdgeWebView\Application\*.*" wv2_found
  Goto wv2_done
wv2_found:
  StrCpy $0 1
wv2_done:
  SetRegView 32
FunctionEnd

Function .onInit
  ; The app cannot start without WebView2. Install the runtime when it is missing and
  ; refuse to install an unusable application when that fails.
  InitPluginsDir
  Call DetectWebView2
  StrCmp $0 "1" webview2_ready
  StrCpy $R9 "webview2=missing"
  Call LogLine
  File /oname=$PLUGINSDIR\${WEBVIEW2_BOOTSTRAPPER} "${SOURCE_DIR}\${WEBVIEW2_BOOTSTRAPPER}"
  DetailPrint "Installing the Microsoft Edge WebView2 runtime..."
  nsExec::ExecToStack '"$PLUGINSDIR\${WEBVIEW2_BOOTSTRAPPER}" /silent /install'
  Pop $BootstrapperExit
  Pop $3
  StrCpy $R9 "webview2_bootstrapper_exit=$BootstrapperExit"
  Call LogLine
  Call DetectWebView2
  StrCmp $0 "1" webview2_ready
  StrCpy $R9 "webview2=still_missing_after_bootstrapper"
  Call LogLine
  IfSilent webview2_abort
  ; NSIS' MessageBox parent is the installer window, which does not exist yet at this
  ; point; Windows and Wine then leave the box unmapped, so it would block unseen.
  ; An ownerless message box is shown immediately.
  StrCpy $R9 "webview2=interactive_hint_shown"
  Call LogLine
  System::Call 'user32::MessageBoxW(p 0, w "SOCDOF needs the Microsoft Edge WebView2 runtime and it is not installed on this computer. The bundled installer could not add it (exit code $BootstrapperExit).$\r$\n$\r$\nInstall it from ${WEBVIEW2_DOWNLOAD_URL} and run this setup again.", w "${APP_NAME} ${APP_VERSION} Setup", i 0x00000010) i .r2'
  StrCpy $R9 "webview2=interactive_hint_dismissed_abort"
  Call LogLine
  Goto webview2_abort
webview2_abort:
  SetErrorLevel 3
  Abort
webview2_ready:
  ; Never force-kill the app during an update: the user may have unsaved form state.
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C ""$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /NH | "$SYSDIR\findstr.exe" /I /C:"${APP_EXE}"'
  Pop $0
  Pop $1
  StrCmp $0 "0" installer_app_running
  StrCmp $0 "1" installer_app_closed
  IfSilent installer_check_failed
  MessageBox MB_ICONSTOP|MB_OK "Could not check whether SOCDOF is running. Close it manually and retry."
installer_check_failed:
  Abort
installer_app_running:
  IfSilent installer_app_running_abort
  MessageBox MB_ICONEXCLAMATION|MB_OK "Close SOCDOF before installing or updating. The installer will not terminate the running application."
installer_app_running_abort:
  Abort
installer_app_closed:
  ; Restore the user's previous opt-in so upgrades do not silently disable startup.
  ReadRegDWORD $0 HKCU "${UNINSTALL_KEY}" "StartWithWindows"
  ${If} $0 == 1
    SectionSetFlags ${SecStartup} ${SF_SELECTED}
  ${Else}
    ; Migrate an existing shortcut from installer versions before the preference was stored.
    IfFileExists "$SMSTARTUP\SOCDOF.lnk" 0 +2
    SectionSetFlags ${SecStartup} ${SF_SELECTED}
  ${EndIf}
FunctionEnd

Function un.onInit
  ; Refuse to uninstall a running app instead of forcibly terminating it and risking unsaved work.
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C ""$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /NH | "$SYSDIR\findstr.exe" /I /C:"${APP_EXE}"'
  Pop $0
  Pop $1
  StrCmp $0 "0" uninstaller_app_running
  StrCmp $0 "1" uninstaller_app_closed
  IfSilent uninstaller_check_failed
  MessageBox MB_ICONSTOP|MB_OK "Could not check whether SOCDOF is running. Close it manually and retry."
uninstaller_check_failed:
  Abort
uninstaller_app_running:
  IfSilent uninstaller_app_running_abort
  MessageBox MB_ICONEXCLAMATION|MB_OK "Close SOCDOF before uninstalling. The uninstaller will not terminate the running application."
uninstaller_app_running_abort:
  Abort
uninstaller_app_closed:
FunctionEnd

Function .onInstSuccess
  SectionGetFlags ${SecStartup} $0
  IntOp $0 $0 & ${SF_SELECTED}
  SetShellVarContext current
  ${If} $0 == 0
    Delete "$SMSTARTUP\SOCDOF.lnk"
    DeleteRegValue HKCU "${UNINSTALL_KEY}" "StartWithWindows"
  ${Else}
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "StartWithWindows" 1
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\SOCDOF.lnk"
  Delete "$SMSTARTUP\SOCDOF.lnk"
  Delete "$SMPROGRAMS\SOCDOF\SOCDOF.lnk"
  Delete "$SMPROGRAMS\SOCDOF\Uninstall SOCDOF.lnk"
  RMDir "$SMPROGRAMS\SOCDOF"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
