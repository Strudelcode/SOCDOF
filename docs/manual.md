# SOCDOF manual

Installation, portable use, network shares and troubleshooting for the Rust desktop build. The
release pipeline is described in [`RELEASING.md`](RELEASING.md), the measured budget values in
[`performance.md`](performance.md).

## Installation

| Platform | Artifact | Notes |
|---|---|---|
| Linux | `SOCDOF-<version>-linux-x86_64.AppImage` | `chmod +x`, then start it; needs FUSE or `--appimage-extract-and-run` |
| Linux | `SOCDOF-<version>-linux-amd64.deb` | `sudo apt install ./SOCDOF-<version>-linux-amd64.deb` |
| Windows | `SOCDOF-<version>-windows-x64-setup.exe` | NSIS installer, per-user, installs the WebView2 runtime check |
| Windows | `SOCDOF-<version>-windows-x64-portable.zip` | unpack and start `socdof-desktop.exe`, no installer and no registry writes |
| macOS | `SOCDOF-<version>-macos-universal.dmg` | universal build, notarisation has to be done by the release pipeline |

The application stores its data in a single SQLite database below the platform data folder
(`SOCDOF/socdof.db` on Windows and Linux, `~/Library/Application Support/SOCDOF` on macOS). The
first start opens the setup wizard: language, administrator account, appearance and the desktop
layout. No data is created before that step.

`SOCDOF_DATABASE` overrides the database path, `SOCDOF_BACKUP_DIR` the default backup folder — both
are read by the headless binary as well as by the desktop shell.

## Portable mode

The portable ZIP is the desktop binary plus `README-PORTABLE.txt`. Start `socdof-desktop.exe` from
the unpacked folder; the data folder stays next to the executable in `SOCDOF-data/` when the
`portable` marker file exists, so a USB stick keeps its own database, backups and logs. Nothing is
written to `%APPDATA%`. Updates are not installed automatically in portable mode — replace the
folder with the new ZIP, the `SOCDOF-data/` directory is kept.

## Network shares

The database can live on a shared folder as long as the share supports byte-range locking. One
instance at a time works on it:

- Every start creates `network_session.lock` next to the database — the same file the
legacy Electron build uses, so both versions exclude each other during a dual-run period. It carries the host, the user, the pid and a
  heartbeat that is refreshed while the application runs.
- A second start on the same share refuses to open the database and reports which host and user
  holds the lock. Exit the other instance, or wait until its heartbeat is stale: an abandoned lock
  (crashed process, powered-off machine) is taken over after the stale window instead of blocking
  the share forever.
- The lock file is removed on a clean exit only when it still belongs to the instance that removes
  it, so a crash never leaves a lock that has to be deleted by hand.

Do not open the same database from two machines without that lock check: SQLite on a network share
gives no cross-machine write safety of its own.

## Backups

Backups are written as `*.socdofbak` (own container with metadata and CRC-32) or as
`*.socdof.json` (the legacy document). Both formats are recognised by their bytes, listed in one
newest-first listing and restored atomically — a failed restore leaves the previous database in
place. The scheduler keeps a folder, an interval and a retention count; the settings screen and
`socdof-cli backup` / `restore` / `backups` use the same service.

## Headless use

```bash
socdof-app --database /srv/socdof/socdof.db            # shell, prints status and exits
socdof-app --database … --backup /srv/backup/run.socdofbak
socdof-app --database … --restore /srv/backup/run.socdofbak
socdof-cli --help                                      # invoice PDF, QR labels, companion sync, locales
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `lock held by <host>/<user>` on start | Another instance owns the database. Close it, or wait for the stale window if that machine is gone. |
| `database is locked` from the driver | A second process (backup tool, sync client) holds a write lock; close it and retry. |
| Start fails after an upgrade | Check `socdof.log` next to the database. Schema migrations run in order; a failed migration leaves the previous `user_version` and does not touch data. |
| Login refused, no password accepted | Failed attempts lock the account for five minutes (persistent across restarts). An administrator can reset the password in the user management. |
| Empty screen after the setup wizard | The chosen layout hides every app; open the start menu and apply another layout template in the desktop settings. |
| Backups stop | The scheduler writes into a folder that no longer exists or is read-only; the settings screen reports the last error. |
| AppImage does not start | FUSE is missing: run it with `--appimage-extract-and-run`. |
| Portals/file dialogs do nothing on Linux | No desktop portal is installed in that session; enter the path in the text field instead of using the picker. |

Crash reports and the rotating log live next to the database (`socdof.log`, `crash-*.log`). They
contain no telemetry; nothing is sent anywhere.
