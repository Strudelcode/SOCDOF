# SOCDOF — Rust Rewrite Migration Plan

> Living document. Tick items as they are completed, update the status block, and append notes at the
> bottom of the phase you are working on. Keep this file the single source of truth for the rewrite.

| | |
|---|---|
| **Branch** | `feature/rust-native-desktop-host` |
| **Started** | 2026-11-07 |
| **State** | 2026-11-15, the native egui host uses the real SQLite store and login/setup flow; CI run 1235 has been triaged and corrective changes are committed for re-verification. First-run language/theme/accent choices are persisted to the created account and per-account appearance is restored after sign-in. The Tauri webview remains the packaged default until the native shell and installer are verified. Visual acceptance is closed; all ten screenshot pairs pass in §15.7. |
| **Current phase** | Phase 11 — **application foundation first**. Prioritize login/account lifecycle, settings persistence, desktop shell/navigation, visual consistency, startup behavior and a reliable Windows installer before resuming remaining app-level parity work. |
| **Overall progress** | Core persistence, authentication, settings modules and 19 permission modules exist. The native host is still a transition build: packaged installer, native shell polish, account-preference restoration, OS integration and final visual acceptance remain to be verified. App-level parity work is paused until the foundation is stable. |
| **Versioning** | Rust workspace, Tauri app and UI manifests are aligned at **`26.0.0`**; the TypeScript reference stays `25.2.1`. The v26 changelog body is prepared; the tag is not cut. See §2.1. |
| **Legacy app** | Unchanged in `SOCDOF - TS` (TypeScript + React + Electron) |
| **Goal** | Same product, Rust core + Rust UI, ~10× smaller installer, ~3× less RAM |
| **Browser build** | `crates/web` — the same egui UI as WebAssembly (Trunk), with real SQLite, real login and real user management; see section 14 |

---


## 1.1 Reprioritized delivery order — application foundation first

The next implementation passes intentionally stop adding small app-specific features until the native application feels like a complete desktop product. Work in this order:

1. **Startup and authentication:** first-run setup, login, account switching, lock/unlock, sign-out, session expiry and useful recovery/error states.
2. **Account and settings persistence:** per-account language/theme/accent/startup preferences, company profile, users/roles, backups and settings that survive a full restart.
3. **Desktop shell:** app launcher, navigation, taskbar/window controls, focus/z-order, keyboard shortcuts, notifications, wallpaper and desktop state restoration.
4. **Visual system:** compare the real startup/login/desktop/settings screens with the legacy app in both themes and all four languages; fix layout, spacing, typography, icons and responsive behavior before polishing individual apps.
5. **Windows distribution:** an initial per-user NSIS installer script is now wired into the desktop CI artifact job. It offers an install-directory choice, creates Start Menu/Desktop shortcuts and uninstall registration, and deliberately preserves the database in the Windows application-data folder. Still required: confirm the installer builds on the Windows runner, install/upgrade/launch/uninstall it on a clean Windows machine, and verify data preservation. Keep the Tauri package as a transition fallback until the native package passes these checks; do not label the native host as the production installer before then.
6. **Resume app parity:** continue the remaining app workflows only after the above gates are demonstrably working.

A feature is not considered complete merely because its screen exists: it must be exercised through the real desktop startup path, persist across restart where appropriate, and be covered by an automated test or a documented manual acceptance check.

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
- [x] desktop folders (`FolderSet` in `desktop.rs`, `DesktopLayout.folders`): folder tiles with the
      reference mini preview (1, 2, 3–4 apps and the `+n` counter), the folder modal with launch,
      remove, rename and dissolve, the desktop and folder context menus, drag onto a folder and
      icon-on-icon merge; evidence `rust-31`…`rust-33`
- [x] folder modal file/storage tab and the full desktop background menu (widgets, sticky note, task
      view, upload, arrange, snap, app store, settings, fullscreen), with `DesktopLayout.storage_location`
      and `DesktopLayout.assets`; evidence `rust-34`, `rust-35`
- [x] sound section (`SettingsTab::Audio`, `Preferences.sound_enabled`/`sound_volume_percent`):
      mute toggle, master volume slider with percent pill, 0/100 % ends, quick presets and the
      immediate-save behaviour of the reference; evidence `rust-41`
- [x] virtual desktops and the full task view (`TaskView` in `shell.rs`, `Window::desktop`,
      `WindowManager::windows_on`/`focus_on`/`move_to_desktop`, `DesktopLayout.virtual_desktops` and
      `active_desktop_id`, `DesktopWindowLayout.desktop_id`, `Ctrl+Alt+←/→`, `Ctrl+Shift+D`);
      evidence `rust-37`…`rust-40`
- **Not possible in egui 0.27 (limitation, recorded):** backdrop blur of the taskbar glass — a panel paints straight into the
      window framebuffer and epaint has no render-to-texture or post-process pass, so nothing can blur
      what is behind the bar. The honest alternative is the current 84 % translucent surface; a real
      blur would need a custom wgpu callback with an offscreen pass and is out of scope here.

### 15.7 Tauri webview visual parity (final evidence, all ten pairs pass)

The feature surfaces and the visual pass are implemented. The final evidence set was captured on
**2026-11-20** from the release binary under Xvfb at 1440×900, German, empty database, through real
navigation and the app's own theme toggle. `docs/parity/` holds the ten TS/Rust pairs;
`parity_diff.py` uses the window crop `(100,15,1240,765)` and writes `diff.json`/`diff.csv`.

**Target:** window pixel score ≥98.00 and window SSIM ≥0.90 for every pair; only native window
chrome may remain different.

| View | Theme | Window pixel | Window SSIM | State |
|---|---|---:|---:|---|
| Dashboard | light | 98.87 | 0.9491 | pass |
| Dashboard | dark | 98.41 | 0.9286 | pass |
| Invoices | light | 98.89 | 0.9174 | pass |
| Invoices | dark | 98.58 | 0.9101 | pass |
| Contacts | light | 98.90 | 0.9131 | pass |
| Contacts | dark | 98.54 | 0.9002 | pass |
| Settings | light | 98.84 | 0.9139 | pass |
| Settings | dark | 98.44 | 0.9025 | pass |
| Command Palette | light | 98.23 | 0.9298 | pass |
| Command Palette | dark | 98.76 | 0.9253 | pass |

**What changed in this pass**

- Command palette: real Lucide SVGs replace the Unicode glyphs, the module list carries
  `POS Kasse` and `Kalender` as rows 8–9, panel geometry is 670×583 at y80 with a 55 px search
  header and 56.5 px row pitch, the selected tile stays `#9810fa` with a white glyph, and dark
  selection is `#4f46e5`.
- Dark Spotlight veil: measured against the reference as slate-900 at **20 %** over a near-black
  navy desktop (`rgb(3 8 29)`), replacing the previous 60 % veil. Desktop tiles use the measured
  48 px grid, 105/107 px pitch and soft blur; the taskbar navigation handler was restored after
  the upstream sync.
- Invoices: dark CTA is `#4f39f6`, toolbar CTA geometry matches the TS 158×32 button, and the
  empty-state action sits 4 px lower (16 px gap), which moved both Invoice pairs over the gate.
- Contacts: the primary CTA matches the reference (`New Contact`, user-plus icon, `#4f46e5`),
  the dark badge is indigo instead of the pale accent, secondary buttons use `#1e293b`, and the
  CTA is 1 px higher.
- Settings layout (this pass, measured against the TS captures rather than adjusted by eye): the
  sidebar card starts at y=177 and is clipped by the settings surface at y=739; every group label,
  nav row and icon sits on the TS pixel rows (label margin 22 px top / 9 px bottom, 32 px nav rows,
  12 px icon inset); the hero keeps its 152 px box (150 px fill) in both themes with the copy block
  20 px higher, the kicker 13 px above the title, a 36 px `Profil anpassen` CTA ending at x=1183 and
  the badge row at y=294; the quick panel starts at y=360 with headers at 389/409 and cards at
  439/553/639; the search field is 256 px wide ending at x=1207; the quick heading uses 14 px with
  0.0075 em tracking and a 14 px sparkles icon; `de.json` renders `100% Offline & Kostenlos`, as in
  the reference. Dark search field stays `#314158`.
- Taskbar navigation, `showView` and palette labels now open Settings, Invoices, Contacts and the
  palette through real clicks; no screenshot relies on JS overrides.

**Quantified residual (after the structural deltas above were removed)**

1. **Settings glyph rasterisation:** with every measured box, row, inset and font metric matching,
   the remaining error is concentrated on glyph edges. Over the window crop the light pair has MAE
   2.96 with 5.38 % of pixels above Δ8 and 2.96 % above Δ24; dark has MAE 3.99 with 9.36 % / 4.03 %.
   A σ=1 Gaussian blur lifts window SSIM from 0.9139 to 0.9624 (light) and from 0.9025 to 0.9502
   (dark), i.e. about half of the residual is antialiasing texture. This is the documented residual;
   the earlier 0.85 score was layout, and is gone.
2. **Native chrome:** window controls are native Tauri/WebKit buttons instead of page-drawn buttons.
   This is the only accepted difference.

**Gates on the final tree (2026-11-20):** `cargo fmt --all -- --check`, clippy with `-D warnings`,
`cargo test --workspace`, `npm run build`, the Tauri `cargo check --all-targets` and the real Xvfb
GUI smoke (`SOCDOF_SMOKE_OK`, schema 19, both chosen and cancelled dialog phases exit 0) all pass.

**Definition of done:** all ten pairs at ≥98.00 window score and ≥0.90 window SSIM; only the native
window decoration differs; `diff.csv` is reproducible; docs quote those values; and all gates are
green. All ten pairs meet both targets, so §15.7 is closed.

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
| ProductsModule, ProductLabelModal, SmartReorderModal, StockMovesModule, TableModule | **partial** | Native egui `products.rs` covers product CRUD, stock in/out, QR labels and reorder planning; the Tauri/webview bridge covers label and reorder actions. The legacy `StockMovesModule` is a separate double-entry journal with source/destination locations, references, filters and CSV/print export; those journal workflows are not yet available in the native Rust host and remain open. |
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

