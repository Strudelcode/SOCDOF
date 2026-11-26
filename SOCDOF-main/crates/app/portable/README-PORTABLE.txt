SOCDOF portable (Windows x64)
============================

Start SOCDOF with SOCDOF.exe. The folder can be moved or copied freely; there is no
installer, no registry entry and no service.

Runtime requirement
-------------------
SOCDOF uses the Microsoft Edge WebView2 Evergreen Runtime. It is included with
Windows 11 and with Windows 10 from version 1803 onward in most installations.
If SOCDOF.exe does not start and Windows reports a missing WebView2 runtime,
install the Evergreen Runtime from Microsoft:

  https://developer.microsoft.com/microsoft-edge/webview2/

The WebView2 runtime is a shared Windows component. It is intentionally not
duplicated in this archive, so it keeps receiving Microsoft security updates.
This is why the portable ZIP contains the application binary and this notice,
not a private browser copy. The optional WebView2Loader.dll is included here
when the Tauri build emits it.

Data and backups
----------------
The database is stored in the per-user application data directory:

  %APPDATA%\com.strudelcode.socdof\socdof.db

Backups are written to the backups subdirectory next to the database:

  %APPDATA%\com.strudelcode.socdof\backups\

Keep the application folder writable only if you intentionally use a portable
data location in a future build; the current build uses the per-user location
above. Do not run the same database from two machines through a network share
without SOCDOF's lock support.

Uninstall / cleanup
-------------------
Close SOCDOF, delete this folder, and optionally delete the per-user data
directory above. Deleting the data directory removes the local database and
backups.
