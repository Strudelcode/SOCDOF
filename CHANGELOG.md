# Changelog

All notable changes to SOCDOF are documented here. The release workflow reads
the section matching the pushed tag; a release fails if this file has no
matching, non-empty section.

## [0.30.0] - 2026-11-08

### Added

- Browser build (`crates/web`): the Rust interface now also runs as WebAssembly in a browser. The
  egui screens, the SQLite schema, the Argon2id login and the user management are the same code as
  in the desktop build — nothing is reimplemented for the web.
- SQLite in the browser: `rusqlite` 0.40 links `sqlite-wasm-rs` on `wasm32-unknown-unknown`, so
  migrations, FTS5 search, sessions and password hashes work unchanged.
- Real first-run setup and login in the browser: an empty database opens the setup form that creates
  the first administrator, and `Store::login` handles failed attempts, the lockout and the session.
- Desktop and module screens in the browser: icon grid, wallpapers, taskbar, start menu, command
  palette, window chrome, dashboard quick actions and every module, with an account chip that signs
  the session out again.
- Core helpers for the web host: `Store::dashboard_snapshot` feeds the dashboard with live figures
  instead of the gallery sample, and `now_millis()` reads the browser clock on wasm.

### Notes

- The browser database currently lives in memory for the session; OPFS persistence is the next step.
- Print, backup and import need file access and stay desktop-only for now.
- Build with `trunk build --release` in `crates/web` (5.4 MB wasm, 2.5 MB gzip).

## [0.29.0] - 2026-11-08

### Added

- Multi-page invoices (`pdf::writer`): the document holds any number of pages, writes a `/Pages`
  tree with the right `/Count`, one content stream per page and repeats the letterhead image on
  every page, so a background set before pagination also covers the pages added afterwards.
- Paginated position table (`pdf::din5008`): 19 positions fit on page one and 33 on every
  continuation page. Each page repeats the column header (`Pos.`, `Bezeichnung`, `Menge`,
  `Einzelpreis`, `Betrag`), totals and the payment line appear only on the last page, and the footer
  numbers the pages (`Seite X von Y`). A position row is never cut in half: a row that does not fit
  moves whole to the next page.
- Letterhead and tokens on every page: the background is painted under the content and the enabled
  `document_layout` tokens are painted over it on page one and on all continuation pages.
- The Studio layout tab names the pagination behaviour (new key `studio_layout_pagination`, 1,428 keys
  per language).

### Notes

- One-page invoices render exactly as before; only the page counter and the letterhead/token repeat
  are new on continuation pages.
- There is still one document layout, not one per invoice template.

## [0.28.0] - 2026-11-08

### Added

- Document layout (`socdof_core::document_layout`): one stored layout with an optional PNG letterhead
  and nine placement tokens (company name, company address, contact, tax number, invoice number,
  invoice date, due date, subject, footer). Every token carries a position in page percentages, a
  font size, bold and left/center/right alignment; the default layout leaves all tokens disabled, so
  freshly installed invoices print exactly as before. Validation reports `layout_position_invalid`,
  `layout_size_invalid`, `layout_tokens_required` and `layout_image_invalid`, and the layout is
  persisted as the `document_layout` setting.
- PDF letterhead (`pdf::writer`, `pdf::din5008`): a PNG background is decoded (RGB, RGBA, grayscale,
  grayscale+alpha) and embedded as a Flate-compressed DeviceRGB image XObject that the page paints
  before the DIN 5008 content. Placed tokens are drawn after the content, so they stay visible on top
  of the letterhead, and `export_invoice_pdf` applies the stored layout.
- Studio layout tab: a page preview with the decoded letterhead and the enabled tokens, the
  background path, a per-token editor (enable, x/y, size, bold, alignment), save with the core's
  error codes and a reset to the defaults. The palette gained a `command_layout` entry that opens the
  Studio on this tab.
- One new golden scene (`studio-layout`) in both appearances and all four languages: 264 goldens in
  33 scenes; 31 new keys bring the catalogue to 1,427 per language.

### Notes

- There is one document layout, not one per invoice template; per-template layouts remain open.
- The letterhead has to be a PNG file. Indexed and 16-bit PNGs are rejected by the writer with
  `layout_image_invalid`, and a missing file simply prints without a background.

## [0.27.0] - 2026-11-08

### Added

