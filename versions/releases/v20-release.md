# SOCDOF Version 20.0.0 Release Overview

## Executive Summary

**SOCDOF Version 20.0.0** introduces major usability, interaction, layout resilience, and localization enhancements across the desktop environment and enterprise modules. This release completes the transition to synchronized multilingual interfaces, structured contact master data forms, custom letterhead background rendering, and high-precision taskbar drag-and-drop feedback.

---

## Key Highlights & Feature Set

### 1. Multilingual Documentation & Real-time Language Switch
- **Bilingual Documentation Engine**: Refactored `DocumentationApp.tsx` with dynamic `useLanguage()` integration.
- **English & German Full Parity**:
  - Fundamentals & Multi-window Desktop Workspace
  - Invoicing, Billing & statutory DIN 5008 Standards
  - Contacts & Bulk Import (vCard, Outlook CSV)
  - Point of Sale (POS) Cash Register & Barcode Scanning
  - Accounting, Financial Evaluations (EÜR / BWA) & VAT Filings
  - App Store & Modular Pinning
  - Hotkeys & Productivity Shortcuts
  - Offline-first IndexedDB Privacy & Data Backups
  - Official Discord Community Support & Open Source GitHub Repository
  - Version History & Changelog Explorer

### 2. Contacts Module UI Redesign & Clean Localization
- **Structured Address Fields**: Replaced single-line address inputs with dedicated fields for:
  - Street & House Number
  - Postal Code (ZIP / PLZ)
  - City / Town
  - Country
  - Tax ID / VAT Number (`USt-IdNr.`)
  - Internal Notes & Payment Terms
- **Multilingual Support**: All toolbar actions, customer/vendor filter badges, detail panels, and batch import modals now strictly respect the active user language selection (`de`, `en`, `fr`, `es`).
- **Responsive Layout**: Designed with responsive modal grids, optical spacing, and high-contrast badges for Customers, Suppliers, and Partners.

### 3. App Store Vertical Scrolling & Resilience
- **Full-Height Scroll Container**: Restructured the root container with `h-full overflow-y-auto` and adaptive padding to ensure effortless navigation across all app categories, promotional banners, and custom modules on any display resolution.

### 4. Windows Desktop Workstation Interactions
- **Taskbar Drag-and-Drop Placement Guide**: Added a pulsating vertical insertion line indicator (`w-1 bg-indigo-500 rounded-full animate-pulse`) visually guiding exact icon placement when reordering pinned apps.
- **Improved Drag Visual States**: Dragged desktop icons receive grayscale and opacity cues (`opacity-30 scale-95 filter grayscale`) for seamless tactile feedback.
- **Clean Pointer Cursors**: Refined cursor styling so icons maintain standard pointer interactions without persistent grabbing cursors.

### 5. Timezone-Aware Desktop Clock & Regional Settings
- **Live Regional Formatting**: The taskbar clock, calendar flyout, and system timestamps format dynamically using the company profile timezone (`company.timezone`, e.g., `Europe/Berlin`, `Europe/London`, `America/New_York`, `UTC`).
- **Storage Footprint Clarity**: Settings provides clear explanations of local IndexedDB database utilization across invoices, products, contacts, and journal entries.

---

## Technical & Architecture Updates

| Component | Path | Description |
|---|---|---|
| **Instructions** | `INSTRUCTIONS.md` | Enforced release documentation protocol in `versions/releases/` |
| **Contacts Module** | `src/components/ContactsModule.tsx` | Reactive `useLanguage` integration and structured modal form |
| **Documentation App** | `src/components/DocumentationApp.tsx` | Bilingual English/German user manual and live localization |
| **Localization Registry** | `src/lib/i18n.ts` | Complete translation dictionary for contacts, invoices, and system tools |
| **App Version** | `src/lib/version.ts` | Synced to `20.0.0` with version history |

---

## Verification & Compliance

- [x] Strict compliance with English documentation rules.
- [x] Zero mock / fake demo data rule maintained.
- [x] Full build verification (`npm run lint` & `npm run build`).
