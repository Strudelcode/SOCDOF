# SOCDOF — Rust Rewrite Migration Plan

> Living document. Tick items as they are completed, update the status block, and append notes at the
> bottom of the phase you are working on. Keep this file the single source of truth for the rewrite.

| | |
|---|---|
| **Branch** | `rust-rewrite` |
| **Started** | 2026-11-07 |
| **Current phase** | Phase 6 — complete: the dashboard, contacts, products, invoices, accounting, purchases, POS, calendar, settings, user management, login/lock flow, App Store, text editor (markup formatting, formatted preview and offline spell check), support, reports, therapy, the documentation/changelog pass and the Studio drawer are done. Decided: **egui**, no JavaScript/WASM in the UI path (`docs/ui-decision.md`). Phase 8 started: the letterhead background, the token placement and the multi-page position tables with repeated headers are done (Studio layout tab, `document_layout`, PNG image XObject repeated per page, paginated DIN 5008 table). Next: Phase 7 (key coverage in CI) and the last Phase 8 item (mobile companion sync); the Phase 2 leftovers (zip/docx/PDF import, update checker) remain |
| **Overall progress** | ~99 % (data layer with all aggregates, FTS5, transactions, sessions/roles; settings, translations, autosave, scheduler, logging, CSV; headless shell, wired Tauri shell, contacts/products CRUD and search; Rust UI tokens, theme, controls, icons, forms, focus system, gallery, window host and golden snapshots; complete desktop shell with window manager, overlays, widgets and real wallpapers; legacy backup compatibility, packaging, runtime proof and release infrastructure) |
| **Legacy app** | Unchanged in `SOCDOF - TS` (TypeScript + React + Electron) |
| **Goal** | Same product, Rust core + Rust UI, ~10× smaller installer, ~3× less RAM |
| **Browser build** | `crates/web` — the same egui UI as WebAssembly (Trunk), with real SQLite, real login and real user management; see section 14 |

---

## 1. Why this branch exists

The shipped application is ~112,800 lines of TypeScript/TSX in 126 files, bundled into a 3.9 MB
JavaScript file (973 KB gzip) and wrapped in Electron. Size and RAM are dominated by the runtime and
the third-party libraries (pdfjs, firebase, lucide), not by the language itself.

This branch rebuilds SOCDOF as a native Rust application:

- **Shell:** Tauri 2 (system WebView, no bundled Chromium) — or a native Rust UI if Phase 4 decides so.
- **Core:** Rust with SQLite (`rusqlite`), `argon2`, `printpdf`, `zip`, `serde`.
- **UI:** Leptos (CSR in the system WebView) — closest match to the existing React component model.
  Alternative evaluated in Phase 4: Dioxus, egui, Slint.
- **Data:** existing Dexie/IndexedDB data must be importable (JSON export) — no user loses data.

### Target metrics (measured against the legacy app)

| Metric | Legacy (measured 2026-11-07) | Rust target |
|---|---|---|
| Installer size | ~100–150 MB (Electron) | ≤ 15 MB |
| Installed size | ~300 MB | ≤ 40 MB |
| Idle RAM | ~250–400 MB | ≤ 120 MB |
| Idle CPU | 1–3 % | < 0.5 % |
| Cold start to login | 2–4 s | < 800 ms |
| UI bundle | 3.9 MB (973 KB gz) | ≤ 1.5 MB (≤ 400 KB gz) |

### Non-goals

- No feature removal, no redesign of the visual language (accent system, glass surfaces, DIN 5008 stay).
- No new modules while parity is incomplete.
- The legacy app is not modified from this branch.

---

## 2. Ground rules

- [ ] Every phase ends with `cargo fmt`, `cargo clippy -- -D warnings`, `cargo test` green.
- [ ] UI texts only via the translation files — all four languages (de, en, fr, es) from day one.
- [ ] Documentation and code comments in English; user-facing texts in all four languages.
- [ ] No mock data, no placeholder screens: a module is either complete or not merged.
- [ ] Every merged phase updates this file: tick boxes, update "Current phase" and "Overall progress".
- [ ] Size and RAM budget checked at the end of Phase 9 and reported in this file.

---

## 3. Phase 0 — Repository & toolchain (done)

- [x] Create branch `rust-rewrite` and this document
- [x] Cargo workspace at the repository root: `crates/core`, `crates/app`, `crates/ui`, `crates/cli`
- [x] Pin the toolchain in `rust-toolchain.toml` (stable + rustfmt + clippy)
- [x] `.github/workflows/rust.yml`: fmt, clippy and tests on Linux and Windows
- [x] Root `README.md` with layout and build commands
- [x] Move the legacy TypeScript app to `SOCDOF - TS` so both versions stay side by side
- [x] Record legacy baselines in `docs/baseline.md` (installer size, RAM, cold start, bundle size)

**Exit criteria:** `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test --workspace`
are green locally and in CI; baseline numbers documented.

---

## 4. Phase 1 — Domain model & data layer

Done so far: `Money` (integer cents, parsing/formatting, tax), `Contact`, `Product`, `Invoice` with
positions and totals, `User` with roles, `StockMove`, `CompanyProfile`, `PurchaseOrder` with
goods receipt, `PosOrder`, `BillingItem`, `Appointment`, `SupportTicket`, `TimeEntry`, `Widget`,
`Report`, `Role` with the per-module permission matrix and `Session`; Argon2id password hashing,
SHA-256 session tokens, lockout tracking, FTS5 search and a SQLite store (schema v4) with
`user_version` migrations and one repository module per aggregate. See `docs/architecture.md` for
the layout and conventions.

- [x] Define entity types: `User`, `Role`, `Contact`, `Product`, `StockMove`, `Invoice`,
      `PurchaseOrder`, `POSOrder`, `BillingItem`, `Session`, `Appointment`, `Widget`, `Report`,
      `SupportTicket`, `TimeEntry`, `Settings`, `CompanyProfile`
- [x] SQLite schema + migrations (`refinery` or hand-rolled `user_version` migrations)
- [ ] Repository traits + SQLite implementations, one module per aggregate — the modules per
      aggregate exist; the trait abstraction is deferred because there is only one backend
- [x] Transaction boundaries for multi-entity writes (invoice + stock move + contact); also POS
      receipts and purchase-order goods receipt write positions, stock and status in one transaction
- [x] Full-text search (`fts5`) for contacts, products, invoices (trigger-maintained indices with a
      guarded prefix query and a substring fallback)
- [x] Legacy import: reader for the legacy `.socdof.json` export (contacts, products, invoices and unknown tables preserved)
- [x] Round-trip test: import a real legacy export → export → identical data, and the legacy importer reads the result
- [x] Money handling: integer cents everywhere, no floats
- [x] Backup: native container (`SOCDOFBK`, metadata and CRC-32, atomic restore) plus the legacy
      `.socdof.json` document. The TypeScript app has no zip or tar container — `backupManager.ts`,
      `db.ts` and `App.tsx` write one JSON file per backup and `jszip` is only used to read DOCX
      templates — so compatibility means that document. `backup` recognises both formats by their
      bytes, reads the legacy header (`app`, `version`, `exported_at`, `backup_owner`, record
      counts), lists both in one folder listing and restores either; `socdof-cli backup` writes the
      format the target name asks for, `restore` accepts both and `backups` lists them.
- [x] Auth: `argon2id` hashes, session tokens (hashed at rest, expiring, revocable), lockout policy
      (5 attempts, 5 minutes) and the roles/permissions matrix with built-in administrator and user roles
- [x] Unit tests for repositories, money math, permission checks (contact/product CRUD, search,
      purchases/goods receipt, POS rollback, billing, calendar, support time tracking, widgets,
      reports, login lockout and FTS5 included)

**Exit criteria:** all domain data lives in SQLite; legacy import verified against a real export.

---

## 5. Phase 2 — Core services

Done so far: backup container with metadata and checksum, crash-safe instance lock with stale
takeover, DIN 5008 invoice PDF with its own writer, civil date formatting, the settings service
(validated company profile plus per-user preferences), the translation loader with embedded
de/en/fr/es catalogues and external language packs, crash-safe autosave snapshots, the stateless
backup scheduler (interval, retention, folder), the local rotating log with crash reports and CSV
import/export for contacts and products (header aliases and delimiter auto-detection). Every
service is reachable from `socdof-cli` and covered by tests.

- [x] Settings service (company profile, accent, theme, language per user)
- [x] Translation loader (compile-time embedded de/en/fr/es + external language packs)
- [x] Autosave / snapshot service (crash-safe, atomic writes)
- [x] Network share lock (`.lock` file with heartbeat and stale takeover)
- [ ] Interactive lock takeover dialog (Phase 5)
- [x] Backup container (metadata, checksum, atomic restore)
- [x] Backup scheduler (interval, retention, target folder, verification)
- [~] File import/export: CSV (contacts, products) and JSON (legacy backup) done; zip, docx read and
      PDF read remain
- [x] Print pipeline: DIN 5008 layout, address field, positions, totals → PDF
- [x] Letterhead background and multi-page position tables with repeated headers (see Phase 8)
- [ ] Update checker (GitHub releases, signature verification)
- [x] Logging + crash report file (no telemetry)
- [x] Service-level tests with temp databases and fixture files

**Exit criteria:** every non-UI service reachable from `crates/cli` and covered by tests.

---

## 6. Phase 3 — Application shell

Done so far: `socdof-app` is a library, a headless binary and the desktop command state.
`Shell::start` takes the instance lock, opens the store and exposes `status`, `backup`, `restore` and
`export_invoice_pdf`; the binary runs that path without a window (`--database`, `--restore`,
`--backup`, `--export-invoice`) and an integration test proves startup, lock contention, backup,
restore and PDF export.

The Tauri 2 window layer lives in `crates/app/src-tauri` as a standalone Cargo workspace. Its
commands are one-line adapters over `socdof_app::desktop::DesktopState`; the shell loads the schema
version, row counts and lock owner through `database_status`, writes a real backup through
`create_backup`, and exposes contact/product list, create, update and delete commands. The frontend
in `crates/app/ui` is a small Vite/TypeScript app with German, English, French and Spanish texts;
its master-data tabs render real rows, filter through the search commands and edit records in native
`<dialog>` forms. Command-layer tests exercise the exact methods the Tauri commands call and run
without GTK/WebKit.

The desktop CI jobs install the Linux WebKit/GTK packages, build the frontend and produce the full
package matrix: AppImage and `.deb` on Ubuntu; a portable ZIP of the built binary (with the WebView2
runtime notice), NSIS setup and MSI on Windows; a universal DMG on macOS. Every file is uploaded as
its own artifact. The
`GUI smoke` job builds the real Tauri binary, starts it under Xvfb with a private XDG data directory
and lets the loaded frontend invoke `database_status`, `create_backup`, contact/product create and
update, and the search-backed list commands. It renders the contacts and products tabs and aborts if
the created rows are missing from the DOM. The `finish_smoke` command validates the returned schema
version, database path, backup bytes, contact/product names, counts and search results against the
live state, writes `smoke-report.json`, logs the values and exits 0; the workflow also checks the
backup container and every runtime marker. The local build image still has no GTK/WebKit development
packages, so the Tauri build and the GUI startup itself run only in CI; the command layer, frontend
build and all non-GTK tests are verified locally.