- Editor rich-text ribbon (`socdof_ui::richtext`): bold, italic, heading, list and quote applied to
  the character selection from a ribbon and from Ctrl+B/Ctrl+I. The document body keeps a light
  markup (`**bold**`, `_italic_`, `# heading`, `- list`, `> quote`), so storage, search, backups and
  the legacy CSV path keep working on plain text.
- Formatted preview: a toggle renders the document with heading size, bullets, a quote bar,
  double-painted bold runs and epaint's italic skew; word counts ignore markup characters.
- Offline spell check (`socdof_core::spell`): the bundled German Hunspell dictionary (igerman98,
  GPL) with its affix rules, licence included under `crates/core/assets/dictionary`. Unknown words
  are underlined in the editor and listed in a proofing panel with occurrence counts; ignored words
  go to a personal dictionary stored under the `editor_spell_ignored` setting and can be reset.
- Two new golden scenes pin the preview and the proofing state in both appearances and all four
  languages: 256 goldens in 32 scenes; 15 new catalogue keys bring the catalogue to 1,396 per
  language.

### Notes

- The spell checker ships with the German dictionary only, like the shipped application; the panel
  names the dictionary in every language. Cross-product affixes are not expanded, so a rare
  inflection can be flagged and is then accepted through the personal dictionary.
- The per-template document layout editor remains with Phase 8.

## [0.26.0] - 2026-11-08

### Added

- Studio drawer (`socdof_ui::studio`): a real right-side drawer that opens from the desktop taskbar
  and from a new command-palette entry. The letterhead tab edits the company profile through the
  validated settings service, shows the empty state when nothing is stored yet and maps the core's
  validation code to its own message. The data tab lists the stored contacts, products, invoices,
  purchase orders and receipts.
- Clean mode: `Store::reset_business_data` deletes every business record in one transaction
  (`store::maintenance`) and keeps the schema, accounts, roles, sessions and settings. The drawer
  asks for confirmation in its own dialog before it runs.
- Two new golden scenes pin the letterhead and the data tab in both appearances and all four languages: 240 goldens in 30
  scenes; 28 new catalogue keys bring the catalogue to 1,381 per language.

### Notes

- The per-template document layout editor, the letterhead background file and the rich-text ribbon
  of the editor remain open. Phase 6's module list is complete.

## [0.25.0] - 2026-11-08

### Added

- Therapy practice (`socdof_ui::therapie`): schema v8 adds `therapy_clients` and `therapy_sessions`;
  `store::therapy` offers the CRUD, the session queries by client and by range, the session count and
  `link_invoice`. `domain::therapy` owns the arithmetic through the pure `session_amount` (minutes at
  the hourly rate plus kilometres at the kilometre rate, integer rounding) and `summarize` (sessions,
  minutes, kilometres, billable, billed, open).
- The screen lists and searches clients with their session count and rates, shows four key figures,
  the session history with per-session amounts and the billed badge, books sessions, links the open
  sessions to an invoice by number and keeps empty, validation and storage states in all four
  languages. It opens from launcher, desktop, gallery, start menu, palette and preview.
- 88 new catalogue keys per language (1,353 in total); one new scene adds 8 goldens.

### Notes

- Appointment sync, series appointments and the treatment report remain open.

## [0.24.0] - 2026-11-08

### Added

- Reports app (`socdof_ui::reports`): `store::reports` loads the invoices of a half-open period with
  their contact names and totals, adds the tracked minutes of the same range and returns a report
  with a pure `summarize` and `status_totals`. The screen offers four periods, seven key figures, a
  per-state breakdown with share bars, the invoice table with locale-independent dates and empty and
  error states.
- 33 new catalogue keys per language (1,265 in total); one new scene adds 8 goldens.

### Notes

- The feedback form of the legacy reporting module is not implemented.

## [0.23.0] - 2026-11-08

### Added

- Support app (`socdof_ui::support`): ticket list with status and priority chips, local search, an
  open-only filter, the create/edit form with core validation, the four status transitions, delete
  confirmation and a working-time panel that books, lists and removes time entries per ticket.
- The module carries the application window chrome, opens from the launcher and the desktop and is
  pinned by its own golden scene. 67 new catalogue keys per language (1,232 in total).

### Notes

- Attachments and the Discord report remain open.

## [0.22.0] - 2026-11-08

### Added