- **Contacts module (2026-11-13):** added native batch creation with atomic persistence, CSV and vCard import, a removable import preview with category assignment, and native CSV/vCard export through save dialogs. The Rust core includes RFC 4180-style quoted-field parsing, separator detection, common Outlook/Google/Apple/German headers, UTF-8 BOM CSV output, vCard 2.1/3.0/4.0 parsing, grouped properties, folded-line handling, URI telephone normalization, truncated final-card recovery and UTF-8-safe 75-octet vCard export folding. Regression tests cover duplicate/blank rows, malformed quoted tails, 5,000-row CSV input, vCard variants and round trips. Remaining: quoted-printable/charset support, multiple EMAIL/TEL property scanning, cancellation/unreadable-file platform checks and exact TypeScript output parity. DE/EN/FR/ES labels are registered in the catalogue inventory.
- **Native macOS host build:** temporarily gated in the desktop matrix. The current egui 0.27/winit 0.29 stack resolves `objc2 0.4.1`, which fails to compile with the current Rust toolchain. Linux and Windows native builds remain enabled; a framework/dependency upgrade is still required before macOS native parity can be claimed.
- **Accounting and tax-advisor ledger (2026-11-13):** the native Accounting screen loads a core aggregate across sent/paid/overdue invoices, non-draft purchases and completed POS receipts. It presents BWA revenue/cost/result, 7% and 19% VAT bases, output/input VAT and liability, open receivables and POS Z-report tender totals. Today and inclusive custom date ranges are supported. The tax-advisor ledger now exports twelve monthly Excel-compatible sheets with formulas and DE/EN/FR/ES labels plus a selected-month CSV, with selectable years, separate cash/bank totals, sequential carry-over, editable persisted opening balances and transaction sources from practice billing items, paid invoice payments, POS receipts, non-draft purchases and manual journal entries. Linked invoices are suppressed when billing items already represent them. Remaining: therapy practice trips with their per-trip rates, formula/layout and exact byte parity against the legacy workbook, local-timezone boundaries and full cross-platform CI; see `docs/accounting-rust-parity.md`.
- **Native Rust desktop host (first integration pass, 2026-11-13):** `cargo run -p socdof-ui --features window --bin socdof-ui-desktop` now starts the egui shell with the persistent SQLite database, the shared `network_session.lock`, saved language/theme/accent and real setup/login. `GalleryState::from_store` deliberately skips all sample records and demo credentials; `GalleryState::new` remains the isolated fixture path for visual tests. Lock/sign-out/account-switch actions return to the authentication screen. The Tauri webview and its installer are retained until native parity and OS integrations are proven.
- The remaining TypeScript components in the egui/webview split: TaskViewModal/Appointments, SupportServicesModule, TherapyPracticeModule, StudioDrawer/AccountScopedWorkspace and the DocumentationApp/StorageInspector screens. Restaurant now has a native functional screen; its TS reference remains for side-by-side parity checks until acceptance.
- Closed in the backoffice pass: Accounting, Purchases, Reports, Restore/Verify and AppStore are
  now real Tauri webview modules; the earlier Settings profile/backup, Textwerk and Calendar
  screens remain in place. The Xvfb smoke now drives the real navigation to accounting, purchases,
  reports and settings, creates and lists one row per transactional module, toggles an AppStore
  switch and verifies/restores a native archive.
- Closed in the dashboard/display pass: the Dashboard tab renders live KPIs, recent invoices and
  the reorder list; Settings exposes language, theme and accent colour.
- **Closed — Tauri webview visual parity (§15.7):** the final set reaches 98.87/0.9491,
  98.41/0.9286, 98.89/0.9174, 98.58/0.9101, 98.90/0.9131, 98.54/0.9002, 98.84/0.9139,
  98.44/0.9025, 98.23/0.9298 and 98.76/0.9253 (window pixel / SSIM). All ten pairs pass both
  targets; the residual is quantified glyph antialiasing.
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
- [x] **Visual-parity gate (§15.7):** all ten pairs reach window ≥98 and SSIM ≥0.90. Settings is
  98.84/0.9139 (light) and 98.44/0.9025 (dark); the hero box is 152 px in both themes and the
  remaining distance to 1.0 is quantified glyph antialiasing (σ=1 blur: 0.9624/0.9502).
- [x] **Evidence refresh:** all ten pairs recaptured with real navigation and the real theme toggle;
  `WINDOW_BOX` is `(100,15,1240,765)`; `diff.json`/`diff.csv` regenerated.
- [x] **Documentation:** final values are in `docs/parity/README.md`, §15.7 and `CHANGELOG.md`.
- [x] **Parity coverage of all apps:** the reference app was run headlessly (Vite + Playwright
  Chromium) and its optional modules were installed for capture. Six screens remain unreachable —
  Fleet/Projects are missing from `ActiveModule` and `shortcutMeta` and are never imported,
  Restaurant is filtered out of `installedModules`, Support crashes the renderer, Therapy never
  leaves its skeleton state, and the launcher window renders empty — so they are backed by a
  DOM/markup audit (`view.<id>.dom` markers in the GUI smoke plus the reference TSX). That audit
  exposed missing page headings in Fleet and Projects (added) and drove the launcher rebuild against
  `AppLauncher.tsx`. See `docs/parity/README.md`, "Coverage per app".
- [x] **App launcher and view audit:** the taskbar grid opens `view-appstore`, a searchable grid of
  all 20 modules, so Fleet, Projects, Restaurant, Support, Therapy, Textwerk, Templates, Reports and
  Users are reachable although their rail tabs are hidden. Fixed a real `showView` alias bug where
  `products` and `stock` shared one element and the later alias hid the Products screen. The GUI
  smoke now navigates every view (`view.audit.done views=20`) and fails on empty content, missing
  controls or an error banner. The launcher is a shell addition without a TS reference capture and
  is therefore outside the ten scored pairs.
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

- 2026-11-14 (native desktop interaction pass) — added keyboard-first window management to the egui shell: Ctrl+Tab cycles visible windows while skipping minimized windows, Ctrl+W requests the normal close-confirmation flow, Ctrl+Left/Ctrl+Right snaps the active window to either half of the work area, and F11 toggles maximize/restore. The window manager exposes a tested focus-cycle operation and refuses to change focus while a modal close/reopen confirmation is active. README desktop claims were corrected to describe the current SQLite data path and to mark multi-monitor support as unfinished rather than implemented. Regression tests cover wrap-around, minimized-window skipping and modal focus trapping. CI format initially caught one rustfmt line-wrap difference; corrected in the follow-up commit. The real module-content-in-window refactor remains open: module screens still use context-level panels and are not yet embedded in independent desktop windows.


## 2026-11-15 — CI stabilization and work-time record

- Investigated workflow run 1235 on PR #22, commit `044d23fe52e4cb581be807179585aa596f44b370`, using the full logs for Format, Windows tests and Linux GUI smoke.
- Corrected the four rustfmt differences without changing application behavior.
- Fixed the Windows-only visual golden comparison by normalizing CRLF checkout files to LF before strict comparison; added a regression test rather than weakening or regenerating the goldens.
- Changed the idle CPU measurement window from five to thirty seconds to reduce phase sensitivity to periodic idle wake-ups. The 0.5% CPU and 120 MiB RSS limits remain unchanged.
- Updated `docs/rust-ci-knowledge-base.md` with the observed symptoms, causes, fixes and pending verification for all three failures.
- **Verification state:** changes are committed to the PR branch; a new full CI run must pass before the foundation is called stable.
- **Effort estimate:** approximately 0.6 hours of hands-on investigation, implementation and documentation. CI queue/runtime is excluded. This is an estimate, not a stopwatch measurement; future entries use the same convention.


## 2026-11-15 — Native Windows installer safety and smoke coverage

- The native NSIS installer and uninstaller now check whether `socdof-ui-desktop.exe` is running and ask the user to close it before proceeding. They no longer force-kill the application, avoiding loss of unsaved form state during upgrades or uninstall.
- Added a Windows CI installer smoke that installs silently into a custom path containing spaces, checks the executable, shortcuts and uninstall registration, runs the installed executable's `--help` entry point, simulates an existing autostart preference across an upgrade, then uninstalls and verifies that the AppData marker survives.
- **Verification state:** implementation is committed for the next Windows Actions run; no installer runtime pass is claimed until the smoke step succeeds.
- **Effort estimate:** approximately 0.5 hours for installer safety, test automation and workflow integration; CI runtime is excluded.


## 2026-11-15 — CI trigger de-duplication

- The migration branch already has a `push` trigger, so a commit push and the corresponding pull-request `synchronize` event were starting identical cross-platform matrices twice.
- Kept pull-request validation for opening, reopening and marking the PR ready; commit updates are validated by the branch push trigger. This prevents duplicate full CI runs without removing a validation path.
- **Effort estimate:** approximately 0.1 hours; workflow review and documentation. CI queue time is excluded.


- Installer smoke cleanup was hardened: a failed assertion now runs the fallback uninstaller before removing its temporary install directory, and the passing path asserts that uninstall removed the install directory.
- **Additional effort estimate:** approximately 0.1 hours for test cleanup and post-uninstall verification.


## 2026-11-15 — Publisher metadata alignment

- Set the native NSIS installer and Tauri bundle publisher metadata to the repository's required identity, **Yuri / Strudel** (organization: **Strudelcode**).
- Kept code signing separate from publisher metadata. The current environment has no Authenticode certificate or signing secrets, so Windows artifacts remain unsigned; this is documented as a release prerequisite rather than generating an untrusted self-signed CI certificate.
- **Effort estimate:** approximately 0.1 hours for metadata alignment and release documentation.


## 2026-11-15 — Native host idle repaint optimization

- The 30-second GUI-smoke sample still measured 0.67% CPU (RSS remained within budget), proving the earlier short-window hypothesis was insufficient.
- Reduced idle redraws on static login/setup/locked screens from every 10 seconds to every 15 seconds. A lockout countdown keeps one-second updates; the active desktop retains its existing ten-second repaint. This preserves the 30-second lock stale timeout and does not change the CPU budget.
- **Verification:** run 1246 measured 0.27% idle CPU and 119,912 KiB RSS, both within the unchanged budgets.
- **Effort estimate:** approximately 0.2 hours for measurement analysis, targeted UI scheduling change and CI documentation.


## 2026-11-15 — Native dialog CI smoke repair

