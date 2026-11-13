# Changelog

All notable changes to SOCDOF are documented here. The release workflow reads
the section matching the pushed tag; a release fails if this file has no
matching, non-empty section.

The next release is **26.0.0 (v26)**. Its changelog body is below and stays marked unreleased until
the tag is cut. The workspace, Tauri and UI manifests are already aligned at `26.0.0`; the historical
`0.1.0`–`0.30.0` sections stay untouched and document everything before 26.

## [26.0.0] - unreleased

### Added

- Native Accounting business report: invoice/POS revenue and VAT, purchase input tax and expenses, operating result, 7%/19% VAT bases, open receivables and POS Z-report tender totals. The report refreshes on reopen, supports Today and custom date ranges, uses the company currency and saves the financial summary as CSV. A native tax-advisor export now creates a 12-sheet Excel-compatible workbook and selected-month CSV with monthly cash/bank totals, selectable years, editable persisted opening balances, carry-over balances and source transactions from recorded payments, POS, purchases, journal bookings and business mileage. Remaining parity checks are tracked in `docs/accounting-rust-parity.md`.


### Added

- Native Contacts workflow: batch creation with atomic multi-row persistence, CSV import with an editable preview and category assignment, Outlook/Google/Apple-style header recognition, vCard 2.1/3.0/4.0 import, and CSV/vCard export through native file dialogs. vCard parsing now handles grouped properties, URI telephone values, truncated final cards and malformed email rejection; export folds long UTF-8 lines safely. The import/export engine is in the Rust core with parser and round-trip tests; all new UI labels are translated in DE/EN/FR/ES.

### Fixed

- Projects KPI parity: native Rust counts only tasks attached to the listed projects, matching
  the TypeScript portfolio calculation. A regression test covers unrelated task records.
- Fleet deletion parity: deleting a vehicle preserves its historical logbook trips and fuel
  receipts, matching the TypeScript module. The persistence integration test now covers this.
- Restaurant VAT parity: native order totals now aggregate net amounts by tax rate before rounding,
  matching the TypeScript calculation. A cent-level regression test covers two small 7% lines.
- Restaurant invoice parity: the v16 SQLite migration stores an optional invoice VAT override, so
  the paid ERP invoice and POS ledger receipt retain the same grouped tax total after reload. Added a checkout
  integration test for the one-cent rounding case (invoice schema v16, POS schema v17).
- Therapy session parity: the native practice screen can now edit open sessions, persists the
  changes through the existing SQLite update path, and prevents edits to sessions already linked
  to an invoice. Added a regression test and DE/EN/FR/ES labels.
- Therapy date parity: open sessions can now update their session date and start time as well as
  duration, distance and notes. Invalid civil dates/times are rejected without overwriting the
  stored session; the new fields are translated in DE/EN/FR/ES.
- POS payment parity: NFC/mobile-wallet is now a distinct payment method, persists as `nfc`,
  appears in the checkout selector and contributes to its own daily-close total. Added DE/EN/FR/ES labels and storage/summary tests.


### Known issues

- Visual parity is **not fully accepted**. The final ten pairs (Dashboard, Invoices, Contacts,
  Settings, Command Palette × light/dark at 1440×900) reach 98.87/0.9491, 98.44/0.9310,
  98.76/0.9041, 98.33/0.8961, 98.85/0.9116, 98.38/0.8979, 95.92/0.7251, 95.42/0.7072,
  97.87/0.9011 and 97.88/0.8778 (window pixel / SSIM). Eight of ten pass the pixel target and five
  pass SSIM ≥0.90; Settings (both themes) and the dark palette remain open because of the TS outline
  icon set, WebKit text rendering and the Spotlight backdrop. See `RUST_MIGRATION.md` §15.7.
- The v26 tag is not cut yet; the TypeScript reference stays at `25.2.1`. See
  `RUST_MIGRATION.md` §2.1.

### Added

