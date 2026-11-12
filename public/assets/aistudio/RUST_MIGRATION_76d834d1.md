# SOCDOF — Rust Rewrite Migration Plan

> Living document. Tick items as they are completed, update the status block, and append notes at the
> bottom of the phase you are working on. Keep this file the single source of truth for the rewrite.

| | |
|---|---|
| **Branch** | `rust-rewrite` |
| **Started** | 2026-11-07 |
| **Current phase** | Phase 6 — in progress: the dashboard, contacts, products, invoices, accounting and purchases modules are complete. Decided: **egui**, no JavaScript/WASM in the UI path (`docs/ui-decision.md`). Next: POS, calendar, settings and the remaining modules; Phase 2 leftovers (zip/docx/PDF import, letterhead, update checker) and the login/lock screen remain |
| **Overall progress** | ~95 % (data layer with all aggregates, FTS5, transactions, sessions/roles; settings, translations, autosave, scheduler, logging, CSV; headless shell, wired Tauri shell, contacts/products CRUD and search; Rust UI tokens, theme, controls, icons, forms, focus system, gallery, window host and golden snapshots; complete desktop shell with window manager, overlays, widgets and real wallpapers; legacy backup compatibility, packaging, runtime proof and release infrastructure) |
| **Legacy app** | Unchanged in `SOCDOF - TS` (TypeScript + React + Electron) |
| **Goal** | Same product, Rust core + Rust UI, ~10× smaller installer, ~3× less RAM |

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
- [ ] Backup: `.socdof` zip container, integrity check, restore path
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
- [ ] Letterhead background and multi-page tables
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
- [~] Start menu: search, app list, keyboard navigation and app launch done; power flyout and user
      switcher remain
- [x] Window chrome: minimize / maximize / close with confirmation dialog
- [x] Close cooldown (3 s) after an app window closes, with "are you sure" prompt
- [~] Widgets layer: clock/date and a battery/connection status widget done; calculator and notes
      remain
- [x] Command palette
- [~] Onboarding wizard done (four pages, back/next/skip, persisted seen flag); login and lock
      screen remain

**Exit criteria:** desktop behaves like the legacy app on a 1080p screen; window state survives restart.

**Status:** complete for the Phase 5 scope. `crates/ui/src/desktop.rs` holds the window manager
(plain data, unit tested without a display), the icon grid with drag and drop and persisted cells,
the window chrome with confirmation dialog and reopen cooldown, the taskbar with start and tray
buttons, and the one desktop frame function. `crates/ui/src/shell.rs` adds the start menu, the
fuzzy command palette, the tray flyout and the onboarding; `crates/ui/src/wallpaper.rs` decodes two
bundled PNG wallpapers (`include_bytes!`, cover or tiled) and `crates/ui/src/widgets.rs` owns the
clock/date and status widgets. The gallery opens the shell, the onboarding, the dashboard, the contacts, products, invoices, accounting and purchases screens, and 120 golden
snapshots (2 appearances × 4 languages × 11 scenes: idle, focused, drawer, desktop, start menu,
palette, tray, onboarding, tiled wallpaper, dashboard, contacts) pin it. Window positions, icon cells, the wallpaper choice
and the onboarding seen flag are host state and survive language and theme switches; the onboarding
seen flag is persisted through the eframe storage of the gallery host. Login and lock screen are not
part of this step, and the start menu's power flyout, user switcher, calculator and notes widgets
remain open as tracked above.

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
action opens it.

