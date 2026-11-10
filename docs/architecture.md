# Architecture

How the Rust rewrite is organised, where the code lives and how a new module is added.

## Crates

| Crate | Responsibility | Must not |
|---|---|---|
| `socdof-core` | Domain entities, money, SQLite store, FTS5 search, roles/sessions, password hashing | Depend on any UI or windowing crate |
| `socdof-app` | Desktop application: startup, instance lock, command state, headless runner | Contain business rules |
| `socdof-desktop` | Tauri 2 window layer (`crates/app/src-tauri`): state wiring and commands over `socdof-app` | Contain business rules, open SQLite directly |
| `socdof-ui` | Components, theme, desktop shell and screens (Phase 4–6) | Talk to SQLite directly |
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
├── backup.rs           native container and legacy archives: inspect, list, restore
├── backup_scheduler.rs due check, folder, interval, retention
├── autosave.rs         atomic snapshots with count-based retention
├── csv.rs              CSV import/export (contacts, products)
├── i18n.rs             embedded de/en/fr/es catalogues + external packs
├── logging.rs          rotating local log and crash reports
├── settings_service.rs validated profile and per-user preferences
├── date.rs             civil date formatting (DD.MM.YYYY)
├── lock.rs             shared-folder lock `network_session.lock`: heartbeat, stale + forced takeover
├── updates.rs          release feed check, version ordering, update channel with rollback
├── pdf/                PDF writer + DIN 5008 invoice layout
│   ├── mod.rs
│   ├── writer.rs       PDF 1.4 writer (Helvetica, WinAnsi, xref, multiple pages)
│   └── din5008.rs      invoice layout: address field, positions, totals
├── domain/             entities, no persistence code
│   ├── appointment.rs  calendar entries
│   ├── billing.rs      billable items (service, material, therapy, mileage)
│   ├── contact.rs
│   ├── invoice.rs
│   ├── permission.rs   AppModule, PermissionLevel, Role, built-in roles
│   ├── pos.rs          POS receipts and payment methods
│   ├── product.rs
│   ├── purchase.rs     purchase orders and goods receipt
│   ├── session.rs      sessions, lockout policy, LoginOutcome
│   ├── settings.rs
│   ├── stock.rs
│   ├── support.rs      support tickets and time entries
│   ├── therapy.rs      therapy clients and sessions
│   ├── user.rs
│   └── workspace.rs    desktop widgets and generated reports
└── store/              SQLite persistence, one file per aggregate
    ├── mod.rs          Store, schema, migrations
    ├── appointments.rs
    ├── billing_items.rs
    ├── contacts.rs
    ├── dashboard.rs    counts, invoice overview rows, period totals
    ├── reports.rs      period report over invoices and tracked time
    ├── invoices.rs
    ├── permissions.rs  roles + permission resolution
    ├── pos_orders.rs   receipts + stock in one transaction
    ├── products.rs     products + stock movements
    ├── purchase_orders.rs  orders + atomic goods receipt
    ├── search.rs       FTS5 queries with substring fallback
    ├── sessions.rs     sessions + sign-in with lockout
    ├── maintenance.rs  clean mode: delete all business records in one transaction
    ├── settings.rs     JSON key/value + company profile
    ├── support.rs      tickets + time tracking
    ├── therapy.rs      therapy clients, sessions and invoice link
    ├── users.rs        accounts + credential checks
    └── workspace.rs    widgets + reports