- Native Rust Restaurant app: floor plan for all 13 legacy tables, indoor/terrace/bar/takeaway filters, open table tickets, menu CRUD and availability, kitchen workflow, item quantities and kitchen notes, server assignment, cash/card/NFC checkout, tips, split totals, GoBD hospitality receipts, atomic invoice/POS posting, daily Z-report KPIs and paid-receipt CSV export. Added to the App Store and role permissions with DE/EN/FR/ES labels.
- Native Rust Fleet app: vehicle register, trip logbook, business/private/commute mileage, fuel and charging receipts, odometer updates, tax allowance metrics and GoBD-style CSV export. Registered in the App Store and role permissions with DE/EN/FR/ES translations.
- Native Rust Projects app: persistent project/customer linking, project/task CRUD, task status transitions, billable-hour calculations, project KPIs, CSV export and draft invoice generation through the shared invoice templates. Registered in the module catalogue and role permissions; translated in DE/EN/FR/ES.

- First persistent native egui desktop host: `socdof-ui-desktop` opens the real SQLite database,
  acquires the legacy-compatible single-instance lock, restores the saved language/theme/accent and
  enters the real first-run setup or local login flow. It does not insert gallery fixtures or demo
  credentials; the component gallery remains a separate development tool.

- FatturaPA XML import in the invoice screen: `fattura_import.ts` parses FatturaPA 1.2 documents
  (seller, buyer, document type, lines, VAT, due date, IBAN, CUP/CIG and bollo), reuses or creates
  the vendor contact and stores a draft invoice through the normal commands. Invalid XML reports a
  visible error instead of a static hint.
- Sequential contact creation: `+ Mehrere anlegen` opens the structured contact dialog in batch
  mode, saves each entry and immediately presents a fresh form until the dialog is closed.
- The Command Palette now follows the TS Spotlight module order and descriptions (including Lager and
  POS Kasse) and uses the TS 391/282 px settings quick-start columns and 96 px cards.
- v26 version alignment: Rust workspace, Tauri app, webview package and lock are at `26.0.0`; DOCX
  app properties read the crate version instead of a hard-coded string, and the 88 egui goldens were
  regenerated for the version pill.
- Visual-parity corrections in the Tauri webview: the TS window geometry (1140×750 at `100,15`,
  43 px title bar, 24 px content padding), the corrected dashboard header/KPI/quick-action/welcome
  spacing, the TS empty-state KPI labels and real POS aggregate, the exact SOCDOF logo and
  quick-action/KPI glyphs, and the computed typography (system stack for UI text, bundled JetBrains
  Mono for numeric values). All ten pairs were recaptured from the v26 binary; eight pass the pixel
  target and five pass SSIM, see `RUST_MIGRATION.md` §15.7.
- The Tauri webview now has the requested TS surfaces: contact detail dialog and customer picker,
  integer calculator with history, desktop widgets, command palette, TaskView with virtual desktops,
  a login gate and local user management, the four-language selection modal, a searchable
  documentation browser and a storage inspector backed by `storage_inspector`. New commands `users`,
  `save_user`, `delete_user`, `login_user` and `storage_inspector`; tests in
  `crates/app/tests/users_storage.rs`. The four language packs share 1,011 identical keys, guarded
  by `crates/app/tests/ui_assets.rs`.
- The Tauri webview now uses the TypeScript desktop shell: a shared `parity.css` token layer with
  light/dark surfaces and an indigo accent, the floating workspace window, icon rail and taskbar,
  the settings landing page, invoice banner, contact filters, empty states and a TS-style command
  palette. The theme toggle persists in `socdof.ui.theme`; `parity.css` is the single palette.
- Ten real screenshot pairs (Dashboard, Invoices, Contacts, Settings and Command Palette, each in
  light and dark at 1440×900) are in `docs/parity/`, recaptured from the v26 release binary with the
  current window crop `(100,15,1240,765)`. `parity_diff.py` records the per-pair pixel and SSIM
  scores in `diff.json`/`diff.csv`. Eight pairs meet the ≥98 pixel target, five meet SSIM ≥0.90.
