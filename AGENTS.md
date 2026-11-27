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
   - Only mark `[x]` when **both** Rust feature parity with `SOCDOF - TS/` **and** tests/clippy/fmt are verified green.
   - Use `[~]` whenever core backend exists or partial UI exists, and explicitly write what remains in the Notes column.
   - Update `RUST_MIGRATION.md` progress log and the table below at the end of every work session.

---

## 2. Live Feature Parity Matrix (`crates/` vs `SOCDOF - TS/`)

Legend: `[x]` Complete & verified | `[~]` Partial / in progress | `[ ]` Missing / not exposed in UI

| Area / Module | Core (`crates/core`) | Pure Rust UI (`crates/ui`) | Web/Desktop Host (`crates/web` / `gallery.rs`) | Status | Remaining / Notes |
|---|---|---|---|---|---|
| **Auth, Setup Wizard & Accounts** | `[x]` | `[x]` | `[~]` | `[~]` | Setup wizard, Argon2id, sessions, lockout, recovery questions, must-change-password, `auth_security` restored; `crates/web` needs first-run/preference/avatar/wallpaper sync parity. |
| **Desktop Shell & Navigation** | `[x]` | `[x]` | `[~]` | `[~]` | Taskbar, start menu, command palette, tray, virtual desktops, widgets, calculator, wallpapers; `crates/web` needs theme/accent/pref persistence sync and studio/calculator/widgets wiring. |
| **Settings & Storage Inspector** | `[x]` | `[~]` | `[~]` | `[~]` | 13 settings sections implemented; missing Storage Inspector table breakdown + JSON full export/import parity + factory reset parity. |
| **App Store & Permissions** | `[x]` | `[x]` | `[~]` | `[~]` | `app_store::apply_selection` + role matrix in core; ensure wizard selection & desktop icon sync persist cleanly across `gallery.rs` & `web`. |
| **Contacts & CRM** | `[x]` | `[x]` | `[x]` | `[x]` | CRUD, contact persons, countries search, CSV/vCard import & export, email draft. |
| **Invoices, DIN 5008 & FatturaPA** | `[x]` | `[~]` | `[x]` | `[~]` | DIN 5008 PDF, templates, dunning, payment, `.eml` present; `invoices.rs` needs status filter chips, invoice duplicate/clone, and UI modal for existing `domain::fattura` FatturaPA 1.2 XML. |
| **Products & Stock Journal** | `[x]` | `[~]` | `[x]` | `[~]` | CRUD, QR labels, smart reorder, double-entry stock journal present; missing `product_link_extractor` (ASIN/shop URL parser), category/low-stock filter tabs, duplicate product, linked history. |
| **Purchases** | `[x]` | `[~]` | `[x]` | `[~]` | PO CRUD & atomic goods receipt present; `PurchaseLineDraft` needs real `Product` (`product_id`) selector, PO KPIs, duplicate PO, `.eml`/PDF print. |
| **POS & Daily Close** | `[x]` | `[~]` | `[x]` | `[~]` | 6 payment methods incl. NFC, receipt cancellation, daily close present; needs barcode/SKU scan quick-add, catalog product tiles, customer link & Z-Bon PDF/CSV export. |
| **Accounting & Tax Advisor Ledger** | `[x]` | `[x]` | `[x]` | `[x]` | Journal, cash book, VAT summary, monthly tax-advisor CSV/workbook. |
| **Calendar / Appointments** | `[x]` | `[~]` | `[x]` | `[~]` | Month/Week/Day views, conflict check, `.ics` export present; missing Work-week view, all-day/multi-day events, recurrence series & `.ics` import. |
| **Therapy Practice Suite** | `[x]` | `[~]` | `[x]` | `[~]` | Clients, sessions, single-client invoice link, mileage logbook present; missing Practice Overview Dashboard, Appointments tab, Batch Billing & Sync view, §4 Nr. 14 UStG invoice template wiring. |
| **Support & Mobile Companion** | `[x]` | `[~]` | `[x]` | `[~]` | Core `mobile_sync` HTTP receiver & JSON parser complete (`crates/core/src/mobile_sync`); `support.rs` missing `MobileCompanionImportModal` UI, ticket `contact_id` selector, work-items checklist, timesheet overview/CSV, ticket print PDF, create invoice from ticket. |
| **Projects / Fleet / Restaurant** | `[x]` | `[x]` | `[x]` | `[x]` | Core CRUD, domain rules & UI parity audited; continuous edge-case polish in `RUST_MIGRATION.md`. |
| **Textwerk Editor** | `[x]` | `[x]` | `[x]` | `[x]` | Rich markup editor, Hunspell DE offline spellcheck, `.docx`/`.odt`/HTML export & `.docx` import. |
| **Documentation & Release History** | `[ ]` | `[~]` | `[x]` | `[~]` | Currently 4 stub topics (165 lines) in `documentation.rs`; expand into tabbed Help Portal (Overview, Searchable Module Manual, Keyboard Shortcuts, Security & Storage, Release History). |
| **Reports** | `[x]` | `[~]` | `[x]` | `[~]` | 4 period tabs + invoice summary table present; missing CSV & PDF export of period reports + tracked hours breakdown. |
| **Users & Roles** | `[x]` | `[x]` | `[x]` | `[x]` | Argon2id accounts, custom roles, passwordless toggle, password reset/must-change gate. |
| **Tauri Compatibility Bridge (`crates/app`)** | `[x]` | `N/A` | `[~]` | `[~]` | Kept green for CI/installers until native `socdof-ui-desktop` & `socdof-web` finish acceptance. |

---

## 3. Repository Structure Quick Reference

- `crates/core/` — Domain entities, money/date math, PDF/FatturaPA/CSV/ICS/vCard/DOCX, `mobile_sync`, `settings_service`, SQLite `store/`
- `crates/ui/` — Pure Rust `egui` UI components, themes, 4-language `locales/`, all 18 module screens + `gallery.rs` (`socdof-ui-desktop`)
- `crates/web/` — Browser WASM host (`Trunk`, IndexedDB SQLite persistence)
- `crates/app/` — Desktop shell state (`Shell`), headless CLI, Tauri compatibility layer (`src-tauri`)
- `crates/cli/` — Headless CLI for all core services
- `SOCDOF - TS/` — Legacy TypeScript/React reference app (also backs root `npm run dev` on port 3000)
