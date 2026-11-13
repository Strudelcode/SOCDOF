# SOCDOF — Rust Rewrite Migration Plan

> Living document. Tick items as they are completed, update the status block, and append notes at the
> bottom of the phase you are working on. Keep this file the single source of truth for the rewrite.

| | |
|---|---|
| **Branch** | `feature/rust-native-desktop-host` |
| **Started** | 2026-11-07 |
| **State** | 2026-11-13, a persistent native egui desktop host is now wired to the real SQLite store and authentication flow. The Tauri webview remains the packaged default until native parity, shell integrations and packaging are verified. The visual gate stays **open**; see §15.7. |
| **Current phase** | Phase 10 — **functional parity expansion before GUI polish**. The native host now includes Projects, Fleet and Restaurant on the persistent SQLite store; this pass prioritizes remaining app workflows, edge cases and parity tests before visual refinement. The existing visual gate remains open; see §15.7. |
| **Overall progress** | Core persistence and 18 permission modules are present; native desktop functional parity is still in progress. Projects, Fleet and Restaurant have been integrated into the egui launcher. Remaining work includes full parity audits, unfinished native app surfaces, shell/OS integrations, visual acceptance and packaging. |
| **Versioning** | Rust workspace, Tauri app and UI manifests are aligned at **`26.0.0`**; the TypeScript reference stays `25.2.1`. The v26 changelog body is prepared; the tag is not cut. See §2.1. |
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

- [x] Every phase ends with `cargo fmt`, `cargo clippy -- -D warnings`, `cargo test` green.
- [x] UI texts only via the translation files — all four languages (de, en, fr, es) from day one.
      Checked 2026-11-10: `crates/ui/locales/{de,en,fr,es}.json` carry the same 1,685 keys (0
      missing, 0 extra), `catalogue-keys.json` matches them exactly, and the committed-inventory
      test is part of the green `cargo test --workspace`
- [x] Documentation and code comments in English; user-facing texts in all four languages.
      Checked 2026-11-10: `grep -rn "[äöüß]" crates/*/src --include=*.rs` outside the locale
      catalogues returns nothing; docs and commit messages are English, the catalogues, this
      file history and `docs/releases/` carry the four UI languages
- [x] No mock data, no placeholder screens: a module is either complete or not merged.
      Checked 2026-11-10: `grep -rn "todo!\|unimplemented!\|lorem ipsum\|dummy data\|PLACEHOLDER"
      crates/*/src --include=*.rs` returns nothing
- [x] Every merged phase updates this file: tick boxes, update "Current phase" and "Overall progress".
- [x] Size and RAM budget checked at the end of Phase 9 and reported in this file — `docs/performance.md` and §12; the app-side RAM figure is sampled in the `gui-smoke` job

### 2.1 Versioning and changelog

The Rust product manifests are aligned for the next release:

| Artifact | Current value |
|---|---|
| Rust workspace (`Cargo.toml`) | `26.0.0` |
| Tauri app, webview package and lock (`Cargo.toml`, `package.json`, `package-lock.json`, `tauri.conf.json`) | `26.0.0` |
| TypeScript reference (`SOCDOF - TS/package.json`) | `25.2.1` |
| Product release | `26.0.0` (v26), prepared, tag not cut |

`CHANGELOG.md` has a `[26.0.0] - unreleased` section followed by the historical `0.1.0`–`0.30.0`
sections. All Rust-rewrite changes in this working tree belong in that v26 block; it becomes a real
release section when the date and version manifests are set.

Before tagging v26:

1. set the release date on the existing `[26.0.0]` section;
2. keep every change before 26 in the existing historical sections — do not rewrite or drop them;
3. write the four release-note files under `docs/releases/` and check the release workflow's
   tag/version extraction;
5. verify the produced installers and checksums; this VM still cannot do the packaging pass.

