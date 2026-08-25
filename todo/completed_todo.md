# SOCDOF – Completed Tasks & Milestones Archive

> This file archives all successfully completed, verified, and released roadmap tasks and user requirements for SOCDOF.

---

## Completed Tasks Archive

### 1. Contacts Modal Viewport Portal & Window Decoupling (v20.0.1)
- [x] **React Portal Integration**:
  - [x] Re-anchored the Single Contact Create/Edit modal, Batch Contacts modal, and CSV Import modal directly to `document.body` via `createPortal`.
  - [x] Eliminated dark rectangular clipping boxes and constrained overflow boundaries caused by parent window animation CSS transforms.
  - [x] Added clean internal scroll containment (`max-h-[92vh] overflow-y-auto`) and optical padding for all contact address inputs.
- [x] **Products Module Portal Overlays**:
  - [x] Wrapped customer allocation modal and product creation dialog in `createPortal` for uniform viewport handling.
- [x] **Documentation Manual Localization (Full Parity)**:
  - [x] Refactored `DocumentationApp.tsx` with dynamic `useLanguage()` integration, providing full German and English parity across all chapters and workflows.
- [x] **Release Documentation Protocol**:
  - [x] Added `versions/releases/v20-release.md` and updated `INSTRUCTIONS.md` with release logging requirements in English.

### 2. Desktop Workspace Polish, App Store Scrolling & Dynamic Timezone (v20.0.0)
- [x] **App Store Vertical Scrolling**: Replaced fixed height constraints with `h-full overflow-y-auto` across all app categories and install cards.
- [x] **Desktop Icon Interaction & Cursor Fix**: Restored default pointer cursors on desktop icons and added grayscale visual feedback during dragging.
- [x] **Taskbar Drag Insertion Indicator**: Added pulsed vertical guide line indicator during taskbar icon reordering.
- [x] **Timezone Persistence & Dynamic System Clock**: Taskbar digital clock, system date string, and calendar flyout format according to configured company timezone.
- [x] **Settings Storage Metric Explanation**: Renamed section to "Sprache, Region & Zeit" and added tooltip explaining local IndexedDB database storage.
- [x] **Structured Contacts Form**: Refactored contact creation modal with dedicated inputs for ZIP, City, Country, Tax ID, and internal notes.

### 3. Customer Support & Service Operations Module
- [x] **Comprehensive Localization & Multilingual Engine (v19.2.2)**:
  - [x] Converted all UI text elements, form labels, tooltips, dialogs, status badges, and settings in `SupportServicesModule.tsx` to use `t('support.*')` dynamic localization with English base fallbacks.
  - [x] Fully expanded `src/lib/i18n.ts` dictionary with comprehensive English, German, French, and Spanish translations for all Support & Service Operations keys.
- [x] **Support App & Ticket Engine Enhancements (v19.2.2)**:
  - [x] **Dynamic GitHub Release Detection**: Web preview notification toast dynamically fetches latest GitHub release via GitHub API (`/repos/Strudelcode/SOCDOF/releases/latest`) with tag name and direct download links.
  - [x] **Removal of Personal Mock Names**: Cleaned all default staff rosters; set default team strictly to `"Standard"` and default assignee to `"Support Agent"`.
  - [x] **Flexible Assignee (Dropdown & Custom Free-Text)**: Instant toggle between staff selection dropdown and free-text custom name input with 1-click roster saving.
  - [x] **Support Settings & Staff Manager**: Comprehensive settings modal with tabs for General (Prefix, number sequence, rates), Teams Manager, and Staff / Assignees Manager.
  - [x] **Form Layout & Overlap Resolution**: Restructured form into a responsive 2-column grid with vertically stacked labels, eliminating any menu or dropdown overlap.
  - [x] **Timer Relocation**: Relocated live working timer into the "Zeiterfassung (Arbeitszeiten)" tab with elapsed seconds counter and automatic duration booking.
  - [x] **High-Contrast Chatter Tabs**: Corrected contrast for "Interne Notiz" and "Aktivität & Protokoll" buttons in both light and dark modes.
- [x] **Standalone Support App & Ticket Management (`SupportServicesModule`)**:
  - [x] Clear 2-column layout (Ticket Details & Internal Logbook/Timeline).
  - [x] **Support Settings & Ticket Prefix**: Configuration modal for custom ticket prefix (e.g. `SUP-`, `TICK-`, `IT-`), next sequence number, default hourly rate, default team, and default staff.
  - [x] **Ticket Lifecycle Operations**: Dedicated 1-click status actions to Complete (`Ticket abschließen`), Reopen (`Wiedereröffnen`), Edit, and Delete with custom confirmation modal.
  - [x] **Dark Mode & UI Fixes**: Eliminated contrast and hover glitches on the "In Rechnung stellen" button and action ribbon in dark mode.
  - [x] **Responsive GUI & Window Adaptivity**: Responsive multi-window adaptivity, non-clipping action ribbons, horizontal scrolling prevention, and edge-to-edge window embedding.
  - [x] Configurable Support Teams management with direct inline creation, editing, and deletion.
  - [x] Automatic contact metadata synchronization (auto-populates customer email, phone, and company upon selection).
  - [x] Structured time tracking with manual duration input (decimal hours / preset buttons) and 1-click live timer.
  - [x] Interactive status workflow pipeline (`Neu` ➔ `In Bearbeitung` ➔ `In Warteschlange` ➔ `Gelöst` ➔ `Abgeschlossen`).
  - [x] Internal activity stream & notes protocol (internal staff notes and action logging without external email confusion).
  - [x] 1-click invoice conversion for billable support hours.
  - [x] Dual-view support: Multi-column Kanban board and dense sortable data table.
  - [x] Initialized with clean empty states (strictly no mock/dummy data).