- [x] Shell lifecycle: single instance lock, database bootstrap, ready status
- [x] Command dispatch: status, backup, restore, invoice PDF export through `socdof-core`
- [x] Headless runner and integration test for the startup path
- [x] Tauri 2 project (`crates/app/src-tauri`), Linux AppImage + `.deb` and Windows portable ZIP + NSIS + MSI in CI
- [x] Real WebView/command runtime smoke under Xvfb, with log and backup artifact
- [x] First screen: schema version, row counts, lock owner and a real backup via commands
- [x] Contacts/products screen: navigation, list, search, create/edit/delete dialogs, all four languages
- [x] Command-layer tests for status, backup, contact/product CRUD and legacy import/export without a window
- [x] Legacy `.socdof.json` import/export with preservation of unknown tables and row fields
- [ ] Window state persistence (size, position, maximized, fullscreen)
- [ ] Splash window with real progress + "ready" handshake
- [x] Single instance guard (lock is held by the shared desktop state; focus needs the window layer)
- [ ] System tray with quick actions
- [ ] Native dialogs: folder picker, file open/save, message boxes
- [ ] Global shortcuts (F11, window snapping, command palette)
- [x] Signed Tauri updater plumbing and release manifest generation (release secrets required)
- [ ] Apple notarization and Windows Authenticode signing
- [ ] Startup measurement harness (cold start → login < 800 ms)

**Exit criteria:** empty shell starts in < 800 ms, installer built and installs cleanly.

---

## 7. Phase 4 — UI foundation

**Decision:** egui (pure Rust, immediate mode, no webview/WASM). Reasons, rejected alternatives and
the step-by-step removal of the Vite/TypeScript frontend are recorded in
[`docs/ui-decision.md`](docs/ui-decision.md).

- [x] **Decision:** egui chosen over Leptos (CSR), Dioxus and Slint — documented in `docs/ui-decision.md`
- [x] Port design tokens from `src/index.css`: accent, accent-companion, radii, spacing, typography
- [x] Theme engine: light / dark / system, palette + accent applied before the first frame
- [x] Component kit: Button, IconButton, Card, Badge, Tabs, SearchField, sortable Table header,
      TextField, Select, Checkbox, Switch, Menu, Drawer, DatePicker, FileDrop area, Modal, Toast,
      EmptyState
- [x] Icon set: 25 Rust-drawn glyphs replace `lucide-react`
- [x] Form framework: validation (required, length, email), dirty tracking, unsaved-changes guard
- [x] Window host: `socdof-ui-gallery` renders the gallery in an eframe window (`--features window`)
- [x] Keyboard navigation: focus list in reading order, Tab/Shift+Tab with wrap-around, focus on
      click, Enter/Space activation, arrows and Home/End in dropdowns, menus and the calendar,
      Escape closes overlays and returns the focus, focus trap in drawer and popups
- [x] Focus rings, hover and pressed states drawn from the accent tokens; accessible labels and roles
      on every interactive element
- [x] Visual regression: deterministic golden snapshots (paint commands, not pixels) for every
      primitive in both appearances and all four languages, including focused and drawer scenes
- [x] Component gallery in de/en/fr/es, both appearances, nine accents (headless test green)

**Exit criteria:** component gallery app renders all states in all four languages, both themes.
Status: **signed off.** The gallery renders in the eframe window, every primitive is keyboard
operable with a token focus ring, and its paint commands are pinned by golden snapshots in both
appearances and all four languages. Phase 4 is complete.

---

## 8. Phase 5 — Desktop shell & window manager

- [x] Desktop canvas with wallpapers, icon grid, drag & drop, saved positions
- [x] Window manager: move, resize, snap, maximize, minimize, close, z-order, focus trap
- [x] Taskbar: pinned apps, running indicators, clock, tray flyout
- [x] Start menu: search over the app list, keyboard navigation, app launch, the user switcher
      (accounts from the store, the signed-in one marked, choosing one prefills its sign-in form) and
      the power flyout with lock, sign-out and quit; Escape closes the flyout before the menu,
      arrows and Enter drive whichever list is open, state machine covered by `start_power_tests`
- [x] Window chrome: minimize / maximize / close with confirmation dialog
- [x] Close cooldown (3 s) after an app window closes, with "are you sure" prompt
- [x] Widgets layer: clock/date, the battery/connection status card, a working calculator (integer
      thousandths, 4×4 pad, chained operations, division-by-zero guard) and a notes card whose text
      the host persists; all four languages, state machine unit tested in `crates/ui/src/widgets.rs`
- [x] Command palette
- [x] Onboarding wizard with four pages, back/next/skip and the persisted seen flag; login, lock and
      first-run screens are `socdof_ui::auth` (Phase 6), so nothing is open in this step

**Exit criteria:** desktop behaves like the legacy app on a 1080p screen; window state survives restart.

**Status:** complete for the Phase 5 scope. `crates/ui/src/desktop.rs` holds the window manager
(plain data, unit tested without a display), the icon grid with drag and drop and persisted cells,
the window chrome with confirmation dialog and reopen cooldown, the taskbar with start and tray
buttons, and the one desktop frame function. `crates/ui/src/shell.rs` adds the start menu, the
fuzzy command palette, the tray flyout and the onboarding; `crates/ui/src/wallpaper.rs` decodes two
bundled PNG wallpapers (`include_bytes!`, cover or tiled) and `crates/ui/src/widgets.rs` owns the
clock/date and status widgets. The gallery opens the shell, the onboarding, the dashboard, the contacts, products, invoices, accounting, purchases, POS and calendar screens, and 144 golden
snapshots (2 appearances × 4 languages × 18 scenes: idle, focused, drawer, desktop, start menu,
palette, tray, onboarding, tiled wallpaper, dashboard, contacts, products, invoices, accounting,
purchases, pos, calendar, settings) pin it. Window positions, icon cells, the wallpaper choice
and the onboarding seen flag are host state and survive language and theme switches; the onboarding
seen flag is persisted through the eframe storage of the gallery host. Login and lock screens are
`socdof_ui::auth` (Phase 6), and the start menu's power flyout, user switcher, calculator and notes
widgets are implemented, so Phase 5 has no open item left.

---

## 9. Phase 6 — Module parity (one checkbox per module, all four languages)

Order chosen by usage frequency in the legacy app.

**Status:** the dashboard is complete. `socdof_core::store::dashboard` aggregates the key figures
(counts, low stock, inventory value at cost and retail, upcoming appointments) and lists the
invoices with contact names; one pure `summarize` function turns them into period totals. The
screen (`socdof_ui::dashboard`) adds period tabs, eight KPI cards, quick actions, the five newest
invoices, the reorder list and an empty state, keyboard reachable and translated. The gallery opens
it from a card, and its deterministic sample data is used only by the gallery and the snapshots.
The dashboard's new-contact action opens the contacts screen; the remaining quick actions still report
to the host. The contacts screen (`socdof_ui::contacts`) lists and searches through the core store,
shows a detail view and writes creates, edits and deletes through `Store::insert_contact`,
`update_contact` and `delete_contact`; domain validation codes map to catalogue keys, so invalid
input never reaches the database. The gallery seeds three contacts in an in-memory store. The products
screen (`socdof_ui::products`) lists and searches through the same store, shows a detail view with
stock bookings through `Store::adjust_stock`, and writes creates, edits and deletes through
`Store::insert_product`, `update_product` and `delete_product`; the form never edits the stock level
directly, so every change keeps a movement. The dashboard's new-product action opens it. The invoices screen (`socdof_ui::invoices`)
lists and searches through the core store, edits positions with live totals, and writes creates,
edits and deletes through `Store::insert_invoice`, `update_invoice` and `delete_invoice`; the
lifecycle moves through `Store::set_invoice_status`. The gallery seeds three invoices in the
in-memory store and the dashboard's new-invoice action opens the form. The accounting screen
(`socdof_ui::accounting`) provides the journal, the cash book with a running balance and the BWA per
account over `store::journal`, with create/edit/delete, period and text filters and a CSV export
copied to the clipboard; schema v5 adds `journal_entries`, and `summarize`, `cash_book` and
`export_csv` keep the arithmetic in the core. The dashboard's accounting action opens it. The
purchases screen (`socdof_ui::purchases`) lists and searches supplier orders, filters by supplier,
shows the open-order count and value, and writes creates, edits and deletes through
`Store::insert_purchase_order`, `update_purchase_order` and `delete_purchase_order`; the lifecycle
moves through `Store::set_purchase_order_status`, and the goods receipt books the domain stock
movements through `Store::receive_purchase_order` in one transaction. The dashboard's purchases
action opens it. The POS screen (`socdof_ui::pos`) lists and searches receipts, filters by payment
method, shows the daily close with net, tax, gross, cash and card totals from a core day-range
query, and writes sales through `Store::insert_pos_order` with the domain stock movements. Cash
receipts record the amount handed over and the change; cancellation through
`Store::cancel_pos_order` returns the sold positions to stock and deletes the receipt in one
transaction. Schema v6 adds `cash_given_cents`. The dashboard's POS action opens it. The calendar
screen (`socdof_ui::appointments`) offers month, week and day views over
`Store::appointments_between` and `Store::search_appointments_between`, a status filter, the agenda,
a detail view with lifecycle changes and a create/edit/delete form. The core gained appointment
search over title, location and notes plus `Store::appointment_conflicts`, which detects overlapping
open slots; the screen refuses conflicting saves with a catalogue error. Contacts are optional and
shown by name. The dashboard's calendar action opens the month view, and the gallery seeds four
appointments through the real insert path. No migration was needed: the `appointments` table has
existed since schema v4.

The settings screen (`socdof_ui::settings`) implements all eight tabs in one screen: general through
the validated company profile, appearance through the active user's preferences, security through
Argon2id password resets and session revocation, backup through create/list/verify/restore, users
through create/edit/delete with custom-role assignment and last-administrator protection, roles
through the full fifteen-module permission matrix, and updates/portable mode through persisted core
policies. The core gained `Store::update_user`/`delete_user` with last-admin protection,
`backup::list_backups` with archive metadata, and validated `UpdateSettings`/`PortableSettings`
services; backup restore writes only to a chosen target file, never over the live database. The
dashboard's settings action opens the screen. The gallery seeds two accounts, the profile and their
preferences through the real core write paths. 192 new keys bring the catalogue to 931 per language
and eight new goldens bring the suite to 144 in 18 scenes.

The user management screen (`socdof_ui::users`) completes the access module: a searchable account
list with role, status and flag badges; a detail view with active-session count, recovery status,
password reset that also revokes every session, and session revocation; recovery answers for two
fixed questions stored as Argon2id hashes in the settings table; and a create/edit form with role
assignment, active and forced-password-change switches. Deletion keeps the core's last-admin
protection and maps it to a catalogue error. The dashboard gained a users quick action, and the
gallery seeds three accounts through the real insert path. The preview renderer now produces 216
PNGs from 27 scenes; 72 new keys bring the catalogue to 1,003 per language and one new golden brings
the suite to 152 in 19 scenes.

The login and lock screens (`socdof_ui::auth`) complete the local session flow. Sign-in goes through
`Store::login`, so failed attempts, the persistent five-attempt lockout and Argon2id verification are
the core paths; disabled accounts get their own message, and an empty database opens the first-run
form that creates the first administrator. An active session locks manually, with Ctrl+L or after
five minutes without input. Unlocking verifies the account password against the live account, keeps
the session, and applies its own five-attempt lockout; signing out revokes the session. Password
fields are masked. The dashboard gained a lock action, the gallery has a login card, and four
goldens per language and theme pin login, lock, setup and signed-in views. The preview renderer now
covers 31 scenes and 248 PNGs; 58 new keys bring the catalogue to 1,061 per language and four new
goldens bring the suite to 184 in 23 scenes.

