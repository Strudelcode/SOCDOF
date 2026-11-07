# Architecture

How the Rust rewrite is organised, where the code lives and how a new module is added.

## Crates

| Crate | Responsibility | Must not |
|---|---|---|
| `socdof-core` | Domain entities, money, SQLite store, password hashing | Depend on any UI or windowing crate |
| `socdof-app` | Desktop application: startup, instance lock, command state, headless runner | Contain business rules |
| `socdof-desktop` | Tauri 2 window layer (`crates/app/src-tauri`): state wiring and commands over `socdof-app` | Contain business rules, open SQLite directly |
| `socdof-ui` | Components, theme, screens (Phase 4) | Talk to SQLite directly |
| `socdof-cli` | Headless commands for tooling and data checks | Duplicate core logic |

Dependency direction is one-way: `desktop` → `app`/`ui`/`cli` → `core`. `core` never depends on the others.
The frontend only calls Tauri commands; it never receives a database handle or SQL.

## Inside `socdof-core`

```
src/
├── lib.rs              public surface + now_millis()
├── error.rs            CoreError, CoreResult
├── money.rs            Money (integer cents)
├── security.rs         Argon2id hash + verify
├── backup.rs           backup container: verify, write, atomic restore
├── date.rs             civil date formatting (DD.MM.YYYY)
├── lock.rs             instance lock with heartbeat and stale takeover
├── pdf/                PDF writer + DIN 5008 invoice layout
│   ├── mod.rs
│   ├── writer.rs       PDF 1.4 writer (Helvetica, WinAnsi, xref)
│   └── din5008.rs      invoice layout: address field, positions, totals
├── domain/             entities, no persistence code
│   ├── contact.rs
│   ├── invoice.rs
│   ├── product.rs
│   ├── settings.rs
│   ├── stock.rs
│   └── user.rs
└── store/              SQLite persistence, one file per aggregate
    ├── mod.rs          Store, schema, migrations
    ├── contacts.rs
    ├── invoices.rs
    ├── products.rs     products + stock movements
    ├── settings.rs     JSON key/value + company profile
    └── users.rs        accounts + credential checks
```

Rules:

- `domain` holds data and validation only. No SQL, no file system.
- `store` owns SQL. One module per aggregate, functions take `&Connection` (or the `Store` wrapper).
- Multi-entity writes run inside one transaction (`unchecked_transaction`).
- Money is always `Money` (integer cents). Never `f64`.
- Timestamps are `i64` milliseconds since the Unix epoch.
- Errors are `CoreError`; validation failures use `CoreError::Validation("snake_case_code")` so the UI
  can translate them.

Service layering:

- `backup` snapshots through `Store::snapshot_to` (SQLite `VACUUM INTO`), never by copying an open
  file, and restores into a temporary file that replaces the database atomically and deletes stale
  `-wal`/`-shm` sidecars left behind by a crashed writer. It writes files, it never executes SQL.
- `lock` only touches the file system: no database, no settings.
- `pdf` consumes domain entities and the company profile. It never queries the database, so the same
  renderer is used by tests, the CLI and later the UI.
- `date` is pure and shared by `pdf` and the UI.

## Backup format

```text
"SOCDOFBK" | format u32 | meta_len u32 | metadata JSON | payload_len u64 | crc32 u32 | SQLite bytes
```

`BackupMetadata` carries `format_version`, `created_at`, `schema_version` and `app_version`. The
checksum covers the database payload; a damaged or foreign file is rejected before anything touches
the live database (`backup_corrupt`, `backup_invalid_format`, `backup_truncated`,
`backup_unsupported_version`).

## Instance lock

`lock.rs` creates a JSON lock file with `create_new` (atomic), stores pid, user, machine, start time
and heartbeat, and refreshes the heartbeat while running. A second start reads the file and is
rejected with `lock_busy`. If the heartbeat is older than `DEFAULT_STALE_AFTER_MS` (30 s), the lock
is treated as abandoned and taken over, so a crash never blocks the application permanently.

## Desktop shell (Phase 3)

`socdof-app` is a library, a headless binary and the desktop command state. `Shell::start` is the
single start path:

1. `InstanceLock::acquire` — a second start fails with `lock_busy` before SQLite runs.
2. `Store::open` — migrations happen here; a failure releases the lock again.
3. Ready — `status()` reports database, schema version, row counts and the lock owner.

`DesktopState` (`crates/app/src/desktop.rs`) owns one `Shell` behind a mutex. It exposes the exact
methods the window commands call, which keeps the command path testable without GTK/WebKit:

| Tauri command | `DesktopState` | Core call |
|---|---|---|
| `database_status` | `status()` | schema version, row counts, lock owner |
| `create_backup` | `backup(None)` | `backup::create_backup` on the open store |

