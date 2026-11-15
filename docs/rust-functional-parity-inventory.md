# TypeScript-to-Rust functional parity inventory

> CI regressions, verified root causes, fixes and troubleshooting commands are tracked in [`rust-ci-knowledge-base.md`](rust-ci-knowledge-base.md). Update that file whenever a CI failure is fixed or a new failure is diagnosed.

**Snapshot:** 2026-11-13

**Audit update:** 2026-11-14 — Native desktop icon positions and window geometry are now persisted per account in a dedicated settings record. Icon positions are restored after login, snapped to a collision-free grid on drag/drop, bounded against malformed stored coordinates and removed with the account's preferences. Window position, normal size and maximized state are restored on launch and clamped to the current work area; regression tests cover per-user isolation, sanitization, cleanup and geometry restoration. The native Windows NSIS installer now supports in-place executable replacement, an opt-in sign-in startup shortcut and data-preserving uninstall; release documentation reflects the separate AppData database. App Store programmatic toggles now initialize the catalogue before applying changes. The embedded locale key registry and committed inventory now include the therapy mileage and project validation labels.  Fleet logbook exports now reuse the exact active vehicle/purpose/date/search filters; Projects task status/delete actions resolve the owning project in the all-projects view; Restaurant paid-receipt history is read-only to match the TypeScript archive, and NFC restaurant checkout now preserves `nfc` in the POS ledger. Regression tests were added for each fix. Therapy mileage now has schema v18 persistence, Store/Desktop/Tauri CRUD, tax-advisor ledger inclusion and a native translated egui editor with search, totals and per-trip rates; detailed legacy parity checks remain open. 2026-11-13 — POS receipt VAT totals now persist through schema v17; Therapy now supports editing unbilled sessions (date, start time, duration, distance and notes) and protects invoice-linked history. Projects, Fleet, Restaurant and Therapy have focused parity findings recorded below; the full workspace gate remains open.  
**Reference branch:** `feature/rust-native-desktop-host`  
**Reference application:** `SOCDOF - TS/`  
**Rust implementation:** `crates/`

## Purpose

This inventory establishes the source-file baseline before further ports. It is a discovery index, **not** a claim that a Rust file with a similar name is functionally equivalent. Each workflow must still be checked against the TypeScript behavior, persistence rules, permission checks, validation, error handling, exports/imports and edge cases.

The snapshot contains **126 TypeScript/JavaScript source files** under `SOCDOF - TS/src/`. It deliberately includes UI components, supporting libraries, types and entry points; parity work must not be limited to the visible app screens.

## Inventory by source area

| Source area | Files |
|---|---:|
| Root entry points and shared types | 4 |
| `components/apps` | 12 |
| `components/auth` | 7 |
| `components/contacts` | 5 |
| `components/documents` | 6 |
| `components/sales` | 17 |
| `components/shell` | 18 |
| `components/support` | 6 |
| `components/therapy` | 14 |
| `components/ui` | 3 |
| `lib` (shared services and utilities) | 34 |
| **Total** | **126** |

The current Rust tree contains 183 `.rs` source/test files under `crates/`. This count is only a size indicator: it includes domain, persistence, bridge, UI, CLI, web and test code, and must not be interpreted as 183 completed ports.

## Rust coverage map (candidate modules only)