The App Store completes module activation. `socdof_core::app_store` owns the only catalogue: name
and description catalogue keys, installed version, licence state (included, trial, locked), system
flag and resolved activation. The UI loads that catalogue and writes every switch back with
`app_store::set_active`; nothing is mocked or hardcoded in the screen. System modules cannot be
disabled, the locked therapy module cannot be activated, and unknown, repeated, required, unlicensed
and storage failures map to translated messages. Activation persists in the settings table and
immediately filters the dashboard quick actions and desktop/start-menu icons. The new scene adds 8
goldens (192 in 24 scenes), while the gallery now renders 256 PNGs in 32 scenes from 1,107 catalogue
keys per language. Version 0.20.0.

The text editor stores real documents in the `documents` table (schema 7). `Store` offers insert,
update, find, list, search, delete and count; validation lives in
`socdof_core::domain::document` and rejects empty names/content and overlong values. The egui screen
loads and searches through those methods, shows word and character counts, creates, edits, saves and
deletes documents, and maps missing, validation, IO and storage failures to translated messages.
Unsaved edits are guarded before switching, creating or leaving; confirming discards and cancelling
keeps the draft. The editor has a gallery card, a dashboard quick action (filtered by its App Store
module) and one scene with 8 goldens.The gallery now renders 264 PNGs in 33 scenes from 1,155 catalogue keys per language; the golden suite has 200 files in 25 scenes. Version 0.21.0.

The editor's rich-text ribbon and spell check close the module. Formatting is stored in the document
body as light markup (`**bold**`, `_italic_`, `# heading`, `- list`, `> quote`), so documents stay
plain text for storage, search, backups and the legacy CSV path, and the ribbon applies it to the
character selection: bold and italic wrap the selection, heading/list/quote toggle the line prefixes,
and Ctrl+B/Ctrl+I do the same from the keyboard. A preview toggle renders the formatted document
(heading size, bullets, quote bar, double-painted bold runs and epaint's italic skew) next to the
markup editor, and word counts ignore the markup characters. The spell check (`socdof_core::spell`)
runs offline against the German Hunspell dictionary the shipped application uses (`de_DE.dic` and
`de_DE.aff` from igerman98, GPL, bundled in `crates/core/assets/dictionary` with its licence): it
knows stems, one suffix or prefix rule, a prefix with a suffix, and two-part compounds, ignores short
tokens, and underlines unknown words in the editor. The proofing panel lists each unknown word with
its count, ignores words into a personal dictionary persisted under the `editor_spell_ignored`
setting and can reset it. The ribbon and the panel work in both appearances and all four languages.
Two scenes pin the preview and the proofing state: 256 goldens in 32 scenes, 1,396 keys per language.
Version 0.27.0.

The application window chrome (`socdof_ui::chrome`) is the first step of the visual parity work: every
module screen is drawn inside the SOCDOF app window the shipped application uses, with the accent
frame and top accent line, a 40 pixel title bar carrying the app icon, the translated name, the
`[MODULE]` badge and the minimize, maximize and close buttons, and a header card with the accent
icon tile, title, optional status chip, subtitle and back action. All four languages, the desktop and
the browser preview share those functions, so a screenshot of a screen and the running window cannot
drift apart. The desktop now offers the full app catalogue instead of three icons: eleven modules
with the icon and tile color of the legacy app launcher, wrapping in reading order, with a label
that wraps instead of clipping. Launching an app from an icon, the start menu, the command palette or
the taskbar opens its real screen and reloads the module state from the store; closing that screen
returns to the desktop and releases the running indicator. The dashboard key figures moved from an
overflowing grid to equal-width columns, and module search fields reserve room for the primary action
next to them. Version 0.22.0.

The support app (`socdof_ui::support`) is the next module of the Phase 6 list: a ticket list with
status and priority chips, a local search over subject and description, an open-only filter, a form
with subject, description, priority and status, the four state transitions on the detail view and a
working-time panel that books and removes time entries and shows the ticket total. Validation stays
in `socdof-core`, so an empty subject or a non-positive duration never reaches SQLite. The app carries
its own window chrome and catalogue in all four languages, sits in the launcher and the desktop, and
is pinned by its own golden scene: 1,232 keys per language. Version 0.23.0.

The reports screen (`socdof_ui::reports`) adds the reporting module the legacy app kept next to the
dashboard. `store::reports` is a new core module: `load` gathers the invoices of a half-open period
with their contact names and totals, adds the tracked minutes of the same range and returns a
`Report` with a `ReportSummary` (invoice count, net, tax, gross, paid share, open share, minutes) and
the gross total per invoice state; `summarize` and `status_totals` stay pure and are unit tested, so
the screen only formats. The screen offers four periods (7, 30, 90 and 365 days), seven key figures,
a per-state breakdown with share bars, and the invoice table with number, contact, date, state and
gross, plus empty and error states and a locale-independent `dd.mm.yyyy` formatter. The feedback form
of the legacy module is not implemented yet. The app carries its own window chrome, sits in the
launcher and the desktop and has its own golden scene: 1,265 keys per language. Version 0.24.0.

The therapy practice (`socdof_ui::therapie`) completes the licensed module: schema v8 adds
`therapy_clients` and `therapy_sessions` (id, rates, active flag; start, minutes, kilometres in
thousandths, notes and the linked invoice), and `store::therapy` offers the full CRUD, the session
queries by client and by range, the session count and `link_invoice`, which puts every open session
of a client on one invoice in a single statement. `domain::therapy` owns the arithmetic:
`session_amount` bills minutes at the hourly rate plus kilometres at the kilometre rate with integer
rounding, and `summarize` returns sessions, minutes, kilometres, the billable total and the split
between billed and open amounts as a pure, tested function. The screen lists and searches clients
with their session count and rates, shows the key figures, the session history with the amount of
every session and a billed badge, books sessions, links the open ones to an invoice by number and
keeps empty, validation and storage states in all four languages. The module is reachable from the
launcher, the desktop, the gallery, the start menu, the command palette and its own preview scene,
and is pinned by a new golden set: 1353 keys per language. Version 0.25.0.

The documentation pass and the Studio drawer close the Phase 6 module list. `README.md`,
`docs/architecture.md` and `CHANGELOG.md` now describe the state of the code instead of the state of
an early milestone: the architecture file lists the reports, therapy and maintenance modules and the
current schema version, the readme walks the gallery through every finished screen, and the changelog
has one section per released version from 0.22.0 to 0.26.0 with the modules, schema steps and
catalogue counts of each.

The Studio drawer (`socdof_ui::studio`) opens from the desktop taskbar and the command palette as a
real right-side drawer. Its letterhead tab edits the company profile that documents print through the
validated settings service, with the stored profile as the starting point; an empty profile shows the
empty state instead of a blank form, and the core's `company_name_required` code maps to its own
message. Its data tab shows the stored contacts, products, invoices, purchase orders and receipts
from the store and offers the clean mode: `Store::reset_business_data` deletes every business record
in one transaction while the schema, the accounts, the roles, the sessions and the settings survive.
The destructive action is behind its own confirmation dialog, and the drawer renders in both
appearances in all four languages. It is pinned by two golden scenes: 240 goldens in 30 scenes (letterhead and data tab),
1,381 keys per language. Version 0.26.0.

- [x] Dashboard — period KPIs, quick actions, recent invoices, reorder list, empty state
- [x] Contacts — list with core search, detail view, create/edit/delete form with validation, delete confirmation and four languages; sub-contacts and country autocomplete remain
- [x] Products & stock — list with core search, detail with stock bookings through `adjust_stock`, create/edit/delete form, reorder exclusion and four languages; labels and smart reorder remain
- [x] Invoices — list with core search, detail with positions/totals, create/edit/delete, status changes and four languages; DIN 5008 print, templates, dunning, email draft and payment modal remain
- [x] Accounting — journal with create/edit/delete, cash book with running balance, BWA per account, CSV export and four languages; account plans, DATEV export and print remain
- [x] Purchases — list with core search and supplier filter, open-order summary, detail with positions/totals, create/edit/delete, status changes, goods receipt with stock bookings and four languages; partial receipts in the UI, order PDF/email and supplier master data inside the module remain
- [x] POS / cash register — receipt list with core search and payment filter, daily close with payment totals, detail with positions/totals/change, sale form with product positions and stock booking, cancellation with stock return and four languages; receipt print, cash sessions/drawer counts, discounts and customer assignment remain
- [x] Calendar — month/week/day views over core range queries, search and status filter, agenda, detail with lifecycle changes, create/edit/delete form, overlap check for open slots and four languages; all-day entries, recurrence, reminders, drag-and-drop and a dedicated mobile layout remain
- [x] Settings (all tabs: general, appearance, security, backup, users, roles, updates, portable)
- [x] User management — searchable accounts, create/edit/delete with custom roles and last-admin protection, password reset with session revocation, active-session count, two Argon2id recovery questions and four languages; login/lock screen and self-service recovery flow remain
- [x] Login and lock screen — local sign-in through sessions, persistent failed-attempt lockout, disabled-account and empty-database setup paths, manual/Ctrl+L/inactivity lock, password unlock and sign-out; self-service security-question recovery remains
- [x] App Store — core catalogue with persisted activation, licence and system state, translated unknown/repeat/locked/required/storage failures, dashboard action and immediate navigation filtering
- [x] Documentation & changelog — readme, architecture file and changelog describe the delivered state; per-module manuals and the release-notes translation remain with Phase 10
- [x] Text editor — persistent core documents, search, create/edit/save/delete, word and character counts, translated validation/missing/storage errors and an unsaved-changes guard; the rich-text ribbon (bold, italic, heading, list, quote, Ctrl+B/Ctrl+I), the formatted preview, markup-safe word counts and the offline German spell check with underlines, a proofing panel and a persisted personal dictionary are done; the document layout editor now lives in the Studio layout tab (Phase 8), per-template variations remain open
- [x] Therapy practice — schema v8 with clients and sessions, core CRUD, pure amounts and summaries, client list and detail with key figures, session history and booking, invoice link by number and four languages; appointment sync, series appointments and the treatment report remain
- [x] Support & tickets — ticket list with search and open filter, detail with the four status transitions, form with validation and working-time panel that books, lists and removes entries; attachments and the Discord report remain
- [x] Reports — period report over core aggregates: invoices with contact names, net, tax and gross, paid and open share, per-state totals, tracked hours and the invoice table; the feedback form remains
- [x] Studio drawer — letterhead editing through the settings service with empty and error states, record counts and the confirmed clean mode that clears business data and keeps accounts, roles and settings; the layout tab with letterhead background and token placement is done (Phase 8), per-template variations remain open

Per module definition of done:

- [ ] CRUD complete, empty states, validation, keyboard shortcuts
- [ ] All four languages translated
- [ ] Legacy data readable
- [ ] Print/export where the legacy module supports it
- [ ] Unit + UI tests green

---

## 10. Phase 7 — Internationalisation

- [x] Generator: `socdof-cli locales <src/lib/i18n.ts> <report.json> [catalogue-dir]` reads the
      legacy catalogue and writes a coverage report. `socdof_core::i18n_legacy` parses the TypeScript
      object literal (quoted and bare keys, escapes, comments; template strings and concatenations
      are skipped on purpose and therefore stay uncovered) and `coverage` compares each language by
      exact text, per module prefix. The committed report is `docs/legacy-locales.json`: 2,963 (de),
      2,964 (en), 2,962 (fr) and 2,962 (es) legacy keys, of which 342, 307, 341 and 351 already exist
      verbatim in the Rust catalogue (11–12 %). The rest is rewritten UX wording or a module the Rust
      build does not ship (download page, updater, restaurant), which the report shows per module
      instead of hiding in a total.
- [x] Stable key compatibility check (no key silently dropped): `crates/ui/locales/catalogue-keys.json`
      is the reviewable copy of `UI_KEYS`, written by `socdof-ui-catalogue`; the test
      `the_committed_key_inventory_matches_the_catalogue` fails when a key is added or removed
      without regenerating it, and `legacy_compatibility::the_catalogue_never_loses_legacy_texts`
      keeps the number of legacy texts each language carries from dropping below its committed
      floor, so neither a key nor a text can disappear unnoticed between releases.
- [x] Plural handling where the legacy strings relied on concatenation: `UiTexts::count(key, n)`
      selects the `_one` / `_other` form of the language (French also uses the singular for zero)
      and replaces `{count}`. The module subtitles of users, products, purchases, POS, calendar and
      accounting read the count through it instead of gluing a bare number to a label. The key gate
      now also collects `.count("…")` literals and accepts a base key when both of its forms exist.
- [x] External language packs (custom JSON in `languages/`) stay loadable: `UiTexts::with_pack` and
      `UiTexts::with_packs` overlay `*.json` packs in file-name order over the embedded catalogue; a
      missing folder means "no packs", an unreadable pack fails instead of rendering blank labels,
      and the gallery host reads the folder named by `SOCDOF_UI_PACKS`.
- [x] Missing-key detection: the `key_coverage` test in `crates/ui/src/i18n.rs` walks every source
      file under `crates/ui/src`, collects each literal `.get("…")` key and fails the build when a
      key is used but not declared in `UI_KEYS`

**Exit criteria:** key coverage for de/en/fr/es is 100 % of used keys; no hardcoded UI string in Rust code.

---

## 11. Phase 8 — Files, print & interoperability

- [x] DIN 5008 PDF output verified norm-based: `pdf::din5008::LetterGeometry` names every
      measurement of form B (A4 210 × 297 mm, text margins 25/20 mm, letterhead 45 mm, address field
      45–90 mm and 85 × 45 mm at 20 mm from the left with the address zone from 62.7 mm, return-sender
      line at 43 mm, information block from 50 mm at 125 mm with at most 75 mm width, subject at
      98.46 mm, body at 111.5 mm, fold marks at 105 mm and 210 mm, hole mark at 148.5 mm, footer from
      277 mm, last text line 257 mm) and draws the marks as 5 mm lines inside the 20 mm binding margin.
      Tests read the coordinates back out of the PDF content stream and compare them in millimetres
      with a 0.05 mm tolerance, prove that a long body text wraps inside the 165 mm column, and that
      60 positions break into three pages without a single line reaching the footer area. The
      pagination reserves the totals block, so the closing line never lands in the footer.
      **No legacy reference exists:** the repository contains no PDF, print screenshot or print layout
      of the TypeScript app (searched `*.pdf` plus the TS print/Studio code), therefore the comparison
      is against the norm and not against a legacy document. One correction to the brief: DIN 5008
      form B puts the hole mark at half the sheet height, 43.5 mm below the first fold mark; the 8.7
      figure is 8.7 cm, the first fold mark of *form A* (87 mm), which templates often quote in
      centimetres.
- [x] Multi-page tables with repeated headers and row splitting — position tables paginate (19 rows on page one, 33 on each continuation page), the column header repeats on every page, totals and the closing line appear only on the last page, `Seite X von Y` is printed per page, and the letterhead background plus the placed `document_layout` tokens are painted on every page (background under, tokens over the content); a row that does not fit moves whole to the next page
- [x] Letterhead background + token placement — a PNG letterhead is embedded into the PDF as a Flate-compressed DeviceRGB image XObject and painted under the DIN 5008 content, nine tokens (company name/address/contact, tax id, invoice number/date, due date, subject, footer) are placed in page percentages with size, bold and left/center/right alignment, edited in the Studio layout tab, validated in `document_layout`, persisted as the `document_layout` setting and applied by `export_invoice_pdf`; per-template variations remain open
- [x] HTML export and Word documents: `richtext::to_html` renders the editor markup as escaped HTML
      (headings, bullet lists, quotes, bold and italic) and is unit tested. `socdof_core::docx` adds
      a real OOXML package — ZIP container, `[Content_Types].xml`, both relationship parts,
      `word/document.xml`, `word/styles.xml`, `docProps/core.xml` and `docProps/app.xml` — with the
      same values the DIN 5008 PDF prints (number, dates, recipient block with one address line per
      `<w:br/>`, positions with quantities/unit prices/amounts, totals block, payment note, company
      footer, tax id) and matching metadata (title, creator, creation timestamp as W3CDTF). The
      reader turns any `.docx` back into blocks (headings by style, paragraphs with bold/italic runs,
      tables with merged runs, page breaks) plus the core properties, which is the shape the
      TypeScript template import produced. It is wired to `socdof-cli invoice-docx <database>
      <number> <out.docx>` and `Core::export_invoice_docx`. Tests write the package and open it with
      `python-docx` (address lines, every table cell, totals, payment note, title/author) and read a
      package produced by `python-docx` (`fixtures/foreign.docx`) to prove the parser is not a mirror
      of the writer; a write → read round trip compares blocks and metadata, a 60 position invoice
      keeps every row, and empty, truncated or broken packages return typed `DocxError` values
      instead of panicking.
- [x] Code 128 and QR encoders done natively (`socdof_core::barcode`): Code 128 with the ISO/IEC
      15417 pattern table, the modulo-103 check symbol and module bits for PDF and print; QR after
      ISO/IEC 18004 with numeric, alphanumeric and byte mode, versions 1 to 40, levels L/M/Q/H,
      Reed-Solomon over GF(2^8), block splitting and interleaving, the norm's eight masks scored by
      its penalty rules, format and version information. `qr()` returns the smallest version that
      fits and `QrError` reports an empty payload or one beyond version 40 instead of panicking.
      `pdf::writer::Page::qr` draws a symbol with its four module quiet zone, and
      `socdof-cli qr <text> [L|M|Q|H] [label.pdf]` prints the matrix or writes a label PDF — the only
      Rust render path so far, because the TypeScript QR surfaces (product label, mobile pairing) are
      not ported yet and the invoice has no EPC/IBAN payload to encode. Tests compare the produced
      matrices module for module with two independent encoders: `qrcode` 1.5.4 for Node (the library
      the TypeScript app uses) over 16 vectors from version 1 to 40 across all levels and modes,
      including automatic version and mask selection, and `python-qrcode` from PyPI over the 15 ASCII
      vectors at the same version, level and mask. Unit tests cover the published format-string
      table, the BCH checks of format and version information, finder, timing and alignment patterns,
      the dark module, capacity growth and the defined errors; the Python comparison skips the one
      payload with umlauts because that encoder writes Latin-1 where this one writes UTF-8.
- [x] Backup container compatible with legacy `.socdof` archives: the legacy archive is its JSON
      backup document, not a zip. `backup::inspect_archive`, `list_archives` and `restore_archive`
      treat `*.socdof.json` as a first-class archive next to the native `SOCDOFBK` container;
      `backup::legacy_metadata` reads `app`, `version`, `exported_at`, `backup_owner` and the record
      counts from the arrays (not from a possibly stale `data_summary`), and
      `socdof-cli backup <database> <file.socdof.json>` writes a document the legacy importer
      accepts. Reached from `socdof-cli backup|restore|backups` and the core API. References: the
      committed real backup `crates/core/tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json`
      (written by the TypeScript exporter) is inspected, listed by `tests/legacy_archive.rs`,
      restored into a fresh database and round-tripped (write → restore → identical contacts,
      products and unknown tables); the produced document is parsed by Python's `json` module
      (app marker, `version: 2`, `exported_at`, owner, every record table, amounts); and empty,
      whitespace-only, zip, non-object, foreign-app, unsupported-version, corrupt-timestamp and
      truncated files return typed `backup_truncated` / `backup_invalid_format` /
      `backup_unsupported_version` / `backup_corrupt` errors without creating a database.
- [x] Mobile companion sync endpoints (HTTP, same payloads as legacy): `mobile_sync::payload`
      validates the document of `SOCDOF - TS/src/lib/mobileCompanionTypes.ts`
      (`SOCDOF_MOBILE_COMPANION_V1`, `exportVersion`, `summary`, `date_range`, `tickets`, `sessions`
      with the five note fields, `trips`, `customers`, `standalone_timesheets`,
      `standalone_expenses`, also wrapped in `data`/`payload`/`export`) and imports it as support
      tickets plus tracked time. `mobile_sync::http` serves the routes of
      `SOCDOF - TS/vite.config.ts` (`mobile-sync-api`) and `SOCDOF - TS/electron/main.cjs`
      (`startMobileSyncServer`): `GET /api/mobile-sync/info`, `GET|POST /api/mobile-sync/ping|test`,
      `POST|PUT /api/mobile-sync|/upload|/submit`, `GET /api/mobile-sync?token=…&consume=true`,
      `OPTIONS` 204 and the CORS headers, on port 3000 with the 3001 fallback, keeping the token,
      UPPER/lower, `latest` and `device_<id>` slots readable for twenty minutes. Reached from
      `socdof-cli companion-sync <database> [port] [--once]`,
      `socdof-cli companion-import <database> <payload.json>` and
      `mobile_sync::http::{start, start_with, client}`. Deliberate differences: broken JSON, a
      non-object body and a foreign `protocol` answer `400` with `mobile_invalid_json` /
      `mobile_invalid_payload` / `mobile_unsupported_protocol` instead of being stored as raw text,
      and `ips` carries the primary LAN address because Rust has no interface enumeration.
      References: the running gateway was spoken to with Python's `http.client` (discovery, ping,
      preflight, upload with pairing token, poll, `consume`, typed failures, unknown path), a foreign
      request was replayed into it, and `crates/core/tests/fixtures/mobile/sync_payload.json` imports
      to 3 tickets, 405 minutes, 93,20 € in four expenses and 84,0 km in `tests/mobile_sync.rs`;
      the same document round-trips through the client unchanged.

