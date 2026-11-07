# SOCDOF — Rust Rewrite Migration Plan

> Living document. Tick items as they are completed, update the status block, and append notes at the
> bottom of the phase you are working on. Keep this file the single source of truth for the rewrite.

| | |
|---|---|
| **Branch** | `rust-rewrite` |
| **Started** | 2026-11-07 |
| **Current phase** | Phase 3/6 — desktop shell plus contacts/products master data (Tauri 2 CRUD/search UI, legacy JSON round-trip; Linux, Windows and macOS builds, runtime smoke, signed updater release pipeline) |
| **Overall progress** | ~42 % (core services, headless shell, wired Tauri shell, contacts/products CRUD and search, legacy backup compatibility, packaging, runtime proof and release infrastructure) |
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
positions and totals, `User` with roles, `StockMove`, `CompanyProfile`, Argon2id password hashing,
and a SQLite store with `user_version` migrations and repositories for contacts, products, stock,
invoices, users and settings. See `docs/architecture.md` for the layout and conventions.

- [ ] Define entity types: `User`, `Role`, `Contact`, `Product`, `StockMove`, `Invoice`,
      `PurchaseOrder`, `POSOrder`, `BillingItem`, `Session`, `Appointment`, `Widget`, `Report`,
      `SupportTicket`, `TimeEntry`, `Settings`, `CompanyProfile`
- [x] SQLite schema + migrations (`refinery` or hand-rolled `user_version` migrations)
- [ ] Repository traits + SQLite implementations, one module per aggregate
- [ ] Transaction boundaries for multi-entity writes (invoice + stock move + contact)
- [ ] Full-text search (`fts5`) for contacts, products, invoices
- [x] Legacy import: reader for the legacy `.socdof.json` export (contacts, products, invoices and unknown tables preserved)
- [x] Round-trip test: import a real legacy export → export → identical data, and the legacy importer reads the result
- [x] Money handling: integer cents everywhere, no floats
- [ ] Backup: `.socdof` zip container, integrity check, restore path
- [ ] Auth: `argon2id` hashes, session tokens, lockout policy, roles/permissions matrix
- [x] Unit tests for repositories, money math, permission checks (contact/product CRUD and search included)

**Exit criteria:** all domain data lives in SQLite; legacy import verified against a real export.

---

## 5. Phase 2 — Core services

Done so far: backup container with metadata and checksum, crash-safe instance lock with stale
takeover, DIN 5008 invoice PDF with its own writer, and civil date formatting. Backup and restore are
reachable from `socdof-cli`; all three services are covered by tests.

- [ ] Settings service (company profile, accent, theme, language per user)
- [ ] Translation loader (compile-time embedded de/en/fr/es + external language packs)
- [ ] Autosave / snapshot service (crash-safe, atomic writes)
- [x] Network share lock (`.lock` file with heartbeat and stale takeover)
- [ ] Interactive lock takeover dialog (Phase 5)
- [x] Backup container (metadata, checksum, atomic restore)
- [ ] Backup scheduler (interval, retention, target folder, verification)
- [ ] File import/export: CSV, JSON, zip, docx read, PDF read
- [x] Print pipeline: DIN 5008 layout, address field, positions, totals → PDF
- [ ] Letterhead background and multi-page tables
- [ ] Update checker (GitHub releases, signature verification)
- [ ] Logging + crash report file (no telemetry)
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

## 7. Phase 4 — UI foundation (decision gate)

- [ ] **Decision:** confirm Leptos (CSR) vs. Dioxus vs. egui vs. Slint — document reasons here
- [ ] Port design tokens from `src/index.css`: accent, accent-companion, glass, radii, shadows
- [ ] Theme engine: light / dark / system, live switching, no flash on start
- [ ] Component kit: Button, IconButton, Card, Input, Select, Checkbox, Switch, Badge, Tooltip,
      Modal, Drawer, ContextMenu, Toast, Table (sortable, virtualized), Tabs, DatePicker, FileDrop
- [ ] Icon set (replace `lucide-react` with generated SVG components)
- [ ] Form framework: validation, dirty tracking, unsaved-changes guard
- [ ] Keyboard navigation + focus ring parity with the legacy app
- [ ] Visual regression snapshots for every component state

**Exit criteria:** component gallery app renders all states in all four languages, both themes.

---

## 8. Phase 5 — Desktop shell & window manager

- [ ] Desktop canvas with wallpapers, icon grid, drag & drop, saved positions
- [ ] Window manager: move, resize, snap, maximize, minimize, close, z-order, focus trap
- [ ] Taskbar: pinned apps, running indicators, clock, tray flyout
- [ ] Start menu: search, app list, power flyout, user switcher
- [ ] Window chrome: minimize / maximize / close with confirmation dialog
- [ ] Close cooldown (3 s) after an app window closes, with "are you sure" prompt
- [ ] Widgets layer (clock, calculator, notes)
- [ ] Command palette
- [ ] Login, lock screen and onboarding wizard (language → administrator account → appearance → apps → backup)

**Exit criteria:** desktop behaves like the legacy app on a 1080p screen; window state survives restart.

---

## 9. Phase 6 — Module parity (one checkbox per module, all four languages)

Order chosen by usage frequency in the legacy app.

- [ ] Dashboard
- [~] Contacts — CRUD, search, all legacy master fields and four languages done; sub-contacts, country autocomplete and detail modal remain
- [~] Products & stock — CRUD, search, stock levels and reorder exclusion done; stock moves, labels and smart reorder remain
- [ ] Invoices (DIN 5008, templates, dunning, email draft, payment modal)
- [ ] Accounting (journal, BWA, cash book, export)
- [ ] Purchases (suppliers, orders, goods receipt)
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
