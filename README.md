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

- Linux: `crates/app/src-tauri/target/release/bundle/deb/*.deb`
- Windows: `crates/app/src-tauri/target/release/bundle/nsis/*.exe`

The `.deb` and NSIS targets are selected in `tauri.linux.conf.json` and `tauri.windows.conf.json`.
The desktop crate has its own `Cargo.lock`; the root workspace lockfile is unaffected.

> The Linux development image used to prepare this branch has no GTK/WebKit development packages,
> so the Tauri build cannot run there. The desktop CI job installs the packages above and builds the
> bundle on Ubuntu and Windows; that job is the build proof for this layer.

## CI

[`.github/workflows/rust.yml`](.github/workflows/rust.yml) runs on every push to `main` and
`rust-rewrite` and on pull requests:

- **Format** on Ubuntu: `cargo fmt --all -- --check` plus the standalone desktop crate.
- **Test** on Ubuntu and Windows: `cargo clippy --workspace --all-targets -- -D warnings` and
  `cargo test --workspace`, including the command-layer test for schema status and backup.
- **Shell smoke** on Ubuntu: starts `socdof-app` headlessly on a fresh database and writes a backup.
- **Desktop** on Ubuntu and Windows: installs the Linux WebKit/GTK dependencies, runs `npm ci`,
  builds the frontend, builds the Tauri bundle and uploads `socdof-desktop-<runner>` as an artifact
  (`.deb` on Linux, NSIS `.exe` on Windows).

All actions use the Node 24 runtime (`checkout@v5`, `setup-node@v5`, `upload-artifact@v6`,
`rust-cache@v2.9.3`), so the run does not emit Node 20 deprecation warnings.