The remaining shell commands are still library adapters used by the headless runner:

| Command | Core call |
|---|---|
| `backup` | `backup::create_backup` on the open store |
| `restore` | closes the store, `backup::restore_backup`, reopens the store, keeps the lock |
| `export_invoice_pdf` | `pdf::din5008::write_invoice_pdf` for an invoice number |

The binary runs exactly that path without a window:

```bash
cargo run -p socdof-app -- --database socdof.db --backup backup.socdofbak \
  --export-invoice 2026-0001 rechnung.pdf
```

**Window layer:** `crates/app/src-tauri` is a Tauri 2 application in its own Cargo workspace. During
setup it creates the application data directory, opens `socdof.db` through `DesktopState` and manages
the state; the commands in `src/commands.rs` are one-line adapters. The webview UI lives in
`crates/app/ui` (Vite + TypeScript, build output `crates/app/dist`). The first screen shows schema
version, row counts and lock owner, and writes a backup with its path and size.

The Tauri crate is deliberately excluded from the root workspace: it needs `libwebkit2gtk-4.1-dev`,
`libgtk-3-dev`, `libayatana-appindicator3-dev` and `librsvg2-dev`, which the core jobs must not
require. The desktop CI job installs those packages on Ubuntu, builds the frontend and produces an
AppImage and a `.deb`; on Windows it produces a portable ZIP, an NSIS setup and an MSI. Each file is
uploaded as an artifact. The local build image used for this branch still has no GTK/WebKit packages,
so the Tauri build itself is verified in CI; `cargo test -p socdof-app` covers the command layer
locally.

The `GUI smoke` CI job uses Xvfb, DBus and `WEBKIT_DISABLE_COMPOSITING_MODE=1` to start the real
window. The frontend invokes the normal commands when `SOCDOF_SMOKE_REPORT` is set; `finish_smoke`
validates the returned schema version, database path and non-empty backup against `DesktopState`,
writes `smoke-report.json` and exits with 0. A missing WebView, failed command or invalid value
fails the job. This is a runtime test of the Tauri IPC path, not a second implementation of the
shell logic.

## PDF layout

`pdf/din5008.rs` implements DIN 5008 Form B: 25 mm left margin, 20 mm right margin, address field at
45 mm (85 × 40 mm), subject at 98.5 mm, body at 111.5 mm, footer at 285 mm. All values are
millimetres converted to points; the writer never depends on a system font.

## Schema and migrations

`store/mod.rs` keeps the schema as numbered constants (`SCHEMA_V1`, `SCHEMA_V2`, ...) and applies
them in order based on `PRAGMA user_version`. To change the schema:

1. Add `SCHEMA_V3` with only the delta (`ALTER TABLE`, `CREATE TABLE`).
2. Raise `SCHEMA_VERSION` to 3.
3. Add `if version < 3 { ... }` to `Store::migrate`.
4. Add a test that opens a fresh database and asserts the new version and behaviour.

Never edit an already shipped schema block; existing databases only run the newer steps.

## Adding a module (example: invoices already exists, orders do not)

1. `domain/order.rs`: entity, enums with `as_str`/`from_storage`, `validate`.
2. `store/orders.rs`: `insert`, `update`, `find`, `list`, transactional writes.
3. Extend `SCHEMA_V*` with the tables and indices.
4. Add thin methods on `Store`.
5. Tests: domain validation, store round-trip, rollback on failure.
6. Tick the module in `RUST_MIGRATION.md` and add a log row.

## Internationalisation

The shell screen keeps its four languages in `crates/app/ui/locales/{de,en,fr,es}.json`, loaded by
`crates/app/ui/src/i18n.ts`; the HTML only carries keys and no user-facing string is embedded in Rust.
Phase 7 consolidates the full catalogue in `crates/ui/locales/{de,en,fr,es}.json`, generated from
`SOCDOF - TS/src/lib/i18n.ts`, and adds missing-key checks to CI.

## Testing

```bash
cargo test --workspace
```

- Domain tests live next to the type (`#[cfg(test)] mod tests`).
- Store tests use `Store::open_in_memory()` — no files, no cleanup.
- Time-dependent behaviour takes `now` as a parameter where practical.

## Comparison with the legacy app

| Legacy (`SOCDOF - TS`) | Rust |
|---|---|
| `src/lib/db.ts` (Dexie/IndexedDB) | `crates/core/src/store` (SQLite) |
| `src/lib/auth.ts` | `domain/user.rs`, `store/users.rs`, `security.rs` |
| `src/components/*Module.tsx` | `crates/ui` screens (Phase 4–6) |
| `src/lib/i18n.ts` | `crates/ui/locales/*.json` (Phase 7) |
| `electron/main.cjs` | `crates/app/src-tauri` (Tauri, Phase 3) |