- Reproduced the GUI-smoke timeout from the uploaded `socdof-gui-smoke` artifact. The dialog log proved that folder selection, file selection and save-path validation worked; execution stopped because the smoke path opened a real message box and the workflow combined chosen and cancelled expectations in one process.
- Updated smoke-mode message handling so it never blocks on a human dialog, completed the chosen/validation flow with explicit confirmation, and added a separate process for folder/open/save cancellation and cancelled confirmation.
- Updated the CI knowledge base with the failure evidence and fix.
- **Partial verification:** run 1246 completed the chosen folder/open/save-validation, message acknowledgement and confirmation paths. It then exposed an invalid test assumption that a fresh profile must contain an external template; the cancellation process is still pending.
- **Effort estimate:** approximately 0.4 hours for artifact inspection, root-cause analysis, smoke-flow repair and documentation.


## 2026-11-15 — Workflow YAML correction

- Corrected the indentation of the newly added dialog-smoke artifact paths after GitHub rejected the workflow before creating any jobs.
- **Effort estimate:** approximately 0.1 hours; YAML diagnosis, correction and CI knowledge-base entry.


## 2026-11-15 — NSIS installer/uninstaller helper correction

- Fixed the Windows native installer compile error by registering and using the separate StrFunc uninstaller helper in `un.onInit`.
- **Verification state:** the Windows NSIS compile must pass in the next run before installer smoke is considered testable.
- **Effort estimate:** approximately 0.1 hours for log diagnosis and the NSIS helper correction.


- Added a five-minute step timeout and a five-second forced cleanup grace to both native-dialog smoke processes so a future modal regression cannot leave the Linux GUI job waiting indefinitely.
- **Additional effort estimate:** approximately 0.05 hours for smoke-process timeout hardening.


## 2026-11-15 — NSIS process-check portability correction

- Replaced the optional StrFunc uninstaller helper with the Windows-native `tasklist.exe | findstr.exe` process check because the NSIS 3.13 package on the CI runner does not include the expected `UnStrFunc` macro.
- Installer and uninstaller still refuse to proceed while SOCDOF is running; they never force-kill the process.
- **Verification state:** next Windows build must compile the NSIS script and run the full install/upgrade/uninstall smoke.
- **Effort estimate:** approximately 0.2 hours for compiler-log diagnosis and replacing the unavailable helper.


## 2026-11-15 — First-run external-template empty state

- The GUI smoke reached the expected first-run state with zero user-imported external templates. The UI already supports this empty state; only the smoke assertion was wrong.
- Updated the smoke to validate a template when one exists while accepting a genuinely empty first-run folder.
- **Verification state:** committed; next GUI-smoke run must complete both the chosen and cancellation processes.
- **Effort estimate:** approximately 0.2 hours for artifact inspection, first-run behavior analysis, test correction and documentation.


## 2026-11-15 — Tray quit smoke ordering

- Run 1249 passed formatting, WASM, Linux/Windows tests and all three desktop build jobs. The only remaining failure was the GUI-smoke tray assertion: show-window and backup were dispatched, but quit was intentionally skipped because the frontend still had FatturaPA and back-office checks to execute.
- Moved the smoke-only quit dispatch to the successful end of `finish_smoke`, after report validation and persistence. It uses the exact same `run_tray_command` / `TrayCommand::Quit` handler as the platform tray menu. This preserves the complete UI smoke and ensures the process exits through the tested quit action.
- Added the tray log to the uploaded diagnostic artifact.
- **Verification state:** code and documentation committed; next full CI run must pass the complete GUI smoke, including tray quit, before the foundation is considered CI-green.
- **Effort estimate:** approximately 0.2 hours for log diagnosis, command-flow correction and documentation. CI runtime is excluded.


## 2026-11-15 — First-run administrator and login regression tests

- Audited the native egui host startup path: it opens the four-step first-run setup when the database has no users and routes subsequent launches through login. The first-admin insert is transactionally restricted to an empty users table.
- Added regression tests against the real in-memory SQLite store and `AuthState`: first administrator creation and password hashing, successful initial session, login on the next start, stale setup race rejection, persistent failed-login lockout and successful login after expiry.
- **Verification state:** committed; Linux and Windows workspace test jobs must pass before treating this coverage as verified.
- **Effort estimate:** approximately 0.3 hours for startup/auth path inspection, test implementation and documentation. CI runtime is excluded.


## 2026-11-15 — Native desktop window startup verification

- Strengthened the native egui desktop smoke: the idle-resource test now waits for an actual visible `SOCDOF` window, checks its title and verifies the 760×560 minimum window geometry before taking resource measurements.
- This closes the gap where a process could remain alive without successfully presenting the native desktop shell. The Xvfb smoke retains the window marker and startup log as artifacts.
- **Verification state:** committed; pending the next Linux GUI-smoke run.
- **Effort estimate:** approximately 0.2 hours for workflow hardening and documentation. CI runtime is excluded.


## 2026-11-15 — GUI smoke X11 dependency correction

- Run 1250 passed all cross-platform tests, desktop builds, Windows native installer smoke, Linux package staging and resource budgets. The GUI smoke passed Tauri startup, splash handshake, native dialogs and the complete tray menu including the corrected quit action.
- The shortcut-dispatch step then timed out while searching for the X11 window. Its application log independently showed that the main window was visible; the smoke environment had not explicitly installed the `xdotool` binary required to enumerate and focus it.
- Added `xdotool` to the GUI-smoke packages and an immediate executable/version check so missing tooling can no longer masquerade as a failed application launch.
- **Verification state:** committed; pending the next GUI-smoke run.
- **Effort estimate:** approximately 0.1 hours for log correlation, dependency correction and CI documentation. CI runtime is excluded.


## 2026-11-15 — Authentication test lint correction

- Run 1254 caught two formatting-only differences and one Clippy `useless_conversion` warning in the newly added auth-flow regression tests.
- Applied rustfmt's exact wrapping/blank-line changes and removed the redundant conversion from the `i64` retry counter. No application logic or test coverage was weakened.
- **Verification state:** committed; next full CI run must pass Format, Clippy and both platform test jobs.
- **Effort estimate:** approximately 0.1 hours for CI log diagnosis, lint correction and documentation. CI runtime is excluded.



## 2026-11-15 — Authentication lockout test interaction correction

- Run 1256 exposed that the new lockout regression test entered the invalid password once and then attempted multiple submissions without re-entering it. The real authentication form clears the password after each attempt, so the test only generated one failed credential check.
- Updated the test to re-enter the wrong password before every submission. The lockout remains enforced by the persistent SQLite store; no production authentication behavior was changed.
- **Verification state:** committed; pending the next Linux and Windows test run.
- **Effort estimate:** approximately 0.1 hours for cross-platform log analysis, test correction and documentation. CI runtime is excluded.

## 2026-11-15 — Keyboard shortcut smoke uses focused X11 input

- Run 1256 passed the desktop builds, native packaging, WASM build and formatting, but the GUI smoke did not observe its F11 shortcut marker.
- The smoke used `xdotool key --window`, which bypasses the normal focused-window input route. It now activates/focuses the SOCDOF window and sends F11/F12 through ordinary X11 keyboard input.
- **Verification state:** committed; pending a fresh GUI-smoke run.
- **Effort estimate:** approximately 0.2 hours for workflow-log diagnosis, input-path correction and documentation. CI runtime is excluded.



## 2026-11-15 — Lockout persistence across restart regression

- Strengthened the authentication regression test to recreate `AuthState` after lockout and verify that a correct password is still rejected before the stored deadline. The same fresh state then signs in successfully after expiry.
- This verifies the SQLite persistence boundary rather than only the in-memory form state.
- **Verification state:** committed; pending cross-platform CI.
- **Effort estimate:** approximately 0.1 hours for test hardening and documentation. CI runtime is excluded.



## 2026-11-15 — Native desktop global keyboard shortcuts

- Added shell-level keyboard handling to the native egui host for F11 fullscreen, Ctrl+K command palette, Ctrl+L session lock and Escape overlay dismissal.
- The shortcuts are consumed centrally, so individual app views do not need duplicate handlers. Locking returns to the existing authentication screen and clears open module windows without revoking the session.
- Updated the parity inventory to distinguish implemented in-app shortcuts from the still-open OS tray/startup integration.
- **Verification state:** committed; cross-platform compile and test CI is required because the local environment has no Rust toolchain.
- **Effort estimate:** approximately 0.4 hours for shell event-path review, implementation and documentation. CI runtime is excluded.



## 2026-11-15 — Global shortcut rustdoc placement correction

- The first build after adding native shell shortcuts found that the helper had been inserted between the existing public gallery documentation and its function. This caused missing-doc errors across Linux, Windows, and WASM, plus a Clippy empty-doc-line warning.
- Moved the helper documentation to its function and restored the public gallery API documentation directly above the function.
- **Verification state:** committed; next full CI run required.
- **Effort estimate:** approximately 0.1 hours for cross-platform CI diagnosis, source correction and documentation. CI runtime is excluded.



## 2026-11-15 — Native shortcut behavior tests

- Added direct headless egui tests for command-palette opening, lock-session behavior and preserved session identity, Escape dismissal and authentication-screen shortcut gating.
- The tests call the same private handler used by the real native desktop frame, rather than validating only a separate chord resolver.
- **Verification state:** committed; full CI run pending.
- **Effort estimate:** approximately 0.3 hours for state-flow review, headless test implementation and documentation. CI runtime is excluded.



## 2026-11-15 — Native multi-window rendering for Projects, Fleet and Restaurant

- Extracted the three module screens' existing render bodies from their full-work-area CentralPanel wrappers into reusable child-window renderers. The original public screen functions now remain compatibility wrappers, preserving their layout and interaction path.
- Added the renderers to the native desktop dispatcher, with per-window active state and isolated `back` handling.
- Expanded the native multi-window headless regression to open Accounting, POS, Therapy, Users, Projects, Fleet and Restaurant concurrently and verify the module titles are painted.
- Updated the parity inventory to identify the next still-missing module-window adapters instead of marking all desktop windows complete.
- **Verification state:** committed; workspace Clippy, Linux/Windows tests, native builds and GUI smoke pending.
- **Effort estimate:** approximately 1.2 hours for source extraction, dispatcher integration, regression coverage and documentation. CI runtime is excluded.



## 2026-11-15 — Complete registered launcher module window dispatch