---

## 12. Phase 9 — Performance & size budget

- [ ] Installer ≤ 15 MB, installed ≤ 40 MB — harness and limits exist (`scripts/budgets.json`,
      `scripts/check-budgets.mjs`); the Tauri bundle cannot be built in a container without
      GTK/WebKit, so the number is measured in the CI `desktop` job
- [ ] Idle RAM ≤ 120 MB, idle CPU < 0.5 % — sampling method fixed; measured in the CI `gui-smoke`
      job under Xvfb, which is the only place a window exists
- [x] Cold start < 800 ms: 144 ms median of five runs of the release `socdof-app` on a fresh
      database (instance lock, schema migration, status) measured 2026-11-09 with the harness in
      `scripts/check-budgets.mjs`; the windowed desktop only adds the Tauri window on top
- [ ] Large dataset test: 50k contacts, 100k invoices — list scroll at 60 fps. Measured as open:
      both lists still lay out every row. Virtualisation and the frame benchmark are the next step
      (plan in `docs/performance.md`)
- [ ] Memory profiling report attached to this file — `docs/performance.md` documents method and
      values; the UI memory profile waits for the large-dataset harness
- [x] UI bundle ≤ 1.5 MB (≤ 400 KB gz): the desktop frontend built by `npm run build` is 52,305 B
      raw and 15,535 B gzip against 1,572,864 B / 409,600 B. The separate browser bundle (6,415,465 B
      raw, 2,991,359 B gzip) is documented in §14 and guarded by its own regression limit

---

## 13. Phase 10 — Packaging & release

- [ ] NSIS installer + portable build, both code-signed
- [ ] Auto-update channel with rollback
- [ ] Migration wizard on first start (import legacy data, keep a backup)
- [ ] Dual-run period: legacy and Rust versions share the same data folder safely (lock file)
- [ ] Release notes in all four languages
- [ ] Manual: installation, portable mode, network shares, troubleshooting

