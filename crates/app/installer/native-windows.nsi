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

Name "${APP_NAME} ${APP_VERSION}"
Caption "${APP_NAME} ${APP_VERSION} Setup"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\SOCDOF"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
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

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  nsExec::ExecToLog "taskkill /IM ${APP_EXE} /F"
  File "${SOURCE_DIR}\${APP_EXE}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\SOCDOF"
  CreateShortCut "$SMPROGRAMS\SOCDOF\SOCDOF.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\SOCDOF\Uninstall SOCDOF.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\SOCDOF.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME} (Native)"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Strudelcode"
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
  CreateShortCut "$SMSTARTUP\\SOCDOF.lnk" "$INSTDIR\\${APP_EXE}" "" "$INSTDIR\\${APP_EXE}" 0
SectionEnd

Function .onInstSuccess
  ; Treat the startup entry as an explicit opt-in and remove an old one when unchecked on upgrade.
  SectionGetFlags ${SecStartup} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 == 0
    SetShellVarContext current
    Delete "$SMSTARTUP\\SOCDOF.lnk"
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog "taskkill /IM ${APP_EXE} /F"
  Delete "$DESKTOP\SOCDOF.lnk"
  Delete "$SMPROGRAMS\SOCDOF\SOCDOF.lnk"
  Delete "$SMPROGRAMS\SOCDOF\Uninstall SOCDOF.lnk"
  RMDir "$SMPROGRAMS\SOCDOF"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