- The Dashboard tab now renders live store data: period KPIs (revenue, open, overdue, contacts,
  products, low stock, inventory value), recent invoices with contact names and status badges, the
  reorder list and quick actions through the new `dashboard` command and
  `DesktopState::dashboard`. Tests in `crates/app/tests/dashboard.rs` cover the aggregates and
  period filtering.
- Settings now expose the display section: language, light/dark/system theme and accent colour are
  stored in `CompanyProfile`, applied immediately and restored on the next start. A language change
  persists in `localStorage` and reloads the webview so every module uses the new pack.
- Four language packs now carry 883 identical keys, including every dashboard, display-settings,
  backoffice, restore and AppStore label.
- Accounting, Purchases and Reports are now real Tauri webview modules: journal CRUD with BWA and
  cash-book totals plus CSV export (`journal_entries`, `journal_summary`, `journal_cash_book`,
  `save_journal_entry`, `delete_journal_entry`, `export_journal_csv`), purchase orders with supplier
  and product reference validation, lifecycle actions and goods receipt (`purchase_orders`,
  `save_purchase_order`, `set_purchase_order_status`, `receive_purchase_order`) and period reports
  over invoices and tracked time (`report`). The webview screens are reachable from the navigation.
- Settings gained archive verification and atomic restore (`verify_backup`, `restore_backup`) and
  the AppStore catalogue with persisted activation switches (`app_store_modules`,
  `app_store_set_active`). Tests `journal_entries_summarise_cash_book_and_reject_invalid_values`,
  `purchase_orders_validate_references_and_receive_stock`,
  `app_store_lists_and_persists_activation` and
  `verify_and_restore_replace_the_database_atomically` cover the new backend paths.
- The native Xvfb smoke now drives the rendered webview through the real navigation: it creates and
  lists an accounting entry and a purchase order, checks the report with the paid smoke invoice,
  toggles an AppStore module and verifies/restores the freshly created `.socdofbak` archive. The
  runner asserts the emitted `SOCDOF_SMOKE_UI` markers, so the rendered rows are part of the test
  output rather than a build-only claim.
- `backup_files` now lists the default `backups/` folder beside the database when the company
  profile has no explicit backup folder, matching where `create_backup` writes without a path.
- Desktop settings and Textwerk are now real webview flows: a Settings tab edits the company
  profile, chooses/lists/opens the backup folder and writes a backup through the native save dialog;
  a Textwerk tab lists, searches, creates, updates and deletes core documents with word/character
  counts. Tauri commands `company_profile`, `save_company_profile`, `backup_files`,
  `save_backup_to_disk`, `open_backup_folder`, `select_backup_folder`, `list_documents`,
  `save_document` and `delete_document`; tests
  `documents_roundtrip_update_search_and_delete` and
  `company_profile_and_backup_list_share_the_configured_folder`.
- Window chrome is reachable from the webview header: `window_minimize`,
  `window_toggle_maximize`, `window_toggle_fullscreen`, `window_is_fullscreen`,
  `window_set_fullscreen` and `window_is_maximized` cover the Electron window channels.
- The Calendar tab now has a Monday-first month grid, day agenda and appointment create/edit/delete
  through `appointments`, `save_appointment` and `delete_appointment`; the command layer rejects
  overlapping open slots. Test `appointments_roundtrip_in_range_and_reject_overlaps`.
- Textwerk-specific native dialogs (`textwerk_open_dialog`, `textwerk_save_dialog`) and four
  additional de/en/fr/es key sets bring each pack to 678 identical keys.
- External invoice-template, language-pack and flag folders are now real desktop flows instead of
  database-only templates: `crates/app/src/external_assets.rs` resolves the environment, portable and
  app-data locations, seeds the folders, lists and reads `.docx/.doc/.pdf/.json/.html/.htm`, validates
  and saves flat or nested language JSON, and turns flag images into data URLs. Tauri commands
  `list_external_templates`, `read_external_template`, `list_external_languages`,
  `list_available_flags`, `save_external_language`, `external_folder_path` and `open_external_folder`
  drive a three-column manager in the Templates tab, and external de/en/fr/es packs overlay the
  embedded texts. Tests `external_folders_seed_list_and_read_templates`,
  `external_languages_parse_flat_and_nested_packs_with_flags` and
  `external_assets_validate_open_folder_and_path_overrides`; smoke `external_templates count=1`,
  `external_languages count=1`, `external_flags count=1` and
  `external_template_read filename=smoke-template.html success=true bytes=22`.