- Application window chrome (`socdof_ui::chrome`): every module screen is drawn inside the SOCDOF
  app window with an accent frame, a 40 pixel title bar (app icon, translated name, `[MODULE]` badge,
  minimize/maximize/close) and the module header card with its accent icon tile and status chip. The
  desktop and the preview share the same functions.
- The desktop now shows the full app catalogue instead of three icons: the legacy tile colors,
  reading-order wrapping and labels that wrap instead of clipping. Icons, start menu, command palette
  and taskbar all open the real screens and reload their state from the store; closing a screen
  returns to the desktop and releases the running indicator.
- 10 new catalogue keys per language (1,165 in total).

### Notes

- The dashboard key figures moved to equal-width columns and module search toolbars reserve room for
  their primary action.

## [0.21.0] - 2026-11-08

### Added

- Text editor (`socdof_core::domain::document`, `socdof_ui::editor`): real document persistence in
  the new `documents` table (schema 7), with core CRUD, core search over names and contents, name
  and content validation, word/character counts and an on-disk reopen test.
- The egui screen lists and searches documents, opens and edits them, creates and saves new ones and
  deletes with confirmation. Core validation and missing/IO/storage failures map to translated
  messages. Unsaved edits are guarded when switching documents, creating another one or leaving the
  screen; confirming the guard discards, cancelling keeps the draft.
- The editor is reachable from the gallery and a new dashboard quick action and appears as its own
  scene in all eight theme/language combinations. Deactivating the editor in the App Store removes
  the dashboard action.
- 48 new catalogue keys per language (1,155 in total); one new scene adds 8 goldens (200 in 25
  scenes). The preview renderer now covers 33 scenes and 264 PNGs.

### Notes

- The editor stores plain text. Rich-text ribbon formatting and spell checking are still open; the
  remaining Phase 6 modules and self-service password recovery are unchanged.

## [0.20.0] - 2026-11-08

### Added

- App Store (`socdof_core::app_store`, `socdof_ui::app_store`): a single core catalogue for all
  permission modules with name, description, installed version, licence state, system flag and
  activation state. The UI has no module list of its own.
- Activation and deactivation are persisted in the database and resolved through the same core
  service. System modules stay enabled, locked modules cannot be activated, and unknown, repeated,
  required, unlicensed and storage failures map to translated messages.
- The App Store is reachable from the gallery and from a new dashboard quick action. Enabled modules
  immediately control the dashboard quick actions and the desktop/start-menu icons.
- 46 new catalogue keys per language (1,107 in total); one new scene adds 8 goldens (192 in 24
  scenes). The preview renderer now covers 32 scenes and 256 PNGs.

### Notes

- Module licences are local catalogue data; there is no billing or remote licence service. The
  remaining Phase 6 modules and the self-service password recovery are still open.

## [0.19.0] - 2026-11-08

### Added

- Login and lock screens (`socdof_ui::auth`): local sign-in through the core session path with
  Argon2id verification, persistent failed-attempt lockout, disabled-account handling and a
  first-run setup that creates the first administrator when the database is empty.
- Manual lock, Ctrl+L and a five-minute inactivity lock keep the session but require the account
  password to continue. Unlocking verifies against the live account, keeps the session and applies
  its own five-attempt lockout; signing out revokes the session.
- Masked password fields in the component kit, a dashboard lock action, a gallery card and four new
  scenes (login, lock, setup, signed in) in both themes and all four languages.
- 58 new catalogue keys per language (1,061 in total); four new goldens (184 in 23 scenes). The
  preview renderer now covers 31 scenes and 248 PNGs.

### Notes

- Self-service recovery through the configured security questions and the remaining Phase 6
  modules are still open.

## [0.18.0] - 2026-11-08

### Added

- User management screen (`socdof_ui::users`): searchable account list with role/status badges, a
  detail view with active-session count and recovery status, a create/edit form with custom-role
  assignment, active and forced-password-change switches, and deletion that keeps the core's
  last-administrator protection.
- Password resets and session revocation in the detail view. A reset stores a new Argon2id hash and
  signs out every session of the account.
- Security questions: two fixed prompts whose answers are stored as Argon2id hashes per user in the
  settings table, with verification and deletion services in the core.
- The dashboard's users quick action opens the screen; the gallery seeds three accounts through the
  real core write path. The preview renderer now covers 27 scenes and 216 PNGs, including the user
  list and account detail in four languages and both themes.