---

## 14. Browser (WebAssembly) target

The interface also runs in a browser. `crates/web` is an `eframe` (egui) host compiled to
`wasm32-unknown-unknown` and built with Trunk; it opens the same `socdof-core` store. Nothing is
reimplemented for the web: the same screens, the same SQLite schema and migrations, the same FTS5
queries, the same Argon2id login and the same user management.

- [x] `crates/web`: `#[wasm_bindgen(start)]` entry, `WebRunner` on the `socdof-canvas` element,
      panics reported to the console
- [x] eframe/egui compiled to WebAssembly, bundled by Trunk (`trunk build --release`)
- [x] SQLite in the browser: `rusqlite` 0.40 links `sqlite-wasm-rs` on wasm, so schema migrations,
      FTS5 search, sessions and password hashes run unchanged
- [x] Browser platform shims: `now_millis()` reads `Date.now()`, `.cargo/config.toml` selects the
      `getrandom` wasm backend, `uuid` uses its `js` feature
- [x] Real first-run setup: an empty browser database opens the setup form and creates the first
      administrator through `Store::insert_user`
- [x] Real login: `Store::login` with failed-attempt counting, the persistent lockout and the session
      token; the host shows the auth screen until a session is signed in
- [x] Desktop and every module screen in the browser: icon grid, wallpapers, taskbar, start menu,
      command palette, window chrome, dashboard quick actions, and an account chip that signs out
- [x] Dashboard figures from the live store (`Store::dashboard_snapshot`) instead of sample data
- [x] Persistent browser storage: the database is serialized after every change
      (`Store::snapshot_bytes`) and kept in IndexedDB (`crates/web/src/storage.rs`); the host
      restores it (`Store::restore_snapshot`) before the first screen, so accounts, roles, sessions
      and business data survive a reload, a hard reload and a new tab, and the setup form only
      appears when no database has ever been stored
- [x] Pointer accuracy: `sync_canvas_size` keeps the canvas backing store on its CSS box, so egui
      paints and hit-tests in the same grid and a click reaches the control under the cursor even
      after the panel was resized
- [ ] OPFS instead of IndexedDB: `sqlite-wasm-vfs` needs `FileSystemSyncAccessHandle`, which browsers
      only expose in a dedicated worker; the host has no worker, so the serialized image in
      IndexedDB is the supported route for now
- [x] Web build in CI: the `web` job in `.github/workflows/rust.yml` installs the wasm target and
      Trunk, builds `crates/web` in release mode, checks that `index.html` and a wasm bundle of
      plausible size exist and uploads `crates/web/dist` as an artifact
- [ ] Print, backup, CSV and legacy import in the browser: they need file access and stay
      desktop-only for now

Measured bundle: 5.4 MB wasm, 2.5 MB gzip, plus 70 KB JavaScript glue.

**Build and run:**

```bash
rustup target add wasm32-unknown-unknown
cd crates/web
trunk serve --address 0.0.0.0 --port 3000      # or: trunk build --release, then serve dist/
```

`clang` with wasm support (LLVM 15 or newer) must be on `PATH`; `sqlite-wasm-rs` compiles the SQLite
amalgamation to wasm with it.

---

## 15. GUI parity with the TypeScript app

The TypeScript application in `SOCDOF - TS` is the visual contract of this rewrite: same accent
system, same surfaces, same geometry. Parity is therefore measured against that app, not from
memory. Host it, walk the first-run flow, read the values out of its stylesheet, and only then change
a Rust token.

### 15.1 The reference walkthrough

```bash
cd "SOCDOF - TS"
bun install --frozen-lockfile          # node_modules is not committed, ~330 packages
./node_modules/.bin/vite --port 3000 --strictPort --host 0.0.0.0
```

`vite.config.ts` already binds `0.0.0.0` and sets `allowedHosts`, so the preview hostname of the chat
works without touching the file. Only one server can own port 3000 per chat: stop the Rust host
(`python3 -m http.server … --directory crates/web/dist`) before starting Vite, and vice versa.

Walk this path and screenshot every step; it is the path the Rust app has to reproduce:

| Step | Legacy screen | Source |
|---|---|---|
| 1 | language chooser (`DE / US / FR / ES`, `Continue`) | `src/components/AuthGate.tsx` |
| 2 | setup step 1 — account: display name, username, account type, avatar, password with strength meter, recovery question | `AuthGate.tsx` |
| 3 | setup step 2 — appearance: nine accent swatches, light/dark/system, wallpaper upload | `AuthGate.tsx` |
| 4 | setup step 3 — app template and per-app selection | `AuthGate.tsx` |
| 5 | lock screen: dark wallpaper, clock, avatar, one password field, "forgot password", quick switch | `AuthGate.tsx` |
| 6 | desktop: wallpaper, icon grid, window controls top right, taskbar | `src/components/DesktopWindowWorkspace.tsx` |

Reference screenshots taken this way are committed in `docs/artifacts/gui-parity/`:
`ts-01-language.png`, `ts-02-setup-account.png`, `ts-03-setup-appearance.png`,
`ts-04-lock-screen.png`, `ts-05-desktop.png`.

The Rust counterparts come from the preview binary, which calls the same screen functions and
rasterises them headlessly, so they are reproducible and exactly as wide as the legacy screenshots:

```bash
SOCDOF_PREVIEW_SIZE=432x771 cargo run -p socdof-ui --bin socdof-ui-preview -- desktop
SOCDOF_PREVIEW_SIZE=432x771 cargo run -p socdof-ui --bin socdof-ui-preview -- auth-locked
SOCDOF_PREVIEW_SIZE=432x771 cargo run -p socdof-ui --bin socdof-ui-preview -- auth-login
```

`rust-02-lock-screen.png`, `rust-03-desktop.png` and `rust-04-login.png` are those renders at
432×771, the window size of the legacy screenshots, so the two sets compare without scaling;
`rust-05-setup.png` and `rust-06-desktop-wide.png` cover the wizard and the 1280 px shell, and
`rust-07-overflow.png`, `rust-08-free-icons.png` and `rust-09-setup-wallpaper.png` document the
overflow menu, the free icon placement and the wallpaper step of the wizard. They are the only
accepted evidence that the two applications match; re-take them whenever a parity change lands.

### 15.2 Where the values come from

- Colours, radii and shadows: the `:root` block of `SOCDOF - TS/src/index.css` (accent variables,
  `--accent-card-shadow`, `--accent-companion`) and `src/lib/accent.ts` (preset list, hue rules).
- Geometry and type: the Tailwind classes on the component (`w-24`, `h-12`, `rounded-2xl`, `text-xs`,
  `min-h-[44px]`), converted at 16 px per rem.
- Screenshots are evidence, never a colour source: gradients, blurs and the display profile shift
  every sampled pixel.

Rust counterparts: `crates/ui/src/tokens.rs` (spacing, radii, font sizes, accent presets),
`crates/ui/src/theme.rs` (`Palette::of`, egui style), `crates/ui/src/desktop.rs` (taskbar, icon grid,
window geometry), `crates/ui/src/chrome.rs` (window chrome, app tiles) and
`crates/ui/src/wallpaper.rs`.

### 15.3 Measured reference values

| Aspect | Legacy (measured 2026-11-08) | Rust today (implemented 2026-11-08) | Target |
|---|---|---|---|
| Accent indigo | `#4f46e5`, hover `#4338ca`, tint 12 %, ring 35 %, border `#6366f1`, dark text `#818cf8` | identical in `tokens.rs` | keep |
| Companion accent | `#0d9488`, hover `#0f766e`, tint 18 % | status dot of the taskbar pill | keep |
| Light surfaces | background `#f6f8fb`, card `#ffffff`, muted `#f1f5f9`, border `#e2e8f0`, text `#0f172a`, muted text `#64748b` | identical in `Palette::of` | keep |
| Dark surfaces | background `#020617`, card `#0f172a`, muted `#1e293b`, border `#334155`, text `#f8fafc` | identical | keep |
| Card shadow | `0 4px 20px -2px rgba(accent,.07), 0 1px 3px rgba(0,0,0,.03)`; hover `0 8px 30px -4px rgba(accent,.20)` | `tokens::shadow_layers` stacks 6 rounded rects of 2 % accent each (hover 8, dialog 10); `components::shadow` paints them below cards, dialogs and windows | keep, tune per surface |
| Control radius | 12 px (`rounded-xl`) | `RADIUS_CONTROL` 12 | done |
| Card and dialog radius | card 16 px, dialog and window 24 px (`rounded-3xl`) | cards 16, floating windows 24 (`RADIUS_DIALOG`); `components::modal` uses the same 24 px dialog radius | done |
| Control height | 40 px desktop, 44 px minimum on touch (`min-h-[44px]`) | `CONTROL_HEIGHT` 40 | done |
| Type | body 14 px, secondary 12 px, form label 12 px semibold | `FONT_BODY` 14, `FONT_SMALL` 12; form labels use the bundled `Semibold` family (`theme::semibold`) | done |
| Font stack | `system-ui, "Segoe UI", Roboto, …` | bundled Source Sans 3 Regular and Semibold (SIL OFL) as the first entry of the Proportional family, egui's built-in faces stay behind it as glyph fallback; egui 0.27 cannot read system fonts, so the OS face cannot come first | done with a bundled face |
| Taskbar | 48 px, top border, glass `rgba(255,255,255,.9)` with 24 px blur; start 36×36 radius 12; running apps 36×36 radius 12; search pill; task view; clock 12 px with seconds | `TASKBAR_HEIGHT` 48 with a 84 % translucent surface (no blur, egui cannot blur a panel); start, apps, Studio and tray are 36×36 at radius 12; search pill from 640 px width; clock `HH:MM:SS`; app buttons that no longer fit move into a 28×36 overflow button whose popup lists them as ghost buttons; a task view button opens the window overview and a version pill with the companion dot appears from 700 px | done except backdrop blur |
| Desktop icon | cell 96 px wide, 96–104 px high, tile 48×48 radius 16, glyph 24 px, label 12 px semibold, two lines, 90 px wide; open marker 20×4 | cell 96×104, tile 48 px radius 16, glyph 24 px, label 12 px wrapped at 90 px, open marker 20×3, an accent drop shadow, a vertical gradient and hover and selection tint; a drag stores a free pixel position (`DesktopIcon::pos`) that wins over the cell | done |
| Icon grid | responsive, three columns at 432 px width, free drag and drop | `IconGrid::columns`: 3 below 440 px, 4 below 768 px, then one column per 136 px up to 6; a drag without a free position moves between cells, otherwise it clamps to the free position | done |
| Wallpaper | no image by default: lavender to white gradient, user image optional | `Wallpaper::Plain` is the default and paints two vertex gradients (accent washed into white, plus a left-to-right corner wash); aurora and dusk stay selectable | done |
| Window chrome | 40 px title bar, 24 px radius, accent rim, 40×32 window buttons, soft outer shadow | 40 px title bar, 24 px radius with only the top corners rounded, 32×32 window buttons, dialog shadow | done |
| Scrollbars | 6 px with a translucent thumb | 6 px bar and thumb, minimum handle 12 px | done |

### 15.4 Screen differences that are structural

These are not token tweaks; each one is its own piece of work.

1. **Lock screen — done.** `AuthView::Locked` draws the 48 px clock, the date, a 56 px avatar, the
   account name and one password field above unlock and sign out. A "forgot password" link explains
   who resets passwords, and the other active accounts appear as switch tiles: choosing one makes
   that account's password the one that unlocks. Still open: the dark blurred backdrop, the Rust lock
   screen keeps the app background.
