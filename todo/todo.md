# SOCDOF – Active Roadmap & Task List

> This file contains all currently open, in-progress, and planned roadmap items. Completed tasks are archived in [completed_todo.md](./completed_todo.md).

---

> ## 1. Operating Rules & Guidelines
> 
> ### 1.1 Language & Documentation
> - All development notes, release history files (`versions/V*.md`), code comments, and technical guides MUST strictly be written in **English**.
> - Multilingual user-facing UI texts are maintained via `src/lib/i18n.ts` (DE, EN, FR, ES).
> 
> ### 1.2 No Mock / Example Data Rule
> - Modules must initialize with clean empty states (e.g. `[]`). Never inject artificial demo/sample records unless explicitly requested.
> 
> ### 1.3 Two-File Todo Management & Archiving Rule
> - **Active Tasks**: `todo/todo.md` is strictly reserved for open (`[ ]`) and in-progress items.
> - **Completed Tasks**: As soon as an item is finished and verified, move it directly to `todo/completed_todo.md` with `[x]` and archive details to keep the active list concise and actionable.

---

## 2. Active Roadmap & Pending Tasks

### 2.0 v24.0.0 — Mobile-Window Responsive Transformation (All Apps in Order)

- [x] **Phase 1: Login, Lock Screen & Onboarding Mobile Adaptation**:
  - [x] Adapt Windows 11 Lock Screen for mobile screens & narrow windows (scalable clock, date, responsive swipe-up gesture).
  - [x] Adapt Login & User Selection screen for compact mobile screens (fluid avatar grid, full-width touch inputs, min 44px buttons).
  - [x] Adapt First-Time Setup & Password Recovery dialogs (scrollable card layout, touch-friendly question dropdowns, keyboard avoidance).
- [x] **Phase 2: Desktop Window Manager & Mobile Breakpoint Engine**:
  - [x] Implement responsive container query width detection & CSS container rules (`.socdof-window-frame`, `@container window (max-width: 580px)`).
  - [x] Compact mobile titlebar mode (streamlined icon, touch-friendly window controls, title truncation, dynamic minW: 340px resize).
  - [x] Dynamic smartphone window dimension resizing down to 340px for live mobile testing on desktop.
- [x] **Phase 3: ERP Dashboard Mobile Layout**:
  - [x] Transform 4-column KPI grid into responsive container-adaptive vertical touch cards.
  - [x] Responsive quick-action launchpad and streamlined zero-state onboarding.
  - [x] Container queries for dual recent activity cards (Invoices & Stock moves).
- [x] **Phase 4: Invoices & Billing Mobile Layout**:
  - [x] Invoice list transformation into touch-friendly stack cards with status badges.
  - [x] Responsive search/filter bar and mobile layout adaptations.
- [x] **Phase 5: POS & Cash Register Mobile Layout**:
  - [x] Mobile product grid with touch-friendly tiles and category selector.
  - [x] Dedicated mobile tab switcher (Katalog vs. Warenkorb) and floating quick-checkout bar.
- [x] **Phase 6: Accounting, BWA & Taxes Mobile Layout**:
  - [x] Compact financial summary cards (Revenue, Expenses, Profit) with container query reflow.
  - [x] Responsive collapsible BWA hierarchy and simplified VAT report table.
- [x] **Phase 7: Contacts & CRM Mobile Layout**:
  - [x] Contact cards with 1-tap call/mail direct action buttons and search bar.
  - [x] Container queries for responsive contact cards grid.
- [x] **Phase 8: Inventory & Products Mobile Layout**:
  - [x] Product catalog mobile card stack with stock badges, EK/VK margin summary and 1-tap stock booking.
  - [x] Mobile category dropdown filter with alert pills.
- [x] **Phase 9: Purchases & Supplier Orders Mobile Layout**:
  - [x] Purchase order mobile card stack with status pills, supplier details and quick receipt action.
  - [x] Responsive KPI summary grid.
