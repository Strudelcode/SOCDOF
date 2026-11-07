# SOCDOF — Rust Rewrite

Native Rust rebuild of SOCDOF. The shipped TypeScript/React/Electron application lives unchanged in
[`SOCDOF - TS`](SOCDOF%20-%20TS) and keeps its own build and release tooling there.

The full migration plan, budgets and the parity checklist are in
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). Tick items off there as work lands.

## Layout

```
.
├── Cargo.toml               # workspace (core, app, ui, cli)
├── RUST_MIGRATION.md        # plan + checklist + progress log
├── crates
│   ├── core                 # domain model, money, SQLite persistence, backup, lock, PDF
│   ├── app                  # shell lifecycle, desktop command state, headless runner
│   │   ├── src-tauri        # Tauri 2 window layer (standalone Cargo workspace)
│   │   └── ui               # Vite/TypeScript frontend + de/en/fr/es texts
│   ├── ui                   # shared UI components (framework decision in Phase 4)
│   └── cli                  # headless access to the core, used for tests and tooling
└── SOCDOF - TS              # legacy TypeScript application (untouched)
```

The Tauri crate is its own Cargo workspace. This keeps the root `cargo fmt`, `clippy` and `test`
commands independent of GTK/WebKit development packages; only the desktop job installs them.

## Build

Requirements: stable Rust (pinned in `rust-toolchain.toml`) and a C toolchain for the bundled SQLite.

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -p socdof-cli -- ./socdof.db
```

### Desktop application

The desktop app talks to the existing core through Tauri commands; there is no second database layer.
The first screen shows the schema version, row counts and lock owner, and writes a real backup.

Linux prerequisites (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libxdo-dev libssl-dev patchelf
```

Windows needs the MSVC Rust target, the Visual Studio C++ build tools and WebView2 (included in
current Windows versions). No GTK packages are needed.

```bash
cd crates/app
npm ci
npm run build          # TypeScript check + Vite build into crates/app/dist
npm run tauri build    # native binary + bundle
```

For development with hot reload:

```bash
cd crates/app
npm run tauri dev
```

Artifacts are written to:

- Linux: `crates/app/src-tauri/target/release/bundle/deb/*.deb` and
  `crates/app/src-tauri/target/release/bundle/appimage/*.AppImage`
- Windows: `crates/app/src-tauri/target/release/bundle/nsis/*-setup.exe` and
  `crates/app/src-tauri/target/release/bundle/msi/*.msi`

The `.deb` + AppImage and NSIS + MSI targets are selected in `tauri.linux.conf.json` and
`tauri.windows.conf.json`. The desktop crate has its own `Cargo.lock`; the root workspace lockfile is
unaffected.

### Portable packages

The Linux AppImage in the CI artifacts is the portable Linux build. It does not need an installer;
run it directly. On distributions without FUSE 2, use the AppImage extraction mode
(`./SOCDOF-0.1.0-linux-x86_64.AppImage --appimage-extract-and-run`). The AppImage still expects the
usual desktop libraries (GTK 3, WebKitGTK 4.1 and the graphics stack) to be present.

The Windows portable ZIP contains `SOCDOF.exe`, its optional `WebView2Loader.dll` when emitted by
the build, and [`crates/app/portable/README-PORTABLE.txt`](crates/app/portable/README-PORTABLE.txt).
It does not require an installer and writes its database under
`%APPDATA%\com.strudelcode.socdof\`. It uses the machine-wide **WebView2 Evergreen Runtime**, which
is present on Windows 11 and most Windows 10 systems; if it is missing, install the runtime from
Microsoft. The portable package deliberately does not carry a private WebView2 copy, so Edge
security updates keep applying. A fixed WebView2 runtime is not part of this pass.

> The Linux development image used to prepare this branch has no GTK/WebKit development packages,
> so the Tauri build cannot run there. The `Desktop` CI jobs install the packages above and build the
> full bundle matrix on Ubuntu and Windows; the `GUI smoke` job additionally starts the real Linux
> WebView under Xvfb. Those jobs are the build and runtime proof for this layer.

## CI

[`.github/workflows/rust.yml`](.github/workflows/rust.yml) runs on every push to `main` and
`rust-rewrite` and on pull requests:

- **Format** on Ubuntu: `cargo fmt --all -- --check` plus the standalone desktop crate.
- **Test** on Ubuntu and Windows: `cargo clippy --workspace --all-targets -- -D warnings` and
  `cargo test --workspace`, including the command-layer test for schema status and backup.
- **Shell smoke** on Ubuntu: starts `socdof-app` headlessly on a fresh database and writes a backup.
- **Desktop** on Ubuntu and Windows: installs the Linux WebKit/GTK dependencies, runs `npm ci`,
  builds the frontend, builds the full Tauri bundle matrix and uploads each file as a separate
  artifact: `SOCDOF-<version>-linux-x86_64.AppImage`, `SOCDOF-<version>-linux-amd64.deb`,
  `SOCDOF-<version>-windows-x64-portable.zip`, `SOCDOF-<version>-windows-x64-setup.exe` and
  `SOCDOF-<version>-windows-x64.msi` (plus checksum files).
- **GUI smoke** on Ubuntu: installs Xvfb, DBus and WebKit, builds the real Tauri binary, starts it
  under `xvfb-run`, waits for the loaded frontend to invoke `database_status` and `create_backup`,
  verifies the returned schema version, database path and backup size against the live state, and
  uploads `artifacts/smoke.log`, `artifacts/smoke-report.json` and the generated backup. The job
  fails if the window/WebView does not start or a value is invalid.

All actions use the Node 24 runtime (`checkout@v5`, `setup-node@v5`, `upload-artifact@v6`,
`rust-cache@v2.9.3`), so the run does not emit Node 20 deprecation warnings.
