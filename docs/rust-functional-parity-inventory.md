# TypeScript-to-Rust functional parity inventory

**Snapshot:** 2026-11-13

**Audit update:** 2026-11-13 — POS receipt VAT totals now persist through schema v17; Therapy now supports editing unbilled sessions (date, start time, duration, distance and notes) and protects invoice-linked history. Projects, Fleet, Restaurant and Therapy have focused parity findings recorded below; the full workspace gate remains open.  
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
| `components/therapy/*` | `crates/ui/src/therapie.rs`, `crates/core/src/domain/therapy.rs`, `crates/core/src/store/therapy.rs` | Partial port; session create/edit/delete, date/time editing and invoice-link protections now covered; full sub-workflow audit remains open |
| `components/contacts/*` | `crates/ui/src/contacts.rs`, `crates/core/src/domain/contact.rs`, `crates/core/src/store/contacts.rs` | Existing Rust surface; full parity audit required |
| `components/sales/*` | `crates/ui/src/accounting.rs`, `pos.rs`, `products.rs`, `purchases.rs`; matching core domains/stores | Existing Rust surface; map each TS screen and action |
| `components/documents/*` | `crates/core/src/domain/document.rs`, `crates/core/src/store/documents.rs`, `crates/core/src/docx/`, `crates/core/src/pdf/` | Backend candidates exist; native UI parity unverified |
| `components/shell/*` | `crates/ui/src/shell.rs`, `dashboard.rs`, `calendar.rs`, `widgets.rs`, `wallpaper.rs`, `studio.rs` | Shell exists; workflow and OS integration audit required |
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
| Projects | TS portfolio metrics vs Rust domain/store/bridge/tests | Fixed task denominator to ignore orphan tasks; regression test added | Filters, task transitions, CSV formatting, invoice numbering and complete UI workflows |
| Fleet | TS vehicle/trip/fuel save/edit/delete, filters, metrics and CSV vs Rust | Confirmed filter scope and historical-record retention; regression test added for vehicle deletion | All form edge cases, invoice handoff, translation coverage and full CSV edge cases |
| Restaurant | TS tax grouping, order totals and paid invoice vs Rust domain/store | Fixed VAT aggregation and added persisted invoice/POS VAT overrides (schemas v16–v17); cent-level checkout/reopen regression test added | Full order/kitchen workflow, checkout side effects, receipt rendering and export parity |
| POS | `POSModule.tsx` and accounting Z-report vs Rust POS domain/UI/store | Cash, card, bank transfer, invoice and other methods persist; NFC/mobile-wallet is now a separate `nfc` method with a translated checkout option and daily-summary regression coverage | Full receipt-printing parity and the accounting Z-report presentation still need side-by-side verification |
| Therapy | TS client/session billing flow vs Rust UI/domain/store | Added edit flow for unbilled sessions, persists minutes/distance/notes and blocks edits after invoice linking; regression test added | Session date editing, mileage ledger/export, invoice generation/print details and full TS workflow comparison |
| Contacts | `ContactsModule.tsx` and `contactImportExport.ts` vs Rust contacts UI/domain/store | CRUD, company contact persons, search, atomic batch creation, CSV/vCard import preview, category assignment, native CSV/vCard export and DE/EN/FR/ES labels now exist | Side-by-side audit remains for every Outlook/Google/Apple header variant, legacy dummy-email sanitization, all-vs-filtered export scope, and malformed/large-file edge cases |
| Accounting | `AccountingModule.tsx` vs Rust journal/accounting UI and invoice/POS/purchase stores | Native journal, cash book, BWA and journal CSV exist | TS UStVA, invoice open-items list, POS Z-report, invoice/POS/purchase aggregation and custom date-range filters are still missing |

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