- Added reusable child-window renderers for Products, Purchases, Calendar/Appointments, Editor, App Store, Support, Reports and Dashboard, preserving each original full-work-area renderer as a compatibility wrapper.
- Connected all eight modules to the native WindowManager dispatcher with isolated module state and active-window Back/Escape routing.
- The desktop dispatcher now renders all 18 registered launcher modules. The expanded headless regression opens fifteen concurrent modules and verifies translated titles and retained WindowManager entries.
- Updated the parity inventory to state precisely what is now implemented and what remains unaccepted.
- **Verification state:** committed; full cross-platform CI pending.
- **Effort estimate:** approximately 2.0 hours for eight render adapters, dispatcher integration, regression expansion and documentation. CI runtime is excluded.



## 2026-11-15 — Active child-window keyboard isolation

- Added a headless regression that opens Projects and Fleet together, focuses Fleet, sends Escape and verifies only the active Fleet window closes while Projects remains open.
- This protects module drafts/navigation from key events intended for a different child window.
- **Verification state:** committed; current-head CI pending.
- **Effort estimate:** approximately 0.2 hours for focus-path test and documentation. CI runtime is excluded.



## 2026-11-15 — Explicit Xvfb modifier release for shortcut smoke

- Run 1260 passed Linux/Windows tests, Linux/Windows/macOS desktop builds, formatting and WASM, but the GUI shortcut smoke saw `Alt+F11` instead of plain F11.
- Artifact inspection of `keys-ready.log` and `keys-locked.log` confirmed the resolver correctly rejected the modified chord. The problem was synthetic X11 modifier state, not the application's shortcut resolver.
- The workflow now releases Alt, Super, Ctrl and Shift before and after each key sequence, then sends F11/F12 through the focused window.
- **Verification state:** committed; next full CI run pending.
- **Effort estimate:** approximately 0.3 hours for artifact download, event-marker diagnosis, workflow correction and documentation. CI runtime is excluded.


## 2026-11-17 — Installable Rust desktop distribution foundation

- Established one shared data contract for the native Rust host and the Tauri transition host: stable per-user database location, explicit database/data-directory overrides, environment override, and lock-protected migration of the former Tauri profile including SQLite WAL/SHM files.
- Defined seven install/deployment profiles covering native Windows/Linux, Tauri transition installers/portable variants including universal macOS, and the WASM web build. Added a version consistency gate so Cargo, Tauri and frontend releases cannot silently diverge.
- Added per-platform native package paths: Windows per-user NSIS installer, Linux portable archive with per-user install/uninstall scripts, and a Tauri universal macOS DMG; the native egui macOS host is deferred because winit/glutin currently fails to compile its objc2 0.4.1 dependency on the macOS runner. Portable Windows and Linux builds keep isolated colocated data by default; installed builds use the standard per-user profile.
- Added Linux install/uninstall smoke coverage proving the executable and desktop entry are removed while the user's database remains. Existing Windows installer smoke continues to verify custom install paths, shortcuts, upgrade preferences and data preservation. macOS packaging verifies both CPU architectures and the DMG container.
- The native Rust host now shows a splash immediately and loads/migrates its database in the background, with a visible retry path if startup fails.
- **Verification state:** implementation committed on PR #22; the latest full CI runs are queued behind an older long-running run. The new cross-platform build, package smoke and startup changes are not yet certified green.
- **Still open before calling distribution production-ready:** native Windows code signing, native Rust self-update, native Windows signing, and any requested Linux .deb/AppImage packaging. Native macOS remains blocked on the upstream objc2 0.4.1 dependency; the Tauri universal DMG is the installable macOS target for now. Tauri signed-updater packages remain the transition fallback.


## 2026-11-26 — First-run and sign-in parity pass (native Rust UI)

- Walked the native first-run flow and the sign-in screens against the committed TypeScript
  references in `docs/artifacts/gui-parity/` and `SOCDOF - TS/src/components/auth/AuthGate.tsx`:
  language card, account step, appearance, apps, finish, login and password recovery.
- Account step now matches `validateAccountStep`: the password strength row (five-point scoring,
  five colours, tips line), the inline confirmation mismatch and the avatar remove action. The
  recovery question is one select with the eight catalogue questions, a custom question and the
  explicit "no question" choice, followed by one required answer.
- The wizard header carries the step chip on the left (`setup_step_*`) and keeps the constant
  `auth.accountSetup · auth.stepAccount` line under the title, like the TypeScript markup.
- Appearance and apps: "Skip" jumps to the finish step, back returns to the account step, and the
  finish step names the skipped block and can re-enable it. Personal accounts hide invoices,
  accounting, purchases, POS and support (`SETUP_BUSINESS_ONLY_MODULES`) and only offer the
  personal and practice templates. A chosen wallpaper can be removed again; the wizard keeps its
  own `wallpaper_picked` flag because the host consumes the choice on the next frame.
- Recovery stores the questions next to their hashed answers (`SecurityAnswers::questions`,
  `save_security_question`, `questions_of`, `verify_any_answer`). The recovery form asks one answer
  that is checked against every configured question; accounts written before the questions were
  stored fall back to the two classic prompts.
- New catalogue keys `setup_recovery_q1`…`q8`, `setup_recovery_custom`, `setup_recovery_none`,
  `setup_recovery_question_required`, `setup_recovery_answer_required`, `setup_remove_image`,
  `setup_skip_extras`, `setup_skip_notice`, `setup_enable_extras`, `setup_password_tips` and
  `setup_strength_very_weak`/`very_strong` in all four languages; `catalogue-keys.json`
  regenerated (2,265 keys). `auth_recovery_subtitle` now matches `auth.newPasswordTitle`.
- **Verification state:** uncommitted; `cargo fmt -p socdof-ui -- --check`, `cargo clippy -p
  socdof-ui --all-targets -- -D warnings`, `cargo test -p socdof-ui` (402 lib, 8 forms, 10
  keyboard, 17 phone, 2 visual goldens, 10 wizard) and `cargo test -p socdof-core
  security_questions` are green. Evidence images `rust-11`…`rust-20` in
  `docs/artifacts/gui-parity/`.


## 2026-11-26 — Sign-in, lock screen and desktop hand-off parity pass

- Compared the native sign-in, signing-in, lock and desktop hand-off screens with the TypeScript
  `AuthGate` (`LoginScreen`, `AuthLoadingScreen`, `LockScreen`) and the committed reference
  `docs/artifacts/gui-parity/ts-04-lock-screen.png`, then closed the differences below.
- **Backdrop:** the legacy sign-in and lock screens always use the dark backdrop, whatever
  appearance the desktop uses. `auth::screen_theme` now forces the dark palette for `Login` and
  `Locked`; the wizard and the forms keep the chosen appearance.
- **Sign-in form:** an explicit "other user" mode (heading, description and username field) instead
  of silently preselecting the first account, the bottom account strip at every width (centred on a
  phone), a fixed-height message slot, and the lockout countdown in seconds with a disabled field
  and submit arrow (`PasswordField::enabled`).
- **Loading state:** the TypeScript form awaits the store call and paints `AuthLoadingScreen`.
  `AuthState::begin_sign_in` / `tick_sign_in` keep that screen (avatar, "sign in" label, animated
  dots) visible for `SIGN_IN_LOADING_MS` before the synchronous login runs; missing credentials
  still fail immediately as a form error.
- **Close confirmation:** the close button of the sign-in screen now asks
  "Möchtest du die App wirklich schließen?" instead of quitting on the first click.
- **Lock screen:** rebuilt as the legacy full screen – clock and date, avatar, display name,
  "Arbeitsplatz gesperrt", one glass password field with the arrow submit, the account strip with
  the current account highlighted and a "Benutzer wechseln" tile that signs out, plus minimise,
  fullscreen and language in the top-right corner. The old card with branding, `@username`, unlock
  and sign-out buttons, recovery link and hints is gone.
- **Desktop hand-off:** unchanged and verified against the host: the gallery closes the auth overlay
  as soon as `AuthView::Unlocked` with a user is reached, so the desktop paints directly; the
  "signed in" card is only a preview scene.
- New catalogue keys `auth_locked_title`, `auth_retry`, `auth_other_user`, `auth_other_user_desc`,
  `auth_switch_user`, `desktop_quit_confirm_title`, `desktop_quit_confirm_no` and
  `desktop_quit_confirm_yes` in all four languages; `catalogue-keys.json` regenerated (2,288 keys).
- **Verification state:** uncommitted; `cargo fmt -p socdof-ui -- --check` and `cargo clippy -p
  socdof-ui --all-targets -- -D warnings` are green, as are `cargo test -p socdof-ui` (405 lib
  including the phone sweep, 8 forms, 10 keyboard, 17 phone, 2 visual, 12 wizard) and the 360 px
  preview renders of the sign-in and lock screens. Evidence images `rust-21`…`rust-27` in
  `docs/artifacts/gui-parity/`.
- **Still open:** the Electron window controls map to viewport commands and depend on the host
  window manager.

## 2026-11-26 — Sign-in parity closure: passwordless, auto login, quick switch and clock preferences

- Closed the four gaps the previous pass reported, against the TypeScript implementation rather than
  screenshots: `quickSwitchUser` and `tryAutoLoginSingleUser` in `SOCDOF - TS/src/lib/auth.ts`,
  `createUser` (passwordless flag), `formatSystemTime` / `formatSystemDate` in
  `SOCDOF - TS/src/lib/i18n.ts`, the settings UI in `SettingsModule.tsx:4275–4326` and the sign-in
  and lock clocks in `AuthGate.tsx:2029/2443`.
- **Company clock preferences:** `CompanyProfile` now stores `date_format`, `time_show_seconds` and
  `timezone` with the reference defaults (`DD.MM.YYYY`, tri-state seconds, `Europe/Berlin`), the
  settings profile tab edits all three, and `catalogue` keys document them in four languages.
  `socdof_core::date` converts the seven zones the reference offers (European last-Sunday rule, US
  second-Sunday/first-Sunday rule) without a new dependency and formats `format_time`,
  `format_time_24h` and `format_date_style`. `desktop::ClockSettings` feeds the sign-in clock
  (`time_show_seconds === true`), the lock screen and the taskbar (`!== false`), so the two screens
  keep the reference asymmetry.
- **Passwordless accounts:** `User` carries the reference `passwordless` flag (schema v20, serde
  default for older data), a regular account created without a password becomes passwordless with
  a random stored hash, and `Store::quick_switch` signs such an account in directly while inactive,
  password-protected and locked accounts stay rejected. The login screen shows one
  "{name} fortfahren" button and no password field; the lock screen unlocks a passwordless session
  the same way.