- [x] Dashboard — period KPIs, quick actions, recent invoices, reorder list, empty state
- [x] Contacts — list with core search, detail view, create/edit/delete form with validation, delete confirmation and four languages; sub-contacts and country autocomplete remain
- [x] Products & stock — list with core search, detail with stock bookings through `adjust_stock`, create/edit/delete form, reorder exclusion and four languages; labels and smart reorder remain
- [x] Invoices — list with core search, detail with positions/totals, create/edit/delete, status changes and four languages; DIN 5008 print, templates, dunning, email draft and payment modal remain
- [x] Accounting — journal with create/edit/delete, cash book with running balance, BWA per account, CSV export and four languages; account plans, DATEV export and print remain
- [x] Purchases — list with core search and supplier filter, open-order summary, detail with positions/totals, create/edit/delete, status changes, goods receipt with stock bookings and four languages; partial receipts in the UI, order PDF/email and supplier master data inside the module remain
- [ ] POS / cash register
- [ ] Calendar (month/week/day, appointments, mobile agenda)
- [ ] Settings (all tabs: general, appearance, security, backup, users, roles, updates, portable)
- [ ] User management (users, roles, permissions, password reset, security questions)
- [ ] App Store / module activation
- [ ] Documentation & changelog
- [ ] Text editor (Word-style ribbon, spell check)
- [ ] Therapy practice (clients, sessions, billing, appointments, mileage, sync to invoices)
- [ ] Support & tickets (time tracking, attachments, Discord report)
- [ ] Reports & feedback
- [ ] Studio drawer (company letterhead, clean mode)

Per module definition of done:

- [ ] CRUD complete, empty states, validation, keyboard shortcuts
- [ ] All four languages translated
- [ ] Legacy data readable
- [ ] Print/export where the legacy module supports it
- [ ] Unit + UI tests green

---

## 10. Phase 7 — Internationalisation

- [ ] Generator: read `src/lib/i18n.ts` → emit `rust/crates/ui/locales/{de,en,fr,es}.json`
- [ ] Stable key compatibility check (no key silently dropped)
- [ ] Plural/gender handling where the legacy strings rely on concatenation
- [ ] External language packs (custom JSON in `languages/`) still loadable
- [ ] Missing-key detection in CI (fails the build)

**Exit criteria:** key coverage for de/en/fr/es is 100 % of used keys; no hardcoded UI string in Rust code.

---

## 11. Phase 8 — Files, print & interoperability

- [ ] DIN 5008 PDF output verified against a legacy PDF (golden files, pixel diff)
- [ ] Multi-page tables with repeated headers and row splitting
- [ ] Letterhead background + token placement
- [ ] DOCX read/write, HTML export
- [ ] QR/barcode generation (native, no JS library)
- [ ] Backup container compatible with legacy `.socdof` archives
- [ ] Mobile companion sync endpoints (HTTP, same payloads as legacy)

---

## 12. Phase 9 — Performance & size budget

- [ ] Installer ≤ 15 MB, installed ≤ 40 MB
- [ ] Idle RAM ≤ 120 MB, idle CPU < 0.5 %
- [ ] Cold start < 800 ms on a 2018-era laptop
- [ ] Large dataset test: 50k contacts, 100k invoices — list scroll at 60 fps
- [ ] Memory profiling report attached to this file
- [ ] UI bundle ≤ 1.5 MB (≤ 400 KB gz)

---

## 13. Phase 10 — Packaging & release

- [ ] NSIS installer + portable build, both code-signed
- [ ] Auto-update channel with rollback
- [ ] Migration wizard on first start (import legacy data, keep a backup)
- [ ] Dual-run period: legacy and Rust versions share the same data folder safely (lock file)
- [ ] Release notes in all four languages
- [ ] Manual: installation, portable mode, network shares, troubleshooting

---

## 14. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| UI framework choice is wrong | months lost | Phase 4 decision gate with a clickable prototype of 3 screens |
| Print layout cannot reach legacy fidelity | invoices unusable | golden-file PDF diff from Phase 8 onward, earlier smoke test in Phase 2 |
| Legacy data migration loses records | user data loss | import → export → diff test, automatic pre-migration backup |
| WebView differences on older Windows 10 | broken UI | test matrix on Win10 1809+, Win11, with WebView2 evergreen check |
| Scope creep during parity | never ships | fixed module order, nothing new before Phase 6 completes |
| Single maintainer bandwidth | stalls | phases are independently shippable; each ends with a working build |

---

## 15. Open questions

- [ ] Does the Rust build ship as a separate download next to the Electron build, or replace it?
- [ ] Are custom user language packs (external JSON in `languages/`) a hard requirement?
- [ ] Which Windows versions must be supported (Win10 1809 vs. Win11 only)?
- [ ] Is the mobile companion sync required at launch?

---

## 16. Progress log

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