- [x] **Phase 10: Calendar & Appointments Mobile Layout**:
  - [x] Mobile daily agenda list view with hour markers.
  - [x] Quick appointment creation bottom sheet.
- [x] **Phase 11: Support & Time Tracking Mobile Layout**:
  - [x] Mobile time recording widget and service ticket list.
- [x] **Phase 12: Praxis & Therapy Mobile Layout**:
  - [x] Client dossier mobile view with quick session notes and consultation timer.
  - [x] Mobile appointment overview and mileage logging cards (existing v24 responsive grid/card stacks verified at 380px).
- [x] **Phase 13: Bug Reports & Feedback Mobile Layout**:
  - [x] Mobile Discord report composer with direct category selectors and error inspector (verified at 380px — responsive layout already in place from v24.0.0).
- [x] **Phase 14: Settings & Personalization Mobile Layout**:
  - [x] Mobile sidebar-to-content navigation with sticky back button and touch sliders (verified at 380px: start page, "Farben & Akzente" design-mode cards, dark-mode toggle — no clipping thanks to the live window auto-fit).
- [x] **Phase 15: App Store & Documentation Mobile Layout**:
  - [x] Responsive app cards and mobile book-style documentation reader (verified at 380px: hero stats, scrollable filter/category chips, single-column touch app cards, Handbuch portal incl. new `support_services` chapter).

---

### 2.0.1 Completed Phases Archive (v24 Mobile Transformation)

The v24.2.0 ERP Dashboard Dynamic Accent & Anti-Clash Harmonization (roadmap 2.1: accent-driven KPI cards & quick launchpad, companion-colored secondary metrics incl. the new POS revenue KPI, full quad-language i18n) milestone is complete and archived in `todo/completed_todo.md`.

The v24.2.0 Praxis & Therapy Mobile Layout (Phase 12: consultation timer with crash-safe persistence, quick session note bottom sheet, duration auto-booking) and Bug Reports & Feedback verification (Phase 13: confirmed responsive at 380px) milestone is complete and archived in `todo/completed_todo.md`.

The v24.2.0 completion of Phase 14 & 15 verification (Settings & Personalization and App Store & Documentation confirmed at 380px) plus the new Web-Preview parity notice in Settings (transparent browser fallbacks for 1:1 web testing) is complete and archived in `todo/completed_todo.md`.

The v24.1.0 Calendar & Appointments Mobile Layout (Phase 10: hour-marker day agenda, quick-create bottom sheet, floating add button, next-event quick bar) and Support & Time Tracking Mobile Layout (Phase 11: mobile time-recording widget, touch ticket card stack, responsive header actions) milestone is complete and archived in `todo/completed_todo.md`.

### 2.1 Dynamic Accent & Anti-Clash Contrast Harmonization (All Apps)

- [x] **Calendar & Appointments (`CalendarModule.tsx`)**:
  - [x] Dynamic header actions, view switcher tabs, today date circle (`--accent`).
  - [x] High-contrast weekday headers (`Mo-Fr` neutral dark/light, `Sa-So` companion accent `--accent-companion`).
  - [x] Dynamic detail & create modals, search filter chips, status bar badges and dark mode polish.
- [x] **ERP Dashboard (`Dashboard.tsx`)**:
  - [x] Dynamic KPI card borders and highlight icons (`--accent`, `--accent-light`).
  - [x] Anti-clash dual-series metrics (Revenue in `--accent`, secondary expenses/stock in `--accent-companion`).
  - [x] Quick launchpad action buttons and onboarding cards.
- [ ] **Invoices & Billing (`InvoicesModule.tsx`)**:
  - [ ] Dynamic status pills, filter chips, and primary action buttons (`--accent`).
  - [ ] Invoice detail modal, QR code scanner, and template editor accents.
- [ ] **POS & Cash Register (`POSModule.tsx`)**:
  - [ ] Dynamic cart counter badge, checkout action bar, mobile tab switcher.
  - [ ] Payment method selection (Cash, Card, QR) with non-clashing companion highlights.