- Native yes/no confirmations complete the dialog bridge: `DialogOutcome::Confirmed`/`Declined` and
  `resolve_confirm`, the Tauri `confirm_message` command using
  `MessageDialogButtons::YesNo`/`blocking_show`, and delete/storno actions in the webview now await
  the native answer instead of `window.confirm`. Test
  `a_confirmation_returns_yes_no_or_cancelled`; smoke `SOCDOF_DIALOG kind=confirm outcome=confirmed`
  and `outcome=cancelled`.
- The tray icon handles a completed left click through `on_tray_icon_event` and the same
  `tray::icon_click()`/`run_tray_command` path as the menu; test
  `a_left_click_on_the_icon_uses_the_show_command`. Linux status notifiers still cannot emit the
  pointer event in the Xvfb smoke.
- Restaurant receipts now print the active company name, street, postal code/city and tax id from
  the company profile instead of a fixed restaurant name; the overview bridge carries
  `RestaurantCompanyView`, with a unit test for both the configured profile and the default fallback.
- The restaurant now plays the TypeScript Web Audio feedback for clicks, successful saves, cash
  checkout and kitchen notifications (`crates/app/ui/src/sound.ts`), with the same muted/volume
  localStorage keys and a sound toggle in the restaurant header. All four webview packs now contain
  601 keys with identical sets, including the external-asset, sound, receipt-to-invoice, company-tax and hospitality labels.

- The TypeScript `RestaurantModule` is fully ported: menu management, 13-table floor plan, table
  orders, kitchen display, receipt archive, cash/card/NFC checkout, tips, split bills, GoBD
  hospitality receipts, Z-report, ERP invoice/POS checkout and CSV export. `crates/core/src/domain/restaurant.rs`
  holds the models, validation, cent/basis-point arithmetic, floor plan and default menu;
  `crates/core/src/store/restaurant.rs` and schema v15 persist menu, orders and positions, seed the
  eleven default dishes and book the paid order, POS receipt and invoice in one transaction.
  `crates/app/src/restaurant_bridge.rs` exposes camelCase views/inputs, KPIs and the receipt CSV;
  twelve Tauri commands drive the new Restaurant tab with four sub-tabs, all dialogs and filters.
  All 125 restaurant strings exist in de/en/fr/es (601 keys per pack including the later external-asset, sound, receipt-to-invoice, company-tax and hospitality labels). The end-to-end tests
  `restaurant_roundtrip_persists_calculates_and_checks_out` and
  `restaurant_rejects_invalid_dish_order_and_checkout_values` and
  `restaurant_receipt_number_considers_kept_pos_receipts` plus the core tests
  `validates_the_dish_and_order_fields` and `adds_merges_and_recalculates_table_orders` cover CRUD,
  persistence across a reopen, totals/tax/tip/change, checkout, CSV, validation and the shared
  invoice/POS receipt number space. The native smoke
  creates and edits a dish/order, lists it, checks persistence, exports, checks out and deletes it
  (`SOCDOF_SMOKE restaurant_dish_saved mode=created|updated`, `restaurant_order_saved mode=created`,
  `restaurant_order_updated`, `restaurant_order_status`, `restaurant_list`, `restaurant_persisted`,
  `restaurant_checkout`, `export_restaurant_csv rows=1`, `restaurant_order_deleted`,
  `restaurant_dish_deleted`, schema 15). `RUST_MIGRATION.md` marks RestaurantModule as done.