- 72 new catalogue keys per language (1,003 in total) and one new golden (152 in 19 scenes).

### Notes

- The login/lock screen and the end-user self-service recovery flow are still open. Phase 6
  continues with the app store and the remaining modules.

## [0.17.0] - 2026-11-08

### Added

- Settings screen (`socdof_ui::settings`) with all eight tabs: company profile, per-user
  appearance, password reset and session revocation, backup create/list/verify/restore, user CRUD
  with custom-role assignment and last-administrator protection, the fifteen-module role matrix,
  update policy and portable mode. All four languages, keyboard reachable, Escape paths and drawing
  from the tokens only.
- Core additions: `Store::update_user`/`delete_user` with last-admin protection, `list_backups`
  with archive metadata, and validated `UpdateSettings`/`PortableSettings` services. A required
  backup folder is now validated when automatic backups are enabled, and restore creates the target
  directory before writing.
- The dashboard's settings quick action opens the settings screen. The gallery seeds two accounts,
  the company profile and their preferences through the real core write paths.
- 192 new catalogue keys per language, 931 in total; eight new goldens pin the settings screen in
  both appearances and all four languages (144 goldens in 18 scenes).

### Notes

- Phase 6 continues with user management and the remaining modules. The settings screen is native
  egui; it is verified headlessly and through paint-command goldens, not in a browser.

## [0.16.0] - 2026-11-08

### Added

- Calendar screen (`socdof_ui::appointments`): month grid, week columns and day agenda with a
  status filter, search, detail view with lifecycle actions, and a create/edit/delete form with
  optional contact assignment. All four languages, keyboard reachable, Escape paths and drawing
  from the tokens only.
- Core appointment search over title, location and notes (`search_appointments_between`) and
  `appointment_conflicts`, which reports overlapping open slots; conflicting saves are rejected by
  the screen with a catalogue error. No schema change was needed, the table exists since v4.
- The dashboard's calendar quick action opens the month view.
- A Calendar card in the gallery seeds four appointments through the real core write path, and
  eight new goldens pin the month, 136 in total in 17 scenes. 79 new catalogue keys per language,
  739 in total.

### Notes

- Phase 6 continues: settings and the remaining modules follow. All-day entries, recurrence,
  reminders, drag-and-drop and a dedicated mobile layout are still open.

## [0.15.0] - 2026-11-08

### Added

- POS screen (`socdof_ui::pos`): searchable receipt list with a payment filter and the daily close
  (net, tax, gross, cash and card totals), detail with positions, totals and change, sale form with
  product positions and stock booking, and cancellation that returns goods to stock. All four
  languages, keyboard reachable, Escape paths and drawing from the tokens only.
- Schema v6 stores the cash handed over (`cash_given_cents`). The core gained receipt search, the
  day range query, receipt count, `PosOrder::stock_moves`/`return_moves`, `change`, the pure
  `summarize` for the daily close and `cancel_pos_order`, which restores stock and deletes the
  receipt in one transaction.
- The dashboard's POS quick action opens the register.
- A POS card in the gallery seeds three receipts through the real core write paths, including two
  sample products and their stock, and eight new goldens pin the list, 128 in total in 16 scenes.
  83 new catalogue keys per language, 660 in total.

### Notes

- Phase 6 continues: calendar, settings and the remaining modules follow. Receipt print, cash
  sessions/drawer counts, discounts and customer assignment are still open.

## [0.14.0] - 2026-11-08

### Added

- Purchases screen (`socdof_ui::purchases`): searchable order list with a supplier filter and an
  open-order summary, detail view with positions and totals, create/edit/delete form, lifecycle
  actions and a goods receipt that books stock through the domain movements. All four languages,
  keyboard reachable, Escape paths and drawing from the tokens only.
- `Store` accessors for purchase orders: `update_purchase_order` replaces the header and all
  positions in one transaction, `search_purchase_orders` covers number, note and position texts,
  and `purchase_order_count`; `PurchaseOrder::stock_moves` and the pure `summarize` keep the goods
  receipt and the open values in the core.
- The dashboard's purchases quick action opens the order list.
- A Purchases card in the gallery seeds three orders through the real core write paths, and eight
  new goldens pin the list, 120 in total in 15 scenes. 85 new catalogue keys per language, 577 in
  total.

### Notes