The visual-parity pass does **not** bump a version and does **not** cut a release. It only updates
the implementation, the evidence and this plan; v26 stays a separate release step.

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
**Decision (2026-11-10):** no repository traits. Every aggregate has its store module (`contacts`,
products`, `invoices`, …) behind a `Store` method, and SQLite is the only backend; a trait layer
would add indirection without a second implementation. Revisit only when a second backend is
actually written. The per-aggregate modules and their tests are in place.
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
- [x] Interactive lock takeover dialog: `InstanceLock::force_takeover` / `InstanceLock::inspect`
      (`crates/core/src/lock.rs`) plus `LockConflict` with `owner_label`/`accept`/`cancel` and the
      `lock_conflict` dialog in `crates/ui/src/auth.rs`. Tests: fresh legacy lock blocks, stale lock is
      taken over, `force_takeover` wins against a fresh heartbeat, cancel withdraws a takeover, owner
      label renders `share-pc / anna (pid 4711)` (`cargo test -p socdof-core --lib lock::`,
      `cargo test -p socdof-ui --lib lock_conflict_tests`)
- [x] Backup container (metadata, checksum, atomic restore)
- [x] Backup scheduler (interval, retention, target folder, verification)
- [~] File import/export: CSV (contacts, products), JSON (legacy backup) and the `.docx` reader are
      done — `socdof_core::docx::read_docx`/`read_docx_file` turn any package into blocks (headings by
      style, bold/italic runs, tables, page breaks) plus the core properties, and the zip reader
      (`crates/core/src/docx/zip.rs`) is part of that path (`cargo test -p socdof-core --lib docx::`
      17 tests, `cargo test -p socdof-core --test docx_invoice` 6 tests including a package written by
      `python-docx`). Still open: a ZIP *import/export format* for user data and PDF text import —
      both need a decision on which files and fields they carry, so they are not implemented here
- [x] Print pipeline: DIN 5008 layout, address field, positions, totals → PDF
- [x] Letterhead background and multi-page position tables with repeated headers (see Phase 8)
- [x] Update checker: `socdof_core::updates` reads a GitHub release document or the updater manifest
      (`parse_feed`), compares versions by number with the pre-release ordering (`compare_versions`)
      and reports `UpdateCheck { current, latest, update_available }`. `socdof-cli update-check
      <feed.json> [current]` prints it as JSON. Verified 2026-11-10: `0.30.0` against a `v0.31.0`
      feed prints `"update_available": true` and `update available: 0.30.0 -> 0.31.0`; `0.31.0`
      prints `up to date: 0.31.0`; a feed without a version fails with `update_feed_missing_version`
      (`cargo test -p socdof-core --lib updates::`, CLI runs above)
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
The Tauri window features below cannot be built or verified in this container. Observed
2026-11-10: `cargo check --manifest-path crates/app/src-tauri/Cargo.toml` exits 101 with
`error: failed to run custom build command for gio-sys v0.18.1` /
`Package 'gio-2.0', required by 'virtual:world', not found`; installing the stack is impossible
because `sudo -n true` answers `sudo: The "no new privileges" flag is set, which prevents sudo from
running as root.` and `command -v Xvfb` prints nothing. Method: the CI `desktop` and `gui-smoke`
jobs build with GTK/WebKit and run under Xvfb; the per-item check is named on each line.

- [x] Window state persistence (size, position, maximized, fullscreen): `crates/app/src/window_state.rs`
      stores `window_state.json` next to the database (schema 1, written through a temporary file and
      renamed), clamps to the minimum size from `tauri.conf.json` and pulls a window that was saved on
      a vanished monitor back onto the current one; `crates/app/src-tauri/src/lib.rs` restores it in
      `setup` and writes it on `CloseRequested`. Tests: round trip after a restart, missing/broken/
      foreign-schema file, minimum clamp, off-screen pull-back, no temporary file left
      (`cargo test -p socdof-app --lib window_state::`). The real window round trip is the gui-smoke
      step **Window state round trip**: two starts under Xvfb, the first reports `source=default`, the
      second `source=file`; that step needs GTK/WebKit and runs in CI only
- [x] Splash window with real progress + "ready" handshake: `crates/app/src/startup.rs` holds the
      phase machine `Starting → Ready/Failed/Closed` with idempotent transitions, a 20 s timeout
      (`startup_timeout`) and `SplashAction` as the only window contract; the static page is
      `crates/app/ui/public/splash.html`, and `crates/app/src-tauri/src/lib.rs` creates the splash,
      keeps the main window hidden (`"visible": false`) and closes the splash on `ready`, on failure
      and on timeout. Tests: splash visible while starting, ready closes it once, a failed start keeps
      its reason and a late ready cannot revive it, the timeout closes instead of hanging, a double
      close is a no-op, marker names are stable (`cargo test -p socdof-app --lib startup::`). The real
      window transition is the gui-smoke step **Splash handshake**: a normal start must log
      `phase=starting` before `phase=ready`, then `splash_window=closed` and `main_window=visible`, and
      a run with `SOCDOF_SMOKE_FAIL_STARTUP=1` must log `phase=failed reason=database_error` with the
      splash closed; that step needs GTK/WebKit and runs in CI only
- [x] Single instance guard (lock is held by the shared desktop state; focus needs the window layer)
- [x] System tray with quick actions: `crates/app/src/tray.rs` owns the menu — ids, reading order,
      labels and one command per entry — and `crates/app/src-tauri/src/lib.rs` only builds the
      platform icon from that model and runs the command it returns. The menu carries the three
      actions the shell really performs: show the main window, write a backup through
      `DesktopState`, quit; no id is bound twice. The menu path and a completed left click use the
      same `tray::icon_click()` pair and `run_tray_command`. Linux status notifiers only expose a
      menu, so the Xvfb run cannot emit the pointer event; the mapping is unit-tested instead.
      Labels and tooltip come from the core catalogue in de/en/fr/es and follow the session locale
      (`de_DE.UTF-8` -> German, `fr-CA` -> French, an unknown locale -> English). Tests: menu order
      with one command per entry and exactly two separators, every id resolving to its own command
      plus unknown and separator ids doing nothing, left-click mapping to the show command
      (`a_left_click_on_the_icon_uses_the_show_command`), locale selection in all four languages,
      every label coming from the catalogue instead of the key, a localized tooltip, the labeled
      menu without separators and stable marker names (`cargo test -p socdof-app --lib tray::`). The
      menu runs end to end in the gui-smoke step **System tray menu**: every entry is dispatched
      through the same function the platform menu event calls — the window becomes visible, the
      backup writes a non-empty file and quit ends the run — and the labels of all four languages are
      asserted; the icon itself needs a status-notifier host, so its appearance and a real pointer
      click are only checked by a human
- [x] Native dialogs: folder picker, file open/save, message boxes and yes/no confirmations:
      `crates/app/src/dialogs.rs` validates every answer before the caller sees it — a folder must be
      a directory, an opened file must exist and match the allowed extensions, a save target needs an
      existing parent folder, a cancelled dialog and a closed message box are their own outcomes, and
      a confirmation resolves to confirmed/declined/cancelled. `crates/app/src-tauri/src/commands.rs`
      opens the platform dialog through `tauri-plugin-dialog` (`blocking` feature); `confirm_message`
      uses `MessageDialogButtons::YesNo` and `.blocking_show()`, and the webview's delete actions call
      it instead of `window.confirm`. Tests: existing folder accepted, cancel for every kind, file
      rejected by the folder picker plus missing path, extension enforcement (case-insensitive) and
      file/directory confusion, save target in an existing folder plus missing parent, message box
      without a path, yes/no/cancelled confirmation (`a_confirmation_returns_yes_no_or_cancelled`),
      marker names stable (`cargo test -p socdof-app --lib dialogs::`). The bridge runs end to end in
      the gui-smoke step **Native dialog bridge** with canned selections (chosen folder, chosen JSON
      file, cancel, message, confirmation `confirmed`/`cancelled`); a real pointer click in the
      platform picker is only exercised by a human, because CI cannot click a GTK dialog
- [x] Global shortcuts (F11, window snapping, command palette): `crates/app/src/shortcuts.rs` maps a
      chord to exactly one `AppAction` and decides repeat and locked-context behaviour, so no window
      code interprets keys. Bound are the documented chords only: `F11` → `toggle_fullscreen`,
      `Ctrl+K` → `open_command_palette`, `Ctrl+L` → `lock_session`, `Escape` → `dismiss`; window
      snapping has no agreed chord and stays unbound until that is decided. Tests: a binding triggers
      exactly one action and no action is bound twice, an unknown key does nothing, modifiers
      distinguish `K` from `Ctrl+K` and `F11` from `Shift+F11`, a repeated key never retriggers, a
      locked context only lets `dismiss` through, marker names are stable
      (`cargo test -p socdof-app --lib shortcuts::`). The real path is the gui-smoke step
      **Shortcut dispatch**: real key events through xdotool, `F11` must log
      `chord=F11 action=toggle_fullscreen`, `F12` must log `action=none reason=unknown`, and a run
      with `SOCDOF_SMOKE_LOCKED=1` must log `reason=locked` without any action; that step needs
      GTK/WebKit and runs in CI only
- [x] Signed Tauri updater plumbing and release manifest generation (release secrets required)
- [ ] Apple notarization and Windows Authenticode signing — no signing material in this
      environment (`env | grep -ci -E "apple|certificate|signing|authenticode"` = 0, no keychain).
      Method: the signing secrets in the release workflow, verified by `codesign -dv` and
      `signtool verify` on the staged artifacts in the `desktop` job
- [x] Startup measurement harness (cold start → login < 800 ms): `scripts/check-budgets.mjs` spawns the release `socdof-app` on a fresh database, waits for `SOCDOF shell ready`, takes the median of five runs and fails above 800 ms; `docs/performance.md` records 248 ms on 2026-11-10

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
- [x] Contacts — list with core search, detail view, create/edit/delete form with validation,
      delete confirmation and four languages. Contact persons ("sub-contacts") are ported the way
      `ContactEditModal.tsx` has them: `ContactPerson` with `id`, `first_name`, `last_name`,
      `email`, `phone`, `role` and `is_primary`; the first person of a company becomes primary,
      removing the primary promotes the first remaining one, setting a primary clears the others,
      and saving drops persons whose name, email and phone are empty (schema v10 keeps them in
      `contact_persons`, ordered, cascade-deleted with the contact). Person names, emails and
      phones are searchable, the legacy `.socdof.json` document reads and writes the array, and
      the desktop command layer treats an absent `contact_persons` field as "keep", an empty
      array as "remove". Tests: `cargo test -p socdof-core --lib contact::`,
      `cargo test -p socdof-core --test contact_persons`, `cargo test -p socdof-app --test
      contact_persons`, `cargo test -p socdof-ui --lib contacts::`. The form edits the whole legacy
      address block — street, postal code, city, country, tax id and notes — and the country input
      autocompletes from `domain::countries`: 47 entries in the legacy order with the five localized
      names, ISO code and name prefix/substring matching on a trimmed, lower-cased query, the first
      eight entries for an empty query, prefix hits before substring hits, no diacritic folding and
      the localized name written on selection; new contacts start with "Deutschland". Tests:
      `cargo test -p socdof-core --lib domain::countries` (8 tests) plus the contacts tests, which
      pin the default country, the localized selection and the free-text round-trip
- [x] Products & stock — list with core search, detail with stock bookings through `adjust_stock`, create/edit/delete form, reorder exclusion, four languages, the legacy barcode/ASIN/web-link/source-domain fields (schema v11, store, import/export, both frontends), the QR label preview with three formats (`domain::label`) and the smart reorder hub with threshold modes, request list, Amazon cart link, clipboard list and draft purchase order (`domain::reorder`); both dialogs live in the egui app and, through the `product_label`, `reorder_plan`, `create_reorder_draft` and `set_product_reorder_exclusion` commands, in the Tauri webview as well
- [~] Invoices — list with core search, detail with positions/totals, create/edit/delete, status changes and four languages; the dunning letter, the invoice e-mail draft and the payment modal are ported 1:1 (schema v12 `invoice_payments`, `domain::dunning`, `domain::mail`, `domain::payment`, egui dialogs); DIN 5008 print, the validated template book in the settings table and the PDF print dialog (template title, footer, accent color and fold marks) are ported; the invoice screens of the Tauri webview remain; tests: `cargo test -p socdof-core --lib invoice_template::`, `cargo test -p socdof-core --lib pdf::din5008::`, `cargo test -p socdof-ui --lib invoice_templates::`
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

Per module definition of done — these are the criteria every module row above is measured against,
not separate tasks; the "remain" notes on the rows name what is still missing in that module:

1. CRUD, empty states, validation and keyboard shortcuts; 2. all four languages (1,685 key catalogue,
checked for parity above); 3. legacy data readable (`legacy` round-trip test); 4. print/export where
the legacy module had it (`pdf::din5008`, `docx`, `barcode::qr` tests); 5. unit and UI tests green
(`cargo test --workspace`, `--test visual`).

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

- [ ] Native executable ≤ 15 MB, portable footprint ≤ 40 MB — current native host measurement pending. Observed 2026-11-10:
      `cargo check --manifest-path crates/app/src-tauri/Cargo.toml` exits 101 with
      `error: failed to run custom build command for gio-sys v0.18.1` /
      `Package 'gio-2.0' … not found`, and there is no `crates/app/src-tauri/target`.
      Measurement: `.github/workflows/rust.yml`, job `desktop`, step **Check native Rust desktop size
      budgets** runs `node scripts/check-budgets.mjs --scope=artifacts` on
      `target/release/socdof-ui-desktop` (limit 15,728,640 B) and its current single-executable
      portable footprint (limit 41,943,040 B); a violation exits 1 and fails the job. The Tauri
      transition fallback remains built/uploaded separately and is not the native release target.
- [ ] Idle RAM ≤ 120 MB, idle CPU < 0.5 % — the previous measurement belongs to the Tauri
      transition fallback. The CI gate now builds and measures the native `socdof-ui-desktop`
      executable; a current-head result is still pending.
      Measurement: `.github/workflows/rust.yml`, job `gui-smoke`, step **Idle RAM/CPU budget**
      starts the native Rust host under `Xvfb :99`, resolves its process with
      `scripts/idle-app-pid.py` and runs `node scripts/check-budgets.mjs --scope=runtime --pid <pid>`,
      which reads `VmRSS` and `utime+stime` from `/proc/<pid>` over five quiet seconds (limits
      122,880 KiB and 0.5 %, exit 1 on a violation). The same sampler ran here against a live
      process: `3516 / 122880 KiB`, `0 / 0.5 %`
- [x] Cold start < 800 ms: 248 ms median of five runs of the release `socdof-app` on a fresh
      database (instance lock, schema migration, status) measured 2026-11-10 with
      `scripts/check-budgets.mjs`; 59 ms more than the 2026-11-09 pass because schema v9 rebuilds the
      invoice FTS index once on first open. The native egui desktop host is measured separately in gui-smoke
- [x] Large dataset test: 50k contacts, 100k invoices — `crates/ui/tests/performance.rs` seeds an
      in-memory store through `Store::insert_contacts`/`Store::insert_invoices` (18.5 s), runs the
      real `contacts()` and `invoices()` screens with `egui::Context::run` at 1280×900 (3 warm-up +
      20 measured frames) and asserts median and P95 of both lists. Measured 2026-11-10: contacts
      50k median 0.10 ms / P95 0.15 ms, invoices 100k median 0.20 ms / P95 0.21 ms against 16.6 ms.
      `SOCDOF_FRAME_BUDGET_MS=0.01` fails the test (`exit 101`, "median 0.10 ms exceeds 0.01 ms").
      Run: `cargo test --release -p socdof-ui --test performance -- --ignored --nocapture`; wired
      into the CI `desktop` job as step **Frame budget (50k contacts, 100k invoices)**. Both lists
      now draw through `ScrollArea::show_rows`, and the invoice rows read the customer name from
      `InvoicesState::contact_labels`
- [x] Memory profiling report attached to this file — `docs/performance.md` §"Memory report" holds
      the measured `VmRSS`/`VmHWM` of the benchmark process after both screens rendered (196.9 MiB
      for the seeded 50k/100k dataset including the in-memory SQLite store) and the CI path that
      samples the native Rust desktop host: job `gui-smoke`, step **Idle RAM/CPU budget** against the 120 MB limit
- [x] UI bundle ≤ 1.5 MB (≤ 400 KB gz): the desktop frontend built by `npm run build` is 52,305 B
      raw and 15,535 B gzip against 1,572,864 B / 409,600 B. The separate browser bundle (6,415,465 B
      raw, 2,991,359 B gzip) is documented in §14 and guarded by its own regression limit

---

## 13. Phase 10 — Packaging & release

- [x] NSIS installer + portable build: `tauri.conf.json` bundles `all` targets, the `desktop` job
      stages the AppImage, the `.deb` and the portable ZIP, the release workflow adds the NSIS
      `setup.exe`. Built on 2026-11-10 only in CI (`desktop`); the artifacts are verified there by
      size, checksum and the installer budget step
- [ ] Code signing of those artifacts — observed 2026-11-10:
      `env | grep -ci -E "apple|certificate|signing|authenticode"` prints `0` and there is no
      keychain entry to sign with; method: the release workflow with the signing secrets, verified
      with `signtool verify` / `codesign -dv` on the staged artifacts
- [x] Rollback for the update channel: `updates::Channel` stages an artifact per version
      (`update-stage`), reports the installed one (`update-current`) and returns to the previous
      version (`update-rollback`). An empty or missing artifact is rejected and leaves the channel
      untouched, and a rollback whose previous artifact disappeared keeps the installed version.
      Verified 2026-11-10 on the CLI: stage 0.30.0, stage 0.31.0, `update-current` -> 0.31.0,
      `update-rollback` -> `rolled back to 0.30.0`, `update-current` -> 0.30.0, a second rollback
      exits 1 with `update_no_previous` (`cargo test -p socdof-core --lib updates::`). Publishing and
      code signing of the releases stay with the release workflow (see the signing item above)
- [x] Import step in the first-run assistant: `crates/ui/src/migration.rs` holds the step
      (`MigrationState::import` through `legacy::import`, which writes the pre-migration backup), the
      wizard renders it on the last page (`crates/ui/src/auth.rs`) and the host runs the request
      (`AuthState::run_pending_import` in `crates/ui/src/gallery.rs`). Tests: the committed legacy
      fixture imports 3 contacts / 2 products / 1 invoice, an empty path and a missing file stay on
      the step, a broken document reports `setup_import_failed` and imports nothing, skipping
      finishes the step (`cargo test -p socdof-ui --lib migration::`)
- [x] Dual-run period: the Rust lock uses the legacy file name `network_session.lock` and writes the
      legacy keys (`hostname`, `username`, `pid`, `heartbeat`, `requestQuit`), so both apps exclude
      each other on one data folder; `Paths::new` derives it next to the database. Tests: a fresh
      legacy file blocks the second start, a stale one is taken over, the written file carries the
      legacy keys, and a legacy ISO `startTime` is read as zero instead of breaking the parse
      (`cargo test -p socdof-core --lib lock::`)
- [x] Release notes in all four languages: `docs/releases/0.30.0-{de,en,fr,es}.md` written
      2026-11-10 from the delivered scope (virtualised lists, schema v9, mobile sync, DIN 5008 with
      QR, docx, backup formats)
- [x] Manual: `docs/manual.md` covers installation per platform, portable mode, network shares with
      the lock/heartbeat behaviour, backups, the headless commands and a troubleshooting table,
      written 2026-11-10 from the code paths above

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
- **Limit (not a task):** no OPFS. `sqlite-wasm-vfs` needs `FileSystemSyncAccessHandle`, which
      browsers only expose in a dedicated worker; the host has no worker, so the serialized image in
      IndexedDB is the supported route
- [x] Web build in CI: the `web` job in `.github/workflows/rust.yml` installs the wasm target and
      Trunk, builds `crates/web` in release mode, checks that `index.html` and a wasm bundle of
      plausible size exist and uploads `crates/web/dist` as an artifact
- **Limit (not a task):** print, backup, CSV and legacy import stay desktop-only — they need file
      access the browser host does not have

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

> **Scope note (2026-11-12).** Sections 15.1–15.6 document the earlier egui surface in `crates/ui`
> and its limitations. The shipping Tauri webview in `crates/app/ui` is a separate surface with its
> own shell, parity layer and evidence set. Its current gate is §15.7; the egui findings remain
> historical reference and are not evidence for the webview.

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

Every parity change has to satisfy these points — they are the review rule, not a backlog:

1. the legacy screen was hosted and screenshotted before the change;
2. changed values trace back to `index.css`/`accent.ts` or a Tailwind class, never to a sampled pixel;
3. the change touches tokens, geometry or a shared component, not the module list, the texts or behaviour;
4. new or renamed texts exist in de, en, fr and es;
5. `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` green;
6. `UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual` accepted on purpose, goldens committed;
7. `trunk build --release` in `crates/web` and the browser build checked against the screenshots;
8. `docs/artifacts/gui-parity/` re-taken and linked here.

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
- **Not possible in egui 0.27 (limitation, recorded):** backdrop blur of the taskbar glass — a panel paints straight into the
      window framebuffer and epaint has no render-to-texture or post-process pass, so nothing can blur
      what is behind the bar. The honest alternative is the current 84 % translucent surface; a real
      blur would need a custom wgpu callback with an offscreen pass and is out of scope here.

### 15.7 Tauri webview visual parity (final evidence, gate open)

The feature surfaces and the visual pass are implemented. The final evidence set was captured on
**2026-11-12** from the v26 release binary under Xvfb at 1440×900, German, empty database, through
real navigation and the app's own theme toggle. `docs/parity/` holds the ten TS/Rust pairs;
`parity_diff.py` uses the current window crop `(100,15,1240,765)` and writes `diff.json`/`diff.csv`.

**Target:** window pixel score ≥98.00 and window SSIM ≥0.90 for every pair; only native window
chrome may remain different.

| View | Theme | Window pixel | Window SSIM | State |
|---|---|---:|---:|---|
| Dashboard | light | 98.87 | 0.9491 | pass |
| Dashboard | dark | 98.44 | 0.9310 | pass |
| Invoices | light | 98.76 | 0.9041 | pass |
| Invoices | dark | 98.33 | 0.8961 | pixel pass, SSIM 0.0039 short |
| Contacts | light | 98.85 | 0.9116 | pass |
| Contacts | dark | 98.38 | 0.8979 | pixel pass, SSIM 0.0021 short |
| Settings | light | 95.92 | 0.7251 | open |
| Settings | dark | 95.42 | 0.7072 | open |
| Command Palette | light | 97.87 | 0.9011 | SSIM pass, pixel 0.13 short |
| Command Palette | dark | 97.88 | 0.8778 | open |

**What was aligned in the final pass**

- Shared `parity.css` light/dark tokens; 1140×750 window at `100,15`, 43 px title bar, 24 px content
  inset; TS rail, taskbar, logo and title-bar workspace tools.
- Dashboard: TS header, five KPI cards in TS order with the real POS aggregate, quick actions,
  welcome panel and empty values.
- Invoices: two-row filters, 130 px search, TS button widths, table head and empty state, journal
  geometry, ID-specific dark banner.
- Contacts: TS filters, table/empty state, CSV/vCard import and export through the Rust backend.
- Settings: 305 px navigation with the TS labels/groups, 56 px `ST` avatar, TS hero and quick-start
  geometry, unequal 391/282 px quick columns, 96 px cards and the 736 px sidebar end.
- Command Palette: 670×583 at y80, 50 px search, ⌘K badge, 52 px rows, TS module order
  (Dashboard, Rechnungen, Abrechnung, Kontakte, Produkte, Lager, Einkauf, POS Kasse, Kalender),
  TS descriptions/colours, footer and desktop overlay with ten shortcut tiles.
- The four locale packs still contain **1,011 identical keys** per language; no user-facing key was
  added. Palette-only stock/POS labels live in `command_text.ts`, outside the locale packs.

**Open visual residuals**

1. **Settings icons:** the TS outline icon set (monitor, card, globe, keyboard, speaker) is not
   reproduced; the Rust sidebar uses text glyphs. This dominates the Settings SSIM gap.
2. **Settings text rendering:** family, size and metrics match, but WebKit draws the semibold labels
   lighter than Chromium, which lowers structural similarity across the sidebar and cards.
3. **Dark palette backdrop:** module order and geometry match, but the blurred desktop icons and the
   blue-violet glow are less saturated than the TS Spotlight backdrop.
4. **Rail slot six:** the TS rail shows `Lager`; this webview shows `Kalender` because it has no
   separate stock screen. The palette still exposes Lager and opens the products screen.
5. **Native chrome:** window controls are native Tauri/WebKit buttons instead of page-drawn buttons.
   This is the only accepted difference.

**Gates on the final tree (2026-11-12):** `cargo fmt --all -- --check`, clippy with
`-D warnings`, `cargo test --workspace` (including all 88 regenerated egui goldens), `npm run build`,
the Tauri `cargo check --all-targets` and the real Xvfb GUI smoke (`SOCDOF_SMOKE_OK`,
schema 15) all exit 0. The GUI smoke was updated to the table-based invoice screen and edits the
created invoice through the row action.

**Definition of done:** all ten pairs at ≥98.00 window score and ≥0.90 window SSIM; only the native
window decoration differs; `diff.csv` is reproducible; docs quote those values; and all gates are
green. The last point is met; the first two are not, so the gate stays open.

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

## 17. Open questions (product decisions, waiting for the owner — not implementation gaps)

Each line below is blocked by a decision the repository cannot make: no code path waits for it,
so there is neither a failing command nor a measurement. The item closes when the owner answers;
the answer is then recorded on the line and, where it changes behaviour, implemented with a test.

- [ ] Does the Rust build ship as a separate download next to the Electron build, or replace it?
- [x] Are custom user language packs (external JSON in `languages/`) a hard requirement? — answered
      2026-11-11: yes, the `languages/` and `flags/` folders are read, saved and overlaid; see 18.1
      and 18.2.
- [ ] Which Windows versions must be supported (Win10 1809 vs. Win11 only)?
- [ ] Is the mobile companion sync required at launch?

---

## 18. Parity matrix (TypeScript → Rust)

Reference: `SOCDOF - TS/` at the checked-out revision — 76 components in `src/components`, 34
modules in `src/lib`, 43 IPC channels in `electron/main.cjs`/`preload.cjs` and the four i18n packs in
`src/lib/i18n.ts` (11,855 key lines, ≈2,964 keys per language). Status values:

- **done** — implemented and evidenced by a test, a smoke marker or an exact command/UI path.
- **present** — the Rust surface exists and is routed, but this pass did not add a new regression
  proof for it; the row names the module.
- **partial** — the surface exists with a named, deliberate difference.
- **out of scope** — deliberately not ported; the reason is part of the row (external service, OS
  feature or product area that the Rust application does not model).
- **open** — locally implementable but not ported yet; the row names what is missing and that an
  owner priority is needed.

A module name alone is not proof of pixel parity; the screenshot procedure in section 15 stays the
visual reference.

### 18.1 Screens and flows

| TypeScript components | Rust status | Evidence / difference |
| --- | --- | --- |
| InvoicesModule, InvoicePrintModal, InvoiceTemplateModal | **done** | `crates/app/src/invoice_bridge.rs`, `crates/app/ui` Invoices/Templates tabs, `crates/app/tests/invoice_bridge.rs` (5 tests), smoke markers `save_invoice`, `invoice_preview`, `export_invoice`; the external template folder is listed/read/open through `list_external_templates`, `read_external_template`, `external_folder_path` and `open_external_folder` (`crates/app/src/external_assets.rs`), proven by `external_folders_seed_list_and_read_templates` and `SOCDOF_SMOKE external_template_read` |
| DunningModal, InvoiceEmailModal, PaymentModal | **done (this pass)** | egui `crates/ui/src/invoice_actions.rs`; new Tauri commands `invoice_dunning`, `invoice_mail_draft`, `invoice_payment`, `record_invoice_payment`, `export_invoice_eml`; dialog in `crates/app/ui/index.html`; smoke markers `invoice_dunning`, `invoice_mail`, `export_eml`, `record_payment`; test `dunning_mail_and_payment_close_the_webview_gap` |
| ContactsModule, ContactDetailModal, ContactEditModal, CustomerPickerModal, ConfirmDeleteModal | **done** | The webview now has a searchable customer picker with customer/supplier filters and inline new-contact creation, the contact detail dialog with KPIs, invoice history, notes and contact persons, and the shared delete confirmation. `crates/app/ui/src/contact_tools.ts`; contact persistence stays in the core store. |
| ContactEmailDraftModal | **done (this pass)** | core `domain::mail` contact payload; commands `contact_mail_draft` and `export_contact_eml`; webview dialog on every contact card; smoke `SOCDOF_SMOKE contact_mail` / `export_contact_eml`; test `contact_mail_and_fattura_are_generated` |
| ProductsModule, ProductLabelModal, SmartReorderModal, StockMovesModule, TableModule | **done** | egui `products.rs`; Tauri `product_label`, `reorder_plan`, `create_reorder_draft`, `set_product_reorder_exclusion`; webview Products tab covers list/create/edit/delete, the QR label editor with three formats and the reorder hub with threshold modes, request list and draft purchase order. |
| Dashboard, CalculatorModule, DesktopCalculatorWidget, DesktopWidgetsLayer, DesktopWidgetsModal, WidgetSettingsModal, WidgetsModule, WidgetsIcon | **done** | The webview dashboard loads real store aggregates through `dashboard`; `crates/app/ui/src/workspace_tools.ts` adds the integer-thousandths calculator with persisted history, the clock/date/notes/KPI widget layer with visibility settings, and TaskView with virtual desktops. The egui widgets remain in `crates/ui/src/widgets.rs`. |
| Sidebar, TopBar, CommandPalette, CommandPaletteModal, DesktopWindowWorkspace, AppLauncher, AppLocationPickerModal, DynamicCalendarIcon, DynamicReportsIcon, SocdofLogo, FlagIcon | **partial** | The webview top bar has wrapped module tabs and Command/Tasks/Widgets/Calculator actions, and `command_palette.ts` searches modules, actions, contacts, products and invoices and runs the selected item; this is the launcher path. The legacy location picker has no Rust data model and stays out of scope. Desktop window chrome is native Tauri. |
| AccountingModule, PurchasesModule, ReportsModule | **done** | Tauri commands `journal_entries`, `journal_summary`, `journal_cash_book`, `save_journal_entry`, `delete_journal_entry`, `export_journal_csv`, `purchase_orders`, `save_purchase_order`, `set_purchase_order_status`, `receive_purchase_order` and `report`; webview tabs for journal/cash book/BWA with real sums and CSV export, purchase orders with supplier/product validation and goods receipt, and period reports with invoice/status totals. Tests `journal_entries_summarise_cash_book_and_reject_invalid_values`, `purchase_orders_validate_references_and_receive_stock`; reply of invalid amount, kind, channel, vendor or product is rejected. |
| CalendarModule, TaskViewModal | **partial** | Webview appointments have month/agenda CRUD and conflict rejection. TaskView (open modules, virtual desktops, direct switching) is in `workspace_tools.ts`. Google Calendar/iCal sync remains environment-bound (OAuth/network service). |
| TherapyPracticeModule, `therapy/`, therapy invoice templates | **present** | `crates/ui/src/therapie.rs`, core therapy modules. |
| StudioDrawer, AccountScopedWorkspace | **present** | `crates/ui/src/studio.rs`; the Tauri window stays single-workspace. |
| SupportServicesModule, SupportDocumentViewerModal, SupportTicketPrintModal, SupportTimesheetModal, SupportWorkItemModal | **present** | `crates/ui/src/support.rs`. |
| SettingsModule, BackupSetupModal, AppStoreModule | **done** | The Settings tab edits the company profile, selects and opens the backup folder, lists/creates/saves backups, verifies and restores a native `.socdofbak` archive through `verify_backup`/`restore_backup`, and loads/toggles the 17-module AppStore through `app_store_modules`/`app_store_set_active`; window controls live in the header. `backup_files` falls back to the default `backups/` folder beside the database when no profile folder is configured. Tests `app_store_lists_and_persists_activation` and `verify_and_restore_replace_the_database_atomically`. |
| DisplaySettingsSection | **done (this pass)** | The Settings profile card now edits language, light/dark/system theme and accent colour; the values are stored in the existing `CompanyProfile` and applied immediately. A language change persists in `localStorage` and reloads the webview so every module picks it up. Eight de/en/fr/es keys cover the section. |
| AuthGate, UserManagementSettings, LanguageSelectionModal | **done** | `users.ts` adds the login gate for databases with accounts, local account create/edit/delete with last-admin protection via `users`/`save_user`/`delete_user`/`login_user`, session display, sign-out and the shared language modal with de/en/fr/es. Password hashes stay in the core. Tests: `crates/app/tests/users_storage.rs`. |
| External template/language/flag folders (`socdof:list-external-templates`, `read-external-template-file`, `get-templates-folder-path`, `open-templates-folder`, `read-local-languages`, `save-local-language-file`, `get-available-flags`, `get-flags-folder-path`, `open-languages-folder`, `open-flags-folder`) | **done (this pass)** | `crates/app/src/external_assets.rs` resolves env/portable/app-data folders, seeds READMEs, lists/reads `.docx/.doc/.pdf/.json/.html/.htm`, parses flat and nested language JSON, writes validated packs, and returns flag images as data URLs; Tauri commands are registered in `crates/app/src-tauri/src/commands.rs`, and the Templates tab shows the three folders with refresh/open/read actions. Tests `external_folders_seed_list_and_read_templates`, `external_languages_parse_flat_and_nested_packs_with_flags`, `external_assets_validate_open_folder_and_path_overrides`; smoke `SOCDOF_SMOKE external_templates count=1`, `external_languages count=1`, `external_flags count=1`, `external_template_read filename=smoke-template.html success=true bytes=22`. |
| DocumentationApp, TextwerkModule, StorageAssetPreviewModal, StorageInspectorView | **done** | The webview has Textwerk plus `docs.ts` (searchable quick-start, modules, shortcuts and security in four languages) and the Settings Storage Inspector (`storage_inspector`) with database path, file size, schema version, backup folder and per-table row counts. Test: `storage_inspector_reports_database_and_counts`. |
| POSModule | **done (this pass)** | The Tauri webview now exposes a real Kasse tab backed by `pos_overview`, `save_pos` and `cancel_pos`; receipts validate through the core POS domain, linked stock is booked out and restored on cancellation. `crates/app/tests/desktop_commands.rs` covers summary, cash change and cancellation. |
| DesktopFolderModal | **done** | native `pick_folder`/`pick_open_file`/`pick_save_file`, chosen and cancelled paths in `artifacts/smoke.log` and `artifacts/smoke-cancel.log`. |
| FleetModule | **done (this pass)** | Core `domain::fleet` (models, validation, distance/allowance, metrics, BOM/`;` CSV), `crates/core/src/store/fleet.rs` and schema v13, `crates/app/src/fleet_bridge.rs`, eight Tauri commands, webview tab with vehicle/logbook/fuel lists, filters, create/edit/delete dialogs and CSV export. Tests `fleet_roundtrip_persists_and_calculates`, `fleet_rejects_invalid_vehicle_trip_and_fuel`, `computes_distance_price_metrics_and_csv`, `validates_the_modal_fields_and_normalizes_the_plate`; smoke `SOCDOF_SMOKE fleet_vehicle_saved mode=created|updated`, `fleet_trip_saved`, `fleet_fuel_saved`, `fleet_list`, `fleet_trip_deleted`, `fleet_fuel_deleted`, `fleet_vehicle_deleted`, `export_fleet_csv rows=1`. |
| ProjectsModule | **done (this pass)** | Core `domain::project` (projects, tasks, validation, progress/revenue metrics, BOM/`;` portfolio CSV), `crates/core/src/store/projects.rs` with schema v14 (`projects`, `project_tasks`) and cascade delete, `crates/app/src/project_bridge.rs`, nine Tauri commands (`project_overview`, `save_project`, `delete_project`, `save_project_task`, `set_project_task_status`, `delete_project_task`, `export_projects_csv`, `project_persistence`, `create_project_invoice`); webview portfolio with KPI strip, search/status/category filters, project cards, four-column Kanban with quick status moves, project/task dialogs, billing and CSV export. Tests `projects_roundtrip_persist_bill_and_export`, `projects_reject_invalid_modal_fields`, `computes_portfolio_metrics_and_csv`, `validates_the_modal_fields_and_normalizes_the_code`; smoke `SOCDOF_SMOKE project_saved mode=created|updated`, `project_task_saved mode=created|updated`, `project_task_status`, `project_list`, `project_persisted`, `export_projects_csv rows=1`, `project_invoice`, `project_task_deleted`, `project_deleted`. |
| RestaurantModule | **done (this pass)** | Core `domain::restaurant` (menu, table orders, kitchen flow, validation, cent/basis-point arithmetic, 13-table floor plan, 11-dish default menu), `crates/core/src/store/restaurant.rs` with schema v15 (`restaurant_menu_items`, `restaurant_orders`, `restaurant_order_items`) and seeded default menu, `crates/app/src/restaurant_bridge.rs` with camelCase views/inputs and BOM/`;` receipt CSV, twelve Tauri commands (`restaurant_overview`, `save_restaurant_menu_item`, `delete_restaurant_menu_item`, `add_restaurant_item`, `set_restaurant_order_item_qty`, `set_restaurant_order_item_notes`, `set_restaurant_order_server`, `set_restaurant_order_status`, `delete_restaurant_order`, `restaurant_checkout`, `export_restaurant_csv`, `restaurant_persistence`); webview with four tabs (tables/orders, KDS, menu, archive), table plan, picker, order receipt, menu CRUD, billing with cash/card/NFC, tip, split, hospitality receipt, Z-report, receipts with the active company address and tax id, CSV, a receipt deep-link into the invoice preview and the ported Web Audio feedback; delete/storno actions use the native `confirm_message` dialog. Tests `restaurant_roundtrip_persists_calculates_and_checks_out`, `restaurant_rejects_invalid_dish_order_and_checkout_values`, `restaurant_receipt_number_considers_kept_pos_receipts`, `validates_the_dish_and_order_fields`, `adds_merges_and_recalculates_table_orders`, `company_view_uses_configured_profile_and_defaults`; smoke `SOCDOF_SMOKE restaurant_dish_saved mode=created|updated`, `restaurant_order_saved mode=created`, `restaurant_order_updated`, `restaurant_order_status`, `restaurant_list`, `restaurant_persisted`, `restaurant_checkout`, `export_restaurant_csv rows=1`, `restaurant_order_deleted`, `restaurant_dish_deleted`. |
| IOSBillingModule | **out of scope** | iOS App Store billing does not exist on the desktop target. |
| FatturaPaInspectorModal | **done (this pass)** | `crates/core/src/domain/fattura.rs` generates FatturaPA 1.2 XML (TD01/TD04/TD24, RF01/RF19, FPA12/FPR12, bollo, CUP/CIG, per-rate summaries); commands `invoice_fattura` and `export_invoice_fattura`; webview inspector with live XML; smoke `SOCDOF_SMOKE fattura` / `export_fattura`; 3 core tests plus the app test |
| DiscordEmbedPreview, DiscordFeedbackApp, DiscordFeedbackModal, DiscordThreadInspectorModal | **out of scope** | External Discord bot/webhook service; no token or network client in Rust. |
| MobileCompanionImportModal | **out of scope** | Mobile companion protocol is not modelled. |
| UpdatePromptModal, UpdatingSplashModal, CustomDownloadModal | **out of scope** | No updater/downloader in Rust; the start splash exists (`SOCDOF_SPLASH`), and packaging/update installation stays open. |
| WebPreviewModal | **out of scope** | Electron/web-preview specific notice; the Rust web build is a separate target. |

### 18.2 Electron IPC → Tauri commands

The TypeScript app registers 43 channels. Grouped status (every channel is listed):

| Channels | Status in Rust |
| --- | --- |
| `socdof:get-preferences`, `socdof:save-preferences` | **done** — settings are stored in the SQLite settings table; egui `settings.rs`. |
| `socdof:save-backup-file-to-disk`, `socdof:select-backup-folder`, `socdof:get-backup-folder-path`, `socdof:open-backup-folder` | **done** — `save_backup_to_disk`, `select_backup_folder`, `company_profile.backup_folder_path`, `backup_files` and `open_backup_folder`; the Settings tab lists archives and writes them through the native save dialog. |
| `socdof:get-network-lock-status` | **done** — instance lock via `Shell`/`InstanceLock`, smoke proves the release on `RunEvent::Exit` and the stale-pid path. |
| `socdof:get-platform` | **done** — `std::env::consts` in `socdof-core`/`socdof-app`; no separate command. |
| `socdof:is-fullscreen`, `socdof:set-fullscreen`, `socdof:toggle-fullscreen`, `socdof:is-maximized`, `socdof:maximize-window`, `socdof:unmaximize-window`, `socdof:minimize-window` | **done** — `window_is_fullscreen`, `window_set_fullscreen`, `window_toggle_fullscreen`, `window_is_maximized`, `window_toggle_maximize`, `window_minimize`; the webview header exposes minimize, maximize/restore and fullscreen buttons. |
| `socdof:move-window-to-display`, `socdof:get-displays`, `socdof:popout-window` | **out of scope** — multi-display windows, popouts and desktop widgets are not modelled. |
| `socdof:textwerk-open-dialog`, `socdof:textwerk-save-dialog` | **done** — `textwerk_open_dialog`/`textwerk_save_dialog` wrap the native dialogs with the Textwerk extensions and suggested name; the Textwerk tab persists documents through the core store. |
| `socdof:list-external-templates`, `socdof:read-external-template-file`, `socdof:get-templates-folder-path`, `socdof:open-templates-folder` | **done** — `list_external_templates`, `read_external_template`, `external_folder_path`, `open_external_folder` over `crates/app/src/external_assets.rs`; smoke `external_templates`, `external_template_read`; test `external_folders_seed_list_and_read_templates`. |
| `socdof:get-languages-folder-path`, `socdof:read-local-languages`, `socdof:save-local-language-file`, `socdof:open-languages-folder` | **done** — `list_external_languages`, `save_external_language`, `external_folder_path`, `open_external_folder`; flat and nested formats, flags and overlay; test `external_languages_parse_flat_and_nested_packs_with_flags`; smoke `external_languages count=1`. |
| `socdof:get-available-flags`, `socdof:get-flags-folder-path`, `socdof:open-flags-folder` | **done** — `list_available_flags`, `external_folder_path`, `open_external_folder`; SVG/PNG/JPG/WEBP/GIF become data URLs; test `external_languages_parse_flat_and_nested_packs_with_flags`; smoke `external_flags count=1`. |
| `socdof:enable-portable-mode`, `socdof:open-portable-folder` | **out of scope** — portable-mode installation is an installer concern. |
| `socdof:download-and-install-update`, `socdof:test-updating-splash` | **out of scope** — no updater; packaging/update installation stays open. |
| `socdof:discord-request`, `socdof:get-discord-token`, `socdof:save-discord-token`, `socdof:send-discord-thread`, `socdof:trigger-botghost-webhook` | **out of scope** — Discord bot/webhook integration. |
| `socdof:get-network-ips` | **out of scope** — no network-address UI in Rust. |
| `socdof:quit-app` | **done** — tray quit through `run_tray_command`, proven in the cancel phase. |

Native yes/no confirmation is not an Electron IPC channel: the TypeScript UI uses `window.confirm`,
while the Rust webview calls the `confirm_message` Tauri command backed by
`tauri-plugin-dialog` (`MessageDialogButtons::YesNo`). Its decision layer and both smoke outcomes are
listed in 18.1 and 18.4.

### 18.3 UI strings

| Surface | Keys | Status |
| --- | --- | --- |
| TypeScript `src/lib/i18n.ts` | ≈2,964 per language × de/en/fr/es | Reference |
| Rust egui `crates/ui/locales/{de,en,fr,es}.json` | 1,709 each, identical key sets | **present**; keys for out-of-scope modules are absent by design |
| Tauri webview `crates/app/ui/locales/{de,en,fr,es}.json` | 1,011 each, identical key sets (verified by JSON comparison and `crates/app/tests/ui_assets.rs`) | **done**; the count includes the parity labels for contact picker, calculator/widgets, command palette, task view, users/auth, docs, storage, contact filters, invoice banner and settings landing page. |

No new dialog text is hard-coded: every new label, option and message goes through
`translate(language, key)` and exists in all four packs.

### 18.4 Remaining open (environment-bound only)

These rows cannot be closed by repository code in this VM; each names the missing capability and the
decision or infrastructure its owner must provide. Everything else that is locally implementable is
listed as the next work in 18.5, not as an open parity gap.

- **Real pointer activation of native dialogs and the tray icon:** the code paths are implemented
  (`confirm_message` with `MessageDialogButtons::YesNo`; `on_tray_icon_event` with a completed left
  click mapped through `tray::icon_click`), and the decision layers are unit-tested. This Xvfb
  session cannot hand a GTK dialog a real pointer choice, and Linux status notifiers do not emit
  tray icon click events, so a human on a desktop session must confirm both interactions. Smoke uses
  the documented `SOCDOF_SMOKE_DIALOG_CONFIRM` fixture for the decision path.
- **SdI transmission and signature:** needs an accredited SdI channel, credentials and a signature
  key/certificate. The XML generation and validation are implemented; sending/signing is not.
- **Google Calendar / iCal sync:** needs the owner's OAuth client, consent and the remote service.
- **Discord bot / webhook feedback:** needs a bot token or webhook URL and the external Discord
  service.
- **Signed updater feed:** needs release signing keys and a published signed feed; the update check
  and UI exist, installation of a signed artifact is not exercised here.
- **Real GPU/compositor rendering:** this VM has no GPU; the software-rendered WebKit path is the
  only one that can run. A desktop machine with a GPU must verify the compositor path.
- **Mobile companion sync:** needs a companion device and its transport/session; the protocol is not
  modelled as a local-only feature.

### 18.5 Next locally implementable work (not environment-blocked)

- **Restaurant module (third functional app port, 2026-11-13):** added the native egui app, registered the 18th permission/App Store module, and added DE/EN/FR/ES catalogues. The Rust screen now covers the 13-table floor plan and area filters, live open orders, menu search/category filters, menu CRUD and availability, kitchen status transitions, item quantities and notes, server assignment, cash/card/NFC checkout, tip and split totals, hospitality receipt metadata, atomic invoice/POS posting, daily Z-report KPIs and the legacy GoBD semicolon CSV format. Regression tests cover menu validation, order persistence, notes/server/status, last-line deletion, cash change and atomic checkout. Remaining side-by-side checks: receipt preview/printing, sound feedback, exact CSV filename and edge-case parity against the Tauri module.
- **Projects module (first functional app port, 2026-11-13):** added `AppModule::Projects` to the permission matrix and App Store; native egui project/task CRUD uses the persistent SQLite store and core validation/metrics. It supports contact linking, budget/hourly rate, project/task statuses and priorities, billable logged hours, CSV export via the native save dialog, and draft invoice creation from billable logged tasks using the active invoice template. The created invoice opens in the native Invoices screen. Added DE/EN/FR/ES catalogues and regression tests for CRUD, validation, billing totals and legacy built-in-role upgrades. Remaining parity review: edge-case comparison of project filters, task transitions, CSV output and invoice numbering against the Tauri command path.
- **Fleet module (second functional app port, 2026-11-13):** registered `AppModule::Fleet` in the 18-module permission/App Store catalogue and native desktop launcher. The native egui app now manages vehicles, trips and fuel/charging receipts with the shared SQLite APIs and core validation, automatically advances vehicle odometers for new trips, computes business/private/commute kilometres and the €0.30/km allowance, and exports the logbook CSV with a native save dialog. CRUD, validation and persistence regression tests are included; DE/EN/FR/ES labels are present. Vehicle, purpose and inclusive date filters are now present; remaining work is side-by-side verification of filter behavior, edit edge cases and CSV output.

- **Contacts module (2026-11-13):** added native batch creation with atomic persistence, CSV and vCard import, a removable import preview with category assignment, and native CSV/vCard export through save dialogs. The Rust core includes RFC 4180-style quoted-field parsing, separator detection, common Outlook/Google/Apple/German headers, UTF-8 BOM CSV output and vCard 3.0. Parser round-trip tests and DE/EN/FR/ES labels are included. Remaining: malformed/large-file edge cases, complete vCard version/property coverage and exact TypeScript output parity.
- **Native macOS host build:** temporarily gated in the desktop matrix. The current egui 0.27/winit 0.29 stack resolves `objc2 0.4.1`, which fails to compile with the current Rust toolchain. Linux and Windows native builds remain enabled; a framework/dependency upgrade is still required before macOS native parity can be claimed.
- **Accounting business report (2026-11-13):** the native Accounting screen now loads a core aggregate across sent/paid/overdue invoices, non-draft purchases and completed POS receipts. It presents BWA revenue/cost/result, 7% and 19% VAT bases, output/input VAT and liability, open receivables and POS Z-report tender totals. The report refreshes on reopen, uses the company profile currency and exports the financial summary as CSV. Core and store-to-UI regression tests cover the calculations and persistence path. Today/custom date filters, exact legacy CSV parity and the monthly tax-advisor Excel ledger remain open; see `docs/accounting-rust-parity.md`.
- **Native Rust desktop host (first integration pass, 2026-11-13):** `cargo run -p socdof-ui --features window --bin socdof-ui-desktop` now starts the egui shell with the persistent SQLite database, the shared `network_session.lock`, saved language/theme/accent and real setup/login. `GalleryState::from_store` deliberately skips all sample records and demo credentials; `GalleryState::new` remains the isolated fixture path for visual tests. Lock/sign-out/account-switch actions return to the authentication screen. The Tauri webview and its installer are retained until native parity and OS integrations are proven.
- The remaining TypeScript components in the egui/webview split: TaskViewModal/Appointments, SupportServicesModule, TherapyPracticeModule, StudioDrawer/AccountScopedWorkspace and the DocumentationApp/StorageInspector screens. Restaurant now has a native functional screen; its TS reference remains for side-by-side parity checks until acceptance.
- Closed in the backoffice pass: Accounting, Purchases, Reports, Restore/Verify and AppStore are
  now real Tauri webview modules; the earlier Settings profile/backup, Textwerk and Calendar
  screens remain in place. The Xvfb smoke now drives the real navigation to accounting, purchases,
  reports and settings, creates and lists one row per transactional module, toggles an AppStore
  switch and verifies/restores a native archive.
- Closed in the dashboard/display pass: the Dashboard tab renders live KPIs, recent invoices and
  the reorder list; Settings exposes language, theme and accent colour.
- **Open — Tauri webview visual parity (§15.7):** the final v26 set reaches 98.87/0.9491,
  98.44/0.9310, 98.76/0.9041, 98.33/0.8961, 98.85/0.9116, 98.38/0.8979, 95.92/0.7251,
  95.42/0.7072, 97.87/0.9011 and 97.88/0.8778 (window pixel / SSIM). Settings icons/text
  rendering and the dark palette backdrop are the remaining non-native differences.
- The installer/bundling pass (`.deb`/AppImage and the Windows bundles).
- Closed in the twentieth pass: the window-control and backup-folder command pairs, the Settings
  profile/backup screen, Textwerk document persistence and the Calendar month/agenda CRUD screen.
- The three remaining product decisions in §17 (distribution model, Windows baseline, mobile
  companion at launch) are owner decisions, not implementation gaps.

### 18.6 Open TODO list

Functional parity is being completed before GUI polish. The native Restaurant, Projects and Fleet screens are new ports and still need side-by-side edge-case verification; the visual-parity gate and release environment remain open.

- [x] Contacts: detail modal, customer picker and delete-confirmation parity.
- [x] Dashboard calculator and widget layer, including calculator history and visibility settings.
- [x] Command palette / launcher, wrapped top-bar navigation and quick actions.
- [x] Calendar `TaskViewModal` with open-module cards and virtual desktops.
- [x] Auth gate, user management settings and the four-language selection modal.
- [x] Documentation browser and storage inspector.
- [ ] **Visual-parity gate (§15.7):** eight of ten pairs reach window ≥98; five reach SSIM ≥0.90.
  Open: Settings light/dark (0.7251/0.7072) and the dark palette (0.8778). The remaining causes are
  the TS outline icon set, WebKit text rendering and the dark Spotlight backdrop.
- [x] **Evidence refresh:** all ten pairs recaptured with real navigation and the real theme toggle;
  `WINDOW_BOX` is `(100,15,1240,765)`; `diff.json`/`diff.csv` regenerated.
- [x] **Documentation:** final values are in `docs/parity/README.md`, §15.7 and `CHANGELOG.md`.
- [x] **FatturaPA import:** XML is parsed in `fattura_import.ts`, creates/reuses the vendor and stores
  a draft invoice through the normal commands.
- [x] **Sequential contact creation:** `+ Mehrere anlegen` keeps the contact dialog open and opens a
  fresh form after each save until the dialog is closed.
- [x] **v26 versioning:** workspace, Tauri, UI and lock manifests are aligned at `26.0.0`; DOCX app
  properties read the package version instead of a hard-coded value.
- [x] POS, support services, therapy practice and studio drawer are present in the Rust egui shell
  (`crates/ui/src/{pos,support,therapie,studio}.rs`); POS is also available in the Tauri webview.
- [ ] Installer/bundling verification for `.deb`/AppImage and the Windows bundles — this Linux VM has
  no packaging toolchain/root and no Windows runner; the CI desktop job owns those builds.
- [ ] Environment-bound items in 18.4 (SdI/signature, OAuth/iCal, Discord, signed updater feed,
  real GPU, mobile companion) and the owner decisions in §17 remain outside repository-only work.

Feature work from the previous passes is closed: dashboard, contact detail/picker,
calculator/widgets, command palette, TaskView, auth/users/language, manual and storage inspector.
The visual-parity pass added shared light/dark tokens, the TS shell and rail/taskbar geometry, the
settings landing page, invoice banner, contact filters, command-palette layout and the evidence set,
but its acceptance gate remains open. Tests: `crates/app/tests/dashboard.rs`,
`crates/app/tests/users_storage.rs`, `crates/app/tests/ui_assets.rs`. Screenshot pairs and per-pair
scores are in `docs/parity/`; §15.7 is the authoritative status.

## 19. Progress log

| Date | Phase | Note |
|---|---|---|
| 2026-11-13 | 9 | Added the first persistent native egui desktop host on `feature/rust-native-desktop-host`: real SQLite path, legacy-compatible instance lock and heartbeat, saved profile language/theme/accent, first-run setup or login, and no demo data. The fixture gallery remains unchanged as a separate development path. The Tauri frontend is not removed until native parity, platform integrations and installer verification pass. |
| 2026-11-13 | 10 | Added native Projects and Fleet to the egui desktop: project/task portfolio and billing, vehicle register/logbook/fuel records, odometer updates, analytics, CSV exports, 18-module permissions/App Store catalogue, legacy built-in-role upgrades and DE/EN/FR/ES labels. Added persistence, validation and billing regression tests. |
| 2026-11-13 | 10 | Added native Restaurant to the egui desktop and 18-module permission/App Store matrix: 13-table floor plan, table orders, menu CRUD/availability, kitchen statuses, notes, server, cash/card/NFC checkout, tips/split, hospitality receipts, atomic invoice/POS posting, daily Z-report and GoBD CSV. Added DE/EN/FR/ES labels and native persistence/checkout tests. |
| 2026-11-11 | 18 | Webview parity pass: contact detail + customer picker, calculator/history and widgets, command palette, task view with virtual desktops, login gate and user management, language modal, documentation browser and storage inspector; 984 identical de/en/fr/es keys and new tests. Real TS/Rust screenshot pairs in `docs/parity/`. |
| 2026-11-12 | 18 | Final visual evidence from the v26 binary: eight of ten pairs pass the ≥98 pixel target, five pass SSIM ≥0.90; Settings and the dark palette remain open. Added the real FatturaPA XML import, sequential contact creation and v26 version alignment; all gates incl. the Xvfb GUI smoke pass. |
| 2026-11-12 | 18 | Ported the POS flow into the Tauri webview: receipt overview, daily totals, validated receipt creation, payment/change handling and cancellation with stock reversal; added a focused command-layer regression test. |
| 2026-11-12 | 18 | Visual-parity audit: the GUI gate is **open**, not closed. Dashboard dark reached 97.61 / 0.8664 at an intermediate revision; the ten captured pairs are 92.60–97.15 / 0.5583–0.8537 against the ≥98 / ≥0.90 target. Typography clarified: system stack/DejaVu for UI text, JetBrains Mono for numeric values. The working tree now bundles JetBrains Mono and fixes the logo, icons and spacing; the release build was interrupted and the recapture is pending. |
| 2026-11-12 | 18 | TypeScript visual-parity pass: shared `parity.css` light/dark tokens, TS desktop window/rail/taskbar, settings landing page, invoice banner and contact filters, TS-style command palette, 1,011 identical de/en/fr/es keys. Captured ten live 1440×900 pairs and documented per-pair pixel/SSIM scores plus the remaining technical differences in `docs/parity/`; the scores did not meet the acceptance target. |
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

- 2026-11-10 (twelfth pass) — the five remaining feature items, all with executed tests:
  `network_session.lock` with the legacy JSON keys, stale takeover, `force_takeover` and the
  `LockConflict` dialog; `socdof_core::updates` with feed parsing, version ordering, `UpdateCheck`
  and the `update-check` CLI command; `updates::Channel` with stage/current/rollback including the
  empty-artifact, missing-artifact and no-previous failures; the import step in the first-run
  assistant with `MigrationState`, wizard rendering and the host hook; all catalogues extended by 13
  keys in four languages. `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`, `cargo build --release --workspace`, `trunk build --release` green.
  Implementation commit: ec1d17a.

- 2026-11-10 (eleventh pass) — Phase 9 completed. Both lists draw through `ScrollArea::show_rows`
  with a fixed row height (`crates/ui/src/contacts.rs`, `crates/ui/src/invoices.rs`) and the invoice
  rows read their customer name from `InvoicesState::contact_labels` instead of a store lookup per
  row. `table_cell` now allocates an explicit rect; the golden diff showed content-sized cells
  misaligning headers and rows, which is fixed before the goldens were accepted (four languages, two
  appearances, columns verified on 303.04/519.76/736.48). The new `crates/ui/tests/performance.rs`
  seeds 50k contacts and 100k invoices through `Store::insert_contacts`/`insert_invoices` in 18.5 s
  and measures the real screens: contacts median 0.10 ms / P95 0.15 ms, invoices 0.20 / 0.21 ms,
  against the 16.6 ms budget; `SOCDOF_FRAME_BUDGET_MS=0.01` fails it (exit 101). Seeding exposed a
  quadratic FTS path — the invoice triggers deleted through the `UNINDEXED` `invoice_id`, 10k batches
  grew 11.4 s → 33.7 s → 54.2 s → 75.3 s — so schema v9 adds `invoices_fts_rows(invoice_id,
  fts_rowid)`, deletes by rowid and rebuilds once; batches now take 1.4–1.7 s. The memory report has
  the measured 196.9 MiB peak of the benchmark dataset. Installer/installed size and idle RAM/CPU are
  not buildable in this container (no GTK/WebKit, no `sudo`, no `Xvfb`) and are wired into the
  `desktop` and `gui-smoke` jobs (`--scope=artifacts`, `--scope=runtime --pid`), where a violation
  fails the job. `cargo fmt`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`, `cargo build --release --workspace` and `trunk build --release` green.

 `scripts/budgets.json` records every
  budget with limit, unit and measurement context; `scripts/check-budgets.mjs` measures the desktop
  UI bundle, the browser bundle and the cold start of the release binary, reports the artifacts that
  need a display or the Tauri toolchain as `not built here`, and exits 1 on a violation
  (`--limit=<key>=<value>` proves it). Measured: UI bundle 52,305 B / 15,535 B gzip, browser bundle
  6,415,465 B / 2,991,359 B gzip, cold start 144 ms median of five runs. Open and named in
  `docs/performance.md`: the 50k/100k frame budget (both lists still lay out every row, so
  virtualisation plus a benchmark is required), the installer/installed size and idle RAM/CPU
  (Tauri and Xvfb, i.e. the CI desktop and gui-smoke jobs), and the UI memory profile.

- 2026-11-10 (thirteenth pass) — invoice dunning, e-mail draft and payment modal, plus the two
  product dialogs in the Tauri webview. `DunningModal.tsx` offers the levels 0/1/2/3 with the fee
  presets 0,00/2,50/2,50/5,00 €, the 5 % interest only on level 3, the payment deadlines 7/7/5 days,
  computes `overdue_days` from `due_at` and writes a German letter with the title
  "Zahlungserinnerung"/"1. Mahnung"/"2. Mahnung" and the note "Bitte überweisen Sie den Gesamtbetrag
  bis zum <date> auf das Konto <IBAN> bei <bank>."; `lib/emlGenerator.ts` encodes the subject as
  base64 UTF-8 for the dunning mail and only for non-ASCII invoice subjects, uses `
` line
  endings, `text/plain; charset=utf-8` and `Content-Transfer-Encoding: base64` with 76-character
  lines. `PaymentModal.tsx` books cash (with the quick amounts 5/10/20/50/100 and the change), card
  (terminal name, TSE signature, base36 reference) and transfer (bank, IBAN, BIC, `AUTH-` reference,
  booking date, `paid_at`) and sets the invoice to `paid`; `domain::payment`, `domain::dunning` and
  `domain::mail` mirror the rules (14 tests), schema v12 adds the 1:1 table `invoice_payments`
  (`Store::record_invoice_payment`/`invoice_payment`, one row per invoice, store round-trip test), and
  the three egui dialogs sit behind the detail buttons of the invoice screen. The Tauri webview now
  also renders the label dialog with format switch, QR matrix, price and fallbacks, and the reorder
  assistant with threshold modes, quantities, inclusion, permanent exclusion (persisted through
  `set_product_reorder_exclusion`), search, marketplace, Amazon cart link, clipboard list and draft
  purchase order; the commands return ready-made DTOs so no rule is duplicated in the frontend.

- 2026-11-10 (eleventh pass) — country autocomplete of the contact form. `lib/countries.ts` of the
  TypeScript app holds 47 countries (DACH first) with German/English/French/Spanish/Italian names
  and a flag, and `searchCountries(query, lang)` trims and lower-cases the query, matches the ISO
  code and every localized name by prefix or substring, returns the first eight entries for an
  empty query and sorts prefix hits before substring hits, alphabetically by the localized name
  (`localeCompare`). `ContactEditModal.tsx` writes the localized name of the clicked entry into the
  free-text `country` field and preselects "Deutschland". The port keeps the list and the matching
  in `domain::countries` (8 tests: order and shape, shortlist, code prefix, localized names,
  substring with prefix-first ordering, trimming, the missing diacritic folding, unknown queries),
  the egui form shows the same suggestion list and writes the localized name into
  `ContactDraft.country`, and the Tauri frontend renders the list from the new `search_countries`
  command. Because the same form was still missing the legacy street/postal-code/tax-id/notes
  inputs, those are part of this pass as well, which closes the contact checklist line.

- 2026-11-10 (twelfth pass) — product labels and the smart reorder hub, plus the keyboard half of the
  country line. `ProductLabelModal.tsx` renders three formats (standard 320 px, shelf 340 px, compact
  260 px wide) with name, SKU, `de-DE` price, category fallback "SOCDOF ERP", unit fallback "Stück",
  the note "SOCDOF-SCAN" and the payload `{"name","sku","price","asin","currency"}` encoded as a QR
  symbol with error correction M; `domain::label` keeps all of that (6 tests: payload order, price
  format, fallbacks, ASIN from the web link, matrix) and the preview paints the same payload through
  the in-house encoder (`crates/core/src/barcode/qr.rs`). `SmartReorderModal.tsx` and
  `lib/productLinkExtractor.ts` take candidates from `stock <= (min_qty ?? 5)` or a fixed threshold
  (default 5), order `max(1, target - stock)` with `target = target_stock || min_qty * 2 || 10`,
  include every article unless `exclude_from_reorder`, search name/SKU/ASIN/source domain, report low
  stock/units/cost/ASIN readiness, build `https://www.<domain>/gp/aws/cart/add.html?ASIN.n=…` and
  derive a draft purchase order with 19 % tax, delivery in three days, number `PO/<year>/<1000..9999>`
  and the note "Automatisch generiert über den SOCDOF Smart Reorder Hub für N knappe Artikel.";
  `domain::reorder` mirrors it (10 tests) and both dialogs are egui modals. Products gained the legacy
  `asin`, `web_link` and `source_domain` columns through schema v11 (`ALTER TABLE`), the store, the
  import/export and both frontends. The egui country list is now keyboard driven like the modal:
  ArrowDown/ArrowUp move the highlighted row with wrapping, Enter writes the localized name and Escape
  closes the list before it can close the form (`country_list_follows_the_keyboard`).
  The label and reorder dialogs are egui modals; the Tauri webview carries the new
  barcode/ASIN/web-link/source-domain inputs but not the two dialogs.

- 2026-11-10 (tenth pass) — contact persons ("sub-contacts") of a company. The TypeScript app keeps
  them as `contact_persons` on the contact (`types.ts`), edits them in `ContactEditModal.tsx` and
  shows the primary one in `ContactsModule.tsx`; the Rust port had no model for them at all.
  `domain::contact::ContactPerson` now carries the same fields and the same rules (first person
  primary, removal promotes the next one, one primary at most, save drops blank persons), schema
  v10 stores them in `contact_persons` ordered by position with `ON DELETE CASCADE`, the contact
  search matches person names/emails/phones, the legacy document reads and writes the array in the
  legacy field names, and the desktop command layer keeps the stored list when a client omits the
  field. Verified with `cargo test -p socdof-core --lib contact::` (9 tests),
  `cargo test -p socdof-core --test contact_persons` (4 tests, including the committed legacy
  backup with `cp-1` / Florian Weber), `cargo test -p socdof-app --test contact_persons` and
  `cargo test -p socdof-ui --lib contacts::` (6 tests).

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

- 2026-11-10 (fourteenth pass) — invoice template parity. The TypeScript sources
  `invoiceTemplateManager.ts`, `InvoiceTemplateModal.tsx` and `InvoicePrintModal.tsx` were used as
  the reference, not just the migration checklist. Completed in the Rust core and egui UI:
  - `InvoiceTemplate` stores a logo source (path or persisted `data:` URL), `show_logo` and
    `logo_position`; the PDF writer embeds the PNG as an XObject and the DIN 5008 renderer places it
    left, centered or right. `file_to_data_url` keeps uploads self-contained in the settings row.
  - `stationery_mode`/`stationery_source` accept a PNG or PDF. `BackgroundImage::from_pdf_bytes`
    extracts the largest embedded raster image from the first PDF page, so an image-based PDF
    letterhead can be reused; it is painted under the invoice on every page and takes precedence
    over the legacy `document_layout` background.
  - `use_custom_layout`/`custom_body_template` render the TypeScript placeholders
    (`{Firma_*}`, `{Kunde_*}`, `{Rechnungsnummer}`, dates, totals, `{Positionen_Tabelle}`,
    `{Primaerfarbe}`, `{Fusszeile}`). The editor, PDF and DOCX share one `rich_html::RichDocument` model. It parses headings,
    paragraphs, line breaks, lists, strong/em/underline, inline colours and font sizes, simple
    tables, images and explicit page breaks; the egui preview paints the same blocks, the PDF draws
    the same runs and table rows, and DOCX maps them to headings, runs and OOXML tables.
  - `TemplateCompany` (name, subtitle, owner, street, ZIP/city, phone, email, website, tax number,
    VAT ID, bank, IBAN, BIC, commercial register) persists with the template and overrides the
    global `CompanyProfile` field by field.
  - `write_invoice_docx_with_template`/`invoice_docx_bytes_with_template` use the existing real OOXML
    writer; the print dialog has a `.docx` path and save button, and `export_invoice_docx` uses the
    active template.
  - 39 new keys in de/en/fr/es; `UI_KEYS` and `catalogue-keys.json` were regenerated (1,685 keys).
    Core tests cover data-URL round trips, company fallback/override, HTML substitution and position
    rendering, logo plus PDF-derived stationery embedding, and template-aware DOCX write/read.
  - Artifacts: `crates/core/target` is not used; the end-to-end test writes
    `target/invoice-template-artifacts/rechnung.pdf` and `rechnung.docx` from a free HTML template
    with logo and PDF stationery. The PDF is checked for the image XObjects and the rendered heading
    and position text; the DOCX is read back and checked for its heading, one table row per position
    and the footer.
  - Verification: `cargo test -p socdof-core --lib invoice_template::`,
    `cargo test -p socdof-core --lib pdf::din5008::`, `cargo test -p socdof-core --test docx_invoice`,
    `cargo test -p socdof-core --test invoice_template_artifacts`,
    `cargo test -p socdof-ui --lib invoice_templates::`, `cargo test -p socdof-ui --lib i18n::`,
    workspace tests, `cargo clippy --workspace --all-targets -- -D warnings` and
    `cargo fmt --all -- --check`.
  - DOCX images: `DocxImage` stores PNG bytes and pixel dimensions. The writer adds
    `word/media/logo.png` and `word/media/stationery.png`, a first-page header
    (`word/header1.xml`, logo plus stationery) and, with both images, a default header
    (`word/header2.xml`, stationery only). The section properties carry `w:titlePg` plus
    `first`/`default` header references, and each header has its own relationships part. Drawings are
    anchored to the page with `behindDoc="1"`; the stationery is cover-cropped to A4 and repeats on
    every page, while the logo stays on the first page and is scaled with `object-fit: contain` to at
    most 140 × 70 CSS pixels (37.04 × 18.52 mm) without upscaling. Unreadable image sources produce
    no media, header or content-type entries, so the package stays valid. The artifact test reads the
    package parts and checks both media files, both header relationships, the document relationships,
    `w:titlePg`, both header references and the `w:sectPr` child order.
  - `stationeryTokens` are ported from the TypeScript `StationeryTokenField`: `StationeryToken`
    stores `tokenKey`, `xPct`, `yPct`, optional `widthPct`, optional `fontSize` in CSS pixels,
    `fontWeight`, `color` and `align` under the TypeScript field names, persists as
    `stationeryTokens` in the template JSON and defaults to an empty list, so existing templates are
    unchanged. `stationery_token_texts` resolves the invoice variables (falling back to the token key
    like `vars[key] || key`) and flattens HTML-valued tokens such as `{Positionen_Tabelle}` to plain
    text. The PDF export draws them on the first page above the stationery and below the body with
    percentage positions, 96-dpi font sizes, bold, colour, alignment and the TypeScript line-height
    1.4; a configured width wraps at word boundaries. The DOCX export writes each token as a
    borderless, page-anchored floating table in the first-page header, with the same percentages,
    half-point font size, colour, bold and `w:jc` alignment. Missing stationery images or an empty
    token list draw nothing, percentages outside 0–100 clamp to the page, unknown colours and
    alignments fall back to `#0f172a` and left, and missing percentages mean the top-left corner.
  - The template dialog contains the TypeScript placement studio. A scaled A4 canvas paints the
    stationery and every token with the export geometry (percentage position, CSS-pixel size at
    96 dpi, weight, colour, 1.4 line height, width wrapping and alignment). Line breaks and per-line
    offsets come from `layout_stationery_token`, the same Helvetica advance/1.4 layout used by the
    PDF and DOCX token output, so long values have identical lines in preview and artifacts; with a
    real invoice the canvas shows the resolved values, without one the token keys. Fields can be added from the 34 token
    keys, selected, dragged or clicked into place (0–95 %, one decimal), edited (x/y, optional width
    10–90 %, size 8–28 px, weight, alignment, colour), deleted and replaced with the seven TypeScript
    default fields. The dialog persists through the validated book API, the Tauri command adapter
    (`DesktopState::save_invoice_templates`/`invoice_templates`) round-trips the same values, and
    templates without tokens stay empty and unchanged. A headless egui test paints the dialog with
    a decoded stationery texture and the default fields.
  - Flex/grid containers resolve through the shared layout plan used by preview, PDF and DOCX.
    Flex supports direction, row-axis `flex-wrap`/`wrap-reverse`, `justify-content`, `align-items`,
    row and column gaps, `flex`/`flex-basis`/`flex-grow`, widths, padding, item margins and nesting;
    every wrapped line distributes its own free space. Grid supports `repeat()`/`fr`/px/percentage/
    `auto` columns and explicit `grid-template-rows` (`auto`, `fr`, px, percentage), `grid-auto-rows`,
    row order and row gaps; an explicit row keeps its planned height, and an `fr` row uses a definite
    container height when one is present. DOCX maps each line to a borderless fixed-width table with
    a row-height hint.
  - Block margins from inline `margin`/`margin-top`/`margin-bottom` are part of the shared model.
    Adjacent block margins collapse to the larger value, flex/grid item margins do not collapse, and
    margins on a wrapper reach its first and last rendered block. Preview, PDF and DOCX consume the
    same values (DOCX writes explicit margins as spacer paragraphs); an explicit zero suppresses the
    implicit paragraph gap.
  - Logo and stationery load through a native file picker injected by the desktop host and through
    drop zones in the template dialog. Both paths use the shared core loader
    (`TemplateAssetKind`/`template_asset_from_bytes`/`read_template_asset`): the logo accepts the
    TypeScript `image/*` set and rejects files above 2 MB, stationery accepts
    `.pdf,.png,.jpg,.jpeg,.webp`, and every accepted file is stored as a data URL. Raster images
    (PNG, JPEG, GIF, WebP, BMP, ICO) use the shared image decoder; SVG logos use the pure-Rust
    `resvg` rasterizer in native builds, capped at 2048 px, so the template dialog thumbnail, PDF
    and DOCX consume the same bitmap. A malformed SVG is accepted and stored like the TypeScript
    file input, but produces no image, leaving the preview and both exports valid. The wasm host
    keeps the previous SVG fallback. A logo selection enables `showLogo`; a stationery selection
    enables stationery mode and fills the seven TypeScript default fields when none exist.
    Cancelling leaves the draft unchanged; an invalid drop or a build without a desktop host
    reports a translated error instead of panicking. The normal template save persists the data
    URL, and preview, PDF and DOCX read the same source.
  - PDF letterheads without an embedded raster image stay vectorial. The PDF writer reads the first
    page (`/MediaBox` or `/CropBox`), decodes uncompressed and Flate-compressed content streams,
    keeps paths, curves, rectangles, fills, strokes, clipping and device colour spaces, and drops
    text, image, pattern and other resource-backed operators. The page is placed with the same
    `object-fit: cover` geometry as the TypeScript PDF.js canvas: scaled to A4 and centred, with
    overflowing edges cropped. Image-based PDFs keep the previous largest-raster extraction. The
    template preview and DOCX still consume a raster stationery image, so a vector-only PDF is
    currently vectorial in the PDF export only.
  - Still open after this pass (closed by the fifteenth pass below): the Tauri webview did not expose
    the template fields, and the wasm host keeps the previous SVG fallback because `resvg` is
    native-only.

- 2026-11-10 (fifteenth pass) — Tauri template bridge and webview editor. The last open item of the
  fourteenth pass is closed: every template field now travels through the Tauri webview with the
  TypeScript format and behaviour.
  - `crates/app/src/template_bridge.rs` is the only translation layer. It exposes the exact
    TypeScript names (`presetType`, `isDefault`, `logoUrl`, the flat `companyName` …
    `companyCommercialRegister` fields, `primaryColor`, `fontFamily`, `headerTitle`, `headerText`,
    `footerText`, `taxNote`, `dueDays`, `useCustomLayout`, `customBodyTemplate`, `showFoldMarks`,
    `stationeryMode`, `stationeryPdfUrl`, `stationeryImageUrl`, `stationeryTokens`, `createdAt`),
    maps `companyAddress` onto the template street and follows the TypeScript
    `stationeryImageUrl || stationeryPdfUrl` precedence in both directions. Missing fields take the
    TypeScript defaults; unknown or core-only field names are rejected instead of being ignored;
    a book without templates fails validation instead of silently replacing the stored book.
  - The core `InvoiceTemplate` gained `preset_type`, `font_family`, `created_at` and `is_default`
    (all `serde(default)`, so existing stored books load unchanged and the factory templates keep
    their preset families). `font_family` selects the TypeScript sans, serif or mono stack of the
    built-in HTML layout; unknown values keep the previous sans stack.
  - `DesktopState::invoice_template_book`/`save_invoice_template_book` are the tested adapters. The
    new Tauri commands `invoice_templates`, `save_invoice_templates`, `template_token_keys` and
    `template_default_stationery_tokens` are one-line wrappers over them.
  - The webview has a Templates tab with a form for every field, logo and letterhead file inputs
    with the TypeScript extension filters and the 2 MB logo limit, template list actions (edit,
    activate, duplicate, delete) and the stationery token editor (all 34 keys, position, width,
    size, weight, alignment, colour, the seven default fields). The GUI smoke run loads, changes,
    stores and re-renders a template through the real `invoke` path. 63 new keys per language in
    de/en/fr/es.
  - Tests (`crates/app/tests/template_bridge.rs`): a complete TypeScript payload reaches every core
    field; serialization uses only the TypeScript names; a full book round trip loses nothing;
    missing fields take the TypeScript defaults; unknown fields raise `unknown field`; a book
    without templates and a missing active template fail validation; `DesktopState` stores and
    reloads the webview book and keeps the stored book after a rejected save; header, introduction,
    footer, company overrides, the serif stack, the accent colour, the stationery image and a
    stationery token are present in the HTML, the DIN 5008 PDF and the DOCX package.
  - Verification: `cargo test -p socdof-app`, `cargo test --workspace --no-fail-fast`,
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs`, `npm run build` in `crates/app`.
  - Still open: the wasm host keeps the previous SVG fallback because `resvg` is native-only; a
    vector-only PDF letterhead is vectorial in the PDF export only (preview and DOCX still need a
    raster stationery source); the Tauri crate is its own Cargo workspace and needs GTK/WebKit,
    which this VM did not provide as system packages, so at that point the new commands were covered
    through their `socdof-app` adapters and the webview build rather than a native window run (the
    window run followed in the seventeenth pass); the invoice list/detail screens of the Tauri
    webview remained open (closed by the sixteenth pass below).

- 2026-11-10 (sixteenth pass) — Tauri invoice list, editor, preview and export. The last open item of
  the fifteenth pass is closed: the webview now runs the complete invoice workflow through the real
  commands.
  - `crates/app/src/invoice_bridge.rs` is the single invoice translation layer. It maps a stored
    `Invoice` to the TypeScript field names (`number`, `contact_name`, `contact_company`, `date`,
    `due_date`, `payment_terms`, `currency_symbol`, `notes`, `items`), keeps every amount in integer
    cents (position net/tax/gross plus subtotal, tax total and total) and parses the editor input
    back into a validated invoice. ISO dates are validated by round trip; a due date before the
    issue date, a missing customer, an empty position list, a zero quantity and an out-of-range tax
    rate return the existing domain codes. The TypeScript status `posted` is accepted as the wire
    name of the stored `sent` state; `payment_terms` is the day count between issue and due date.
    Missing fields take the editor defaults, unknown field names are rejected by serde.
  - `DesktopState` gained `invoice_views`/`invoice`/`invoice_defaults`/`save_invoice`/
    `delete_invoice`/`set_invoice_status`/`invoice_preview`/`export_invoice`. The list search covers
    number, customer name/company, note and position descriptions; status filters accept `all` and
    the storage names (plus `posted`). New invoices get the next `YYYY-0001` number, the company
    currency and the active template's payment term.
  - Tauri commands `list_invoices`, `invoice_detail`, `invoice_defaults`, `save_invoice`,
    `delete_invoice`, `set_invoice_status`, `invoice_preview` and `export_invoice` are registered.
    The preview resolves the chosen template (the active one by default) with the shared HTML
    renderer and returns the resolved stationery fields; the export writes a real DIN 5008 PDF or
    DOCX with that template, and without a path it writes next to the database under `exports/`.
  - The webview has an Invoices tab: searchable/status-filtered list with status badges, customer,
    dates, position count and totals, plus preview/edit/status/delete actions; an editor with number,
    contact, status, issue and due date, payment term (days and date stay in sync), currency, note and
    editable position rows that recalculate net/tax/gross live; and a preview dialog with template
    switcher, the rendered HTML body, an A4 stationery canvas with the positioned token texts and
    PDF/DOCX buttons that use the native save dialog. 66 new keys per language (de/en/fr/es, 258
    total).
  - The GUI smoke run now covers the required path end to end through `invoke`: create, list,
    detail, change quantity/price/note/status, save, preview (HTML asserted), export PDF and DOCX
    (non-empty files), and the paid transition. It asserts the totals 11,900 -> 21,420 cents and the
    `posted` -> `sent` mapping. A mismatch aborts the smoke run.
  - Tests (`crates/app/tests/invoice_bridge.rs`): create/list/search (number, customer, position)
    and status filters; defaults and next number; totals; update of positions, dates, note and
    status; invalid input (empty positions, bad date, due before issue, unknown customer, unknown
    field) leaves the stored invoice untouched; preview with the active and a second template,
    including the resolved token, and PDF/DOCX exports that contain the number, customer, positions,
    template title, the accent colour, the stationery image and the token in the DOCX header.
  - Deviations from the TypeScript app: `posted` is stored as `sent`; `payment_terms` is a day count
    instead of a free-text string; a manual recipient without a contact, the per-position discount
    and the SdI/FatturaPA fields have no Rust model; the preview is a DOM rendering plus the
    stationery/token canvas, while the authoritative print output stays the PDF/DOCX export (no
    `window.print`); payment capture, dunning and the invoice e-mail draft remain egui-only.
  - Still open: the wasm host keeps the previous SVG fallback (`resvg` is native-only); a vector-only
    PDF letterhead is vectorial in the PDF export only (preview and DOCX still need a raster); the
    Tauri crate needs GTK/WebKit, which this VM did not provide as system packages, so at that point
    the commands were covered through their `socdof-app` adapters and the webview build rather than a
    native window and smoke run; payment, dunning, e-mail and the other remaining TypeScript modules
    are not yet ported to the webview.
    (The native window and smoke run were built and executed in the seventeenth pass below.)

- 2026-11-10 (seventeenth pass) — the native Tauri GUI smoke ran in this environment. The open item of
  the sixteenth pass is closed: the release binary was built, started under Xvfb and ran the complete
  invoice workflow through the real `invoke` path; the run exits with `SMOKE_EXIT=0` and writes
  `artifacts/smoke-report.json`.
  - Build defect found and fixed: `crates/app/src-tauri/Cargo.toml` lacked the Tauri v2 template's
    `[features] custom-protocol = ["tauri/custom-protocol"]` entry. `tauri-macros` generates its
    context with `dev: cfg!(not(feature = "custom-protocol"))`, so a plain `cargo build --release`
    embedded no frontend, pointed the webview at `build.devUrl` (`http://localhost:1420`) and the
    smoke never reached a single command. The feature is declared now and the binary is built with
    `cargo build --release --features custom-protocol` (`tauri build` enables it itself).
  - GUI smoke hardening: the edit step no longer builds a save payload in JS. It asserts the detail
    (`invoice_detail`, one position, 11,900 cents), clicks the invoice card's edit action, checks
    that the editor loaded the number, sets status and note plus the position quantity/price inputs,
    submits the real form (`invoiceInputFromForm` -> `save_invoice`), waits for the dialog to close
    and re-reads the invoice (21,420 cents, `sent`). The preview dialog and both exports stay on the
    real commands. `waitForSmoke` bounds every UI wait at 10 s.
  - Environment, without root and without GTK/WebKit/Xvfb packages: 661 `.deb` files were extracted
    into `$HOME/sysroot` (nothing installed system-wide). Xvfb runs `/usr/bin/xkbcomp` from a
    compiled-in path, so a private user+mount namespace overlays `/usr/bin` with the sysroot
    `xkbcomp`; the same namespace exposes the WebKit helper processes at
    `/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1` (also compiled in; `WEBKIT_EXEC_PATH` is only honoured
    in developer builds). `__EGL_VENDOR_LIBRARY_FILENAMES`, `LIBGL_DRIVERS_PATH`,
    `MESA_LOADER_DRIVER_OVERRIDE=llvmpipe` and a sysroot `fonts.conf` replace the missing
    `/usr/share/glvnd`, `/usr/lib/x86_64-linux-gnu/dri` and `/etc/fonts` lookups.
    `artifacts/run-gui-smoke.sh` reproduces the run.
  - Evidence in `artifacts/smoke.log`: splash and main window, tray, `database_status
    schema_version=12`, backup, contact and product create/update, template book,
    `save_invoice ... total=11900`, `list_invoices`, the form-driven `save_invoice ... total=21420`,
    `invoice_preview html_bytes=2053`, `export_invoice format=pdf bytes=2988`,
    `export_invoice format=docx bytes=3359` and `SOCDOF_SMOKE_OK`.
  - Verification after the change: `cargo test --workspace --no-fail-fast` (all suites green),
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` in `crates/app` — all exit 0.
  - Not covered: installer/bundling (`tauri build` with bundling, `.deb`/AppImage); the tray menu and
    the native file dialogs were covered in the eighteenth pass below. The window rendered through
    llvmpipe software GL under Xvfb instead of a real GPU/compositor.

- 2026-11-10 (eighteenth pass) — the native tray menu and the native file dialogs ran in the real
  window. The open native surface of the seventeenth pass is closed; the run is green in two phases
  and ends with `NATIVE_SMOKE_OK chosen=0 cancel=0`.
  - `SOCDOF_SMOKE_TRAY` and `SOCDOF_SMOKE_DIALOGS` no longer run inside the setup closure. The window
    asks the new `smoke_options` command which flows are enabled and then drives them through the
    real commands: `pick_folder`, `pick_open_file`, `pick_save_file` and `show_message` for the chosen
    and the cancelled selection, plus `smoke_tray_run`, which dispatches every labeled entry through
    `run_tray_command` — the same function the platform menu event calls. The quit entry is only
    dispatched in the cancel phase, so that phase also proves the exit path.
  - Defect found and fixed: `app.exit(0)` skips the destructors of managed state, so the tray quit and
    the smoke finish left a fresh `network_session.lock` behind and the next start failed with
    `lock_busy` for up to 30 s — phase 2 of the runner reproduced exactly that. The lock is released
    on `RunEvent::Exit` (`DesktopState::release_lock` -> `Shell::release_lock` ->
    `InstanceLock::release`), and `is_stale` additionally treats a lock whose pid no longer exists on
    the same machine (`/proc/<pid>` on Linux) as abandoned, so a crash cannot block a restart either.
  - Environment defect fixed: `$HOME/sysroot/env.sh` exported `SYSROOT`, which `clippy-driver` reads
    as its Rust toolchain sysroot; a non-cached `cargo clippy` then failed with "can't find crate for
    std". The variable is `SOCDOF_SYSROOT` now and `artifacts/run-gui-smoke.sh` follows it.
  - Evidence, phase 1 (`artifacts/smoke.log`): `SOCDOF_DIALOG kind=folder|open_file|save_file
    outcome=chosen` with real fixture paths, `kind=message outcome=acknowledged`,
    `SOCDOF_TRAY item=unknown action=none`, `item=show action=show_window`,
    `item=backup action=create_backup` with a written archive, then `SOCDOF_SMOKE_OK`.
  - Evidence, phase 2 (`artifacts/smoke-cancel.log`): all three file dialogs `outcome=cancelled`, the
    message acknowledged, `item=show`, `item=backup` and `item=quit action=quit`; the process exits 0
    through the tray quit.
  - Verification after the change: `cargo test --workspace --no-fail-fast`,
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` in `crates/app` — all exit 0.
  - Still not covered: the tray icon and its menu cannot be opened with a pointer because the Xvfb
    session has no status-notifier host; the entries are dispatched through the same function the
    menu event calls, not by clicking the platform menu. Installer/bundling (`tauri build` with
    bundling, `.deb`/AppImage) and a real GPU/compositor remain unverified, as do the native modal
    dialogs with a real user choice (the selections come from the seeded smoke environment).
- 2026-11-11 (nineteenth pass) — parity audit against the TypeScript source, and the webview gap for
  dunning, invoice mail and payment capture is closed. The eighteenth pass and its CHANGELOG entry
  were verified in the repository first: the tray/dialog smoke, the `RunEvent::Exit` lock release and
  the stale-pid detection are documented at the end of section 19 and in `CHANGELOG.md`.
  - Reference used for the audit was `SOCDOF - TS/` itself (76 components, 34 `src/lib` modules, 43
    Electron IPC channels, four i18n packs), not the previous migration notes. The result is the
    matrix in section 18; every screen group and every IPC channel has a status and a reason.
  - Real gap found: `DunningModal`, `InvoiceEmailModal` and `PaymentModal` existed in `socdof-core`
    and the egui screens but had no Tauri command and no webview surface at all. Added
    `InvoiceDunningView`/`InvoiceMailView`/`InvoicePaymentView` in `crates/app/src/invoice_bridge.rs`,
    the `DesktopState` methods `invoice_dunning`, `invoice_mail`, `record_invoice_payment` and
    `invoice_payment`, and the commands `invoice_dunning`, `invoice_mail_draft`, `invoice_payment`,
    `record_invoice_payment` and `export_invoice_eml` (writes the real `.eml`). The webview invoice
    cards now open a dunning dialog (level, fee, deadline, live subject/body), an e-mail draft dialog
    and a payment dialog (transfer/cash/card, reference); all strings exist in de/en/fr/es (283 keys
    per pack, identical sets).
  - `DunningLevel` gained `as_str`/`from_storage` so the wire format and the stored level cannot
    drift. The payment path reuses `transfer_reference`, `card_reference`, `CASH_REFERENCE` and the
    TSE signature, and `record_invoice_payment` marks the invoice paid in the same transaction.
  - The GUI smoke now exercises the new path through `invoke`: mail draft, dunning letter, two EML
    exports and a transfer payment that flips the invoice to `paid`. Evidence in
    `artifacts/smoke.log`: `SOCDOF_SMOKE invoice_mail ... bytes=1150`,
    `SOCDOF_SMOKE invoice_dunning ... level=first fee_cents=250 days=7 claim_cents=21670`,
    `SOCDOF_SMOKE export_eml kind=dunning ... bytes=807`, `export_eml kind=invoice ... bytes=1150`,
    `SOCDOF_SMOKE record_payment ... method=transfer`, then `SOCDOF_SMOKE_OK`; the runner ends with
    `NATIVE_SMOKE_OK chosen=0 cancel=0`.
  - New regression test `dunning_mail_and_payment_close_the_webview_gap` covers the three levels,
    fee/deadline overrides, interest/claim arithmetic, the EML headers, the `mailto:` URL, the stored
    payment, the `paid` status and the rejection of unknown level/method names.
  - Verification after the change: `cargo test --workspace --no-fail-fast` (all suites green, 1
    ignored), `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` in `crates/app` — all exit 0.
    The native smoke ran with `SMOKE_EXIT=0`.
  - Still open: see section 18.4 (webview breadth, installer/bundling, real GPU, native dialogs with a
    real user choice, tray click without a status-notifier host, contact e-mail draft, and the
    explicitly out-of-scope product areas).
- 2026-11-11 (twentieth pass) — the contact e-mail draft and the FatturaPA 1.2 generation are in Rust,
  with UI, command bridge, four languages, tests and native smoke. Both were listed as missing or out
  of scope in section 18 before this pass.
  - `ContactEmailDraftModal` ported from `lib/emlGenerator.ts`: `contact_display_name`,
    `contact_subject`, `contact_body`, `contact_eml_file_name`, `contact_eml` and
    `contact_eml_with` in `crates/core/src/domain/mail.rs`; `ContactMailView`, `DesktopState::contact_mail`
    and `DesktopState::contact_eml`; commands `contact_mail_draft` and `export_contact_eml`. The
    contacts tab has an `E-Mail` action per card, opens the editable recipient/subject/body dialog and
    writes the RFC 822 draft through the native save dialog.
  - `FatturaPaInspectorModal` ported from `lib/fatturaPaGenerator.ts` into
    `crates/core/src/domain/fattura.rs`: standard `IT<VAT>_<PROGRESSIVE>.xml` name, FPR12/FPA12
    selection, TD01/TD04/TD24, RF01/RF19, recipient code and PEC, two-euro stamp duty, CUP/CIG,
    per-rate `DatiRiepilogo`, payment code from the recorded payment (MP01/MP05/MP08), company and
    customer addresses, XML escaping and the five required-section checks. `invoice_fattura` and
    `export_invoice_fattura` expose it; the invoice card opens the inspector with live XML and a save
    button.
  - i18n: 25 new keys in de/en/fr/es, 308 keys per pack, identical key sets.
  - Smoke through `invoke`, in `artifacts/smoke.log`:
    `SOCDOF_SMOKE contact_mail ... bytes=556`,
    `SOCDOF_SMOKE export_contact_eml ... bytes=556`,
    `SOCDOF_SMOKE fattura file=IT00000000000_60012.xml valid=true lines=1 bytes=2935`,
    `SOCDOF_SMOKE export_fattura ... bytes=2935`; the runner ends with
    `NATIVE_SMOKE_OK chosen=0 cancel=0` and `SMOKE_EXIT=0`.
  - Tests: `contact_mail_and_fattura_are_generated` (app, real store), three `domain::fattura` tests
    and the contact payload assertions in `domain::mail`.
  - Verification after the change: `cargo test --workspace --no-fail-fast`,
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` in `crates/app` — all exit 0.
  - Still open: Fleet, Projects and Restaurant (implementable, next batch), installer/bundling, real
    GPU, native dialogs with a real user choice, tray click without a status-notifier host, and SdI
    transmission/signature (needs an accredited channel and credentials).
- 2026-11-11 (twenty-first pass) — the TypeScript `FleetModule` is ported 1:1: vehicles, logbook trips
  and fuel receipts, with the same fields, validation, 0.30 €/km allowance, metrics and logbook CSV.
  - Core: `crates/core/src/domain/fleet.rs` (`FleetVehicle`, `FleetTrip`, `FleetFuel`, normalisation,
    validation, `distance`, `allowance_cents`, `price_per_unit`, `metrics`, BOM/`;` CSV, file name);
    `crates/core/src/store/fleet.rs` with CRUD and an odometer update inside the trip transaction;
    schema v13 tables `fleet_vehicles`, `fleet_trips`, `fleet_fuel`.
  - App: `crates/app/src/fleet_bridge.rs` (camelCase views and inputs), `DesktopState` methods, eight
    commands `fleet_overview`, `save_fleet_vehicle|trip|fuel`, `delete_fleet_vehicle|trip|fuel`,
    `export_fleet_csv`; webview tab with KPI strip, three lists, search/vehicle/purpose/date filters,
    all three dialogs and CSV export; 76 keys per pack in de/en/fr/es (385 per pack, identical sets).
  - Evidence: `SOCDOF_SMOKE fleet_vehicle_saved mode=created ... odometer=12000`, `... mode=updated
    ... odometer=12345 status=maintenance`, `fleet_trip_saved ... km=30 cost_cents=900`,
    `fleet_fuel_saved ... total_cents=8000 price_milli=2000`, `fleet_list vehicles=1 trips=1 fuel=1
    total_km=30 active=0`, `export_fleet_csv ... rows=1 bytes=260`, `fleet_trip_deleted`,
    `fleet_fuel_deleted`, `fleet_vehicle_deleted`, then `fleet_list vehicles=0 trips=0 fuel=0` and
    `SOCDOF_SMOKE_OK schema_version=13`; runner `NATIVE_SMOKE_OK chosen=0 cancel=0`.
  - Tests: `crates/app/tests/fleet.rs` (`fleet_roundtrip_persists_and_calculates`,
    `fleet_rejects_invalid_vehicle_trip_and_fuel`) and core tests
    `computes_distance_price_metrics_and_csv`,
    `validates_the_modal_fields_and_normalizes_the_plate`.
  - Verification after the change: `cargo test --workspace --no-fail-fast` (green),
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` — all exit 0.
  - Still open: Projects and Restaurant (implementable, owner priority needed), installer/bundling,
    real GPU, native dialogs with a real user choice, tray click without a status-notifier host, SdI
    transmission/signature.
- 2026-11-11 (twenty-second pass) — the TypeScript `ProjectsModule` is ported 1:1: portfolio, Kanban
  board, projects and tasks with the same fields, filters, status transitions, KPI arithmetic,
  billing and CSV export.
  - Core: `crates/core/src/domain/project.rs` (`Project`, `ProjectTask`, normalisation, validation,
    `default_code`, `metrics`, `billable_cents`, BOM/`;` portfolio CSV, file name);
    `crates/core/src/store/projects.rs` with CRUD, task status moves and cascade delete; schema v14
    tables `projects`, `project_tasks`.
  - App: `crates/app/src/project_bridge.rs` (camelCase views/inputs, per-project progress and revenue),
    `DesktopState` methods and nine commands `project_overview`, `save_project`, `delete_project`,
    `save_project_task`, `set_project_task_status`, `delete_project_task`, `export_projects_csv`,
    `project_persistence`, `create_project_invoice`; webview tab with KPI strip, portfolio cards,
    four-column Kanban, search/status/category filters, project/task dialogs, CSV export and billing;
    75 keys per pack in de/en/fr/es (460 per pack, identical sets).
  - Evidence: `SOCDOF_SMOKE project_saved mode=created ... code=SMK-PRJ-2026 status=active
    budget_cents=500000`, `... mode=updated ... status=review budget_cents=600000`,
    `project_task_saved mode=created ... logged_milli=2500`, `... mode=updated ... logged_milli=3000`,
    `project_task_status ... status=review`, `project_list projects=1 tasks=1 logged_milli=3000
    revenue_cents=28500`, `project_persisted ... present=true tasks=1`, `export_projects_csv ...
    rows=1 bytes=277`, `project_invoice ... items=1 total_cents=33915`, `project_task_deleted`,
    `project_deleted`, then `project_list projects=0 tasks=0` and `SOCDOF_SMOKE_OK
    schema_version=14`; runner `NATIVE_SMOKE_OK chosen=0 cancel=0`.
  - Tests: `crates/app/tests/projects.rs` (`projects_roundtrip_persist_bill_and_export`,
    `projects_reject_invalid_modal_fields`) and core tests `computes_portfolio_metrics_and_csv`,
    `validates_the_modal_fields_and_normalizes_the_code`.
  - Verification after the change: `cargo test --workspace --no-fail-fast` (green),
    `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check`,
    `cargo check -p socdof-ui --features dialogs` and `npm run build` — all exit 0.
  - Still open: Restaurant (implementable, owner priority needed), installer/bundling, real GPU,
    native dialogs with a real user choice, tray click without a status-notifier host, SdI
    transmission/signature.



- 2026-11-11 (twenty-third pass) — the TypeScript `RestaurantModule` is ported 1:1: menu, 13-table
  floor plan, table orders, KDS, receipt archive, cash/card/NFC checkout, tip, split, GoBD
  hospitality receipt, Z-report, ERP invoice/POS checkout and receipt CSV.
  - Core: `crates/core/src/domain/restaurant.rs` (`MenuItem`, `TableOrderItem`, `TableOrder`,
    `RestaurantTable`, normalisation, validation, cent/basis-point totals, 13 tables, 11 default
    dishes); `crates/core/src/store/restaurant.rs` with menu/order CRUD and the transactional
    paid-order + POS + invoice checkout; schema v15 tables `restaurant_menu_items`,
    `restaurant_orders`, `restaurant_order_items` and the seeded default menu.
  - App: `crates/app/src/restaurant_bridge.rs` (camelCase views/inputs, KPI/Z values, receipt CSV),
    twelve commands (`restaurant_overview`, `save_restaurant_menu_item`,
    `delete_restaurant_menu_item`, `add_restaurant_item`, `set_restaurant_order_item_qty`,
    `set_restaurant_order_item_notes`, `set_restaurant_order_server`,
    `set_restaurant_order_status`, `delete_restaurant_order`, `restaurant_checkout`,
    `export_restaurant_csv`, `restaurant_persistence`); webview tab with four sub-tabs, table plan,
    picker, order receipt, menu CRUD, billing dialog, Z-report and archive; 125 keys per pack in
    de/en/fr/es (585 at that time; 601 after the external-asset, sound, receipt-link, company-header and hospitality-fallback pass, identical sets).
  - Tests: `restaurant_roundtrip_persists_calculates_and_checks_out`,
    `restaurant_rejects_invalid_dish_order_and_checkout_values`,
    `restaurant_receipt_number_considers_kept_pos_receipts`,
    `validates_the_dish_and_order_fields`, `adds_merges_and_recalculates_table_orders`.
  - Smoke evidence in `artifacts/smoke.log`: `database_status schema_version=15`,
    `restaurant_dish_saved mode=created` and `mode=updated`, `restaurant_order_saved mode=created`,
    `restaurant_order_updated` (quantity, note, server), `restaurant_order_status ... status=preparing`,
    `restaurant_list menu=12 orders=1 open=1 kitchen=1`, `restaurant_persisted ... status=preparing`,
    `restaurant_checkout ... total_cents=2982 tip_cents=200 method=cash split=2`,
    `restaurant_persisted ... status=paid receipt=GASTRO/2026/1000`,
    `export_restaurant_csv rows=1`, `restaurant_order_deleted`, `restaurant_dish_deleted`, then
    `restaurant_list menu=11 orders=0 open=0 kitchen=0`; the runner ends with
    `NATIVE_SMOKE_OK chosen=0 cancel=0`.
  - Verification after the last change: `cargo test --workspace --no-fail-fast` (exit 0),
    `cargo clippy --workspace --all-targets -- -D warnings` (exit 0),
    `cargo fmt --all -- --check` (exit 0), `cargo check -p socdof-ui --features dialogs` (exit 0)
    and `npm run build` in `crates/app` (exit 0); release build and native smoke exit 0.
  - Still open: only environment-bound items listed in 18.4; the next locally implementable work is
    the webview parity list and installer/bundling pass named there, with no restaurant blocker.

- 2026-11-11 (twenty-fourth pass) — the remaining locally implementable points from the last report
  were decided against the TypeScript source and closed: external template/language/flag folders,
  native confirmation dialogs, the tray icon's left-click mapping and the restaurant's Web Audio
  feedback. `SOCDOF - TS/electron/main.cjs` has no `Tray` or `Notification` constructor, so there is
  no separate Electron notifier to port; the only relevant notification path is the renderer's
  `sounds` module, whose restaurant methods are now in `crates/app/ui/src/sound.ts`.
  - External assets: `crates/app/src/external_assets.rs` resolves `SOCDOF_TEMPLATES_DIR`/
    `SOCDOF_LANGUAGES_DIR`/`SOCDOF_FLAGS_DIR`, then a portable folder next to the executable, then
    the app-data folder; seeds READMEs; lists/reads templates; parses flat or nested language JSON;
    saves packs after validation; lists flags as data URLs. Commands
    `list_external_templates`, `read_external_template`, `list_external_languages`,
    `list_available_flags`, `save_external_language`, `external_folder_path` and
    `open_external_folder` are registered. The Templates tab has a three-column manager and applies
    external de/en/fr/es packs through `setExternalPack` before re-rendering the static labels.
    Tests: `external_folders_seed_list_and_read_templates`,
    `external_languages_parse_flat_and_nested_packs_with_flags`,
    `external_assets_validate_open_folder_and_path_overrides`. Smoke: `external_templates count=1`,
    `external_languages count=1`, `external_flags count=1`,
    `external_template_read filename=smoke-template.html success=true bytes=22`.
  - Native confirmations: `DialogOutcome::Confirmed`/`Declined` and `resolve_confirm`;
    `confirm_message` uses `MessageDialogButtons::YesNo` and `blocking_show`; the webview delete
    actions and restaurant storno/dish/receipt actions await it instead of `window.confirm`. Test
    `a_confirmation_returns_yes_no_or_cancelled`; smoke phase 1
    `SOCDOF_DIALOG kind=confirm outcome=confirmed`, phase 2 `outcome=cancelled`.
  - Tray left click: `create_tray` now registers `on_tray_icon_event` and sends a completed left
    click through `tray::icon_click()` to `run_tray_command`; test
    `a_left_click_on_the_icon_uses_the_show_command`. Linux status notifiers still cannot emit the
    event in Xvfb, which remains the environment limit named in 18.4.
  - Receipt header: `restaurant_bridge::RestaurantCompanyView` now carries the active
    `CompanyProfile` name, street, postal code/city and tax id; `desktop::restaurant_overview`
    loads the profile and the webview prints it instead of a fixed restaurant name. The
    `company_view_uses_configured_profile_and_defaults` unit test covers both the default fallback
    and a configured profile.
  - Hospitality fallbacks: an empty host now prints the active company name, an empty occasion
    prints the translated business-meeting default and empty guests print the translated guest
    default, matching the TypeScript receipt instead of three dashes.
  - Restaurant feedback: `crates/app/ui/src/sound.ts` ports the TypeScript click, success, kaching
    and notification Web Audio graphs with the same muted/volume localStorage keys; add-dish,
    quantity, kitchen status, billing and check-out call them, and a restaurant sound toggle exposes
    the state because the Rust shell has no settings sound page. The two new labels bring all four
    packs to 597 keys with identical sets; the receipt deep-link brings them to 598, the tax-id label to 599, and the two hospitality fallbacks to 601.
  - Verification after the last change: `cargo test --workspace --no-fail-fast` (exit 0),
    `cargo clippy --workspace --all-targets -- -D warnings` (exit 0),
    `cargo fmt --all -- --check` (exit 0), `cargo check -p socdof-ui --features dialogs` (exit 0),
    `npm run build` in `crates/app` (exit 0), release build (exit 0), native smoke
    `NATIVE_SMOKE_OK chosen=0 cancel=0` (exit 0); restaurant smoke ends with the empty state,
    `export_restaurant_csv rows=1 bytes=232` and schema 15.
  - Still open: only the environment-bound list in 18.4. The locally implementable breadth and
    installer work is scheduled in 18.5.


- 2026-11-13 (functional parity inventory and Projects KPI audit) — captured the complete
  TypeScript/JavaScript source baseline in `docs/rust-functional-parity-inventory.md`: 126 source
  files across app screens, shell, auth, documents, therapy, shared libraries, types and entry
  points. The Rust tree currently contains 183 Rust source/test files; file counts are inventory
  metadata only and are not counted as parity evidence. The README links the inventory.
  - First focused comparison: `SOCDOF - TS/src/components/support/ProjectsModule.tsx` against
    `crates/ui/src/projects.rs`, `crates/app/src/project_bridge.rs`,
    `crates/core/src/domain/project.rs`, `crates/core/src/store/projects.rs` and
    `crates/app/tests/projects.rs`.
  - Found and corrected a KPI edge-case mismatch: the TypeScript metrics loop counts tasks only
    through the listed projects, while Rust previously used `tasks.len()` for the denominator.
    Rust now counts only tasks attached to the supplied project set; a regression test covers an
    unrelated/orphan task so completion percentage and totals cannot drift.
  - Verification is now running in GitHub Actions on pull requests and migration-branch pushes.
    The first run exposed workspace rustfmt drift and one pre-existing Clippy range-loop warning in
    `crates/core/src/pdf/din5008.rs`; the Clippy issue is fixed and a one-time rustfmt pass is being
    prepared. No full test-suite success is claimed until the complete jobs finish.


- 2026-11-13 (Fleet side-by-side audit, first pass) — compared the complete TypeScript
  `FleetModule.tsx` save, edit, delete, filtering, analytics and CSV paths with the native
  `crates/ui/src/fleet.rs`, `crates/core/src/domain/fleet.rs`, the SQLite store, desktop bridge
  and integration tests.
  - Confirmed that the native analytics receives filtered trips while fuel costs and active
    vehicle counts remain global, matching the TypeScript `useMemo` behavior.
  - Confirmed that editing a trip does not retroactively change the vehicle odometer and deleting
    a vehicle keeps historical trip and fuel records. Added an integration assertion for the
    latter behavior.
  - Confirmed that the native CSV writer includes the UTF-8 BOM and the same semicolon columns;
    Rust additionally escapes embedded quotes safely.
  - The audit is still partial: keyboard/form edge cases, all translation labels, invoice handoff
    and native dialog behavior need further comparison. The Fleet module is not declared complete.


- 2026-11-13 (Restaurant tax rounding audit) — compared the TypeScript order calculations in
  `RestaurantModule.tsx` with `TableOrder::recalculate`. The legacy UI first groups net line
  amounts by tax rate (7% and 19%), then calculates VAT for each group. Rust previously rounded
  every line's VAT separately and summed those rounded values, which can differ by one cent for
  small or numerous positions. The Rust calculation now groups by basis-point rate before applying
  the shared half-up money rounding. Added a regression case with two 0.07 EUR lines at 7%:
  TypeScript-compatible order totals are 0.14 EUR net, 0.01 EUR VAT and 0.15 EUR gross. Restaurant
  parity remains under review for receipt rendering, checkout persistence side effects, and the
  complete kitchen/order state workflow.


- 2026-11-13 (restaurant invoice VAT persistence) — the grouped-tax correction revealed a second
  parity requirement: the legacy POS checkout stores its calculated order tax total on the invoice,
  while the Rust invoice model previously recalculated tax per line. Added optional
  `tax_total_override_cents` to the invoice domain and schema migration v16. Restaurant checkout
  now sets the override from the paid order; invoice reads, totals and PDF/template views use that
  persisted amount, while ordinary invoices continue to calculate VAT from their own lines.
  The integration test checks two 0.07 EUR / 7% items produce 0.14 EUR net, 0.01 EUR VAT and
  0.15 EUR gross both before and after reopening the SQLite database.


- 2026-11-13 (POS ledger VAT parity) — extended the same persisted tax override to
  `PosOrder`, not only the restaurant order and ERP invoice. Schema migration v17 adds the
  nullable override to `pos_orders`; normal counter sales keep line-based tax calculation, while
  restaurant checkouts carry their grouped VAT into the POS ledger and Z-report summaries.
  The restaurant checkout/reopen integration test now verifies the POS summary retains the same
  one-cent VAT and 15-cent gross total.