- The TypeScript `ProjectsModule` is fully ported: portfolio cards, a four-column Kanban board,
  projects and tasks with the same fields, filters, status transitions, KPI arithmetic, billing and
  CSV export. `crates/core/src/domain/project.rs` holds the models, validation, default `PRJ-YYYY-NN`
  codes, progress/revenue metrics and the BOM/`;` portfolio CSV; `crates/core/src/store/projects.rs`
  and schema v14 (`projects`, `project_tasks`) persist them, including cascade delete and quick task
  status moves. `crates/app/src/project_bridge.rs` exposes camelCase views/inputs and per-project
  progress, logged hours and billable value; nine Tauri commands drive the new Projects tab with KPI
  strip, search/status/category filters, project and task dialogs, CSV export and a real draft invoice
  from all billable task hours. All 75 new strings exist in de/en/fr/es (460 keys per pack). The
  end-to-end tests `projects_roundtrip_persist_bill_and_export` and
  `projects_reject_invalid_modal_fields` plus the core tests `computes_portfolio_metrics_and_csv` and
  `validates_the_modal_fields_and_normalizes_the_code` cover CRUD, persistence across a reopen,
  Kanban status moves, metrics, CSV, billing and validation. The native smoke creates, edits, lists,
  exports, bills and deletes a project with its task (`SOCDOF_SMOKE project_saved mode=created|updated`,
  `project_task_saved mode=created|updated`, `project_task_status`, `project_list`, `project_persisted`,
  `export_projects_csv rows=1`, `project_invoice`, `project_task_deleted`, `project_deleted`,
  `NATIVE_SMOKE_OK chosen=0 cancel=0`, schema 14). `RUST_MIGRATION.md` marks ProjectsModule as done
  and leaves only Restaurant and environment-bound work explicitly open.
- The TypeScript `FleetModule` is fully ported: vehicles, logbook trips and fuel receipts with the
  same fields, validation, 0.30 €/km allowance, metrics and logbook CSV. `crates/core/src/domain/fleet.rs`
  holds the models, normalisation, validation, distance/allowance calculations, metrics and the
  BOM/`;`-separated export; `crates/core/src/store/fleet.rs` and schema v13
  (`fleet_vehicles`, `fleet_trips`, `fleet_fuel`) persist them, and a trip insert raises the
  odometer in the same transaction. `crates/app/src/fleet_bridge.rs` exposes camelCase views and
  inputs; eight Tauri commands drive the new Fleet tab with KPI strip, vehicle/logbook/fuel lists,
  filters, create/edit/delete dialogs and CSV export. All 76 new strings exist in de/en/fr/es (385
  keys per pack). The end-to-end tests `fleet_roundtrip_persists_and_calculates` and
  `fleet_rejects_invalid_vehicle_trip_and_fuel` plus the core tests
  `computes_distance_price_metrics_and_csv` and
  `validates_the_modal_fields_and_normalizes_the_plate` cover CRUD, persistence across a reopen,
  odometer and fuel-price arithmetic, CSV and validation. The native smoke creates, edits, lists,
  exports and deletes a vehicle with trip and receipt (`SOCDOF_SMOKE fleet_vehicle_saved
  mode=created|updated`, `fleet_trip_saved`, `fleet_fuel_saved`, `fleet_list`, `export_fleet_csv`,
  `fleet_trip_deleted`, `fleet_fuel_deleted`, `fleet_vehicle_deleted`, `NATIVE_SMOKE_OK chosen=0
  cancel=0`, schema 13). `RUST_MIGRATION.md` marks FleetModule as done and leaves Projects and
  Restaurant explicitly open.
- The contact e-mail draft and FatturaPA 1.2 generation now exist in Rust. `crates/core/src/domain/mail.rs`
  builds the contact payload and the editable RFC 822 draft, exposed through `contact_mail_draft` and
  `export_contact_eml`; every contact card opens the recipient/subject/body dialog and saves a real
  `.eml`. `crates/core/src/domain/fattura.rs` generates the SdI XML with the standard file name,
  FPR12/FPA12, TD01/TD04/TD24, RF01/RF19, recipient code/PEC, stamp duty, CUP/CIG, per-rate summaries,
  payment codes and XML escaping; `invoice_fattura` and `export_invoice_fattura` expose it through an
  inspector with live XML. Both flows are translated in de/en/fr/es (308 keys per pack), covered by
  `contact_mail_and_fattura_are_generated` plus core tests, and proven in the native GUI smoke
  (`SOCDOF_SMOKE contact_mail|export_contact_eml|fattura|export_fattura`,
  `NATIVE_SMOKE_OK chosen=0 cancel=0`). `RUST_MIGRATION.md` marks both matrix entries as done and names
  the still-open Fleet/Projects/Restaurant modules, installer/bundling, real GPU, native dialogs with a
  real user choice and SdI transmission/signature.