- [ ] **Accounting, BWA & Taxes (`AccountingModule.tsx`)**:
  - [ ] Non-clashing revenue vs. expense dual comparison charts using `--accent-companion`.
  - [ ] BWA hierarchy rows, tax overview cards, and export action buttons.
- [ ] **Contacts & CRM (`ContactsModule.tsx`)**:
  - [ ] 1-Tap call/mail chips, contact category pills, and tag selector highlights.
- [ ] **Inventory & Products (`ProductsModule.tsx`)**:
  - [ ] Margin badges, low stock alert pills, and 1-tap booking action buttons.
- [ ] **Purchases & Supplier Orders (`PurchasesModule.tsx`)**:
  - [ ] Order status badges, supplier action chips, and purchase metric indicators.
- [ ] **Support & Time Tracking (`SupportTicketsModule.tsx`)**:
  - [ ] Timer start/stop widget, priority status badges, ticket timeline accents.
- [ ] **Praxis & Therapy Module (`PraxisTherapyModule.tsx`)**:
  - [ ] Consultation timer, therapy dossier tabs, diagnosis chips, mileage log indicators.
- [ ] **Bug Reports & Discord Feedback (`DiscordBugReportModal.tsx`)**:
  - [ ] Submit button, category tag pills, live embed preview highlights.
- [ ] **Settings & Personalization (`SettingsWorkspace.tsx`)**:
  - [ ] Color Picasso palette picker, active section tabs, toggle switches, accent preview cards.

---

### 2.1 Completed Milestones Archive

The v23.18.13 Direct Electron Node.js HTTPS BotGhost Dispatch & Delivery Verification milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.12 Verified Discord Forum Bot Integration & Localhost Proxy in Desktop App milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.11 Documentation Portal Layout Hierarchy & Smooth Scrolling Restoration milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.10 Exclusive Discord Bot Forum Release Broadcast & Webhook Removal milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.9 Adaptive Screen Layout & Dark Mode Polish for Invoice Template Editor milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.8 Prominent Discord Transmission Loading Banner & Verified Delivery Feedback milestone is complete and archived in `todo/completed_todo.md`.

The v23.18.0 High-Fidelity Word (.docx) XML Table Parsing & Smart Variable Rendering milestone is complete and archived in `todo/completed_todo.md`.

The v23.17.0 PDF & Word (.docx) Template Import & Automatic Variable Extraction milestone is complete and archived in `todo/completed_todo.md`.

The v23.16.6 Clean Option Labels, Fixed Window Frame & Streamlined Mobile View Switcher milestone is complete and archived in `todo/completed_todo.md`.

The v23.16.4 Clean Minimalist Responsive Invoice Layout Switcher & Automatic Split View milestone is complete and archived in `todo/completed_todo.md`.

The v23.16.3 Fixed Modal Backdrop Positioning & Responsive Editor vs. Preview View Switcher milestone is complete and archived in `todo/completed_todo.md`.

The v23.16.2 Invoice Modal Foreground Layering, Taskbar Clearance & Non-Scrolling Sub-Tabs Layout milestone is complete and archived in `todo/completed_todo.md`.

The v23.15.0 Offline Bug Report Queueing, Automatic Online Auto-Sync & Exact Capture Timestamp Preservation milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.5 Discord Bug Report User Identity Independence, Live Dynamic Bot Status & Offline Graceful Degradation milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.4 Onboarding Language Selection Persistence, Database Profile Default & Account Preferences Sync milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.3 Discord Tag ID Mapping, Thread Messages Inspector & Custom Emoji Parsing milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.2 Live Discord Forum Tags Sync, 30-Second Polling & Thread Status milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.1 Authentic Live Discord Embed & Forum Post Preview with Real-Time Typing milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.0 App-Location Modal Picker & Start Menu Cleanup milestone is complete and archived in `todo/completed_todo.md`.