- Phase 6 continues: POS, calendar, settings and the remaining modules follow. Partial receipts in
  the UI, order PDF/email and supplier master data inside the module are still open.

## [0.13.0] - 2026-11-08

### Added

- Accounting screen (`socdof_ui::accounting`): journal with period tabs, text search, create/edit/delete
  form, cash book with a running balance, BWA per account and a CSV export copied to the clipboard.
  All four languages, keyboard reachable, Escape paths and drawing from the tokens only.
- Core accounting aggregate (`socdof_core::domain::accounting`): validated journal entries with net,
  tax and gross amounts, a pure `summarize` for the BWA, `cash_book` with the running balance and
  `export_csv` with RFC 4180 quoting. Schema v5 adds the `journal_entries` table.
- `Store` accessors for the journal: insert, find, list, period range, search, update, delete and
  count, with a core test covering the round trip.
- The dashboard's accounting quick action opens the journal.
- An Accounting card in the gallery seeds four entries through the real core write paths, and eight
  new goldens pin the journal, 112 in total. 83 new catalogue keys per language, 492 in total.

### Notes

- Phase 6 continues: purchases, POS, calendar, settings and the remaining modules follow. Account
  plans, DATEV export and print are still open in the accounting module.

## [0.12.0] - 2026-11-08

### Added

- Invoices screen (`socdof_ui::invoices`): searchable list using the core invoice search, detail view
  with positions and per-line net/tax/gross plus document totals, create/edit/delete form with domain
  validation, lifecycle actions and success/error badges. All four languages, keyboard reachable,
  Escape paths and drawing from the tokens only.
- The core store gained `update_invoice`, `delete_invoice` and `set_invoice_status`; updates replace
  the header and all positions in one transaction, and the screen never writes a partial document.
- The dashboard's new-invoice quick action opens the invoice form.
- An Invoices card in the gallery seeds three invoices through the real core write paths, and eight
  new goldens pin the list, 104 in total. 77 new catalogue keys per language, 409 in total.

### Notes

- Phase 6 continues: accounting, purchases, POS, calendar, settings and the remaining modules follow.
  DIN 5008 print, templates, dunning, the email draft and the payment modal are still open in the
  invoices module.

## [0.11.0] - 2026-11-08

### Added

- Products screen (`socdof_ui::products`): searchable list using the core product search, detail view,
  create/edit/delete form with domain validation, low-stock badges, delete confirmation and
  success/error badges. All four languages, keyboard reachable, Escape paths and drawing from the
  tokens only.
- The detail view books stock through `Store::adjust_stock`; the movement history and the new level
  are written in one transaction, and the form never edits the stock level directly. Outgoing
  bookings above the available stock surface the core rejection as an error instead of writing.
- The screen writes through `Store::insert_product`, `update_product` and `delete_product`;
  validation codes from the domain are mapped to catalogue keys, so invalid input never reaches the
  database.
- The dashboard's new-product quick action opens the products form.
- A Products card in the gallery seeds two products and books their stock through the real core
  write paths, and eight new goldens pin the catalogue, 96 in total. 69 new catalogue keys per
  language, 332 in total.

### Notes

- Phase 6 continues: invoices, accounting, purchases, POS, calendar, settings and the remaining
  modules follow. Product labels and smart reorder are still open in the products module.

## [0.10.0] - 2026-11-08

### Added

- Contacts screen (`socdof_ui::contacts`): searchable list using the core FTS search, detail view,
  create/edit form with domain validation, delete confirmation and success/error badges. All four
  languages, keyboard reachable and drawn from the tokens.
- The screen writes through `Store::insert_contact`, `update_contact` and `delete_contact`;
  validation codes from the domain are mapped to catalogue keys, so invalid input never reaches the
  database.
- The dashboard's new-contact quick action opens the contacts form; the remaining quick actions
  still report to the host.
- A Contacts card in the gallery seeds three contacts in an in-memory store, and eight new goldens
  pin the list, 88 in total. 50 new catalogue keys per language, 263 in total.

### Notes

- Phase 6 continues: contacts and products keep their core modules; products, invoices, accounting,
  purchases, POS, calendar, settings and the remaining modules follow. Sub-contacts and country
  autocomplete are still open in the contacts module.

## [0.9.0] - 2026-11-08

### Added