```

Rules:

- `domain` holds data and validation only. No SQL, no file system.
- `store` owns SQL. One module per aggregate, functions take `&Connection` (or the `Store` wrapper).
- Multi-entity writes run inside one transaction (`unchecked_transaction`).
- Money is always `Money` (integer cents). Never `f64`.
- Timestamps are `i64` milliseconds since the Unix epoch.
- Errors are `CoreError`; validation failures use `CoreError::Validation("snake_case_code")` so the UI
  can translate them.

### Transaction boundaries

Documents that touch several tables are written through one transaction. The stock helpers are the
building block:

| Write | Rows touched | Entry point |
|---|---|---|
| Invoice + stock | `invoices`, `invoice_lines`, `stock_moves`, `products.stock` | `invoices::insert_with_stock` |
| POS receipt + stock | `pos_orders`, `pos_order_lines`, `stock_moves`, `products.stock` | `pos_orders::insert` |
| Goods receipt | `stock_moves`, `products.stock`, `purchase_orders.status` | `purchase_orders::receive` |
| Collect billable items | many `billing_items.invoice_id` | `billing_items::assign_to_invoice` |

`products::apply_stock` writes a movement and the new stock level without opening a transaction of
its own; the document functions call it inside theirs, so an insufficient stock level rolls the
whole document back. `products::adjust_stock` is the standalone wrapper for single movements.

### Full-text search

Schema v4 adds `contacts_fts`, `products_fts` and `invoices_fts`. They are plain FTS5 tables with an
`UNINDEXED` id column and a `body`, maintained by `AFTER INSERT/UPDATE/DELETE` triggers, so every
writer stays consistent without application code. The invoice body also follows the positions
through triggers on `invoice_lines`. Existing rows are backfilled when the migration runs.

`store/search.rs` turns user input into quoted prefix terms (`"alpen"* "tech"*`), which makes FTS
operator injection impossible, and falls back to the aggregate's `LIKE` search when the index finds
nothing. That keeps legacy behaviour such as matching `tech` inside `AlpenTech`.

### Authentication and permissions

- Passwords are Argon2id PHC strings (`security::hash_password`).
- A session token is two random UUIDs (64 hex characters). Only its SHA-256 hash is stored, the
  plain token is returned once to the caller.
- Sessions expire after twelve hours, can be revoked individually (`Store::sign_out`) or for a user
  (`Store::sign_out_all`), and are purged with `Store::purge_expired_sessions`.
- Failed sign-ins are counted per account name; the fifth failure locks the account for five
  minutes. While locked, even the correct password is rejected (`LoginOutcome::Locked`).
- `Role` carries one `PermissionLevel` (`none`, `view`, `edit`, `manage`) per `AppModule`. The
  built-in administrator and user roles are seeded by the migration; custom roles live in `roles`.
  `Store::user_allows` resolves `user.role_id` first, falls back to the built-in role and lets an
  administrator pass unconditionally.

Service layering:

- `backup` snapshots through `Store::snapshot_to` (SQLite `VACUUM INTO`), never by copying an open
  file, and restores into a temporary file that replaces the database atomically and deletes stale
  `-wal`/`-shm` sidecars left behind by a crashed writer. It writes files, it never executes SQL.
- `autosave` writes a backup container to a temporary name and renames it into place, so a crash
  never leaves something that looks like a snapshot. `backup_scheduler` is stateless: the newest
  archive in the folder, the interval and the retention decide whether and what to write.
- `settings_service` owns the rules for the company profile and the per-user preferences, so the UI,
  the CLI and later the mobile companion validate identically.
- `i18n` only maps stable snake_case keys to texts. It never formats domain values; the UI passes
  placeholders. Unknown keys fall back to German and finally to the key itself.
- `logging` writes JSON lines and does not phone home. A crash report is a local file.
- `csv` parses RFC 4180 with delimiter detection, recognises headers in four languages and reports
  skipped rows instead of inventing values.

### Rust UI layer (`crates/ui`)

The interface is drawn by egui, a pure Rust immediate-mode library: no webview, no WASM, no
JavaScript. The decision and the removal plan for the temporary Vite frontend are in
[`ui-decision.md`](ui-decision.md).

- `tokens` holds the design values ported from `SOCDOF - TS/src/index.css` and the accent presets
  from `src/lib/accent.ts`, including the hue rules for the companion color.
- `theme` resolves light/dark/system, owns the surface and status palette and applies spacing,
  rounding and text styles to the egui context before the first frame.
- `components` draws the kit (buttons, icon buttons, cards, badges, tabs, search field, sortable
  table header, dialog, toasts, empty state) from the tokens, not from egui defaults. Labels and
  values come from the caller; no business logic lives here.
- `controls` adds the input controls: select, checkbox, switch, labelled text field with error,
  month calendar, menu, side drawer and file drop area.
- `desktop` keeps the window manager (z-order, focus, move, resize, snap, maximize, minimize,
  close cooldown, focus trap) as plain data, plus the icon grid and the taskbar; windows are egui
  areas painted from the tokens. One `desktop` frame draws the wallpaper, the widgets, the icon
  grid, the windows, the shell overlays and the taskbar.
- `dashboard` is the first Phase 6 module screen: period tabs, KPI cards, quick actions, recent
  invoices and the reorder list, all fed by `store::dashboard`; the screen formats, it never
  aggregates. Its sample data exists only for the gallery and the golden snapshots.
- `appointments` is the calendar screen: independent month/week/day views load their ranges through
  `Store::appointments_between` or `Store::search_appointments_between` and share one agenda. The
  detail view moves the lifecycle, the form writes creates, edits and deletes through the store,
  and open-slot overlaps are rejected from `Store::appointment_conflicts`; the domain owns the
  interval rule. The dashboard's calendar action opens it.
- `contacts` is the first full CRUD module screen: list with the core FTS search, detail view,
  create/edit form, delete confirmation and status badges. It writes through the `Store` contact
  methods; validation stays in the domain and returned codes are mapped to catalogue keys. The
  dashboard's new-contact action opens it.
- `shell` holds the start menu, the fuzzy command palette, the tray flyout and the onboarding as
  testable state machines, and renders them as focus-trapping overlays. All labels come from the
  catalogue; the models expose open/close, filtering, selection and the persisted seen flag.
- `wallpaper` decodes the two bundled PNG wallpapers with `include_bytes!`/`png` and paints them
  losslessly, either scaled to cover the desktop or tiled at their native size, behind a texture
  cache.
- `widgets` is the desktop widgets layer: a clock/date card and a battery/connection status card,
  drawn from the tokens and independent of the window z-order.
- `icons` paints the 28 glyphs that replace `lucide-react`, defined in a normalized box so they
  scale without assets.
- `calendar` holds the civil-date math for the date picker (leap years, weekday of the first day,
  six-week grid); it mirrors the core algorithm instead of adding a date library.
- `form` validates fields (required, length, email), tracks dirty state against a saved baseline and
  answers whether closing a screen needs a confirmation.
- `focus` owns keyboard focus: controls register in draw order, Tab/Shift+Tab wrap around, a click
  focuses, overlays trap the focus and Escape hands it back to the trigger. Focus rings are painted
  from the accent tokens, not from egui defaults.
- `snapshot` reduces a frame's paint commands to stable text (positions rounded, text and colors
  verbatim) so the primitives can be pinned by golden files without a display.
- `i18n` loads the UI catalogue for de/en/fr/es with the shared core loader; the tests fail if a
  key is missing.
- `gallery` is the acceptance surface: every control in every state, both appearances, nine accents
  and four languages, asserted headlessly with `egui::Context::run`. With the `window` feature the
  `socdof-ui-gallery` binary renders the same screen in an eframe window; the default build stays
  window free so tests and clippy need no desktop libraries.
- `reports` is the reporting screen: four periods over `store::reports::load`, seven key figures,
  per-state share bars and the invoice table. The core aggregates invoices and tracked time; the
  screen only formats, and dates are printed with a locale-independent `dd.mm.yyyy` formatter.
- `therapie` is the therapy practice: client list with search and rates, client detail with session
  count, treatment hours, driven kilometres and the open amount, the session history with the amount
  of every session and its billed state, session booking and the invoice link by number. All
  arithmetic comes from `domain::therapy` (`session_amount`, `summarize`), persistence from
  `store::therapy`.
- `studio` is the Studio drawer: it opens from the taskbar and the command palette, edits the company
  letterhead through `settings_service`, shows the stored record counts and runs the clean mode
  (`Store::reset_business_data`) behind a confirmation dialog. Its third tab edits the document
  layout: the PNG background path, a page preview that decodes the file into an egui texture and
  paints the enabled tokens, and a per-token editor for position, size, bold and alignment. It holds
  no business rules: profile validation, layout validation and the reset live in the core.
- `document_layout` is the stored print layout: an optional PNG letterhead path plus nine tokens
  (company name/address/contact, tax id, invoice number/date, due date, subject, footer), each with a
  position in page percentages, a font size, bold and alignment. Every token is disabled by default.
  `validate` returns catalogue codes (`layout_position_invalid`, `layout_size_invalid`,
  `layout_tokens_required`, `layout_image_invalid`) and `background` decodes the file through the PDF
  writer's PNG reader.
- `richtext` is the editor's markup layer: it parses `# `, `- `, `> `, `**` and `_`, renders the
  formatted preview (bold runs are painted twice with a sub-pixel offset, italic runs use epaint's
  skew) and applies the ribbon actions to the character selection.
