# SOCDOF – Version 19 Full Release Overview

**Version Series:** `v19.0.0` – `v19.2.2`  
**Release Date:** August 2026  
**Author / Organization:** Yuri (Strudel) • South Tyrol, Italy  
**System Architecture:** 100% Offline-First Windows 11 Desktop ERP (React 19, TypeScript, Dexie IndexedDB, Tailwind CSS, Vite, Electron)

---

## 1. Executive Summary

Version 19 of **SOCDOF** (Strudel's Organization, Commerce & Documentation Offline Flow) represents a major evolutionary milestone in the project's journey. It transformed SOCDOF from a basic modular offline suite into an authentic, multi-window Windows 11 desktop operating environment featuring smart app folders, a dedicated Customer Support and Ticketing engine, inter-app metric navigation, intelligent product URL importing, custom date-range analytics for BWA accounting, dynamic timezone management, and seamless GitHub release detection.

Throughout the entire v19 cycle, strict adherence to the **Zero-Mock-Data** mandate and **Local-First Data Storage** was maintained. All business records (invoices, support tickets, timesheets, contacts, products, warehouse journal entries, POS receipts, and settings) persist directly in the user's browser or desktop IndexedDB storage with zero reliance on cloud servers or external subscription backends.

---

## 2. Core Functional Pillars of Version 19

### 🖥️ A. Authentic Windows 11 Desktop Workspace & App Folders
- **Smart App Folders**: Desktop drag-and-drop icon grouping creating Android/iOS-style squircle folders with live 2x2 mini-icon previews.
- **Folder Management**: In-place rename modal, direct app launching, and 1-click folder dissolve actions.
- **Desktop Interaction Polish**: Streamlined hover tooltips with ~0.6s delay, native click cursors, and acoustic feedback.
- **Windows 11 Calendar & Agenda Flyout**: Clicking the taskbar clock opens an authentic bottom-right Windows 11 calendar with live seconds, weekday/date header, interactive month grid, and "Termine & Fälligkeiten" displaying open invoices and due dates.
- **Graceful Session Shutdown**: Start Menu "Beenden" action presents explicit confirmation to lock, reboot, or cancel.

### 🎫 B. Customer Support & Service Operations Engine
- **Dedicated 2-Column Split Interface**: High-contrast form on the left, interactive SOCDOF Chatter stream on the right.
- **Ticket Lifecycle Pipeline**: Visual state progress bar (`New` ➔ `In Progress` ➔ `In Queue` ➔ `Resolved` ➔ `Closed`) with automatic audit trail logging.
- **Timesheets & Integrated Work Stopwatch**: Live 1-click start/stop timer directly on tickets with seconds counter, preset duration pills (`0.5h`, `1.0h`, `1.5h`, `2.0h`), and 1-click invoice generation.
- **Support Team Management**: Full management dialog to create, rename, or delete custom service teams and assign default rates.
- **Flexible Assignee Selection**: Seamless toggle between team staff dropdown and custom free-text input with instant "+ In Liste" roster additions.
- **Customer CRM Synchronization**: Picking a contact automatically auto-fills email, phone number, and company information.
- **Unified Kanban & List Views**: Fast toggle between drag-and-drop Kanban columns and dense data table with instant search and filters.

### 🔗 C. Inter-App Navigation & Dynamic Dashboards
- **Clickable Live Metric Cards**: Dashboard revenue, unpaid receivables, stock asset valuation, and product count cards navigate directly into Accounting, Invoices, Warehouse Stock, and Catalog with click sounds and directional cues.
- **Custom Timeframe Filtering**: Flexible presets (**Today**, **Month**, **Quarter**, **Year**, and **Custom Date Range**) harmonized across Dashboard, BWA, P&L, and VAT reports.
- **Standardized App Naming**: Standardized 4-language app names (`Dashboard`, `Invoices`, `Accounting`, `Contacts`, `Products`, `Inventory`, `Purchases`, `POS Cashier`, `Restaurant`, `Support`, `Quick Checkout`, `App Store`, `Handbook`, `Settings`).

### 📦 D. Intelligent Stock & Product Importer
- **Web-Link Product Importer**: Instant URL metadata parsing (Amazon, Otto, MediaMarkt, and supplier stores) to extract product name, price, store domain, and image icon.
- **Offline Custom Images**: Local Base64 image storage in IndexedDB with real-time thumbnail preview and full manual overrides on all fields.
- **Customer Product Allocation**: Live tracking within inventory showing units assigned to active customer orders and invoices.

### 🌐 E. Regionalization, Timezone & Multilingual Engine
- **4 Fully Synchronized Languages**: Complete English, German, French, and Spanish translation keys in `src/lib/i18n.ts`.
- **Dynamic Timezone & Time Formatting**: Persistent timezone selection (`Europe/Berlin`, `America/New_York`, `UTC`, etc.) updating taskbar clock, calendar flyout, and date formatting.
- **Seconds Display Toggle**: Configurable toggle to show or hide live seconds in the taskbar (`HH:MM:SS` vs `HH:MM`).

### 🚀 F. Deployment, GitHub Integration & Packaging
- **Dynamic GitHub Release Toast**: Queries `/repos/Strudelcode/SOCDOF/releases/latest` to display live release notes and download links for the Windows `.exe` bundle.
- **Clean Standalone Windows Packaging**: Electron configuration with dedicated SOCDOF branding, SVG icons, and `.cmd`/`.bat`/`.ps1` local directory wizards.

---

## 3. Chronological Version Changelog for v19

| Version | Date | Highlights |
| :--- | :--- | :--- |
| **v19.2.2** | 2026-08-25 | Live GitHub release fetching in toast, staff default cleanup, free-text assignee toggle, 2-column form overlap fix, timesheet timer relocation, high-contrast chatter tabs. |
| **v19.2.1** | 2026-08-25 | Support app settings dialog, custom ticket prefix (`SUP-`, `TICK-`), ticket lifecycle complete/reopen actions, delete confirmation modal, dark mode button hover contrast fix. |
| **v19.2.0** | 2026-08-25 | Support team manager dialog, CRM contact auto-fill, manual timesheet duration presets, internal notes logbook, strict empty states, English documentation standards, task archiving. |
| **v19.1.5** | 2026-08-25 | Full Customer Support engine rollout with 2-column split layout, timesheet table, live work timer, status pipeline ribbon, Kanban board, and activity chatter. |
| **v19.1.0** | 2026-08-25 | Inter-app navigation links from Dashboard KPIs into Accounting, Invoices, Stock and Products, unified concise app naming across EN/DE/FR/ES, flexible minor versioning rules. |
| **v19.0.5** | 2026-08-25 | Intelligent product web-link importer, offline Base64 product image uploads, customer inventory allocation drilldown, initial Support module registration. |
| **v19.0.4** | 2026-08-25 | Custom date range filtering in Dashboard & Accounting, bundled regional/time controls in Settings, seconds toggle in taskbar, formal `INSTRUCTIONS.md` and `AGENTS.md` guidelines. |
| **v19.0.3** | 2026-08-25 | Windows 11 style Calendar and Agenda flyout on taskbar clock, Start Menu exit confirmation modal, updated shutdown and restart overlays. |
| **v19.0.2** | 2026-08-25 | Duplicate HTML tooltip bugfix on desktop icons and folders, hover delay refinement. |
| **v19.0.1** | 2026-08-25 | Clean desktop startup without forced window opening, Start Menu search focus bugfix, streamlined quick bar, SOCDOF-Prinzip terminology in stock moves. |
| **v19.0.0** | 2026-08-24 | Smart desktop app folders with drag-and-drop grouping, App Store typography polish, taskbar tray streamlining, English localization synchronization, DIN-5008 light mode & dark mode accent colors. |

---

## 4. Verification & Quality Assurance

All v19 releases passed mandatory quality verification:
- ✅ TypeScript compilation check (`npm run lint` / `tsc --noEmit`): **Passed 0 errors**
- ✅ Production application build (`npm run build` / `vite build`): **Passed**
- ✅ Local Storage & Dexie IndexedDB compatibility: **Verified**
- ✅ Multi-lingual i18n key parity across EN, DE, FR, ES: **Verified**