- - The Tauri webview now covers the invoice dunning letter, the invoice e-mail draft and payment
  capture, which previously existed only in the core and the egui screens. New views and builders in
  `crates/app/src/invoice_bridge.rs` (`InvoiceDunningView`, `InvoiceMailView`, `InvoicePaymentView`,
  `dunning_view`, `mail_view`, `payment_view`), new `DesktopState` methods and the commands
  `invoice_dunning`, `invoice_mail_draft`, `invoice_payment`, `record_invoice_payment` and
  `export_invoice_eml`. The invoice cards open a dunning dialog (level, fee, deadline, live
  subject/body), a mail draft dialog and a payment dialog (transfer, cash with TSE signature, card);
  the EML export writes the real draft through the native save dialog. All 25 new strings exist in
  de/en/fr/es, and the GUI smoke proves mail, dunning, both EML exports and a payment that flips the
  invoice to `paid` (`SOCDOF_SMOKE invoice_dunning|invoice_mail|export_eml|record_payment`,
  `NATIVE_SMOKE_OK chosen=0 cancel=0`). The new end-to-end test
  `dunning_mail_and_payment_close_the_webview_gap` covers the overrides, claim arithmetic, EML
  headers, stored payment and rejected level/method names. `RUST_MIGRATION.md` now carries the
  TypeScript→Rust parity matrix with a status, evidence and reason for every screen group and every
  Electron IPC channel; it names the remaining gaps (webview breadth, installer/bundling, real GPU,
  native dialogs with a real user choice, tray click without a status-notifier host) instead of
  claiming full parity.