2. **First-run setup — done.** The wizard runs four steps with a numbered pill and a step list:
   language, account (display name, user name, password, repeat and a three level strength meter),
   appearance (light or dark plus the nine accent swatches) and desktop layout (sales, office,
   everything). Back and Continue move between the steps, the last step creates the administrator
   and jumps back to the account step when validation fails. The host applies language, appearance
   and accent as soon as the step reports a choice. The appearance step also offers the wallpaper
   presets and a PNG drop zone: a dropped file is decoded (`wallpaper::decode_png`, 8-bit RGB/RGBA),
   kept as `CustomWallpaper` and cached as a texture per revision, and the wizard finishes with
   `AuthState::take_wizard_completed`, which makes the host apply the chosen layout template through
   `IconGrid::retain_apps` (sales, office or everything). There is no native file dialog in egui 0.27,
   so the upload is drag and drop only; the desktop build additionally accepts the real file path.
3. **Taskbar — done.** Translucent 48 px bar, 36×36 buttons at radius 12, search pill from 640 px,
   task view from every width, version pill with the companion dot from 700 px, clock with seconds,
   and app buttons that would push the clock off the bar are dropped. The task view lists every open
   window; clicking one raises it and closes the overview. App buttons that no longer fit go into
   the 28×36 overflow button, which opens a popup ("Weitere Apps") listing them as ghost buttons that
   open the app. Still open: the status text shows the crate version, and the backdrop blur of the
   glass surface, which egui cannot paint on a panel (see 15.6).
4. **Desktop — done.** 48 px tiles with a vertical gradient, an accent drop shadow, wrapped 90 px
   labels, hover and selection tint, an open marker and the responsive column count (3 / 4 / N)
   instead of the fixed six. Dragging an icon stores a free position that overrides its grid cell
   (clamped to the desktop area, cleared when a layout template is applied), while the cell keeps
   keyboard navigation and persistence working.
5. **Toasts — done.** `components::toast_stack` draws the legacy glass cards in the bottom left:
   tone icon tile, uppercase 11 px title, 13 px body and a close button, stacked upwards with the
   card shadow. The form and gallery actions use it with titles, and the previous badge line is gone.

### 15.5 Definition of done for a parity change

- [ ] the legacy screen was hosted and screenshotted in this chat before the change
- [ ] changed values trace back to `index.css`/`accent.ts` or a Tailwind class, never to a sampled pixel
- [ ] the change touches tokens, geometry or a shared component, not the module list, the texts or behaviour
- [ ] new or renamed texts exist in de, en, fr and es
- [ ] `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` green
- [ ] `UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual` accepted on purpose, goldens committed
- [ ] `trunk build --release` in `crates/web` and the browser build checked against the screenshots
- [ ] `docs/artifacts/gui-parity/` re-taken and linked here

### 15.6 Open parity work

- [x] shadow helper (`tokens::shadow_layers`), used by cards, dialogs, windows, tiles and toasts
- [x] control height 40, control radius 12, card 16 and dialog/window 24
- [x] taskbar: 36×36 buttons, translucent surface, search pill, task view, version pill, seconds clock
- [x] desktop: 48 px gradient tiles with an accent shadow, wrapped labels, open marker, responsive columns
- [x] plain gradient wallpaper as the default
- [x] lock screen with clock, date, avatar, password field, recovery hint and account switch tiles
- [x] first-run wizard with language, account, appearance and layout steps, strength meter and swatches
- [x] toast component replacing the badge confirmation line in the modules
- [x] companion accent color for the taskbar status dot
- [x] taskbar overflow menu (`OverflowMenu` in `shell.rs`, popup in `desktop.rs`, button appears only
      when apps are hidden); evidence `rust-07-overflow.png`
- [x] free placement of desktop icons beyond grid cells (`DesktopIcon::pos`, `IconGrid::place_at`,
      drag end clamps into the desktop); evidence `rust-08-free-icons.png`
- [x] wizard: wallpaper upload (PNG drag and drop, `CustomWallpaper` texture cache) and applying the
      chosen layout template to the desktop (`IconGrid::retain_apps` on `take_wizard_completed`);
      evidence `rust-09-setup-wallpaper.png`
- [x] bundled font stack: Source Sans 3 Regular and Semibold in `crates/ui/assets/fonts`, installed by
      `theme::install_fonts`, egui defaults kept as glyph fallback
- [x] semibold form labels through the `FontFamily::Name("Semibold")` family (`theme::semibold`), used
      by the field labels in `controls.rs`; egui has no synthetic bold, hence a second face
- [ ] backdrop blur of the taskbar glass — not possible in egui 0.27: a panel paints straight into the
      window framebuffer and epaint has no render-to-texture or post-process pass, so nothing can blur
      what is behind the bar. The honest alternative is the current 84 % translucent surface; a real
      blur would need a custom wgpu callback with an offscreen pass and is out of scope here.
---

## 16. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| UI framework choice is wrong | months lost | Phase 4 decision gate with a clickable prototype of 3 screens |
| Print layout cannot reach legacy fidelity | invoices unusable | golden-file PDF diff from Phase 8 onward, earlier smoke test in Phase 2 |
| Legacy data migration loses records | user data loss | import → export → diff test, automatic pre-migration backup |
| WebView differences on older Windows 10 | broken UI | test matrix on Win10 1809+, Win11, with WebView2 evergreen check |
| Scope creep during parity | never ships | fixed module order, nothing new before Phase 6 completes |
| Single maintainer bandwidth | stalls | phases are independently shippable; each ends with a working build |

---

## 17. Open questions

- [ ] Does the Rust build ship as a separate download next to the Electron build, or replace it?
- [ ] Are custom user language packs (external JSON in `languages/`) a hard requirement?
- [ ] Which Windows versions must be supported (Win10 1809 vs. Win11 only)?
- [ ] Is the mobile companion sync required at launch?

---

## 18. Progress log