- Dashboard module (`socdof_ui::dashboard`): period tabs (all, month, quarter, year), eight KPI
  cards, quick actions, the five newest invoices with contact and status, the reorder list and an
  empty state, drawn from the tokens, keyboard reachable and translated into all four languages.
- Core aggregates (`socdof_core::store::dashboard`): counts for contacts, products and low stock,
  inventory value at cost and retail, upcoming appointments and invoice overview rows with contact
  names. Period totals come from one pure `summarize` function shared by the screen and the store.
- `date::civil_from_millis`, `date::days_from_civil` and `date::start_of_month_ms` for calendar
  ranges, used by the dashboard periods.
- 54 new catalogue keys per language (213 total) and eight new goldens for the dashboard scene in
  both appearances and all four languages, 80 in total.
- A Dashboard card in the gallery opens the screen. Its deterministic sample data is only used by
  the gallery and the snapshots; real screens are loaded from the core aggregates.

### Notes

- Phase 6 has started: the dashboard is complete, contacts and products keep their core modules and
  their screens follow next. Quick actions report the chosen action to the host; wiring them to the
  module screens belongs to those modules.

## [0.8.0] - 2026-11-07

### Added

- Start menu (`socdof_ui::shell::StartMenu`) as a testable model with search over app labels and
  slugs, arrow-key navigation that wraps, Escape to close and app launch that closes the menu; it
  opens from a taskbar button, renders from the tokens and traps the focus like every dialog.
- Command palette: Ctrl+K, fuzzy ranking (prefix over substring over subsequence) over seven
  commands, arrows plus Enter to execute, Escape to abort, and every label from the catalogue.
- Widgets layer with a clock/date card and a battery/connection status card, drawn below the
  windows so the z-order is untouched.
- Four-page onboarding with back, next and skip, Escape to finish, a persisted "seen" flag in the
  gallery host and a gallery button to replay it.
- Tray flyout from the taskbar with four quick actions, keyboard focus and close on Escape or an
  outside click.
- Two real PNG wallpapers (`wallpaper-aurora.png`, `wallpaper-dusk.png`) embedded with
  `include_bytes!`, decoded with `png` and painted losslessly as cover or tiled, with a switch that
  keeps its choice across language and theme changes.
- Three new glyphs (grid, battery, Wi-Fi), 28 in total, and 35 new catalogue keys per language
  (159 total) for the new surfaces.
- Twelve new goldens: start menu, palette, tray, onboarding and the tiled dusk wallpaper in both
  appearances and all four languages, 72 in total.

### Notes

- Phase 5 is complete for the desktop shell scope: window manager, chrome, taskbar, start menu,
  palette, widgets, tray, onboarding and real wallpapers. Login and lock screen are not implemented;
  the start menu's power flyout and user switcher and the calculator/notes widgets remain tracked in
  `RUST_MIGRATION.md`. Window state and the onboarding seen flag live in the host, not in a database.

## [0.7.0] - 2026-11-07

### Added

- Desktop shell (`socdof_ui::desktop`): wallpaper-tinted canvas, icon grid in reading order with
  drag and drop, persisted cell positions and arrow-key navigation, plus a taskbar with pinned
  apps, running indicators and a clock.
- Window manager as plain data: z-order, focus, move, resize with a minimum size, snap to the left
  or right half, maximize with restore rectangle and minimize with focus hand-off. Everything is
  unit tested without a display.
- Window chrome drawn from the tokens: minimize, maximize/restore and close on every window, a
  confirmation dialog before closing and a 3 s close cooldown, so reopening a just closed app asks
  again. A confirmation dialog traps the keyboard focus; Escape returns to the gallery.
- Three new Rust glyphs (minimize, maximize, restore), 25 in total.
- Desktop golden snapshots in both appearances and all four languages, so the shell is pinned along
  with the primitives: 32 goldens in total. The gallery has a desktop card that opens the shell.

### Notes

- Phase 5 is in progress: the start menu, the widgets layer, the command palette and the onboarding
  wizard are still open. The Phase 4 primitives remain unchanged and their goldens still match.

## [0.6.0] - 2026-11-07

### Added

- Keyboard focus system for the whole kit: controls register in reading order, Tab and Shift+Tab
  move and wrap, a click focuses, and overlays (dropdown, menu, drawer) trap the focus and hand it
  back to their trigger on Escape.
