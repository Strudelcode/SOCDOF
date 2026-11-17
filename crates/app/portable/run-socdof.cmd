@echo off
setlocal
if not defined SOCDOF_DATA_DIR set "SOCDOF_DATA_DIR=%~dp0data"
if not exist "%SOCDOF_DATA_DIR%" mkdir "%SOCDOF_DATA_DIR%"
if not exist "%~dp0socdof-desktop.exe" (
  echo SOCDOF executable was not found next to this launcher.
  exit /b 2
)
"%~dp0socdof-desktop.exe" %*
exit /b %errorlevel%