| TypeScript area | Rust candidates to audit | Audit status |
|---|---|---|
| `components/apps/FleetModule.tsx` | `crates/ui/src/fleet.rs`, `crates/app/src/fleet_bridge.rs`, `crates/core/src/domain/fleet.rs`, `crates/core/src/store/fleet.rs` | Port exists; behavior-by-behavior audit required |
| `components/support/ProjectsModule.tsx` | `crates/ui/src/projects.rs`, `crates/app/src/project_bridge.rs`, `crates/core/src/domain/project.rs`, `crates/core/src/store/projects.rs` | Port exists; behavior-by-behavior audit required |
| `components/sales/RestaurantModule.tsx` | `crates/ui/src/restaurant.rs`, `crates/app/src/restaurant_bridge.rs`, `crates/core/src/domain/restaurant.rs`, `crates/core/src/store/restaurant.rs` | Port exists; behavior-by-behavior audit required |
| `components/sales/InvoicesModule.tsx`, `InvoiceTemplateModal.tsx`, `InvoicePrintModal.tsx` | `crates/ui/src/invoices.rs`, `invoice_templates.rs`, `invoice_tokens.rs`; `crates/app/src/invoice_bridge.rs`; `crates/core/src/store/invoices.rs`, `invoice_template.rs`, `pdf/` | Existing Rust surface; full parity audit required |
| `components/therapy/*` | `crates/ui/src/therapie.rs`, `crates/core/src/domain/therapy.rs`, `crates/core/src/store/therapy.rs` | Session create/edit/delete, date/time editing and invoice-link protections covered; schema v18 now persists standalone mileage trips with per-trip rates and CRUD APIs; native egui mileage UI, TypeScript rate/preset parity and end-to-end acceptance remain open |
| `components/contacts/*` | `crates/ui/src/contacts.rs`, `crates/core/src/domain/contact.rs`, `crates/core/src/store/contacts.rs` | Existing Rust surface; full parity audit required |
| `components/sales/*` | `crates/ui/src/accounting.rs`, `pos.rs`, `products.rs`, `purchases.rs`; matching core domains/stores | Product CRUD, stock in/out, labels and reorder are present; exact tax-rate parsing and stock overflow handling are covered. The standalone TypeScript `StockMovesModule` double-entry journal (source/destination locations, reference, location filters, CSV/print) is not yet represented as a native Rust screen; treat as an open parity gap |
| `components/documents/*` | `crates/core/src/domain/document.rs`, `crates/core/src/store/documents.rs`, `crates/core/src/docx/`, `crates/core/src/pdf/` | Backend candidates exist; native UI parity unverified |
| `components/shell/*` | `crates/ui/src/shell.rs`, `desktop.rs`, `dashboard.rs`, `calendar.rs`, `widgets.rs`, `wallpaper.rs`, `studio.rs` | Native shell, taskbar, window manager, per-user icon/window persistence and global F11/Ctrl+K/Ctrl+L/Escape shortcuts are implemented. Independent native windows now render Contacts, Projects, Fleet, Restaurant, Invoices, Accounting, POS, Therapy, Users and Settings; the remaining launcher modules still need dedicated window adapters and side-by-side acceptance. OS tray/startup integration and full workflow parity remain open |
| `src/lib/*` | `crates/core/src/*`, `crates/app/src/*`, `crates/ui/src/*` | Cross-cutting; map every exported function and side effect |

## Full TypeScript source inventory