- Keyboard semantics per control: Enter/Space activate buttons, checkboxes and switches; arrows,
  Home and End navigate dropdowns, menus and the calendar; PageUp/PageDown change the month; text
  fields take cursor, Backspace, Home and End; Tab never leaves an open overlay.
- Focus rings, hover and pressed states drawn from the accent tokens instead of egui defaults, plus
  accessible labels and roles (button, checkbox, combo box, text edit, selectable entry) on every
  interactive element.
- Deterministic visual regression: `snapshot` reduces a frame's paint commands to stable text and 24
  golden files pin every primitive in both appearances, all four languages and the idle, focused
  and drawer scenes. Refresh them with
  `UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual` after an intended change.
- Ten keyboard tests drive the real widgets with synthetic egui input: Tab order and wrap-around,
  Enter activation, Space toggles, dropdown commit, Escape handling, menu navigation, typing and
  Backspace, calendar keys, drawer focus restore and pointer focus.
- UI catalogue grown to 104 keys per language (previous/next month labels).

### Notes

- Phase 4 of the migration is complete: the Rust UI foundation is keyboard accessible, visually
  pinned and runs in its own window. The remaining work is the module screens and the removal of
  the Vite/TypeScript frontend.

## [0.5.0] - 2026-11-07

### Added

- Remaining controls of the Rust UI: select, checkbox, switch, labelled text field with error
  message, month calendar with own civil-date math, menu, right side drawer and a file drop area.
  All of them are drawn from the design tokens in both appearances.
- Icon set: 22 vector glyphs (search, add, edit, delete, close, chevrons, check, upload, calendar,
  more, filter, settings, bell, user, folder, refresh, sun, moon, info, warning) painted by Rust,
  replacing `lucide-react` without shipping image assets.
- Form framework with required, maximum-length and email validation, dirty tracking against a saved
  baseline, per-field error messages and an unsaved-changes guard that asks before discarding edits.
- `socdof-ui-gallery` window host: the gallery now runs as a real eframe window
  (`cargo run -p socdof-ui --features window --bin socdof-ui-gallery`). The feature is off by
  default, so tests and clippy need no desktop libraries.
- Language and theme switches in the gallery header; switching the language relabels the form while
  keeping its values and errors.
- UI catalogue grown to 102 keys per language, including month and weekday names for the calendar.

### Notes

- The UI path is now proven end to end on the desktop: window, theme, controls, icons, forms and
  translations are all Rust. The Vite/TypeScript frontend stays until the module screens reach
  parity, as described in [`docs/ui-decision.md`](docs/ui-decision.md).

## [0.4.0] - 2026-11-07

### Added

- Rust UI foundation on **egui**: the interface no longer needs a webview, a WASM bundle, npm or
  any TypeScript. The decision, the rejected alternatives (Leptos, Dioxus, Slint) and the ordered
  removal of the temporary Vite frontend are recorded in [`docs/ui-decision.md`](docs/ui-decision.md).
- Design tokens ported from the legacy stylesheet: surface and text palette for light and dark,
  spacing, radii, typography, the nine accent presets and the companion-color hue rules used by
  charts.
- Theme engine that resolves light, dark and system mode, applies the palette and accent before the
  first frame and keeps the legacy accent shades for hover, borders and dark-mode text.
- Component kit: buttons in four weights, cards, status badges, segmented tabs, search field,
  sortable table header with sort state, modal dialog, toasts with time-based retention and an
  empty state. All controls are drawn from the tokens, not from framework defaults.
- Component gallery in German, English, French and Spanish, covering both appearances and the nine
  accents, with a headless test that renders every language and appearance through
  `egui::Context::run`.
- Four-language UI catalogue checked against a fixed key list, so a missing label fails the build
  instead of rendering a blank spot.

### Notes

- egui 0.27 is the newest release compatible with the workspace MSRV of 1.75; raising the MSRV is
  a separate decision.
- The Vite/TypeScript frontend of the Tauri shell stays until the Rust screens reach parity and is
  then deleted together with the npm steps in CI. The legacy application remains unchanged in
  `SOCDOF - TS`.

## [0.3.0] - 2026-11-07

### Added

- Settings service with a validated company profile and per-user preferences (language, theme,
  accent, sidebar, start module). Preferences inherit the company defaults until the user changes
  them, and the backup interval/retention from the legacy profile are now stored as well.