- **Automatic single-user login and quick switch:** `auth_security` persists
  `auto_login_single_user` and `allow_quick_user_switch` with the reference defaults (off/on,
  matching `SecuritySettings`). `AuthState::new` signs in automatically when the switch is on and
  exactly one active account exists. The lock-screen strip switches a passwordless account
  immediately, while the login strip only selects it and the "{name} fortfahren" button signs in,
  like `chooseUser` / `quickSwitchUser`. The security tab edits both switches and
  disables the auto login while more than one account exists, like `updateSecuritySettings`.
- **Profile pictures:** the login and lock strips, and both header avatars, decode the stored
  `avatar:<id>` data URL through `settings_service::decode_data_url_rgba`; initials remain only the
  fallback for accounts without a picture. Decoded images are cached per account in `AuthState`,
  and the picture chosen during setup is stored for the first administrator.
- **Verification:** `cargo test -p socdof-core --lib` (396 tests, including the new quick-switch,
  auto-login and security-settings tests), `cargo test -p socdof-ui` (405 lib plus forms, keyboard,
  phone, visual, wizard and the new `auth_parity` suite), `cargo fmt -p socdof-ui -p socdof-core --
  --check` and `cargo clippy -p socdof-ui --all-targets -- -D warnings` are green. The desktop
  goldens were regenerated for the configured `Europe/Berlin` taskbar clock and date. The new tests render the
  login and lock screen at 900 px and 360 px, assert the configured clock/date, the passwordless
  continue button, both strip avatars and the auto-login state.
- **Evidence:** `rust-28-auth-parity-login-{light,dark}-{900,360}.png`,
  `rust-29-auth-parity-locked-{light,dark}-{900,360}.png` and
  `rust-30-auth-parity-quick-switch-{light,dark}-{900,360}.png` in `docs/artifacts/gui-parity/`
  show the selected `MM/DD/YYYY` / New York clock with seconds, the stored profile pictures and the
  quick-switch continue button.

## 2026-11-26 — Desktop folders (native Rust shell)

- Ported the reference desktop folders (`DesktopWindowWorkspace.tsx` folder model and drag and drop,
  `DesktopFolderModal.tsx`) instead of leaving the desktop as a flat icon grid.
- **Model:** `desktop::DesktopFolder` and `desktop::FolderSet` keep the folders, the open folder, the
  rename buffer and the two context menus as plain data, so every operation is tested without a
  display. `create`, `rename`, `add_app`, `remove_app`, `dissolve`, `free_cell`, `positions` and
  `restore` mirror the reference handlers: an app belongs to one folder, an emptied folder dissolves,
  and a dissolved folder returns its apps to the desktop. Folder names are trimmed and bounded, the
  identifier follows the reference `folder-<n>` scheme, and `known_app` drops slugs the catalogue no
  longer knows instead of substituting another app.
- **Persistence:** the folders live in the account's `DesktopLayout` (`folders`), next to the
  icon cells and the window geometry, so they travel with the backup. `save_desktop_layout`
  normalizes them (unique ids, valid names, deduplicated app slugs, 32 folders, cells inside the
  saved grid) and loads older layouts without the field as an empty set.
- **Desktop:** apps inside a folder lose their own tile, folder tiles sit on free grid cells
  (`free_cell` skips the cells of the folders still on the desktop), and the tile shows the reference
  preview: folder glyph when empty, one icon, two icons side by side, a 2 × 2 grid for three or four,
  and three icons plus a `+n` counter. Dropping an icon onto a folder files it there; dropping it onto
  another icon merges both into a new folder named like `desktop_folder_default_name`; right-click on
  the wallpaper opens the desktop menu with `+ Neuer Ordner`, right-click on a tile opens the folder
  menu (open, rename, dissolve), and Escape or a click next to a menu closes it.
- **Folder modal:** dimmed backdrop, folder heading with inline rename (field, save and cancel), the
  app grid with a launch on click and a remove control on the icon corner, the app count, an empty
  state, and the footer with "Ordner auflösen" and "Schließen". The reference file/storage tab has no
  native counterpart yet and stays open work, as do the widget, task view, upload and arrange entries
  of the background menu.
- Twelve new catalogue keys in de/en/fr/es (`desktop_new_folder`, `desktop_folder_*`),
  `catalogue-keys.json` regenerated (2,312 keys).
- **Verification:** `cargo test -p socdof-core --lib settings_service` (11 tests incl. the new folder
  round trip and normalization), `cargo test -p socdof-ui` (lib, forms, keyboard, phone, visual,
  wizard and auth parity suites green) and the five new `desktop::tests` cases for grouping,
  renaming, dissolving, persisted slugs and free cells.
- **Evidence:** `rust-31-desktop-folders-{light,dark}.png`, `rust-32-desktop-folder-open-{light,dark}.png`
  and `rust-33-desktop-folders-compact-{light,dark}.png` in `docs/artifacts/gui-parity/`, rendered
  from the real screens by `socdof-ui-preview desktop-folder` (scenes `desktop-folders`,
  `desktop-folder-open`, `desktop-folders-compact`).

## 2026-11-27 — Desktop files tab and the full background menu (native Rust shell)

- Ported the two parts the folder section left open: the file/storage tab of the folder modal
  (`DesktopFolderModal.tsx`, `StorageAssetPreviewModal.tsx`, `storageAssets.ts`) and every entry of
  the desktop background menu (`DesktopWindowWorkspace.tsx`).
- **Files tab:** `desktop::DesktopStorage` holds the filed assets, the upload location and the file
  shown in the details pane; `desktop::StorageAsset` and `desktop::AssetCategory` follow
  `determineAssetCategory` and `formatFileSize` from the reference. The modal has the reference tab
  row (two equal pills with count badges, hard-drive glyph on the file tab), the dashed upload card,
  the storage location with the platform folder picker, the file list with category glyph, name and
  `size • date`, the row actions details, download and delete in reference order, the empty state and
  the `{count} Datei(en) im Ordner` footer. Selecting a row opens the details with the name, size and
  category, the storage location and origin, the date, the folder link selector
  (`Mit Desktop-Ordner verknüpfen`, every folder with its app count) and download, delete and close.
- **Background menu:** every entry of the reference menu in its order and with its separators —
  widgets, new sticky note, task view, new folder, upload, arrange icons left, snap to grid, app
  store, settings and fullscreen with the `F11` badge. Widgets opens the widgets window, the sticky
  note pins a note on the desktop (`WidgetLayer::pin_sticky_note`), task view opens the task view,
  upload asks the host for the platform file picker, arrange re-fills the left columns and moves the
  folder tiles behind them, snap returns freely placed icons and tiles to their nearest cell, and
  fullscreen toggles the window mode.
- **Persistence:** `DesktopLayout` gains `storage_location` and `assets`, normalized by
  `save_desktop_layout` (200 assets, bounded names and locations, known category slugs, unique ids)
  and read by older layouts as an empty storage. The gallery restores the storage on unlock and
  saves it after every change, next to the folders and the icon cells.
- **Deliberate differences (recorded):** the reference stores a `dataUrl` copy of every upload in the
  browser storage; the native shell keeps the source path instead, because a base64 copy of up to
  15 MB per file would bloat the account settings. The file details sit in a pane of the folder modal
  instead of the second `StorageAssetPreviewModal`, because egui would stack two modals on a phone
  viewport. The upload runs through the platform dialog behind the `dialogs` feature and is a no-op
  in builds without it, like the other native pickers. The category glyphs use the icons the egui set
  has, so image, code and archive files share the palette, pen and database glyphs of the palette.
- 39 new catalogue keys in de/en/fr/es (`desktop_menu_*`, `folder_tab_*`, `folder_files_*`,
  `storage_category_*`), `catalogue-keys.json` regenerated (2,351 keys).
- **Verification:** `cargo fmt --check`, `cargo clippy --all-targets -D warnings` and `cargo test` for
  `socdof-core` and `socdof-ui`, including the new core tests for the storage round trip and the
  legacy layouts plus eight new `desktop::tests` cases (categories, slugs, sizes, storage, persisted
  assets, arrange and snap).
- **Evidence:** `rust-34-desktop-folder-files-{light,dark}.png`,
  `rust-35-desktop-menu-{light,dark}.png` and
  `rust-36-desktop-folder-files-compact-{light,dark}.png`, rendered with
  `socdof-ui-preview desktop-folder` and `desktop-menu` (scenes `desktop-folder-files`,
  `desktop-folder-files-compact`, `desktop-menu`) and checked in both appearances: the modal is
  centred and fully visible, the file rows truncate long names instead of running into the size
  line, and the upload hint wraps inside its dashed card on the phone viewport.

## 2026-11-27 — Virtual desktops and the full task view

Reference: `SOCDOF - TS/src/components/support/TaskViewModal.tsx` and the virtual desktop state,
handlers and shortcuts in `SOCDOF - TS/src/components/shell/DesktopWindowWorkspace.tsx`
(`virtualDesktops`, `activeDesktopId`, `handleSelectDesktop`, `handleAddDesktop`,
`handleRemoveDesktop`, `handleRenameDesktop`, `handleMoveWindowToDesktop`, the global key handler).
The shell only had an open flag and a small "open windows" list, so the menu entry from the previous
step opened nothing that resembled the reference.

**Model (`crates/ui/src/shell.rs`)**

- `shell::VirtualDesktop` mirrors the reference type: `id` (`desktop-<n>`) and the strip name, plus
  `short_name()` for the `D1`/`D2` move buttons.
- `shell::TaskView` now owns the whole state: `desktops`, the active desktop id, the inline rename
  (`begin_rename`, `rename_buffer_mut`, `commit_rename`, `cancel_rename`, `take_rename_focus`) and
  the open flag. `TaskView::new()` seeds `Desktop 1`/`Desktop 2` with `desktop-1` active, exactly
  like the reference defaults, and `restore()` adopts a saved strip and repairs a stale active id.
- `add()` appends `Desktop <count + 1>` (the reference numbers by the current count, not by the
  highest id), makes it active and closes the overview; a blank or missing name never overwrites an
  existing one; `remove()` keeps at least one card and falls back to the first remaining desktop.
- `step(forward)` implements the wrap-around of `Ctrl+Alt+Arrow`.

**Windows on desktops (`crates/ui/src/desktop.rs`)**

- `Window::desktop` (`on_desktop`, `set_desktop`, `is_on`): a window without a filing, or filed on
  `all`, appears on every desktop, like the reference `!w.desktopId || w.desktopId === 'all'`.