The v23.13.0 Bug-Reports Desktop App, 3-Step Guided Reporting & Discord Embed Polish milestone is complete and archived in `todo/completed_todo.md`.

The v23.12.0 Live Discord Bot Forum Integration for Feedback & Bug Reports milestone is complete and archived in `todo/completed_todo.md`.

The v23.11.0 Invoicing Templates & Layout Architecture in Invoicing & Settings milestone is complete and archived in `todo/completed_todo.md`.

The v23.10.10 European Number & Currency Formatting (DIN 1333) & Therapy Dark Mode Refinement milestone is complete and archived in `todo/completed_todo.md`.

The v23.8.0 Therapy & Practice Flow, Authentic Desktop Preview & Settings Personalization Overhaul milestone is complete and archived in `todo/completed_todo.md`.

The v23.7.0 Windows-Inspired Settings & Display / Multi-Monitor Management milestone is complete and archived in `todo/completed_todo.md`.

The v23.6.1 Brand Neutralization & Avatar Studio UX Layout Refinement milestone is complete and archived in `todo/completed_todo.md`.

The v23.6.0 Windows-Style Personalization, Avatar Studio & Admin User Inspection milestone is complete and archived in `todo/completed_todo.md`.

The v23.5.0 Multi-Step System Reset & Complete Reinstallation Flow milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.5 Desktop Icon Layout & In-App Activation Persistence Stabilization milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.4 Persistent Application Activation, Pinning & Desktop Ordering milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.3 Safe In-App Updates & Persistent Application State milestone is complete and archived in `todo/completed_todo.md`.


### 2.1 Multi-User Architecture, Authentication & Windows-Style Security

The v23.3.2 Profile Picture Alignment & Centering Stabilization milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.3.1 Dynamic Language Discovery, Search Filtering & Windows-Style Toast Feedback milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.3.0 Windows 11 Personalization Center, Live Blur & Unsaved Changes Guard milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The authentication and local multi-user milestone is complete for v22.10.0. Historical completion details are archived in `todo/completed_todo.md`.

The v23.0.0 Users & Accounts / Start Menu power milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.5 Consolidated User Management & Profile Personalization in Settings milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.4 Localization Alignment & Crisp Vector Flag Rendering milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.3 Dark Mode Persistence & Auth Activity Event Fix milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.2 Responsive first-run account onboarding & authentication refinements milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.1 Settings-centered user management cleanup is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.1.0 Windows-style authentication surface redesign is complete on the feature branch and is archived in `todo/completed_todo.md`.



### 2.2 Windows-Inspired Settings & Display / Multi-Monitor Management

The v23.7.0 Windows-Inspired Settings Hub & Multi-Monitor Extended Display Management milestone is complete and archived in `todo/completed_todo.md`.

### 2.3 Praxis & Therapy Management Suite (TheraPsy Architecture)

The v23.4.2 CustomerPicker & CRM Contact Integration for Praxis & Therapy milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.4.0 Praxis & Therapy Interconnected Client Dossier & Cross-Module Linking milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

Initial offline Practice workspace was introduced in v23.2.0. Historical implementation details are archived in `todo/completed_todo.md`.

### 2.4 Invoicing Templates, Office File Binding & Layout Architecture
- [ ] Deep binary Word (.docx) AST parsing & XML unzipping engine for complex nested multi-page tables.
- [ ] Local filesystem folder watcher (`templates/`) for automatic desktop synchronization of external Office template files.
- [ ] Direct PDF form-field token injection and interactive visual placement tool for PDF background stationery.

### 2.5 System Optimization & Continuous Polishing
- [ ] Continuous module performance and responsive UX refinements.
- [ ] Automated regression coverage for critical local data workflows.
- [ ] Accessibility audit and keyboard-navigation refinement across major desktop surfaces.
