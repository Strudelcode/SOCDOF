# SOCDOF Version 20 Release Overview

## Executive Summary

**SOCDOF Version 20** introduces major usability, interaction, layout resilience, and localization enhancements across the desktop environment and enterprise modules. This release series completes the transition to synchronized multilingual interfaces, structured contact master data forms, React Portal-based global viewport dialogs, custom letterhead background rendering, and high-precision taskbar drag-and-drop feedback.

---

## Key Highlights & Feature Set

### 1. Web Preview Modal, Storage Notices & Leave Protection (v20.0.3)
- **Web Demo Notice & Session-Only Persistence Clarity**:
  - Implemented `WebPreviewModal.tsx` and interactive taskbar indicator for web environments clarifying transient browser storage.
  - Added `beforeunload` warning event listener in preview mode preventing accidental loss of unsaved input.
  - Direct download links to the official Windows Desktop `.exe` release on GitHub (`https://github.com/Strudelcode/SOCDOF/releases`).
- **Dynamic Browser Title & Data URI Favicon Pipeline**:
  - Automatically identifies web preview mode and sets browser document title to `"SOCDOF - Preview"`.
  - Injected resilient SVG data URI favicon fallback rendering reliably across GitHub Pages and custom deployments.
- **GitHub Release Update Checker Engine**:
  - Integrated `src/lib/updateChecker.ts` with the official GitHub Releases API (`Strudelcode/SOCDOF`), allowing instant version comparison, update notifications, and direct downloads from within Settings.
- **Exit Prompt & Startup Preferences**:
  - Added `disable_exit_prompt` and `launch_maximized` toggles in Settings.

### 2. Window Control Buttons Drag Suppression & Event Isolation (v20.0.2)
- **Titlebar Button Drag Rejection**: Prevented accidental window dragging when pressing down (`onMouseDown`, `onPointerDown`) on the close (`✕`), minimize (`—`), maximize (`▢`), or split-view snap buttons (`◧` / `◨`).
- **Event Propagation Stopping**: Embedded explicit `e.stopPropagation()` handlers on mouse/pointer events and applied `cursor-pointer` fidelity.
- **Defensive Drag Target Filter**: Added interactive element detection in `startDrag` to ensure window drag movements are exclusively initiated from neutral titlebar surfaces.

### 2. Contacts Modal Viewport Portal & Window Decoupling (v20.0.1)
- **Direct Body Portaling**: Contact creation/edit modals and batch add dialogs are portaled directly to the viewport root via React `createPortal`.
- **Zero Window Clipping**: Solved parent container transform constraints from window animations, ensuring backdrop covers the complete display and all form fields remain accessible and scrollable.
- **Structured Address Fields**: Dedicated granular inputs for:
  - Street & House Number
  - Postal Code (ZIP / PLZ)
  - City / Town
  - Country
  - Tax ID / VAT Number (`USt-IdNr.`)
  - Internal Notes & Remarks

### 2. Multilingual Documentation & Real-time Language Switch
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
| **Desktop Workspace** | `src/components/DesktopWindowWorkspace.tsx` | Window titlebar button drag suppression and pointer event isolation |
| **Contacts Module** | `src/components/ContactsModule.tsx` | Viewport portal modals, reactive `useLanguage` integration and structured form |
| **Products Module** | `src/components/ProductsModule.tsx` | React Portal viewport overlays for customer allocation & product modal |
| **Documentation App** | `src/components/DocumentationApp.tsx` | Bilingual English/German user manual and live localization |
| **Localization Registry** | `src/lib/i18n.ts` | Complete translation dictionary for contacts, invoices, and system tools |
| **App Version** | `src/lib/version.ts` | Synced to `20.0.2` with version history |

---

## Verification & Compliance

- [x] Strict compliance with English documentation rules.
- [x] Zero mock / fake demo data rule maintained.
- [x] Full build verification (`npm run lint` & `npm run build`).