- `WindowManager` keeps the current desktop, stamps new windows with it (`open`) and gains
  `windows_on(desktop)` (z-order, minimized included), `focus_on(desktop)` (topmost unminimized
  window of that desktop, `None` clears the focus) and `move_to_desktop(app, desktop)`.
- The desktop paints only windows of the active desktop. Opening an app that lives on another
  desktop brings the window over instead of focusing something invisible (see deviations).

**Task view overlay**

The panel follows the reference structure: full-screen `slate-950` veil, a top bar
(`bg-slate-900/60`, bottom hairline) with the layers glyph, the uppercase `Virtuelle Desktops`
label and the close button (`Task-Ansicht schließen (Esc)`), a horizontally scrollable strip of
170 px desktop cards, the dashed 150×135 add card, and the window grid in 4/3/2/1 columns.

- Desktop card: 80 px mini preview with the monitor glyph, the `N Fenster` count, the emerald
  active dot with its dark ring, the 2 px indigo border and 30 % indigo fill when active, the
  hover-only rose delete button (only while more than one desktop exists) and the hover pencil with
  the inline editor (centered semibold input, `Enter` commits, `Escape` cancels, focus loss
  commits like the reference `onBlur`).
- Window card: initial badge, truncated title that turns indigo on hover, the close cross, the
  skeleton thumbnail with the module name and the amber `Minimiert` badge, and the
  `Verschieben nach:` row with the `D1`/`D2`/… buttons, the current filing highlighted.
- Empty state: the 48 px monitor glyph and `Keine geöffneten Fenster auf diesem Desktop.`
- Behaviour: clicking a card closes the overview and focuses the window, clicking a desktop card
  switches and closes, `Escape` and the close button leave the overview, `Escape` inside the rename
  editor only drops the rename (`ShellState::dismiss_top_overlay`).

**Persistence (`crates/core/src/settings_service.rs`, `crates/ui/src/gallery.rs`)**

- `DesktopLayout.virtual_desktops` (`VirtualDesktopLayout { id, name }`) and `.active_desktop_id`,
  `DesktopWindowLayout.desktop_id`. `save_desktop_layout` drops blank and duplicate ids, bounds the
  names to 40 characters, caps the strip at 12 desktops, fills a blank name with `Desktop <n>`,
  repairs an unknown active id to the first card, seeds the two reference desktops for an empty
  list and clears a window filing whose desktop no longer exists (shared instead of invisible).
- The gallery restores the strip and the active desktop on unlock, refiles restored windows and
  saves strip, active id and window filings whenever `DesktopOutcome::task_view_changed` is set.

**Shortcuts:** `Ctrl+Alt+←/→` switch desktops (wrapping) and focus the new desktop's top window,
`Ctrl+Shift+D` adds a desktop, both also while the overview is closed, like the reference global
handler.

**Deliberate differences (recorded)**

- egui cannot blur what is behind an area (`backdrop-blur-md`), so the veil is 92 % opaque instead
  of 85 %: with no blur, the reference's 85 % let the desktop shine through far too strongly.
- The hover `scale-[1.02]` of a window card would move every neighbour in a manual grid; a soft
  indigo halo marks the hovered card instead.
- Clicking an app that is open on another desktop moves the window to the current desktop instead of
  opening a second instance. The native shell keeps one window per app, and focusing an invisible
  window would look like nothing happened.
- The desktop names are not translated (`Desktop 1`, …), matching the reference, which also
  hard-codes them; `N Fenster` uses the catalogue key `taskview_windows`.
- The header uses the four-square grid glyph for the reference `Layers` icon, which the bundled
  icon set does not have.

**i18n:** 14 new keys in de/en/fr/es (`taskview_*`), `catalogue-keys.json` regenerated (2,365 keys).

**Verification:** `cargo fmt -p socdof-ui -p socdof-core -- --check`, `cargo clippy -p socdof-ui
-p socdof-core --all-targets -- -D warnings` and `cargo test` for both crates, including the new
core tests for the desktop round trip and the legacy layout, four new `shell` tests (defaults,
add/remove/select, rename/step, restore and the `Escape` of the inline editor) and two new
`desktop::tests` cases (desktop filing and focus, refiling after a removal).

**Evidence:** `rust-37-task-view-{light,dark}.png`, `rust-38-task-view-empty-{light,dark}.png`,
`rust-39-task-view-compact-{light,dark}.png` and `rust-40-task-view-rename-{light,dark}.png`,
rendered with `socdof-ui-preview desktop-task-view` (scenes `desktop-task-view`,
`desktop-task-view-empty`, `desktop-task-view-compact`, `desktop-task-view-rename`) and checked in
both appearances: the strip and the grid stay inside the 1,280 px column, the compact viewport
scrolls the strip and falls back to one window column without clipping a card, the empty state is
centred, and the rename editor stays inside its desktop card.

## 2026-11-27 — Settings: Sound & Lautstärke

Reference: the `audio` section of `SOCDOF - TS/src/components/apps/SettingsModule.tsx` together with
`SOCDOF - TS/src/lib/sound.ts` (`muted`, `volume`, `setVolume`, `toggleMute`). The native settings had
no audio section at all; the inventory listed audio preferences as still open.

**Model (`crates/core/src/settings_service.rs`)**

- `Preferences.sound_enabled` and `Preferences.sound_volume_percent`; a fresh account follows the
  reference sound engine: muted, 80 % volume (`DEFAULT_SOUND_VOLUME_PERCENT`). `save_preferences`
  clamps the percent to `0..=100`, and a record written before these fields existed loads the same
  defaults.
- The settings draft (`AppearanceDraft`) carries both fields, so the section persists through the
  existing per-user `Preferences` write.

**Section (`crates/ui/src/settings.rs`)**

- New tab `SettingsTab::Audio` right after Personalization, with the `Speaker` icon, the
  `Sound & Lautstärke` label and the shared index (the numbered badge now counts
  `SettingsTab::ALL.len()` instead of a hard-coded eleven).
- Header: accent icon tile, `System-Audio & Soundeffekte` with the reference description and the
  reference mute button on the right (`Aktiviert` in the primary style, `Stummgeschaltet` in the
  secondary one); the button stacks below the text on the phone width.
- Volume card on the muted surface: accent icon that switches to `SpeakerOff` while muted or at 0 %,
  the `Gesamtlautstärke (Master Volume)` label with the percent pill (shows `0%` while muted, like
  the reference), the description and the disabled `Probehören` button.
- Slider row in reference order: `0%` button, themed slider (handle at zero while muted), `100%`
  button; the quick presets row (`Schnellwahl:`) with 15/35/60/85/100 %, the active preset within
  eight points highlighted, mirrored left-to-right on wide screens.
- Every change saves immediately (`save_appearance`), matching the reference, which writes the sound
  engine's storage on each interaction; there is no Save button in this section.

**Deliberate differences (recorded)**

- The workspace has no audio dependency and the native shell ships without an audio backend, so no
  tone can be synthesised: `Probehören` is rendered disabled with the hint
  `Der native Build hat kein Audio-Backend …` instead of pretending to play, and the reference sound
  catalogue (dozens of synthetic effects with their own preview buttons) is not reproduced — there is
  nothing to preview. The preference values and the UI behaviour are persisted either way.
- The reference gradient card becomes the muted surface with the accent icon tile, because the native
  settings cards keep one surface per theme.

**i18n:** 13 new keys in de/en/fr/es (`settings_tab_audio`, `settings_audio_*`),
`catalogue-keys.json` regenerated (2,377 keys; the unused `settings_audio_enable` key was dropped
again when the switch was removed).

**Verification:** `cargo fmt --check`, `cargo clippy -p socdof-ui -p socdof-core --all-targets
-- -D warnings` and `cargo test` for both crates, including the new core test for the sound
preferences (round trip, clamping, legacy record) and two new settings tests (draft round trip and
the tab index/label invariant for all fourteen tabs).

**Evidence:** `rust-41-settings-audio-{light,dark}.png`, rendered with
`socdof-ui-preview settings-audio` (scene `settings-audio`) and checked in both appearances: the
slider rail is visible against both surfaces, the handle sits at zero while muted, the percent pill
stays readable, and the section fits the 1,180 px settings column without clipping.

## 2026-11-27 — Purchases product link, FatturaPA inspector, report exports

Reference: `SOCDOF - TS/src/components/sales/PurchasesModule.tsx`,
`SOCDOF - TS/src/components/sales/FatturaPaInspectorModal.tsx`,
`SOCDOF - TS/src/lib/fatturaPaGenerator.ts`, `SOCDOF - TS/src/components/sales/InvoicesModule.tsx`
and the report period view of the legacy dashboard.

**Purchases (`crates/ui/src/purchases.rs`)**

- `PurchaseLineDraft.product` carries the stored `PurchaseOrderLine.product_id`; `from_line` keeps it
  and `to_line` writes it back. Before, every position built in the form stored `product_id: None`,
  so `PurchaseOrder::stock_moves` produced no movement and the goods receipt left the product stock
  unchanged — the screen looked complete while the booking path was dead.
- The form renders a product select above the description (`purchases_line_product_none` is the
  free-text choice). `PurchasesState::link_product` prefills description, net cost and tax rate from
  the catalogue product, and the popup state follows added and removed rows.
- Test `links_a_catalogue_product_to_a_position_and_books_its_stock` covers the link, the prefill,
  the stored `product_id` and the stock change through the receipt.

**Invoices — FatturaPA/SdI inspector (`crates/ui/src/{invoice_actions,invoices}.rs`)**

- New `InvoiceAction::Fattura` with the SdI document types TD01/TD04/TD24, recipient code
  (`Codice Destinatario`), PEC, stamp duty (Bollo), CUP and CIG. `open_fattura`, `fattura_options` and
  `fattura_document` wrap the existing core generator (`domain::fattura::{generate, validate,
  file_name}`), so the XML is never assembled in the UI.
- The dialog shows the SdI file name, the schema result (`validate`, green when clean, red with the
  findings), the XML in a collapsed preview and the target path; saving appends `.xml` when missing
  and reports the written path. The invoice detail gains the `XML / FatturaPA` action.
- The preview is a collapsed section on purpose: with an always-open preview the auto-sized dialog
  pushed the path field and the save button below its frame (seen in the first render, fixed before
  the evidence was captured).