### 2. Custom Date Range Filters & Accounting Synchronization
- [x] Enabled custom date range selectors in Dashboard (Total, Today, Month, Quarter, Year, and Custom Start/End).
- [x] Synchronized date range filters across Accounting (BWA, UStVA, CSV Export).
- [x] Consistent handling of start date, end date, and local timezone conversions.

### 3. Smart Inventory & Product Management with Link Import
- [x] **Extended Inventory Tracking (Double-Entry Stock Accounting)**:
  - [x] Overview of all items with stock on hand, minimum threshold, reservations, and customer delivery allocations.
- [x] **Smart Product Web Link Extractor**:
  - [x] Optional URL input when creating and editing products (Amazon, supplier shop, manufacturer URL).
  - [x] Automatic extraction of title, price, currency, category, preview image, and merchant favicon.
  - [x] Editable fields prior to saving.
- [x] **Product Image Preview & Local Upload**:
  - [x] Base64 image storage and preview in IndexedDB.
- [x] **Customer Allocation & Delivery Tracking**:
  - [x] Trace product allocations directly to invoices, delivery notes, and orders.

### 4. Inter-App Navigation & Harmonized App Registry
- [x] **Unified App Names**:
  - [x] Clean naming (`Dashboard`, `Rechnungen`, `Abrechnung`, `Kontakte`, `Produkte`, `Lager`, `Einkauf`, `POS Kasse`, `Restaurant`, `Support`, `Schnellkasse`, `App Store`, `Handbuch`, `Einstellungen`).
  - [x] Multilingual localization across all 4 languages (DE, EN, FR, ES).
- [x] **Interactive Dashboard Metric Navigation**:
  - [x] Clickable metric cards with direct navigation to corresponding modules (Revenue -> Accounting, Receivables -> Invoices, Stock Value -> Stock, Products -> Products).
  - [x] Acoustic feedback and hover cues.

### 5. Regional Settings & Windows 11 Desktop Experience
- [x] Consolidated language, date, and time settings under Settings -> Language & Region.
- [x] Support for `DD.MM.YYYY`, `YYYY-MM-DD`, and `MM/DD/YYYY` formats.
- [x] Taskbar clock toggle for seconds display.
- [x] Windows 11 interactive Calendar & Agenda flyout with live seconds and 1-click event navigation.
- [x] Close confirmation modal ("SOCDOF wirklich schließen?" with Exit, Restart, and Cancel).

### 6. Platform & Website Polish
- [x] Disabled touchpad pinch-to-zoom on GitHub Pages website.
- [x] Shortened website and browser titles strictly to **"SOCDOF"**.
- [x] Native Electron icon applied to `.exe` builds; removed default Electron icon.
- [x] App start screen displays clean desktop workspace without forced auto-opening of sub-apps.
- [x] Fixed start menu search focus auto-close glitch.
- [x] Replaced "odoo Prinzip" label with "SOCDOF-Prinzip: Doppelte Lagerbuchführung".

### 7. Desktop Workspace, App Store & Settings Polish (v20.0.0)
- [x] **App Store Scrolling & Layout**: Restructured root container with `h-full overflow-y-auto` to allow full vertical scrolling through all apps and categories.
- [x] **Desktop Icon Interaction & Cursor Fix**: Replaced grab-cursor on icon corners with default cursor and pointer on icon click, adding visual grayscale/opacity feedback during drag.
- [x] **Taskbar Drag-and-Drop Visual Indicator**: Added pulsed vertical insertion guide line (`dragOverTaskbarIdx`) showing exactly where an app will be positioned when reordering pinned apps.
- [x] **Timezone Persistence & Dynamic System Time**: Updated taskbar clock, calendar flyout, and system date formatters to respect configured company timezone dynamically.
- [x] **Settings Storage Explanation**: Added descriptive guidance explaining that the storage metric measures total local IndexedDB database usage in the browser.
- [x] **Settings Section Naming**: Renamed sidebar navigation item to "Sprache, Region & Zeit" to accurately reflect timezone, date format, seconds, and localization settings.
- [x] **Version Update Guidelines**: Documented system version update checklist in `INSTRUCTIONS.md` and release history in `versions/V20.md`.
- [x] **Contacts Form Verification & Refactoring**: Clean dedicated fields for ZIP, City, Country, TaxID, and Notes.