- - Invoice print templates (`invoice_template`): the validated template book is stored in the settings
  table with a classic DIN 5008 default plus four alternative layouts. The invoices screen can
  select, edit, duplicate, activate, delete and reset templates; the PDF dialog prints with the
  active template's title, introduction, footer placeholders, accent color, payment term and fold
  marks. Templates now carry a PNG, JPEG, GIF, WebP, BMP or ICO logo (path or persisted data URL,
  left/center/right), PDF or PNG stationery as the page background, editable HTML with the TypeScript placeholders and a live
  formatted preview, and per-template company details (address, contact, tax/VAT ID, bank and register)
  that override the global profile. A bounded HTML renderer turns the free template into one shared document model: headings,
  paragraphs, line breaks, lists, strong/em/underline, inline colours and sizes, tables, images and
  explicit page breaks. The egui preview, PDF and DOCX consume that same structure, so a positions
  table becomes real rows everywhere. The print dialog exports a real `.docx` through the existing
  Word writer, using the same template values. An end-to-end test writes
  `target/invoice-template-artifacts/rechnung.pdf` and `rechnung.docx` and verifies heading, table
  rows and footer; the PDF carries a PNG logo and a PDF stationery background. The DOCX writer now
  embeds both as real PNG parts (`word/media/logo.png`, `word/media/stationery.png`): a first-page
  header holds the logo and the stationery, a default header repeats the stationery alone, and
  `w:titlePg` plus `first`/`default` header references map them to the pages, so the logo no longer
  appears on every page. Drawings are anchored to the page and painted behind the content, image
  relationships live in each header part, and the stationery is cover-cropped to A4. Unreadable image
  sources add no media or header parts, keeping the package valid. Stationery text tokens
  (`stationeryTokens` with `tokenKey`, percentage position, optional width, CSS-pixel font size,
  weight, colour and alignment) are stored with the template and exported as positioned text
  overlays: the PDF draws them over the letterhead on the first page, the DOCX uses page-anchored
  borderless text tables in the first-page header. Missing letterheads or an empty token list draw
  nothing, out-of-range percentages clamp to the page, and unknown style values fall back to the
  TypeScript defaults. The template dialog now offers the same placement studio: a scaled A4
  canvas paints the stationery and every token with the export geometry, fields can be added from
  all token keys, selected, dragged or clicked into place, edited (position, width, size, weight,
  alignment, colour), deleted and filled with the seven TypeScript default fields, and the preview
  resolves the same values the exports use. Long token values now share one Helvetica line layout
  with the PDF and DOCX exports, including explicit line breaks and 1.4 line offsets. The editor and print dialog are translated in
  de/en/fr/es (1,709 keys per language). Logo and stationery files now load through a native desktop picker and drop zones on the
  template dialog, using the TypeScript filters and 2 MB logo limit. The chosen data URL is saved
  with the template, so preview, PDF and DOCX read the same file. SVG logos are rasterized with the pure-Rust `resvg` crate in
  native builds, so the same data URL reaches the dialog thumbnail, PDF and DOCX. Malformed SVGs
  stay accepted like the TypeScript file input and are omitted from the artifacts without aborting
  the export. The shared raster decoder reads PNG, JPEG, GIF, WebP, BMP and ICO. Vector-only PDF
  stationery now stays vectorial in the PDF export: the first page's paths, curves, rectangles,
  fills, strokes and device colours are copied with the TypeScript cover geometry, while text,
  image and pattern operators are skipped. Image-based PDFs keep the existing largest-raster
  extraction; preview and DOCX still need a raster stationery source. Flex and grid containers in a custom template now share one
  layout plan between preview, PDF and DOCX: `display:flex` honours the direction, row-axis
  `flex-wrap`/`wrap-reverse` with row gaps, `justify-content`, `align-items`, `flex`/`flex-basis`/
  `flex-grow`, fixed and percentage widths, padding, item margins and nesting; `display:grid`
  honours `repeat()`/`fr`/px/percentage/`auto` tracks and explicit `grid-template-rows` with
  `auto`/`fr`/px/percentage heights, `grid-auto-rows` and row gaps. Block margins collapse to the
  larger adjacent value, flex and grid item margins do not collapse, and an explicit zero removes
  the implicit paragraph gap. The DOCX export writes the planned columns as borderless fixed-width
  tables with row-height hints and explicit margins as spacer paragraphs; the PDF draws the same
  slots, and missing declarations keep the CSS defaults while empty containers render nothing.
- The Tauri webview now edits and prints the invoice template book through the same validated core
  path as the egui screens. `crates/app/src/template_bridge.rs` translates between the core model
  and the exact TypeScript field format (`presetType`, `isDefault`, `logoUrl`, the flat `company*`
  fields, `primaryColor`, `fontFamily`, `headerTitle`, `headerText`, `footerText`, `taxNote`,
  `dueDays`, `useCustomLayout`, `customBodyTemplate`, `showFoldMarks`, `stationeryMode`,
  `stationeryPdfUrl`, `stationeryImageUrl`, `stationeryTokens`, `createdAt`), maps
  `companyAddress` to the template street and follows the TypeScript
  `stationeryImageUrl || stationeryPdfUrl` precedence. Missing fields take the TypeScript defaults,
  unknown or core-only field names are rejected instead of being ignored, and a book without
  templates fails validation instead of silently replacing the stored one. The core template gained
  `presetType`, `fontFamily`, `createdAt` and `isDefault` (all optional in the stored JSON, so
  existing books load unchanged); `fontFamily` selects the TypeScript sans, serif or mono stack of
  the built-in HTML layout. The new commands `invoice_templates`, `save_invoice_templates`,
  `template_token_keys` and `template_default_stationery_tokens` expose the bridge, and the webview
  has a Templates tab with a form for every field, logo and letterhead inputs with the TypeScript
  filters and 2 MB logo limit, template list actions (edit, activate, duplicate, delete) and the
  stationery token editor with all 34 keys and the seven default fields, translated in de/en/fr/es.
  Tests cover a full TypeScript payload in both directions, the round trip of every field, defaults
  for missing fields, rejection of unknown fields, storage through `DesktopState`, and the effect of
  the values in the HTML, the DIN 5008 PDF and the DOCX package.