**Reports — CSV and PDF export (`crates/core/src/store/reports.rs`, `crates/ui/src/reports.rs`)**

- `Report::to_csv` writes `number;contact;status;issued_at;net;tax;gross;minutes`, quotes fields that
  contain the separator and closes with a `summary` row. `Report::to_pdf` renders an A4 document with
  title, period, totals, the invoice table and a page break before the footer margin.
- The screen offers `CSV exportieren` and `PDF exportieren` through the system file dialog and keeps
  the picker fallback (`reports_error_picker`) for builds without the `dialogs` feature.

**Status protocol and cleanup**

- New `docs/feature-status.md` is the canonical per-module status (status, code paths, gaps, evidence,
  changelog). `AGENTS.md` §2 now points to it instead of keeping a second, stale matrix, and §6
  requires every AI to update `docs/feature-status.md`, this file and `docs/rust-parity-status.md`
  after each work block.
- The stale `NEXT_STEPS_AI.md` handover (old worktree paths, superseded by the status files) is
  removed.
- The status files now name the two missing modules explicitly: `ios_billing` (Schnellkasse,
  `IOSBillingModule.tsx`, ≈2,400 lines) and `table` (spreadsheet, `TableModule.tsx`).

**i18n:** 22 new keys in de/en/fr/es (`invoices_fattura_*`, `purchases_line_product_none`,
`reports_export_*`, `reports_error_*`); `catalogue-keys.json` regenerated (2,473 keys).

**Verification:** `cargo fmt -p socdof-ui -p socdof-core`, `cargo clippy --all-targets -- -D warnings`
for both crates, `cargo test -p socdof-core --lib` (408), the `purchases`, `invoices`, `reports` and
`i18n` filters of `socdof-ui`, the phone sweep (1,312 cases, 360/390/412/432 px × light/dark), the
visual goldens (regenerated for the eight `reports` scenes) and the new scene `invoices-fattura`.

**Evidence:** `rust-42-invoices-fattura-{light,dark}.png`, `rust-43-reports-export-{light,dark}.png`,
`rust-44-purchases-product-{light,dark}.png`, rendered with `socdof-ui-preview invoices-fattura`,
`... reports` and `... purchases-form` and inspected in both appearances.

---

## 16.26 Quick billing `ios_billing` (2026-11-27)

**Reference:** `SOCDOF - TS/src/components/sales/IOSBillingModule.tsx` (five tabs: checkout, inventory,
receipts, stats, settings; payment methods `cash`, `card`, `apple_pay`; dish options with groups,
surcharges and defaults; receipts without a cancellation path in the reference).

**Change**

- `crates/core/src/domain/quick_billing.rs`: `QuickDish` (category, gross price, tax rate, stock,
  enabled, emoji, SKU, option list), `DishOption` (group, name, surcharge, preselected),
  `PaymentMethod`, `ReceiptStatus`, `ReceiptLine` (gross/net/tax with half-up rounding on the
  contained tax), `QuickReceipt` (gross/net/tax split, item count, `storno`), `DaySummary`
  (`average`, `payment_total`), `summarize`, `dish_sales`, `option_sales`, `next_number`,
  `next_storno_number` and `tse_signature`. 8 unit tests.
- `crates/core/src/store/quick_billing.rs`: dishes and receipts, receipt positions stored as JSON so a
  later menu edit can never rewrite a paid receipt. `insert_receipt` writes the receipt and decrements
  the tracked stock in one transaction; `cancel_receipt` marks the original `cancelled`, writes a
  linked storno receipt with negated amounts and adds the stock back. Settings (register name, receipt
  footer) live under `quick_billing_settings`. 5 store tests.
- Schema **v21** adds `quick_dishes` and `quick_receipts` plus three indexes; existing databases
  migrate in place, no table is rewritten.
- `crates/ui/src/quick_billing.rs`: the five tabs, category chips and search, dish tiles, cart with
  quantity controls, option sheet (one option per group, kitchen note), payment sheet (cash with
  tendered/change, card, NFC), receipt detail with TSE signature and cancellation confirmation, dish
  form with option rows and delete confirmation, statistics from the stored receipts, and register
  settings. Dialogs clamp their width to the viewport, so the dish form fits the 360 px phone panel.
- Wiring: `AppModule::QuickBilling` (`ios_billing`) with `ALL_MODULES` 18 → 19, app-store entry
  (trial, reference start-up disabled like the legacy desktop, which filters `ios_billing` out of the
  installed list), chrome app tile, desktop icon, native window (open, restore, minimise, fullscreen),
  settings label, permission matrix. i18n: 134 keys in de/en/fr/es, `UI_KEYS` and
  `catalogue-keys.json` regenerated (2,607 keys). Preview scenes `quick-billing`,
  `quick-billing-receipts`, `quick-billing-stats`.

**Verification**

- `cargo fmt --all -- --check` clean (the command also formatted three pre-existing unformatted files
  in `crates/app` and `crates/web`; formatting only, no logic change).
- `cargo clippy -p socdof-core --all-targets -- -D warnings` and `-p socdof-ui` clean.
- `cargo test -p socdof-core --lib`: 420 passed, 0 failed (12 new).
- `cargo test -p socdof-ui --lib`: 455 passed, 0 failed (6 new), including the phone sweep with the
  new cases at 360/390/412/432 px in both appearances.
- `cargo test -p socdof-ui --test visual`: 2 passed. The App Store snapshot assertion now expects the
  19 registered modules instead of freezing a catalogue-dependent image.
- `cargo test -p socdof-app --test backoffice`: module count updated to 19.
- Sale flow proof (`two_payment_methods_and_a_storno_reach_sqlite_journal_and_statistics`): one cash
  sale (with side and kitchen note) and one card sale are written to SQLite with `BON-2026-0001`/
  `BON-2026-0002`, the tracked stock drops in the same transaction, the statistics read 2.300 gross
  (1.850 cash + 450 card); cancelling the cash sale adds `STO-2026-0001` with −1.850 gross, marks the
  original `cancelled`, restores the stock and leaves the statistics at one receipt and 450 gross.

**Evidence:** `rust-45-quick-billing-checkout-{light,dark}.png`,
`rust-46-quick-billing-receipts-{light,dark}.png`, `rust-47-quick-billing-stats-{light,dark}.png`,
rendered with `socdof-ui-preview quick-billing` and inspected in both appearances. The journal shows
`BON-2026-0001` (cancelled, 5,40 €), its `STO-2026-0001` (−5,40 €), `BON-2026-0002` (card, 4,50 €)
and `BON-2026-0003` (NFC, 9,80 €); the statistics card reads 14,30 € revenue for two receipts with
the tax split 0,64 € / 0,72 €.

**Still open:** receipt printing and e-mail delivery, the reference's photo evidence (the workspace has
no image backend), and a real TSE signature — `tse_signature` is a deterministic checksum, not a
certified signature.

## 16.27 Spreadsheet `table` (2026-11-27)

**Reference:** `SOCDOF - TS/src/components/sales/TableModule.tsx` (579 lines). The reference is a small
spreadsheet, not a floor plan: an 8 × 20 to 26 × 200 grid, per-cell styles, formulas with A1 ranges and
five range functions, CSV import/export and two view switches. It keeps its sheet in React state only —
`TEMPLATE_STORAGE_KEY` is declared but never read — so nothing survives a reload there.

**Change**

- `crates/core/src/domain/spreadsheet.rs`: `Sheet` (raw grid, insert/delete with style shifting,
  `filled_count`), `CellValue`/`CellStyle`/`CellAlign`, `format_number` mirroring JavaScript's
  `String(number)`, and a real formula parser (tokens, precedence, unary minus, A1 refs, `FN(A1:B3)`)
  with the reference's semantics: text reads as 0 inside a formula, a cycle reads as 0, anything
  invalid is `#FEHLER`, numbers accept a comma decimal mark, results round to ten decimals. CSV is
  semicolon separated with quoted fields, BOM on export and a cap at the maximum grid on import.
  10 domain tests.
- `crates/core/src/store/spreadsheet.rs` + schema **v22** `table_documents` (name, sheet JSON, styles
  JSON, gridlines, formula bar, timestamps, index on `updated_at`): list, find, save (insert or
  update in place, keeping `created_at`), rename, delete, count. 4 store tests, including a full
  lifecycle that saves cells/formulas/styles and reads them back, and a CSV round trip of the stored
  sheet.
- `crates/ui/src/table.rs`: ribbon with four tabs — Datei (new, save, clear, CSV export/import via a
  path field, document list with open/delete, name field, new-sheet field), Start (bold/italic/
  underline, five font families, the ten standard colours for font and fill plus "none", three
  alignments, clear selection, insert/delete row and column), Einfügen (the five range functions over
  the connected block above), Ansicht (grid lines, formula bar). Grid with A–Z headers and row
  numbers, inline editor for the active cell, formula bar, status bar (active cell, filled cells,
  hint) and keyboard navigation (arrows, Enter, Tab, Shift+Tab, Escape). 9 UI tests.
- Wiring: `AppModule::Spreadsheet` (`"table"`, 20 modules), App-Store definition (Trial, inactive at
  first start like the reference install list), chrome tile (emerald → teal, `Icon::Grid`), desktop
  icon, native window with restore/minimise/maximise, settings label, role matrix, 71 new i18n keys
  in de/en/fr/es; `catalogue-keys.json` regenerated (2,678 keys). Preview scene `table`, phone sweep
  flow with six cases.

**Deviations**

- Persistence is new (SQLite) — the reference has none, and the project rule forbids UI-only state.
- A range function whose block starts in row 1 is refused with a hint instead of writing a formula
  that would reference its own cell; the reference has no defined behaviour for that case.
- Multi-line CSV fields are quoted on export and split into rows on import, exactly like the
  reference's line-based reader.

**Verification**

- `cargo fmt --all -- --check` clean; `cargo clippy -p socdof-core --all-targets -- -D warnings` and
  `-p socdof-ui` clean.
- `cargo test -p socdof-core --lib`: 434 passed (14 new).
- `cargo test -p socdof-ui --lib`: 464 passed (9 new table tests, settings/sweep indices follow the
  twentieth module).
- `cargo test -p socdof-ui --test visual`: 2 passed (App Store expects "/ 20").
- `cargo test -p socdof-app --test backoffice`: 4 passed.
- Phone sweep: 1,424 cases at 360/390/412/432 px in both appearances, no overflow. It found and we
  fixed two real defects: cells collided in egui's id space (debug boxes over the sheet) and two text
  fields side by side left the phone panel.