- `settings` is the Phase 6 settings screen: eight tabs in one screen, reading and writing the
  company profile, per-user preferences, passwords/sessions, users, roles, backups and the persisted
  update/portable policies exclusively through the core services. Backup restore writes to a chosen
  target file instead of replacing the live database. Validation errors come back from the core as
  catalogue codes, and the screen adds no business rules of its own.

`crates/app/ui` remains the frontend of the Tauri shell until the Rust screens replace it. It is
not a dependency of `socdof-ui` and is deleted in the step described in `ui-decision.md`.

The UI crate is covered by three test layers: unit tests for tokens, theme, forms and calendar math;
`tests/keyboard.rs` drives the real widgets with synthetic egui input (Tab order, activation, arrows,
Escape, typing, click focus); and `tests/visual.rs` compares the paint commands of every primitive
with 264 golden files (2 appearances × 4 languages × 33 scenes: idle, focused, drawer, desktop,
start menu, palette, tray, onboarding, tiled wallpaper, studio, studio data, studio layout, dashboard,
contacts, products,
invoices, accounting, purchases, pos, calendar, settings, users, app store, editor, editor preview,
editor spell check, support, reports, therapy and the four auth screens).
- `lock` only touches the file system: no database, no settings.
- `pdf` consumes domain entities and the company profile. It never queries the database, so the same
  renderer is used by tests, the CLI and later the UI. The writer holds one content stream per page
  and repeats the letterhead image on each of them; `din5008` paginates the position table (19 rows
  on page one, 33 per continuation page), repeats the column header, keeps totals and the payment
  line on the last page and numbers the pages.