| Date | Phase | Note |
|---|---|---|
| 2026-11-07 | 0 | Branch and this plan created. Legacy baselines measured: 112,790 lines TS/TSX, 11 MB `dist`, 3.9 MB main bundle (973 KB gz). |
| 2026-11-07 | 0 | Workspace, pinned toolchain, CI and README created; legacy app moved to `SOCDOF - TS`; baselines written to `docs/baseline.md`. |
| 2026-11-07 | 1 | `Money` (integer cents, parsing, formatting, tax), contacts, products, invoices with totals, SQLite store with `user_version` migrations and repositories. 17 tests, clippy clean. |
| 2026-11-07 | 1 | Users with Argon2id hashing, stock movements, company profile settings, schema v2, `docs/architecture.md`. |
| 2026-11-07 | 2 | Backup container (CRC-32, atomic restore), instance lock with stale takeover, DIN 5008 invoice PDF with an own PDF writer, CLI backup/restore, architecture docs extended. |
| 2026-11-07 | 3 | Headless application shell in `socdof-app`: lock-first startup, status, backup, restore and invoice PDF commands, headless binary and integration test. Tauri window layer blocked by missing WebKitGTK/GTK development packages; exact `pkg-config` failure documented. |
| 2026-11-07 | 3 | CI moved to a Linux + Windows matrix: format gate on Ubuntu, clippy and the full test suite on both runners, headless shell smoke on Ubuntu. |
| 2026-11-07 | 3 | Tauri 2 window layer added in `crates/app/src-tauri` with a Vite/TypeScript screen in `crates/app/ui`. `DesktopState` exposes schema status and backup to the commands; command-layer tests run locally without GTK/WebKit. Desktop CI job builds `.deb` and NSIS bundles on Ubuntu and Windows and uploads them as artifacts; actions moved to Node 24 runtimes. |
| 2026-11-07 | 3 | Added runtime GUI smoke: the real Tauri binary starts under Xvfb, the loaded frontend invokes `database_status` and `create_backup`, and `finish_smoke` validates schema, database and backup bytes before writing a JSON report and log artifact. Expanded packaging to AppImage + `.deb`, Windows portable ZIP + NSIS + MSI. |
| 2026-11-07 | 3 | Added universal macOS DMG builds in CI, the Tauri updater/process plugins with a release-only signed config, changelog-driven GitHub Releases, `latest.json`, checksums and a Discord announcement workflow. Signing keys, Apple notarization and Discord secrets remain deployment configuration, not repository data. |
| 2026-11-07 | 3/6 | Contacts and products are now complete master-data flows in the desktop app: schema v3, CRUD/search commands, validated forms, navigation and four-language UI. Added legacy `.socdof.json` import/export with unknown-table and unknown-field preservation; a real fixture from the legacy exporter round-trips unchanged, and the legacy importer successfully reads the Rust export. Command-layer tests cover CRUD, search, deletion and the real-backup round trip; the Xvfb GUI smoke creates/updates/searches both records and verifies the rendered screens. |
| 2026-11-07 | 1 | Schema v4 completes the data layer: purchase orders with atomic goods receipt, POS receipts with stock rollback, billable items (collect many on one invoice), appointments with range queries, support tickets with time tracking, desktop widgets, reports, roles and sessions. Every aggregate has a domain module, a repository module and `Store` accessors. |
| 2026-11-07 | 1 | Authentication is now complete on the data layer: Argon2id sign-in with a hashed, expiring session token (revoke one or all), a 5-attempt/5-minute lockout per account and a per-module permission matrix with built-in administrator and standard roles. Session tokens and password hashes are the only stored secrets. |
| 2026-11-07 | 1 | Full-text search: FTS5 indices for contacts, products and invoices are maintained by triggers, backfilled for existing databases, query terms are quoted as prefixes so input cannot inject FTS operators, and a substring fallback keeps the legacy search behaviour. 95 workspace tests, clippy clean. |
| 2026-11-07 | 2 | Settings service: validated company profile with backup interval/retention, per-user preferences (language, theme, accent, sidebar, start module) with profile defaults, and language resolution. |
| 2026-11-07 | 2 | Translation loader with compiled-in de/en/fr/es catalogues for all validation and service codes, external language packs merged over the embedded texts, pack validation (missing/unknown keys) and a coverage check exposed as `socdof-cli i18n`. |
| 2026-11-07 | 2 | Autosave (atomic snapshot + count-based retention), stateless backup scheduler (due check from the newest archive, folder, interval and retention), local rotating JSON log with crash reports and panic hook, plus CSV import/export for contacts and products with legacy/Outlook header aliases. Services are reachable from the CLI; 110 workspace tests. |
| 2026-11-07 | 4 | UI decision: egui over Leptos/Dioxus/Slint, because it is the only option that keeps the whole UI path in Rust (no webview, no WASM, no npm). Recorded in `docs/ui-decision.md` together with the ordered removal of the Vite/TypeScript frontend. |
| 2026-11-07 | 4 | Rust UI foundation: design tokens and accent presets ported from the legacy stylesheet (including the companion-color hue rules), theme engine (light/dark/system, accent, no flash), component kit drawn from the tokens, four-language UI catalogue and a headless-tested component gallery. |
| 2026-11-07 | 4 | Control kit completed: select, checkbox, switch, labelled text field with error, month calendar (own civil-date math), menu, side drawer and file drop area, each drawn from the tokens. 22 icons replace `lucide-react` with Rust-painted vector glyphs. |
| 2026-11-07 | 4 | Form framework (required/length/email validation, dirty tracking against a saved baseline, unsaved-changes guard) and the `socdof-ui-gallery` window host on eframe, feature gated so clippy and tests stay free of desktop libraries. |
| 2026-11-07 | 4 | Keyboard focus closed the phase: `focus` keeps the order in reading order, consumes Tab/Shift+Tab with wrap-around, focuses on click, traps the focus in overlays and restores it to the trigger on Escape. Focus rings come from the accent tokens, and every control sets an accessible label and role. Ten keyboard tests drive the real widgets with synthetic input. |
| 2026-11-07 | 4 | Visual regression: `snapshot` reduces paint commands to stable text and 24 golden files pin every primitive in 2 appearances × 4 languages × 3 scenes (idle, focused, drawer), 32 with the Phase 5 desktop scene and 72 with the start menu, palette, tray, onboarding and tiled-wallpaper scenes. A mismatch fails the test with the affected file; `UPDATE_SNAPSHOTS=1` refreshes them after an intended change. |
| 2026-11-07 | 5 | Desktop shell: `desktop` keeps the icon grid, z-order, window rectangles and the close cooldown in plain data, so move, resize, snap, maximize, minimize, the focus trap and the cooldown are unit tested without a display. Windows are egui areas painted from the tokens with keyboard reachable chrome; the taskbar shows pinned apps with running indicators and a clock, and the gallery opens the shell in all four languages. |
| 2026-11-07 | 5 | Desktop golden snapshots (2 appearances × 4 languages) pin the wallpaper, the icon grid, two open windows with chrome and the taskbar, bringing the suite to 32 goldens. Three chrome glyphs (minimize, maximize, restore) joined the icon set, now 25. Repeated opens of a just closed app ask for confirmation inside the 3 s cooldown. |
| 2026-11-07 | 5 | Phase 5 completed: start menu, fuzzy command palette (Ctrl+K), tray flyout, four-page onboarding with persisted seen flag, clock/date and status widgets, and two embedded PNG wallpapers (cover or tiled). Grid, battery and Wi-Fi glyphs bring the set to 28; 35 new keys bring the catalogue to 159 per language; six new scenes bring the goldens to 72. Login/lock screen, the start menu power flyout/user switcher and calculator/notes widgets stay tracked as open sub-items. |
| 2026-11-08 | 6 | Dashboard module: `store::dashboard` aggregates contact/product/low-stock counts, inventory value at cost and retail, upcoming appointments and invoice overview rows with contact names; one pure `summarize` function turns them into all/month/quarter/year totals. `socdof_ui::dashboard` adds KPI cards, quick actions, recent invoices, the reorder list and an empty state in four languages; 54 new keys bring the catalogue to 213 per language and eight goldens bring the suite to 80. The gallery opens the screen from a card. |
| 2026-11-08 | 6 | Contacts screen: list with the core search, detail view, create/edit form with domain validation mapped to catalogue keys, delete confirmation and success/error badges. The screen writes through `Store::insert_contact`/`update_contact`/`delete_contact`; the gallery seeds three contacts in an in-memory store, the dashboard's new-contact action opens the form and eight goldens pin the list, bringing the suite to 88. 50 new keys bring the catalogue to 263 per language. |
| 2026-11-08 | 6 | Products screen: list with the core search, detail view with stock bookings through `Store::adjust_stock` (movement history and new level in one transaction), create/edit/delete form, low-stock badges, reorder exclusion and four languages; labels and smart reorder remain. |
| 2026-11-08 | 6 | Invoices screen: list with the core search, detail with positions, per-line and document totals, create/edit/delete form, lifecycle changes through `Store::set_invoice_status` and four languages. The core gained `update_invoice`, `delete_invoice` and `set_invoice_status`; DIN 5008 print, templates, dunning and the email draft remain. |
| 2026-11-08 | 6 | Accounting screen: schema v5 `journal_entries`; journal with core period queries, create/edit/delete, cash book with a running balance, BWA per account from one pure `summarize`, CSV export to the clipboard and four languages. Account plans, DATEV export and print remain. |
| 2026-11-08 | 6 | Purchases screen: supplier filter and open-order summary over the existing purchase tables, list/detail/form with positions, create/edit/delete through new `update_purchase_order` and `search_purchase_orders` store accessors, status transitions, and the goods receipt booking the domain stock movements. 85 new keys bring the catalogue to 577 per language and eight goldens bring the suite to 120 in 15 scenes. Partial receipts in the UI, order PDF/email and supplier master data inside the module remain. |
| 2026-11-08 | 6 | POS screen: schema v6 `cash_given_cents`; receipt list with core search and payment filter, daily close from `pos_orders_between` with net/tax/gross and payment totals, sale form with product positions and stock booking, cash given/change, cancellation returning goods to stock, and four languages. 83 new keys bring the catalogue to 660 per language and eight goldens bring the suite to 128 in 16 scenes. Receipt print, cash sessions/drawer counts, discounts and customer assignment remain. |
| 2026-11-08 | 6 | Text editor: schema 7 `documents` table, core CRUD/search/validation with on-disk reopen test, egui list/editor with save, create, delete, word counts and unsaved-changes guard, translated missing/storage/validation errors, dashboard action filtered by the App Store module, gallery/snapshot/preview scene; 48 new keys (1,155), 8 goldens (200 in 25 scenes), preview 264 images in 33 scenes. Version 0.21.0. |
| 2026-11-08 | 6 | Application window chrome (`socdof_ui::chrome`): accent frame and top accent line, a 40 pixel title bar with app icon, translated name, `[MODULE]` badge and window buttons, plus the module header card with accent icon tile and status chip, applied to every module screen and pinned by the golden scenes. The desktop shows the full app catalogue (eleven modules with legacy tile colors, wrapping labels) and launches the real screens from icons, start menu, palette and taskbar; dashboard key figures and module search toolbars no longer overflow. Six module icons and ten catalogue keys complete the set: 1,165 keys per language. Version 0.22.0. |
| 2026-11-08 | 6 | Support app (`socdof_ui::support`): ticket list with status and priority chips, local search and an open-only filter, ticket form, the four status transitions, delete confirmation and a working-time panel that books, lists and removes entries per ticket. Validation stays in `socdof-core`; the module is reachable from the launcher and the desktop and is pinned by a new golden scene. 1,232 keys per language. Version 0.23.0. |
| 2026-11-08 | 6 | Reports app (`socdof_ui::reports`): new core module `store::reports` with `load`, `summarize`, `status_totals` and per-period aggregates over invoices and tracked time, four periods, seven key figures, per-state share bars, invoice table with dates, window chrome, launcher and desktop entry and a new golden scene. 1,265 keys per language. Version 0.24.0. |
| 2026-11-08 | 6 | Therapy practice app (`socdof_ui::therapie`): schema v8 (`therapy_clients`, `therapy_sessions`), `store::therapy` CRUD, range queries and `link_invoice`, pure `session_amount`/`summarize` with tests, client list, key figures, session history and booking, invoice link, window chrome, launcher/desktop entry and a new golden scene. 1353 keys per language. Version 0.25.0. |
| 2026-11-08 | 6 | App Store: core module catalogue, persisted activation, licence/system rules, translated errors, dashboard action, gallery scene and immediate dashboard/desktop filtering; 46 new keys (1,107), 8 goldens (192 in 24 scenes), preview 256 images in 32 scenes. Version 0.20.0. |
| 2026-11-08 | 6 | Login and lock screens (`socdof_ui::auth`): core login and lockout, first-admin setup, disabled-account handling, manual/Ctrl+L/five-minute inactivity lock, password unlock with its own five-attempt policy, sign-out, masked password fields and dashboard/gallery integration; 58 new keys (1,061), four goldens (184 in 23 scenes), preview 248 images in 31 scenes. Version 0.19.0. |
| 2026-11-08 | 6 | User management screen (`socdof_ui::users`): account list/detail/form, custom-role assignment, last-admin protection, password reset with session revocation, session counts, Argon2id recovery answers and 72 new keys; catalogue 1,003, goldens 152 in 19 scenes, preview 216 images in 27 scenes. Version 0.18.0. |
| 2026-11-08 | 6 | Settings screen: all eight tabs (general, appearance, security, backup, users, roles, updates, portable) over the core services; profile/preferences writes, Argon2id password reset with session revocation, user CRUD with last-admin protection and custom-role assignment, the full fifteen-module role matrix, backup create/list/verify/restore to a target file, and persisted update/portable policies. The core gained `update_user`/`delete_user`, `list_backups`, `UpdateSettings`/`PortableSettings`; 192 new keys bring the catalogue to 931 per language and eight goldens bring the suite to 144 in 18 scenes. |
| 2026-11-08 | 6 | Calendar screen: month grid, week columns and day agenda over `appointments_between` and the new core `search_appointments_between`; status filter, detail view with lifecycle changes, create/edit/delete form, optional contact, conflict check for overlapping open slots through `Store::appointment_conflicts`, and four languages. The dashboard's calendar action opens the month view; four deterministic gallery samples use the real insert path. 79 new keys bring the catalogue to 739 per language and eight goldens bring the suite to 136 in 17 scenes. All-day entries, recurrence, reminders, drag-and-drop and a dedicated mobile layout remain. |
| 2026-11-08 | 6 | Editor rich-text ribbon and spell check: markup body (`**bold**`, `_italic_`, `# heading`, `- list`, `> quote`) with ribbon and Ctrl+B/Ctrl+I actions on the character selection, formatted preview (`socdof_ui::richtext`), markup-safe word counts, and the offline German Hunspell checker (`socdof_core::spell`, bundled igerman98 dictionary with licence) with underlines, proofing panel, persisted personal dictionary and reset. Two new golden scenes pin the preview and the proofing state: 1,396 keys per language, 256 goldens in 32 scenes. Version 0.27.0. |
| 2026-11-08 | 6 | Studio drawer and documentation pass (`socdof_ui::studio`, `store::maintenance`): letterhead tab over the validated company profile with empty and validation states, data tab with the stored record counts and the clean mode (`Store::reset_business_data`, one transaction, keeps accounts/roles/settings), confirmation dialog, taskbar button, command-palette entry, own golden scenes and two preview scenes; readme, architecture file and changelog describe the delivered state including reports and therapy. 1,381 keys per language, 240 goldens in 30 scenes. Version 0.26.0. |
| 2026-11-08 | 8 | Letterhead background and token placement (`socdof_core::document_layout`, `pdf`): a PNG letterhead becomes a Flate-compressed DeviceRGB image XObject painted under the DIN 5008 content, nine tokens are placed in page percentages with size, bold and alignment, validated (`layout_position_invalid`, `layout_size_invalid`, `layout_tokens_required`, `layout_image_invalid`) and stored as the `document_layout` setting that `export_invoice_pdf` applies. The Studio drawer gained a third tab with a page preview, the background path and a per-token editor, reachable from a new `command_layout` palette entry; tokens stay disabled by default so existing PDFs do not change. 31 new keys bring the catalogue to 1,427 per language, eight goldens bring the suite to 264 in 33 scenes. Version 0.28.0. |
| 2026-11-08 | 8 | Multi-page invoice PDFs (`pdf::writer`, `pdf::din5008`): `Document` keeps a page list (`new_page`, `page_count`), writes a `/Pages` tree with `/Count n` and one content stream per page, and repeats the letterhead image on every page. The DIN 5008 renderer paginates the position table (19 rows on page one, 33 per continuation page), repeats the column header and `Pos./Bezeichnung/Menge/Einzelpreis/Betrag` on every page, prints totals and the closing line only on the last page, numbers the pages (`Seite X von Y`) and paints the background under and the enabled `document_layout` tokens over the content of every page; a row moves whole to the next page. One-page invoices keep the previous output. The Studio layout tab names the continuation behaviour; the catalogue grows to 1,428 keys. Version 0.29.0. |
| 2026-11-08 | 14 | Browser host (`crates/web`): eframe/egui compiled to `wasm32-unknown-unknown` and bundled with Trunk; the workspace moved to `rusqlite` 0.40, which links `sqlite-wasm-rs` on wasm, so schema migrations, FTS5, sessions and Argon2id run in the browser unchanged. `now_millis()` reads `Date.now()`, `.cargo/config.toml` selects the `getrandom` wasm backend and `uuid` uses its `js` feature. Verified in a real browser: empty database → first-run setup → administrator created → desktop. |
| 2026-11-08 | 14 | Browser session flow: the host renders the auth screen until a session is signed in and then the desktop with icon grid, wallpapers, taskbar, start menu, command palette, window chrome, dashboard quick actions and every module screen, plus an account chip with sign-out; `Store::dashboard_snapshot` feeds the dashboard from the live store. Bundle: 5.4 MB wasm (2.5 MB gzip). Version 0.30.0. |
| 2026-11-08 | 15 | GUI parity reference: served the TypeScript app on the reserved preview port and walked it end to end (language chooser, three setup steps, lock screen, desktop). The measured tokens, component geometry and the five structural differences are recorded in section 15; reference screenshots live in `docs/artifacts/gui-parity/` (five legacy screens plus the current Rust desktop). |
| 2026-11-08 | 15 | GUI parity implemented: soft card, dialog and window shadows from stacked accent layers, control radius 12 and height 40, window radius 24 with a 40 px title bar and 32 px buttons, taskbar with 36×36 buttons, a translucent surface, search pill, seconds clock and an overflow guard, desktop icon cell 96×104 with 48 px tiles, wrapped labels, an open marker and responsive columns (3/4/N), the plain accent-gradient wallpaper as the default, and a lock screen with clock, date and avatar above a single password field. 264 goldens regenerated, two catalogue keys added (1,432 per language), web build 5.5 MB. Section 15.3–15.6 updated with the achieved values and the remaining gaps. |
| 2026-11-09 | 15 | Parity follow-up closed the open list: dialog radius 24, gradient desktop tiles with an accent shadow, task view overlay with the open window list, version pill with the companion dot, lock screen recovery hint and account switch tiles, the four step first-run wizard (language, account with strength meter, appearance with nine swatches, layout) whose choices the host applies, and the glass toast stack that replaced the badge line. Two texts sets were corrected after a swap between German and English, 26 catalogue keys added (1,458 per language), goldens regenerated and the web build rebuilt. Font stack and semibold labels stay open because no font file is bundled and egui has no synthetic bold. |
| 2026-11-09 | 15 | Parity rest list closed. Taskbar overflow menu for app buttons that no longer fit, free desktop icon placement on top of the grid cells, wallpaper presets plus PNG drag and drop in the wizard's appearance step together with applying the chosen layout template, and bundled Source Sans 3 Regular/Semibold installed as the proportional family with a separate semibold family for form labels. Two tests added (free positions, template filtering), all 70 headless test contexts now install the bundled fonts, goldens regenerated because the font change moves every text metric, three catalogue keys added in four languages, web build rebuilt. The only item left open is the taskbar backdrop blur, with the egui limitation documented in 15.6. |

