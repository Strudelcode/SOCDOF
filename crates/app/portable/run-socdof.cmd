@echo off
setlocal
if not defined SOCDOF_DATA_DIR set "SOCDOF_DATA_DIR=%~dp0data"
if not exist "%SOCDOF_DATA_DIR%" mkdir "%SOCDOF_DATA_DIR%"
rem The packaged binary is named socdof-ui-desktop.exe; older builds used the other name.
set "SOCDOF_EXE=%~dp0socdof-ui-desktop.exe"
if not exist "%SOCDOF_EXE%" set "SOCDOF_EXE=%~dp0socdof-desktop.exe"
if not exist "%SOCDOF_EXE%" (
  echo SOCDOF executable was not found next to this launcher.
  exit /b 2
)
"%SOCDOF_EXE%" %*
exit /b %errorlevel%