- `src/App.tsx`
- `src/components/apps/AppStoreModule.tsx`
- `src/components/apps/CalculatorModule.tsx`
- `src/components/apps/CalendarModule.tsx`
- `src/components/apps/CustomDownloadModal.tsx`
- `src/components/apps/DiscordEmbedPreview.tsx`
- `src/components/apps/DiscordFeedbackApp.tsx`
- `src/components/apps/DiscordFeedbackModal.tsx`
- `src/components/apps/DiscordThreadInspectorModal.tsx`
- `src/components/apps/DisplaySettingsSection.tsx`
- `src/components/apps/FleetModule.tsx`
- `src/components/apps/MobileCompanionImportModal.tsx`
- `src/components/apps/SettingsModule.tsx`
- `src/components/auth/AccountScopedWorkspace.tsx`
- `src/components/auth/AuthGate.tsx`
- `src/components/auth/BackupSetupModal.tsx`
- `src/components/auth/LanguageSelectionModal.tsx`
- `src/components/auth/UpdatePromptModal.tsx`
- `src/components/auth/UpdatingSplashModal.tsx`
- `src/components/auth/UserManagementSettings.tsx`
- `src/components/contacts/ContactDetailModal.tsx`
- `src/components/contacts/ContactEditModal.tsx`
- `src/components/contacts/ContactEmailDraftModal.tsx`
- `src/components/contacts/ContactsModule.tsx`
- `src/components/contacts/CustomerPickerModal.tsx`
- `src/components/documents/DocumentationApp.tsx`
- `src/components/documents/StorageAssetPreviewModal.tsx`
- `src/components/documents/StorageInspectorView.tsx`
- `src/components/documents/SupportDocumentViewerModal.tsx`
- `src/components/documents/TextwerkModule.tsx`
- `src/components/documents/WebPreviewModal.tsx`
- `src/components/sales/AccountingModule.tsx`
- `src/components/sales/DunningModal.tsx`
- `src/components/sales/FatturaPaInspectorModal.tsx`
- `src/components/sales/IOSBillingModule.tsx`
- `src/components/sales/InvoiceEmailModal.tsx`
- `src/components/sales/InvoicePrintModal.tsx`
- `src/components/sales/InvoiceTemplateModal.tsx`
- `src/components/sales/InvoicesModule.tsx`
- `src/components/sales/POSModule.tsx`
- `src/components/sales/PaymentModal.tsx`
- `src/components/sales/ProductLabelModal.tsx`
- `src/components/sales/ProductsModule.tsx`
- `src/components/sales/PurchasesModule.tsx`
- `src/components/sales/RestaurantModule.tsx`
- `src/components/sales/SmartReorderModal.tsx`
- `src/components/sales/StockMovesModule.tsx`
- `src/components/sales/TableModule.tsx`
- `src/components/shell/AppLauncher.tsx`
- `src/components/shell/AppLocationPickerModal.tsx`
- `src/components/shell/CommandPalette.tsx`
- `src/components/shell/CommandPaletteModal.tsx`
- `src/components/shell/Dashboard.tsx`
- `src/components/shell/DesktopCalculatorWidget.tsx`
- `src/components/shell/DesktopFolderModal.tsx`
- `src/components/shell/DesktopWidgetsLayer.tsx`
- `src/components/shell/DesktopWidgetsModal.tsx`
- `src/components/shell/DesktopWindowWorkspace.tsx`
- `src/components/shell/DynamicCalendarIcon.tsx`
- `src/components/shell/DynamicReportsIcon.tsx`
- `src/components/shell/Sidebar.tsx`
- `src/components/shell/StudioDrawer.tsx`
- `src/components/shell/TopBar.tsx`
- `src/components/shell/WidgetSettingsModal.tsx`
- `src/components/shell/WidgetsIcon.tsx`
- `src/components/shell/WidgetsModule.tsx`
- `src/components/support/ProjectsModule.tsx`
- `src/components/support/SupportServicesModule.tsx`
- `src/components/support/SupportTicketPrintModal.tsx`
- `src/components/support/SupportTimesheetModal.tsx`
- `src/components/support/SupportWorkItemModal.tsx`
- `src/components/support/TaskViewModal.tsx`
- `src/components/therapy/ConfirmDeleteModal.tsx`
- `src/components/therapy/TherapyAppointments.tsx`
- `src/components/therapy/TherapyBilling.tsx`
- `src/components/therapy/TherapyClientFilterModal.tsx`
- `src/components/therapy/TherapyClients.tsx`
- `src/components/therapy/TherapyDashboard.tsx`
- `src/components/therapy/TherapyInvoicePrintModal.tsx`
- `src/components/therapy/TherapyMileage.tsx`
- `src/components/therapy/TherapyPracticeModule.tsx`
- `src/components/therapy/TherapySessionModal.tsx`
- `src/components/therapy/TherapySessions.tsx`
- `src/components/therapy/TherapyTaxAdvisorLedgerModal.tsx`
- `src/components/therapy/therapyInvoiceSync.ts`
- `src/components/therapy/types.ts`
- `src/components/ui/ConfirmDeleteModal.tsx`
- `src/components/ui/FlagIcon.tsx`
- `src/components/ui/SocdofLogo.tsx`
- `src/lib/accent.ts`
- `src/lib/auth.ts`
- `src/lib/backupManager.ts`
- `src/lib/botghostTranslator.ts`
- `src/lib/contactImportExport.ts`
- `src/lib/countries.ts`
- `src/lib/db.ts`
- `src/lib/desktopDownloadStatus.ts`
- `src/lib/discordFeedback.ts`
- `src/lib/displayManager.ts`
- `src/lib/emlGenerator.ts`
- `src/lib/fatturaPaGenerator.ts`
- `src/lib/fatturaPaParser.ts`
- `src/lib/formatters.ts`
- `src/lib/googleCalendar.ts`
- `src/lib/i18n.ts`
- `src/lib/ical.ts`
- `src/lib/invoiceTemplateManager.ts`
- `src/lib/ledgerTemplates.ts`
- `src/lib/mobileCompanionTypes.ts`
- `src/lib/platform.ts`
- `src/lib/productLinkExtractor.ts`
- `src/lib/sdiReceiptParser.ts`
- `src/lib/sound.ts`
- `src/lib/spellcheck.ts`
- `src/lib/storageAssets.ts`
- `src/lib/storageInspector.ts`
- `src/lib/taxAdvisorLedgerManager.ts`
- `src/lib/therapyInvoiceTemplateManager.ts`
- `src/lib/updateChecker.ts`
- `src/lib/vcardGenerator.ts`
- `src/lib/version.ts`
- `src/lib/versionArchive.ts`
- `src/lib/windowsExeDownloader.ts`
- `src/main.tsx`
- `src/types.ts`
- `src/vite-env.d.ts`