- 2026-11-09 (second pass) — Code-only items of the open list: desktop calculator and notes widget,
  the missing-key build gate, the Code 128 barcode encoder and the HTML export of documents. The
  calculator keeps integer thousandths (no floats), the notes text is host state, and the key gate
  walks `crates/ui/src` and fails on any literal catalogue key that `UI_KEYS` does not declare.
  `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`,
  the visual suite (goldens regenerated on purpose: the desktop gained two widget cards) and
  `trunk build --release` are green.

- 2026-11-09 (third pass) — Phase 5 closed. The start menu gained its power flyout (lock, sign out,
  quit, all through `DesktopOutcome` into the real session paths of the gallery and the browser
  host) and the user switcher, which reads the accounts from the store, marks the signed-in one and
  prefills the sign-in form of the chosen account through `AuthState::begin_switch`. Escape closes
  the flyout before the menu, arrows and Enter drive whichever list is open, and the start menu
  reports `StartMenuChoice` instead of a bare app id. New catalogue keys `start_accounts`,
  `start_current`, `start_power`, `power_lock`, `power_sign_out`, `power_quit` in all four
  languages; new golden scene `StartMenuPower` (goldens regenerated on purpose, twice: once for
  the new scene and once after the render showed the flyout outside a narrow window) and the
  artifact `docs/artifacts/gui-parity/rust-10-start-power.png`. `cargo fmt`, `cargo clippy
  --workspace --all-targets -- -D warnings` and `cargo test --workspace` are green.

- 2026-11-09 (fourth pass) — Phase 7 closed. New `socdof_core::i18n_legacy` parses the legacy
  TypeScript catalogue and `socdof-cli locales` writes `docs/legacy-locales.json` (per language and
  module, matched by exact text); the committed key inventory `crates/ui/locales/catalogue-keys.json`
  and the legacy floors in `legacy_compatibility` make the catalogue a ratchet — a key or a text
  that disappears fails the build. `UiTexts::count` adds `_one`/`_other` plural forms with the
  `{count}` placeholder (French singular for zero) and the six module subtitles use it, and
  `UiTexts::with_pack(s)` overlays external packs, read from `SOCDOF_UI_PACKS` by the gallery host.
  12 new keys per language (1,483), the key gate also covers `.count("…")`, goldens regenerated on
  purpose because the subtitles now carry the count word. `cargo fmt`,
  `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` and
  `trunk build --release` are green.

- 2026-11-09 (fifth pass) — Phase 8 print layout. `pdf::din5008::LetterGeometry` replaces the loose
  constants with the DIN 5008 form B measurements, draws both fold marks and the hole mark, reserves
  the totals block in the pagination and wraps the body text inside the text column. New tests read
  the rendered content stream back, convert the coordinates to millimetres and check the address
  field, information block, subject, body, marks, footer and the 257 mm last text line against the
  norm with a 0.05 mm tolerance; a 60 position invoice breaks into three pages without touching the
  footer. No legacy PDF exists in the repository, so the check is norm-based (documented in section
  11). `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`,
  the visual suite (unchanged, no screen touched), `cargo build --release --workspace` and
  `trunk build --release` are green.

- 2026-11-09 (sixth pass) — Phase 8 QR generation. `barcode::qr` implements ISO/IEC 18004 end to
  end: mode selection (numeric, alphanumeric, byte as UTF-8), the smallest fitting version of 1 to
  40, Reed-Solomon over GF(2^8), block splitting and interleaving for all four levels, data
  placement, the eight masks scored with the norm's penalties, format and version information.
  `QrError` reports empty payloads and payloads beyond version 40 instead of panicking.
  `pdf::writer::Page::qr` renders a symbol with a four module quiet zone and `socdof-cli qr` prints
  the matrix or writes a label PDF, so the encoder has a real render path until the TypeScript label
  and pairing screens are ported. Reference matrices come from `qrcode` 1.5.4 (Node, the library the
  TypeScript app uses; automatic version and mask selection, versions 1 to 40, levels L/M/Q/H, all
  three modes) and from `python-qrcode` (PyPI) at the same version, level and mask; both agree module
  for module and the encoder reproduces both. `cargo fmt`, `cargo clippy --workspace --all-targets --
  -D warnings`, `cargo test --workspace`, the visual suite, `cargo build --release --workspace` and
  `trunk build --release` are green.

- 2026-11-09 (seventh pass) — Phase 8 Word documents. The TypeScript app never wrote OOXML: it saved
  its invoice HTML as `.doc` with the `application/msword` type, and only read `.docx` for the
  template import. `socdof_core::docx` now writes a genuine package (own ZIP writer with deflate and
  CRC-32, content types, both relationship parts, document, styles, core and app properties) with the
  values of the printed invoice, and reads foreign packages into `Document` blocks with a small XML
  parser of its own, reporting `DocxError` for empty, truncated or malformed input. The invoice fits
  the existing DIN 5008 data, so no new feature was invented. `socdof-cli invoice-docx` and
  `Core::export_invoice_docx` render it. Verification against foreign tools: `python-docx` opens the
  generated file and finds title, author, address lines, all position cells and totals; the committed
  `fixtures/foreign.docx` (written by `python-docx`) is parsed with its heading levels, bold run,
  table cells and page break. `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`, the visual suite, `cargo build --release --workspace` and
  `trunk build --release` are green.

- 2026-11-09 (tenth pass) — Phase 9 budget harness, partial. `scripts/budgets.json` records every
  budget with limit, unit and measurement context; `scripts/check-budgets.mjs` measures the desktop
  UI bundle, the browser bundle and the cold start of the release binary, reports the artifacts that
  need a display or the Tauri toolchain as `not built here`, and exits 1 on a violation
  (`--limit=<key>=<value>` proves it). Measured: UI bundle 52,305 B / 15,535 B gzip, browser bundle
  6,415,465 B / 2,991,359 B gzip, cold start 144 ms median of five runs. Open and named in
  `docs/performance.md`: the 50k/100k frame budget (both lists still lay out every row, so
  virtualisation plus a benchmark is required), the installer/installed size and idle RAM/CPU
  (Tauri and Xvfb, i.e. the CI desktop and gui-smoke jobs), and the UI memory profile.

- 2026-11-09 (ninth pass) — Phase 8 mobile companion sync. The TypeScript application has a real
  gateway, not a stub: `mobile-sync-api` in `vite.config.ts` and `startMobileSyncServer` in
  `electron/main.cjs` answer the same routes, the app pairs by scanning a QR code that carries
  `{url, token, station, protocol, timestamp}` and polls `GET /api/mobile-sync` every 1.4 s until it
  is ready. `mobile_sync::payload` rebuilds the document model and the ticket planning of
  `mobileCompanionTypes.ts`, `mobile_sync::http` rebuilds the gateway (own HTTP/1.1 over
  `std::net`, no new crate) plus a client, and the gateway is reachable from
  `socdof-cli companion-sync` and `companion-import`. Verification against foreign tools: the
  server was started for real and driven with Python's `http.client` through discovery, ping,
  preflight, a fixture upload with pairing token, poll, `consume=true`, a second poll answering
  `ready:false`, broken JSON, a non-object, a foreign protocol and an unknown path, with the
  database checked afterwards; `tests/mobile_sync.rs` repeats the dialogue over raw TCP, imports the
  fixture (3 tickets, 405 minutes, 93,20 € in four expenses, 84,0 km) and round-trips the payload
  through `mobile_sync::http::client`. `cargo fmt`, `cargo clippy --workspace --all-targets --
  -D warnings`, `cargo test --workspace`, the visual suite, `cargo build --release --workspace` and
  `trunk build --release` are green.

- 2026-11-09 (eighth pass) — Phase 8 backup archives. The plan asked for a `.socdof` zip container,
  but the TypeScript application never wrote one: `exportDatabaseToJson` emits a single JSON document
  per backup (`*.socdof.json`) and `importDatabaseFromJson` reads it back, while `jszip` only serves
  the DOCX template import. The document was already byte-compatible in `legacy`; what was missing
  was the archive path around it. `backup` now sniffs both formats by content, reads the legacy
  header (`app`, `version`, `exported_at`, `backup_owner`, counts per table), lists
  `*.socdofbak` and `*.socdof.json` in one newest-first listing and restores either kind, and
  `socdof-cli backup` chooses the format from the target name while `restore` accepts both and the
  new `backups` command lists a folder. Verification uses the real legacy backup as the foreign
  reference (inspect, list, restore into a fresh database, write → restore round trip with identical
  tables) plus Python's `json` for the produced document, and rejects empty, whitespace, zip,
  foreign-app, version-9, corrupt-timestamp and truncated files with typed errors. `cargo fmt`,
  `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, the visual
  suite, `cargo build --release --workspace` and `trunk build --release` are green.