- `date` is pure and shared by `pdf` and the UI.

`crates/core/src/spell.rs` is the offline spell checker of the text editor. It parses the bundled
German Hunspell dictionary (`crates/core/assets/dictionary/de_DE.dic` and `de_DE.aff`, igerman98,
GPL, licence file included) once into stems with their affix flags and the prefix/suffix rules, and
accepts a word when it is a stem, a stem with one suffix or prefix, a prefix plus suffix, or a
two-part compound. Unknown words are returned as byte ranges for the editor underline and as unique
words with counts for the proofing panel; the personal dictionary lives in the settings, not in the
checker.

## Backup format

```text
"SOCDOFBK" | format u32 | meta_len u32 | metadata JSON | payload_len u64 | crc32 u32 | SQLite bytes
```

`BackupMetadata` carries `format_version`, `created_at`, `schema_version` and `app_version`. The
checksum covers the database payload; a damaged or foreign file is rejected before anything touches
the live database (`backup_corrupt`, `backup_invalid_format`, `backup_truncated`,
`backup_unsupported_version`).

The legacy application writes no zip or tar archive: `exportDatabaseToJson` in
`SOCDOF - TS/src/lib/db.ts` produces one JSON document per backup (`*.socdof.json`) and
`importDatabaseFromJson` reads the same shape back. `backup` therefore treats both files as archives:
`inspect_bytes` recognises the container magic or a JSON object, `legacy_metadata` reads `app`,
`version`, `exported_at`, `backup_owner` and the counts of the record arrays, `list_archives`
returns both kinds newest first, and `restore_archive` replaces the database from a container or
imports a legacy document through `legacy::import_json`. `socdof-cli backup <database> <target>`
writes the format the target name asks for, `socdof-cli restore` accepts either and
`socdof-cli backups <folder>` lists both.

## Mobile companion sync

The mobile app does not stream over WebSocket and does not discover the desktop over mDNS: it posts
one JSON document over plain HTTP and the desktop polls the gateway until the document is there.
The routes and bodies come from `SOCDOF - TS/vite.config.ts` (`mobile-sync-api`) and
`SOCDOF - TS/electron/main.cjs` (`startMobileSyncServer`), the document shape from
`SOCDOF - TS/src/lib/mobileCompanionTypes.ts`.

- `mobile_sync::payload` parses `SOCDOF_MOBILE_COMPANION_V1` documents (`summary`, `date_range`,
  `tickets`, `sessions` with `task`/`objective`/`onSiteReport`/`materialAndExpenses`/`remarks`,
  `trips`, `customers`, `standalone_timesheets`, `standalone_expenses`, wrapped or bare) and plans
  support tickets plus time entries from them. Amounts have no column of their own in Rust, so they
  are summed into an import report and appended to the ticket description; the ticket number and
  the voice note transcripts go to the description as well.
- `mobile_sync::http` binds `0.0.0.0:3000` (falling back to 3001) and serves
  `GET /api/mobile-sync/info`, `GET|POST /api/mobile-sync/ping|test`,
  `POST|PUT /api/mobile-sync|/upload|/submit`, `GET /api/mobile-sync?token=…&consume=true`,
  `OPTIONS` with 204 and the CORS headers. Uploads are accepted as JSON, as form data or as base64
  JSON; the token comes from the query, the `Bearer` header or the body and falls back to
  `default`. A stored document stays readable for twenty minutes under the token, its upper and
  lower case, `latest` and `device_<id>`, and `consume=true` clears those slots.