## Audits completed so far (partial, not parity sign-off)

| Area | Comparison performed | Result | Still open |
|---|---|---|---|
| Projects | TS portfolio metrics, task actions and invoice handoff vs Rust domain/store/bridge/tests | Fixed task denominator to ignore orphan tasks; task status/delete now resolve the owning project in the all-projects view; regression tests cover both | Filters, task transitions, CSV formatting, invoice numbering and complete UI workflows |
| Fleet | TS vehicle/trip/fuel save/edit/delete, filters, metrics and CSV vs Rust | Confirmed filter scope and historical-record retention; native CSV now exports the active filtered trip set; tests cover vehicle deletion, combined filters and escaped multiline CSV | All form edge cases, invoice handoff, translation coverage and exact byte-for-byte CSV filename/format parity |
| Restaurant | TS tax grouping, order totals, paid receipt archive and invoice vs Rust domain/store/UI | Fixed VAT aggregation and added persisted invoice/POS VAT overrides (schemas v16–v17); cent-level checkout/reopen regression test added; paid receipt archive is now read-only like TypeScript; NFC checkout retains its distinct POS tender | Full order/kitchen workflow, checkout side effects, receipt rendering and export parity |
| POS | `POSModule.tsx` and accounting Z-report vs Rust POS domain/UI/store | Cash, card, bank transfer, invoice and other methods persist; NFC/mobile-wallet is now a separate `nfc` method with a translated checkout option and daily-summary regression coverage. Invoice capture rejects underpaid cash and unconfigured card terminals, and status/payment metadata commit atomically | Full receipt-printing parity and the accounting Z-report presentation still need side-by-side verification |
| Therapy | TS client/session billing and `TherapyMileage.tsx` vs Rust UI/domain/store | Client/session CRUD and unbilled session editing; schema v18 mileage persistence, per-trip rates, tax-ledger bank expenses, native mileage editor with create/edit/delete, optional client assignment, search, totals and DE/EN/FR/ES labels; regression tests cover custom-rate persistence and reimbursement | Kilometre input is now parsed exactly to thousandths and per-trip reimbursement rates to cents (no floating-point rounding or scientific notation); exact side-by-side parity for legacy date/default behavior, delete confirmation and invoice generation/print details remains open |
| Contacts | `ContactsModule.tsx` and `contactImportExport.ts` vs Rust contacts UI/domain/store | CRUD, company contact persons, search, atomic batch creation, CSV/vCard import preview, category assignment, native CSV/vCard export and DE/EN/FR/ES labels; vCard 2.1/3.0/4.0, grouped/folded properties, quoted-printable soft breaks and UTF-8/ISO-8859-1/Windows-1252 decoding are covered | Side-by-side audit remains for exact TypeScript filenames/MIME/output bytes, remaining header variants, malformed/large-file edge cases and cross-platform file-dialog behavior; see `docs/contacts-rust-parity.md` |
| Accounting | `AccountingModule.tsx` vs Rust journal/accounting UI and invoice/POS/purchase stores | Native journal, cash book and journal CSV plus a cross-module business report (invoice/POS/purchase totals, 7%/19% VAT, open receivables and POS Z-report) are implemented; Today/custom date filters, company-currency formatting and the monthly tax-advisor workbook/CSV are now present and covered by aggregate/store tests | Tax-rate input now parses exactly to integer basis points; local-timezone boundaries, exact CSV/Excel parity, partial-payment edge cases and side-by-side UI acceptance remain open; see `docs/accounting-rust-parity.md` |

