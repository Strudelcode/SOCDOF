SOCDOF native Rust desktop (Linux x86_64)
===========================================

Portable launch
---------------
Run ./run-socdof.sh. By default the portable database and backups are stored
inside ./data. Set SOCDOF_DATA_DIR before launching to select another location.

Per-user installation
---------------------
Run ./install-linux.sh to copy the executable into ~/.local/bin and create
a desktop entry. No root privileges are required. The installed application
uses the standard per-user data directory:
  $XDG_DATA_HOME/SOCDOF/SOCDOF.db
or:
  ~/.local/share/SOCDOF/SOCDOF.db

Run ./uninstall-linux.sh from this archive to remove only the installed
executable and desktop entry. The database, backups and settings are preserved.

Runtime requirements
--------------------
The native eframe build requires the host GTK, X11 or Wayland, and OpenGL
runtime libraries. This archive does not bundle system GUI libraries.

Custom paths
------------
Both launch modes support --data-dir, --database and SOCDOF_DATA_DIR.
Do not share a live SQLite database over a network filesystem or open the
same data folder from two application processes.