- Broken JSON, a non-object body and a foreign `protocol` answer `400` with `mobile_invalid_json`,
  `mobile_invalid_payload` or `mobile_unsupported_protocol`; unknown paths answer `404 Not found`
  like the TypeScript server. The accept loop never panics on a request.
- Reached from `socdof-cli companion-sync <database> [port] [--once]` (server plus import, report
  on stdout), `socdof-cli companion-import <database> <payload.json>` and the core API
  (`mobile_sync::import`, `import_value`, `import_bytes`, `import_file`, `http::start_with`,
  `http::client`).

## Instance lock

`lock.rs` creates `network_session.lock` next to the database with `create_new` (atomic) and writes
the keys the legacy Electron app reads (`hostname`, `username`, `pid`, `startTime`, `heartbeat`,
`requestQuit`), so both versions exclude each other on one shared folder during the dual-run period.
`Paths::new` derives the path, the heartbeat is refreshed while running, and a second start is
rejected with `lock_busy`. A heartbeat older than `DEFAULT_STALE_AFTER_MS` (30 s) marks the lock as
abandoned and it is taken over; `InstanceLock::inspect` reads the owner without acquiring, and
`InstanceLock::force_takeover` takes a fresh lock after the user confirmed the dialog. The UI side is
`auth::LockConflict` + `auth::lock_conflict` (`crates/ui/src/auth.rs`).

`updates.rs` is UI-free: `parse_feed` reads a GitHub release document or the updater manifest,
`compare_versions` orders versions (a release above its pre-release), `check` returns
`UpdateCheck { current, latest, update_available }`, and `Channel` stages one artifact per version
with a journal so `rollback` returns to the previous version. `socdof-cli update-check`,
`update-stage`, `update-current` and `update-rollback` expose the same calls.

The setup wizard imports legacy data through `crates/ui/src/migration.rs` (`MigrationState::import`
→ `legacy::import`, which writes the pre-migration backup); the last wizard page renders the step and
`AuthState::run_pending_import` in `crates/ui/src/gallery.rs` executes the request.

## Desktop shell (Phase 3)

`socdof-app` is a library, a headless binary and the desktop command state. `Shell::start` is the
single start path:

1. `InstanceLock::acquire` — a second start fails with `lock_busy` before SQLite runs.
2. `Store::open` — migrations happen here; a failure releases the lock again.
3. Ready — `status()` reports database, schema version, row counts and the lock owner.

`startup.rs` owns the startup handshake: `Starting → Ready/Failed/Closed`, idempotent transitions and
a 20 s timeout, returned as a `SplashAction` so the window layer only closes the splash and shows the
main window. `crates/app/ui/public/splash.html` is the splash page; the main window is created
invisible and becomes visible on `ready` — or in its error state when initialisation fails.

`shortcuts.rs` maps a key chord to one `AppAction` (`F11`, `Ctrl+K`, `Ctrl+L`, `Escape`) and owns the
repeat and locked-context rules; the window layer registers the key handler, forwards the event and
executes the returned action, nothing else.

`window_state.rs` keeps `window_state.json` next to the database: geometry in physical pixels plus
the maximized/fullscreen flags, written atomically and clamped to the minimum window size and onto
the current monitor. The Tauri layer restores it in `setup` before the window is shown and writes it
on `CloseRequested`; the module has no windowing dependency, so the restore rules are unit-tested.

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
them in order based on `PRAGMA user_version`. The current version is 8. To change the schema:

1. Add `SCHEMA_V9` with only the delta (`ALTER TABLE`, `CREATE TABLE`).
2. Raise `SCHEMA_VERSION` and add the matching `SCHEMA_V<n>` block.
3. Add `if version < 9 { ... }` to `Store::migrate`.
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
| React + Vite + TypeScript UI | egui components drawn from the ported design tokens |
| CSS variables / Tailwind classes | `tokens` + `Palette` applied to the egui context |
| `lucide-react` icons | Rust-drawn glyphs (28) |
| `src/lib/db.ts` (Dexie/IndexedDB) | `crates/core/src/store` (SQLite) |
| `src/lib/auth.ts` | `domain/user.rs`, `store/users.rs`, `security.rs` |
| `src/components/*Module.tsx` | `crates/ui` screens (Phase 4–6) |
| `src/lib/i18n.ts` | `crates/ui/locales/*.json` (Phase 7) |
| `electron/main.cjs` | `crates/app/src-tauri` (Tauri, Phase 3) |
