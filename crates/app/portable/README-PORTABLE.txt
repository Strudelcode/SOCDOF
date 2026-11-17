SOCDOF portable (Windows x64)
============================

Start SOCDOF with run-socdof.cmd. The folder can be moved or copied freely; there is no
installer, no registry entry and no service. The launcher stores the database and
backups in the data folder next to the executable. You can override that location
by setting SOCDOF_DATA_DIR before starting the launcher.

Runtime requirement
-------------------
SOCDOF uses the Microsoft Edge WebView2 Evergreen Runtime. It is included with
Windows 11 and with Windows 10 from version 1803 onward in most installations.
If SOCDOF does not start and Windows reports a missing WebView2 runtime, install
the Evergreen Runtime from Microsoft:

  https://developer.microsoft.com/microsoft-edge/webview2/

The WebView2 runtime is a shared Windows component. It is intentionally not
duplicated in this archive, so it keeps receiving Microsoft security updates.
The optional WebView2Loader.dll is included when the Tauri build emits it.

Data and backups
----------------
By default the launcher sets SOCDOF_DATA_DIR to the portable archive's data folder.
The database is data\SOCDOF.db; backups and window state remain alongside it.
This portable profile is separate from the installed application's AppData profile.
Do not run the same database from two machines through a network share.

Uninstall / cleanup
-------------------
Close SOCDOF and delete this folder. This removes the portable database and backups
because they are stored inside the folder. The separately installed SOCDOF profile
under %APPDATA%\SOCDOF is not affected.