- The Tauri webview now runs the invoice workflow through the real commands. `crates/app/src/invoice_bridge.rs`
  maps a stored invoice to the TypeScript names (`number`, `contact_name`, `contact_company`, `date`,
  `due_date`, `payment_terms`, `currency_symbol`, `notes`, `items`) with every amount in integer cents,
  validates the editor input (ISO dates, due date, customer, positions, quantities and tax rates),
  accepts the TypeScript status `posted` as the stored `sent` state and rejects unknown fields instead
  of ignoring them. `DesktopState` and the new commands `list_invoices`, `invoice_detail`,
  `invoice_defaults`, `save_invoice`, `delete_invoice`, `set_invoice_status`, `invoice_preview` and
  `export_invoice` cover search over number, customer, note and positions, status filters, the next
  `YYYY-0001` number, template-aware previews and real PDF/DOCX exports with the chosen template.
  The webview has an Invoices tab with list actions, an editor for all fields including editable
  position rows with live net/tax/gross totals, a preview dialog with template switcher and an A4
  stationery/token canvas, and PDF/DOCX buttons that use the native save dialog; the strings are
  translated in de/en/fr/es. The GUI smoke run now creates, lists, details, changes, saves, previews,
  exports and marks an invoice paid through `invoke`. Four end-to-end tests cover the list/search,
  defaults, totals, updates, rejected input, template selection and the exported artifacts.
  Deviations: `posted` maps to `sent`, `payment_terms` is a day count, manual recipients, per-item
  discounts and the SdI/FatturaPA fields have no Rust model yet, the preview is a DOM plus stationery
  canvas (the authoritative output stays PDF/DOCX), and payment, dunning and e-mail remain egui-only.
  The Tauri v2 feature `custom-protocol` is now declared in `crates/app/src-tauri/Cargo.toml`; without
  it `generate_context!` produced a dev context, so a plain release build embedded no frontend and the
  webview fell back to the dev-server URL. The native GUI smoke run was executed in this environment
  (Xvfb plus a root-free GTK/WebKit sysroot) and exits with 0: it creates, lists and details the
  invoice, edits it through the real editor form, previews it and exports PDF and DOCX through the
  real `invoke` path.
  The native tray menu and the native file dialogs are part of the GUI smoke as well: the window
  enables them through `smoke_options`, invokes `pick_folder`, `pick_open_file`, `pick_save_file`,
  `show_message` and `smoke_tray_run`, and the runner proves the chosen and the cancelled dialog
  paths plus the tray show/backup/quit actions (`NATIVE_SMOKE_OK chosen=0 cancel=0`). Exiting through
  `app.exit` used to leave a fresh instance lock behind, so the next start failed with `lock_busy`;
  the lock is now released on `RunEvent::Exit`, and a lock whose local pid is gone counts as
  abandoned.

### Fixed

- Projects KPI parity: native Rust now counts only tasks attached to the listed projects, matching
  the TypeScript portfolio calculation. Added a regression test for unrelated task records.

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
- Persistent browser storage: the browser build serializes its SQLite image after every change and
  keeps it in IndexedDB (`Store::snapshot_bytes` / `Store::restore_snapshot`, `crates/web/src/storage.rs`).
  Accounts, roles, sessions and business data survive a reload, a hard reload and a new tab, and the
  setup form only appears when this browser has never stored a database. The loading hint and the
  storage warning add two catalogue keys, so the catalogue holds 1,430 keys per language.

### Fixed

- Pointer accuracy in the browser build: the host now keeps the canvas backing store in sync with
  its CSS box (`sync_canvas_size`). Without it egui painted in a stale point space and clicks landed
  beside the control under the cursor.

### Notes

- The browser database lives in IndexedDB. OPFS through `sqlite-wasm-vfs` is not usable here: its
  `FileSystemSyncAccessHandle` only exists in a dedicated worker, and the web host has none.
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
