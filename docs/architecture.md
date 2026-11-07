# Architecture

How the Rust rewrite is organised, where the code lives and how a new module is added.

## Crates

| Crate | Responsibility | Must not |
|---|---|---|
| `socdof-core` | Domain entities, money, SQLite store, password hashing | Depend on any UI or windowing crate |
| `socdof-app` | Desktop application: startup, instance lock, commands; Tauri window layer once WebKitGTK is available | Contain business rules |
| `socdof-ui` | Components, theme, screens (Phase 4) | Talk to SQLite directly |
| `socdof-cli` | Headless commands for tooling and data checks | Duplicate core logic |

Dependency direction is one-way: `app`/`ui`/`cli` → `core`. `core` never depends on the others.

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

`socdof-app` is a library plus a headless binary. `Shell::start` is the single start path:

1. `InstanceLock::acquire` — a second start fails with `lock_busy` before SQLite runs.
2. `Store::open` — migrations happen here; a failure releases the lock again.
3. Ready — `status()` reports database, schema version, row counts and the lock owner.

Commands live in `crates/app/src/commands.rs` and are thin adapters over `socdof-core`:

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

**Window layer:** Tauri 2 is the planned shell, but the Linux build environment has no GTK/WebKit
development packages. `pkg-config --cflags --libs webkit2gtk-4.1` fails with:

```text
Package webkit2gtk-4.1 was not found in the pkg-config search path.
Perhaps you should add the directory containing `webkit2gtk-4.1.pc'
to the PKG_CONFIG_PATH environment variable
Package 'webkit2gtk-4.1', required by 'virtual:world', not found
```

`gtk+-3.0`, `libsoup-3.0`, `glib-2.0` and `javascriptcoregtk-4.1` are missing as well, and `dpkg`
reports no installed GTK/WebKit package. The Tauri crate is therefore not part of the workspace: it
cannot compile here and would leave a half-built dependency. The window layer is added once the
build image provides `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev` and `librsvg2-dev`.

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

The four languages stay in one place: `crates/ui/locales/{de,en,fr,es}.json`, generated once from
`SOCDOF - TS/src/lib/i18n.ts` (Phase 7). Rust code only references keys; no literal UI text. Missing
keys fail the build in CI.

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
| `electron/main.cjs` | `crates/app` (Tauri, Phase 3) |