- Translation loader for German, English, French and Spanish. The core catalogue is compiled into
  the binary, external language packs are merged on top, and `socdof-cli i18n` reports key coverage
  while `i18n-pack` validates a pack (missing and unknown keys).
- Autosave snapshots that are written atomically and pruned by count, plus a stateless backup
  scheduler that derives both the due check and the retention from the newest archive in the target
  folder.
- Local logging without telemetry: rotating JSON lines and a crash report file, including a panic
  hook that writes the report next to the log.
- CSV import and export for contacts and products. The parser handles RFC 4180 quoting, embedded
  newlines and comma/semicolon/tab exports; headers are recognised in German, English, French and
  Spanish, product rows deduplicate by SKU, and invalid rows are reported instead of guessed.

### Preview scope

Still a migration milestone. The services are available through the Rust core and the CLI; the
settings, backup and import screens follow with the module screens in Phase 6 of
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). The legacy application remains unchanged in `SOCDOF - TS`.

## [0.2.0] - 2026-11-07

### Added

- Complete data layer for the remaining modules: purchase orders with goods receipt, POS
  receipts, billable items (collect several on one invoice), appointments, support tickets with
  time tracking, desktop widgets and reports. All of them mirror the legacy fields and use integer
  cents for money.
- Sign-in on the core: Argon2id passwords, session tokens that are stored only as hashes, expire
  after twelve hours and can be revoked individually or everywhere, plus a five-attempt lockout
  that lasts five minutes.
- Roles with a per-module permission matrix. The built-in administrator has full access, the
  built-in user role covers day-to-day work without settings and user management, and custom roles
  can grant each module separately.
- Full-text search with FTS5 for contacts, products and invoices. The indices follow every write
  through triggers, existing databases are backfilled, and a substring fallback keeps the previous
  search behaviour.
- Multi-entity writes are atomic: an invoice, a POS sale and a goods receipt book their positions,
  stock movements and status in a single transaction, and insufficient stock rolls the document
  back.

### Preview scope

Still a migration milestone. The new aggregates are available through the Rust core and its tests;
module screens for purchases, POS, calendar, support and reports follow in Phase 6 of
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). The legacy application remains unchanged in `SOCDOF - TS`.

## [0.1.0] - 2026-11-07

### Added

- Contacts and products are now first-class modules in the Rust desktop app:
  create, edit, delete and search them from the new master-data navigation.
  The forms cover the legacy fields (contact type, company/person, address,
  tax id, notes; SKU, category, unit, prices, tax rate, stock levels, barcode,
  emoji and reorder exclusion commit) in German, English, French and Spanish.
- Legacy backup compatibility: the Rust app imports and exports the legacy
  `.socdof.json` document, keeps unknown tables and unknown row fields, and
  passes a round-trip test against a real backup created by the legacy
  `exportDatabaseToJson` function. The exported file was also read back with
  the legacy `importDatabaseFromJson` function without losing tables.
- The GUI smoke now creates, updates and searches a contact and a product,
  verifies both screens rendered the data, and reports the counts, name and
  SKU to CI. Command-layer tests cover contact/product CRUD, search, deletion
  and legacy import/export.
- Native Rust core with SQLite schema v3, integer-cent money handling, contacts,
  products, stock movements, invoices, users, company settings, backups,
  instance locking and DIN 5008 invoice PDFs.
- Tauri 2 desktop foundation with real contacts/products/database/backup
  screens, German, English, French and Spanish texts, light/dark system theme
  support and a command layer that delegates to the shared Rust core.
- Signed Tauri updater integration for release builds. Linux AppImage, Windows
  NSIS and macOS app bundles can check the GitHub release endpoint and install
  signed updates; the app then restarts through the process plugin.
- CI packaging for Linux (AppImage, `.deb`), Windows (portable ZIP, NSIS, MSI)
  and macOS (universal DMG), plus a real WebView/command smoke test under Xvfb.
- Changelog-driven release notes, GitHub Releases with checksums, a generated
  `latest.json` updater manifest and a Discord release announcement using the
  existing bot/thread secrets.

### Preview scope

This release is still a migration milestone, not yet a 1:1 replacement for the
legacy Electron application. Contacts and products now have complete desktop
CRUD/search flows, and legacy JSON backups round-trip; invoices, purchases,
stock moves, POS, accounting, calendar and the remaining modules are tracked in
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). The legacy application remains
unchanged in `SOCDOF - TS`.