**Evidence:** `docs/artifacts/gui-parity/rust-48-spreadsheet-{light,dark}.png`, rendered with
`socdof-ui-preview table` and inspected: the seeded "Inventur" sheet shows A–H headers, the bold
filled header row, the evaluated column `=B*C` (14.4 / 9.6 / 7.2 / 7.5), `=SUMME(B2:B5)` = 530 and
`=SUMME(D2:D5)` = 38.7, the formula bar with `A1 · Artikel` and the status bar with 22 filled cells.

**Still open:** the reference's template storage (unused there), a print/PDF export (the reference has
none) and the visual pixel comparison — this block targets functional parity only.

## 16.28 Calendar & appointments parity (2026-11-27)

`CalendarModule.tsx` renders a merged event list: local events from `localStorage`, invoice due
dates built by `buildUnifiedCalendarEvents` and Google events from `lib/googleCalendar.ts`. This
block ports the local half and keeps the Google half out of scope: OAuth, the Google Calendar API
and the invoice push need credentials and a network backend that the Rust build deliberately does
not have.

**Domain** `crates/core/src/domain/appointment.rs`:
- `AppointmentCategory` with the six reference categories (invoice, customer, meeting, deadline,
  personal, general), stable storage strings and catalogue keys.
- `Appointment::all_day`; all-day entries are stored as half-open day ranges
  (`starts_at` = first day, `ends_at` = start of the day after the last one) so views, conflict
  checks and the exporter share one representation. `day_count()` reports the covered days.
- `export_appointments_ics` writes `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` for all-day entries and
  `CATEGORIES:<KIND>` for every event, matching the reference exporter's date values and exclusive
  end date.
- `InvoiceEvent` and `invoice_events(invoices, contacts, now)` turn due, non-cancelled invoices into
  read-only entries; paid and overdue are derived from status and due date.

**Store** `crates/core/src/store/appointments.rs`, schema **v23**:
`category TEXT NOT NULL DEFAULT 'general'` and `all_day INTEGER NOT NULL DEFAULT 0`; insert, update
and row mapping carry both fields.

**UI** `crates/ui/src/appointments.rs`:
- fourth view **Work week** (Monday–Friday); week and work week render five or seven equal columns;
  all-day entries get a banner above the columns.
- merged `CalendarEntry` list (appointments plus invoice events) with per-category accent dots,
  category chips, an invoices-only filter and search over titles, notes and invoice numbers.
- form: start/end date and time instead of a duration, all-day switch, quick durations
  (15 m/30 m/45 m/1 h/2 h/all day), category select; all-day entries skip the slot conflict check
  because the reference allows overlapping all-day entries.
- detail: category and invoice status badges, duration in minutes or days, duplicate (also from an
  invoice entry, which becomes a local all-day appointment), status actions for local entries only.
- `.ics` export writes the filtered list, now including invoice entries and all-day date values.
- The agenda is a list (title line plus date/time/category/status line) rather than a grid, so long
  invoice or customer titles keep the panel width; titles that still do not fit are shortened with
  an ellipsis.

**Wiring:** no new module (the calendar already held slot 8). New preview scene `calendar-workweek`,
a calendar fixture with categories and an all-day `Inventur` entry, the app demo seed with the same
categories and one all-day entry, and 23 i18n keys in de/en/fr/es (catalogue 2,701).

**Verification:** `cargo fmt --all -- --check`, clippy core+ui `-D warnings`, core 437, UI 467,
visual 2 (goldens regenerated for the new work-week tab and five fixtures), backoffice 4 and the
phone sweep with 1,432 cases at 360/390/412/432 px in both appearances. The sweep caught two real
overflows (search field wider than the phone row, long invoice titles in the agenda); both are fixed.

**Evidence:** `docs/artifacts/gui-parity/rust-49-calendar-{light,dark}.png`,
`rust-49-calendar-workweek-{light,dark}.png`, `rust-49-calendar-form-{light,dark}.png`.

**Still open:** Google Calendar sync (OAuth/API/invoice push), `window.print()` (no desktop
equivalent; the ICS export covers exchange), the reference's mobile bottom sheets (the Rust form
stacks on phone widths) and the pixel comparison. Recurrence and ICS import do not exist in the
reference, so they are not gaps.

## 16.29 POS register parity (2026-11-27)

`POSModule.tsx` is a cash-register screen, not a receipt form: catalogue tiles with category pills
and search, a barcode field that adds a product on Enter (barcode or SKU, case-insensitive), a cart
with quantity and a receipt-wide discount, a customer select, the payment methods of
`PaymentModal.tsx` (cash with quick amounts and change, card, NFC) and a receipt view after
checkout. The reference has no Z report; the daily close already existed in Rust and is now a real
view with an export instead of `window.print()`.

**Domain** `crates/core/src/domain/pos.rs`:
- `PosOrder::discount_bp` (basis points, `serde(default)`, validated to 0..=10,000) applies to the
  net amount of every position; tax is derived from the discounted net, so totals and change follow
  the same rounding as before.
- `PosOrderLine::net_for` / `tax_for`, `PosOrder::discount_amount`.
- `PosZReport`, `PosTaxGroup` and `z_report(orders)` aggregate a day's receipts: totals, payment
  methods, cash given/change, tax groups sorted by rate and receipt numbers in payment order.

**Store** `crates/core/src/store/pos_orders.rs`, schema **v24**
(`ALTER TABLE pos_orders ADD COLUMN discount_bp INTEGER NOT NULL DEFAULT 0`):
- `checkout(conn, order, invoice)` books the receipt, its stock movements and an optional paid
  invoice in one transaction; `Store::pos_checkout` exposes it. The existing `insert_pos_order`
  keeps working for forms and fixtures.

**UI** `crates/ui/src/pos.rs`:
- new default view **Register** plus **Z-Bericht**; tab row switches Register, Belege and Z-Bericht,
  Escape returns to the receipt list.
- register: barcode field with Enter (and a Scan button), catalogue search, category chips, stock
  tiles with emoji/initial, cart lines with +/−/remove and clear, customer select, discount field,
  payment select, cash field with 10/20/50/100 € quick amounts and live change, totals and a
  full-width checkout.
- checkout builds the receipt from the cart, books it through `Store::pos_checkout` and creates a
  paid invoice only when a customer is selected (the reference falls back to contact 1; documented
  deviation). Errors map to catalogue keys (`pos_error_stock`, `pos_error_cash`, …). The booked
  receipt stays visible as "last receipt" with open/new-sale actions.
- Z report: header with first/last receipt, totals, payment methods, cash/change, VAT groups, the
  day's receipt numbers and a `.txt` export through the system dialog (content built from the
  catalogue, so it follows the UI language).

**Wiring:** three new preview scenes `pos-cart`, `pos-receipt`, `pos-zreport`; the seed gets
category, barcode and emoji for both sample products; 42 i18n keys in de/en/fr/es plus two plural
pairs (catalogue 2,748). The phone sweep covers Register and Z-Bericht.

**Verification:** `cargo fmt --all -- --check`, clippy core+ui `-D warnings`, core 440, UI 471,
visual 2 (goldens regenerated for the new register default), backoffice 4 and the phone sweep at
360/390/412/432 px in both appearances. The sweep caught no new overflow; the register stacks
catalogue and cart below 760 px.

**Evidence:** `docs/artifacts/gui-parity/rust-50-pos-register-{light,dark}.png`,
`rust-50-pos-cart-{light,dark}.png`, `rust-50-pos-checkout-{light,dark}.png`,
`rust-50-pos-zreport-{light,dark}.png`.

**Still open:** a receipt printer and a real card/NFC terminal (neither exists in the reference; the
payment methods only record how the customer paid) and the pixel comparison of the POS screen
(functional parity is the measure here).

**Deliberate deviations:** the Z report has no TypeScript counterpart — it is a Rust extension and
replaces `window.print()` with the text export; a paid invoice is created only when a customer is
selected, while the reference falls back to contact 1 (otherwise Rust books the receipt alone). The
reference's `window.print()` for receipts has no desktop counterpart either; the existing PDF receipt
covers handover.

## 16.30 Invoice list filters and duplicate (2026-11-28)

`InvoicesModule.tsx` filters the journal through four status tabs (`invoice.filter_all`,
`filter_draft`, `filter_posted`, `filter_paid`) and offers `handleDuplicateInvoice` next to every
row. Both behaviours are now in the Rust screen; the duplicate button sits in the detail view
because the virtualised list has no per-row action column (same database effect, one extra click).

**UI** `crates/ui/src/invoices.rs`:
- `InvoicesState::status_filter`, `filter_status`, `status_count` and `visible_invoices`; the list
  renders six chips (`invoices_filter_*`) with their counts above the search row. Search and chip
  combine, and an empty chip selection shows `invoices_filter_hint` instead of the catalogue empty
  state.
- `InvoicesState::duplicate` copies customer, note, positions and the tax override, then assigns a
  new id, the next free number of the whole journal (`suggest_number` over `Store::list_invoices`),
  the current date, a 14-day due date and `InvoiceStatus::Draft`. Validation runs before the insert,
  so a broken copy never reaches SQLite. `duplicate_selected` is the detail-view button.
- The detail action row gains `invoices_duplicate`; the success badge `invoices_duplicated` confirms
  the new draft.

**Wiring:** 9 i18n keys in de/en/fr/es (`invoices_filter_all`, `_cancelled`, `_draft`, `_hint`,
`_overdue`, `_paid`, `_sent`, `invoices_duplicate`, `invoices_duplicated`; catalogue 2,757) and one
new phone sweep case (`invoices filter`, empty filter on phone widths).

**Verification:** `cargo fmt -p socdof-ui -- --check`, clippy ui `-D warnings`, core 440, UI 473
(`filters_the_list_by_status_through_the_chips`, `duplicates_an_invoice_as_a_fresh_draft`), visual 2
with regenerated goldens, backoffice 4 and the phone sweep with 1,456 cases at 360/390/412/432 px in
both appearances, no overflow.

**Evidence:** `docs/artifacts/gui-parity/rust-51-invoices-{light,dark}.png`.

**Difference to the reference:** the reference knows three statuses, Rust five, so the chip row lists
five statuses plus "all". The row-level duplicate icon of the reference is the detail-view button
here; the created draft is identical (new number, today, 14 days, status draft).
