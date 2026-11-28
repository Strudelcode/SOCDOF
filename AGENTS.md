# SOCDOF — Rules & Status Tracker for AI Agents

> Every AI working in this repository MUST follow these rules and update both this status matrix and `RUST_MIGRATION.md` after every completed work block.

## 1. Non-Negotiable Engineering Rules

1. **Alles in RUST!**
   - Business logic, domain validation, persistence (SQLite `Store`), PDF/XML generation, CSV/ICS/vCard/DOCX/Email export & import belong in `crates/core` (`socdof-core`).
   - User interface belongs in pure Rust (`crates/ui` with `egui`, plus `crates/web` for browser WASM and `crates/app` for desktop shell).
   - `SOCDOF - TS/` is the behavioral & visual **reference** only — never add new user features only in TypeScript or move logic back to JS/TS. Keep root `npm run dev` working until the Rust web/desktop shells completely replace preview/packaging.
2. **Dark + Light Mode & Professional Look**
   - Every screen and control must render cleanly in **both Dark and Light Mode** using `Theme` and `crate::tokens` (never hardcoded colors, no flashy/generic "AI-look", no leaked internal developer/prompt notes in UI copy).
3. **4 Languages From Day One (`de`, `en`, `fr`, `es`)**
   - No hardcoded visible strings in Rust UI or Core errors.
   - Add every UI key to `crates/ui/src/i18n.rs` (`UI_KEYS`) and all four `crates/ui/locales/{de,en,fr,es}.json` files, then regenerate `crates/ui/catalogue-keys.json` via:
     `cargo run -p socdof-ui --bin socdof-ui-catalogue`
   - Code comments and documentation remain in technical English.
4. **No Mock Data or Stubs**
   - Every control must read/write real SQLite records through `Store` / core services and enforce real validation & permissions.
5. **Memory-Safe Verification Commands (4 GB RAM / 0 Swap Containers)**
   - Run Rust builds sequentially (never spawn concurrent `cargo` processes) and keep memory small:
     ```bash
     export PATH="$HOME/.cargo/bin:$PATH"
     export CARGO_BUILD_JOBS=1
     export CARGO_INCREMENTAL=0
     export CARGO_PROFILE_DEV_DEBUG=0
     export CARGO_PROFILE_TEST_DEBUG=0
     ```
   - Verify **one crate at a time**:
     - `cargo fmt --all -- --check`
     - `cargo clippy -p socdof-core --all-targets -- -D warnings`
     - `cargo clippy -p socdof-ui --all-targets -- -D warnings`
     - `cargo clippy -p socdof-app --all-targets -- -D warnings`
     - `cargo clippy -p socdof-cli --all-targets -- -D warnings`
     - `cargo test -p socdof-core` / `socdof-ui` / `socdof-app` / `socdof-cli`
     - `cd crates/web && trunk build` (verify WASM compiles cleanly)
6. **Mandatory Status Protocol for All AIs**
   - Only mark `fertig` / `[x]` when **both** Rust feature parity with `SOCDOF - TS/` **and** tests/clippy/fmt are verified green.
   - Use `teilweise` / `[~]` whenever core backend exists or partial UI exists, and explicitly write what remains in the status file.
   - At the end of every work block update **all three**:
     1. [`docs/feature-status.md`](docs/feature-status.md) — the module row (status, code paths, gap, evidence number)
        and a new row in its changelog table.
     2. `RUST_MIGRATION.md` — a dated section with reference, change and verification.
     3. `docs/rust-parity-status.md` — the German overall picture (done / partial / open / deviations / numbers).
   - Regenerate `crates/ui/locales/catalogue-keys.json` after i18n changes and add a light+dark scene image
     under `docs/artifacts/gui-parity/` for every completed UI point.
   - Never mark a module complete from a compile alone: name the command you ran and the result.

---

## 2. Live Feature Parity Status

The detailed, per-module status is maintained in [`docs/feature-status.md`](docs/feature-status.md).
That file is the single source of truth: every AI updates its module row, names the remaining gap and
adds a row to its changelog after each work block. There is deliberately no second matrix here.

Overview (details, code paths and evidence are in the status file):

| Area | Status |
|---|---|
| Shell, taskbar, windows, virtual desktops | `teilweise` — blur, OS tray and the studio/widget module remain |
| Auth, setup wizard, users & roles | `fertig` — the web host follows the browser theme on `System` (`rust-53`) |
| Settings | `teilweise` — factory reset, monitor layout, letterhead in every renderer |
| App Store, contacts, accounting, projects, fleet, restaurant, textwerk, editor, reports, users | `fertig` |
| Invoices | `fertig` — CRUD, status, dunning, mail, payment, PDF/DOCX, templates, FatturaPA inspector, status filter chips with counts and duplicate as a new draft |
| Products | `fertig` — CRUD, labels, reorder assistant, double-entry journal, category/low-stock chips with counts, duplicate as a copy, link extractor for marketplaces and shops (name, SKU, ASIN, category, shop, description) |
| Purchases | `teilweise` — product link per position done; duplicate, KPIs, print remain |
| POS | `fertig` — product tiles, barcode quick add, cart with discount, checkout and Z report with text export (schema v24, seed, three preview scenes, four languages); deliberately open: no receipt printer or card/NFC terminal (payment methods are only recorded), Z report is a Rust extension, invoice only with a selected customer, no pixel comparison |
| Calendar | `teilweise` — work week, all-day, categories, invoice entries and ICS export done; Google sync, print and mobile sheets remain |
| Therapy | `teilweise` — practice dashboard, appointments tab, batch billing remain |
| Support & mobile companion | `teilweise` — ticket PDF acceptance, work-item checklist remain |
| Documentation | `teilweise` — the manual content is still short |
| **Quick billing / Schnellkasse (`ios_billing`)** | `fertig` — Bon-Druck und echte TSE bleiben offen |
| **Spreadsheet (`table`)** | `fertig` — Vorlagen-Speicher der Vorlage bleibt offen |
| Feedback (Discord) | `offen` — network feature, deliberately deferred |

Status values: `fertig` = behaviour, persistence and tests verified against `SOCDOF - TS/`;
`teilweise` = real data path works and the named gap is listed; `offen` = not present in Rust;
`abweichend` = deliberate difference with a reason in `docs/rust-parity-status.md`.

## 3. Repository Structure Quick Reference

- `crates/core/` — Domain entities, money/date math, PDF/FatturaPA/CSV/ICS/vCard/DOCX, `mobile_sync`, `settings_service`, SQLite `store/`
- `crates/ui/` — Pure Rust `egui` UI components, themes, 4-language `locales/`, all 18 module screens + `gallery.rs` (`socdof-ui-desktop`)
- `crates/web/` — Browser WASM host (`Trunk`, IndexedDB SQLite persistence)
- `crates/app/` — Desktop shell state (`Shell`), headless CLI, Tauri compatibility layer (`src-tauri`)
- `crates/cli/` — Headless CLI for all core services
- `SOCDOF - TS/` — Legacy TypeScript/React reference app (also backs root `npm run dev` on port 3000)