These are focused findings, not full module acceptance. Keep each row open until the remaining behaviors are audited and the workspace CI passes.

## Required audit record per workflow

For each module and supporting service, record:

1. TypeScript source file(s) and exported actions/hooks.
2. Rust UI action and app/command bridge.
3. Core domain operation and SQLite store method.
4. Permission gate and account/workspace scope.
5. Validation, defaults, rounding and date/time semantics.
6. Persistence/reload behavior and transaction boundaries.
7. Import/export formats and backward compatibility.
8. Failure paths, empty states and destructive-action confirmation.
9. DE/EN/FR/ES translation coverage.
10. Rust unit/integration tests and the equivalent TypeScript acceptance scenario.

A candidate mapping is not marked complete until all applicable items above are evidenced by tests. UI visual parity remains a later, separate gate.



### Native shell shortcut coverage (2026-11-15)

The native egui desktop host now consumes the documented global shortcuts at the application shell:
- `F11` toggles the native window between windowed and fullscreen.
- `Ctrl+K` opens the command palette from any active module.
- `Ctrl+L` locks the current session, closes module windows and returns to authentication without revoking the session.
- `Escape` dismisses the active shell overlays.

The Tauri compatibility shell retains its existing shortcut bridge. This native implementation is separate so the Rust host does not depend on the legacy webview event layer. OS-level tray/startup integration and multi-window module acceptance remain open.



## Native shell keyboard regression tests

The application-wide egui handler has direct headless tests for:
- Ctrl+K opening the command palette while closing competing shell overlays.
- Ctrl+L closing open module windows, returning to the locked authentication view and preserving the active session identifier.
- Escape dismissing the palette without signing out.
- Ctrl+K and Ctrl+L having no effect while first-run authentication is visible.

The F11 action is emitted as a viewport fullscreen command and remains covered by the platform GUI smoke path.



## Native module windows: Projects, Fleet and Restaurant (2026-11-15)

- Refactored the Projects, Fleet and Restaurant screens into reusable window-content renderers plus full-work-area wrappers. The existing standalone screens retain their original background, padding and scrolling behavior.
- Added active-window-aware Escape handling so a key event from another module window cannot cancel or navigate the wrong module's draft.
- Registered all three content renderers in the native desktop's multi-window dispatcher. Their independent state objects, store refresh, CRUD forms, exports, checkout and module-specific dialogs remain attached to their own windows.
- Extended the headless native-window regression to open and render seven concurrent modules, asserting the actual Projects, Fleet and Restaurant titles are present in the rendered output.
- Remaining desktop-window adapters include Dashboard, Products, Purchases, Calendar, Editor, App Store, Support and Reports. This change does not claim all modules are complete.
