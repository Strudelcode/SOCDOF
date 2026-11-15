Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "Sections.nsh"
!include "StrFunc.nsh"
${StrStr}

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

Function .onInit
  ; Never force-kill the app during an update: the user may have unsaved form state.
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /NH'
  Pop $0
  Pop $1
  StrCmp $0 "0" installer_tasklist_ok
  IfSilent installer_check_failed
  MessageBox MB_ICONSTOP|MB_OK "Could not check whether SOCDOF is running. Close it manually and retry."
installer_check_failed:
  Abort
installer_tasklist_ok:
  ${StrStr} $2 $1 "${APP_EXE}"
  StrCmp $2 "" installer_app_closed
  IfSilent installer_app_running
  MessageBox MB_ICONEXCLAMATION|MB_OK "Close SOCDOF before installing or updating. The installer will not terminate the running application."
installer_app_running:
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
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /NH'
  Pop $0
  Pop $1
  StrCmp $0 "0" uninstaller_tasklist_ok
  IfSilent uninstaller_check_failed
  MessageBox MB_ICONSTOP|MB_OK "Could not check whether SOCDOF is running. Close it manually and retry."
uninstaller_check_failed:
  Abort
uninstaller_tasklist_ok:
  ${StrStr} $2 $1 "${APP_EXE}"
  StrCmp $2 "" uninstaller_app_closed
  IfSilent uninstaller_app_running
  MessageBox MB_ICONEXCLAMATION|MB_OK "Close SOCDOF before uninstalling. The uninstaller will not terminate the running application."
uninstaller_app_running:
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
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
