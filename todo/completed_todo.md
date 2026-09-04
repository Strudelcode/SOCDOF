# SOCDOF – Completed Tasks & Milestones Archive

> This file archives all successfully completed, verified, and released roadmap tasks and user requirements for SOCDOF.

---

## Completed Tasks Archive

### 1. Master Volume Slider, Multi-Sound Audio Library, Categorized Settings Hub & Custom Language Pack Engine (v21.10.0)
- [x] **Master Volume Control Slider (`src/lib/sound.ts`, `SettingsModule.tsx`, `src/lib/i18n.ts`)**:
  - [x] Implemented a smooth master volume slider (`0%` to `100%`) with Web Audio API gain scaling in `src/lib/sound.ts` (`sounds.getVolume()`, `sounds.setVolume()`).
  - [x] Added instant percentage badge, dynamic volume icons (`VolumeX`, `Volume1`, `Volume2`), 5 quick preset levels (`15%`, `35%`, `60%`, `85%`, `100%`), and audio test button in Settings.
- [x] **Enriched Procedural Sound Effects & Interactive Sound Catalog (`src/lib/sound.ts`, `SettingsModule.tsx`, `PaymentModal.tsx`, `POSModule.tsx`)**:
  - [x] Synthesized realistic enterprise sound effects:
    - Kasse, Bezahlung & Geld: Payment Success chord (`playPaymentSuccess`), Cash Drawer latch (`playCashDrawer`), Metallic Coin Clink (`playCoinClink`), NFC Contactless Beep (`playNfcBeep`), Desk Bell (`playBell`), Ka-Ching (`playKaChing`).
    - Geschäftsprozesse & Termine: Calendar Sync (`playCalendarSync`), Success Fanfare (`playFanfare`), Invoice Sent (`playSendInvoice`), Trash Empty (`playTrashEmpty`).
    - UI Feedback: Window Lock (`playLock`), Window Unlock (`playUnlock`), Click, Pop, Success, Error.
  - [x] Built an interactive categorized sound preview catalog directly in Settings > Sound & Audio.
  - [x] Embedded cash drawer, coin clinking, and NFC audio triggers into live POS checkouts and invoice payment flows.
- [x] **Categorized Settings Navigation & Home Hub (`SettingsModule.tsx`)**:
  - [x] Restructured all 11 settings modules into 4 logical groups (Übersicht, Unternehmen & Finanzen, Oberfläche & Personalisierung, System & Geräte).
  - [x] Designed an interactive "Einstellungsbereiche & Module" hub dashboard on the Settings Home tab with status indicators and quick-navigation cards.
  - [x] Upgraded mobile/compact view navigation to group modules by category with responsive horizontal carousels.
- [x] **Custom JSON Language Pack Engine & Translation Template (`src/lib/i18n.ts`, `SettingsModule.tsx`)**:
  - [x] Created JSON translation template download containing all system translation keys.
  - [x] Added 1-click export of current language packs (`de.json`, `en.json`, `fr.json`, `es.json`).
  - [x] Implemented file import, validation, and persistent local storage of custom user-translated language packs.
  - [x] Added UI for switching, deactivating, and deleting custom packs, along with offline desktop guidance for `%APPDATA%/socdof/languages/`.

### 2. Modern Dark Mode Switch & Harmonized Settings Quick Toggles (v21.9.9)
- [x] **Modern Dark Mode Toggle Switch (`SettingsModule.tsx`, `src/lib/i18n.ts`)**:
  - [x] Replaced awkward "Wechseln" button and text with an authentic, smoothly animated toggle switch and localized "Dark Mode" title across all 4 languages.
  - [x] Added active state indicators ("Aktiviert" / "Deaktiviert") and interactive card wrapper with click, keyboard (Enter / Space), and sound effect triggers.
- [x] **Harmonized Quick Preferences Controls (`SettingsModule.tsx`)**:
  - [x] Upgraded Sound Effects quick toggle to match the slider switch aesthetic with green active accent and clear status ("Aktiviert" / "Stumm").
  - [x] Unified Google Calendar quick link tile with live synchronization status badge and hover chevron.
- [x] **Natural Toolbar Document Flow (`SettingsModule.tsx`)**:
  - [x] Cleaned up sticky toolbar wrapper that caused translucent overlapping over the Quick Access and search cards on window scroll.

### 2. Settings Module Layout Fix & Sticky Docked Toolbar (v21.9.8)
- [x] **Sticky Settings Header & Top Toolbar (`SettingsModule.tsx`)**:
  - [x] Converted the settings top toolbar (search bar, breadcrumb, and quick save button) into a sticky element docked at `top: 0` with `backdrop-blur-md` and high z-index.
  - [x] Prevents search input and current view indicators from being hidden during window scrolling.
- [x] **Elimination of Sidebar Viewport Clipping (`SettingsModule.tsx`)**:
  - [x] Fixed sticky positioning on the left navigation column that previously clipped the top navigation categories (`Startseite`, `Allgemein`, `Personalisierung`) when scrolling inside desktop windows.
- [x] **Smooth Scroll Reset (`SettingsModule.tsx`)**:
  - [x] Added automated scroll-to-top handler whenever changing settings tabs, clicking quick-access tiles, or navigating from search results.

### 2. Adaptive Keyboard Shortcut Localization (Strg vs Ctrl vs ⌘ Cmd) (v21.9.7)
- [x] **Language & Platform Adaptive Shortcut Helper (`src/lib/shortcuts.ts`, `src/types.ts`)**:
  - [x] Implemented formatShortcut utility detecting user language (`de` -> `Strg`, `en`/`fr`/`es` -> `Ctrl`) and macOS (`⌘ Cmd`).
  - [x] Added `shortcut_modifier_style` to CompanyProfile interface and localStorage persistence.
- [x] **Settings UI Configuration (`SettingsModule.tsx`, `src/lib/i18n.ts`)**:
  - [x] Added interactive modifier selector with 4 modes in "Sprache, Region & Zeit" settings section with live preview cards.
- [x] **Application-Wide Shortcut Integration (`CommandPalette.tsx`, `DocumentationApp.tsx`, `DesktopWindowWorkspace.tsx`)**:
  - [x] Unified all shortcut displays across tooltips, command palette, and manual documentation.

### 3. Clean Minimalist Taskbar Search Bar (v21.9.6)
- [x] **Removed Ctrl+K Shortcut Badge (`DesktopWindowWorkspace.tsx`)**:
  - [x] Removed shortcut badge pill from the taskbar search field for a clean, distraction-free aesthetic while retaining full search invocation on click / shortcut.

### 4. Top-Level Portal Rendering & Keyboard Escape Dismissal for Desktop Widget Settings Modal (v21.8.6)
- [x] **Top-Level React Portal Stacking (`WidgetSettingsModal.tsx`)**:
  - [x] Wrapped `WidgetSettingsModal` in `createPortal(..., document.body)` with `z-[999999]` and `pointer-events-auto`.
  - [x] Fixed stacking context issue where desktop icons and canvas containers clipped or rendered in front of the settings modal.
  - [x] Ensured all interactive controls (buttons, dropdowns, inputs, styles) receive direct pointer input.
- [x] **Modal Dismissal & Keyboard Controls (`WidgetSettingsModal.tsx`, `DesktopWidgetsLayer.tsx`)**:
  - [x] Added `Escape` key event listener to immediately close the modal.
  - [x] Enabled backdrop click to close the modal.
  - [x] Ensured `onSave` cleanly saves updates and unmounts the modal.

### 2. Pure Desktop Widget Presentation, True Background Transparency, Position Locking & Right-Click Customization Context Menu (v21.8.5)
- [x] **Pure Smartphone-Style Widget Presentation (`DesktopWidgetsLayer.tsx`)**:
  - [x] Removed bulky header bars and static titles from pinned desktop widgets so they render directly in their authentic format as clean clock, calendar, revenue, and launcher tiles.
  - [x] Added subtle floating micro-action controls (⚙️ Settings and ✖️ Remove) on hover.
- [x] **True Zero-Background Transparency (`DesktopWidgetsLayer.tsx`, `WidgetSettingsModal.tsx`)**:
  - [x] Eliminated all background colors, solid container borders, and hover outlines when "Ohne Hintergrund" (Transparent) is selected.
  - [x] High-contrast drop-shadow typography (`drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]`) ensures high readability across all wallpaper backgrounds.
- [x] **Widget Position Locking & Accidental Movement Prevention (`DesktopWidgetsLayer.tsx`, `WidgetSettingsModal.tsx`, `src/types.ts`)**:
  - [x] Added `isLocked` property to `DesktopWidget` interface.
  - [x] Drag events are prevented when `isLocked` is true, ensuring widgets stay firmly anchored on the desktop.
  - [x] Position locking toggleable via right-click context menu, hover lock badge, and settings modal.
- [x] **Right-Click Context Menu & Live Customizer (`DesktopWidgetsLayer.tsx`, `src/lib/i18n.ts`)**:
  - [x] Right-clicking on any widget opens a Windows 11-styled context menu for live configuration.
  - [x] Menu actions: Open Customization Settings Modal, Lock/Unlock Position, Fast Background Style switcher, Fast Resizing (Klein, Mittel, Groß), Layer Mode, and Remove from Desktop.

### 2. Task View Indicator Removal, Semi-Transparent Desktop Placement Ghost & Complete Widgets 4-Language Localization (v21.8.4)
- [x] **Task View Active Indicator Dot Removal (`DesktopWindowWorkspace.tsx`)**:
  - [x] Removed active dot indicator under the Task View taskbar button to reflect its status as a permanent system background feature (Windows 11 style).
- [x] **Semi-Transparent App Placement Ghost (`DesktopWindowWorkspace.tsx`)**:
  - [x] Implemented real-time desktop grid placement ghost preview (`dragPreviewPos`) on `onDragOver` / `onDragLeave`.
  - [x] Visual translucent badge with dashed border, module icon, and name shows the destination slot before drop.
- [x] **Complete Widgets 4-Language Localization (`src/lib/i18n.ts`, `WidgetsModule.tsx`, `WidgetSettingsModal.tsx`, `DesktopWidgetsModal.tsx`)**:
  - [x] Localized all widget cards, category filter dropdown, background and typography selectors, analog clock options, and quick action launcher across German, English, French, and Spanish.

### 2. Advanced Widget Customization Studio, Floating Search & Filter Dropdown, Analog & World Clocks, Quick Actions & Wallpaper Layering (v21.8.3)
- [x] **Floating Search Bar & Category Filter Dropdown (`WidgetsModule.tsx`)**:
  - [x] Replaced blocky container with a floating, rounded-2xl glass search bar with smooth focus highlights and blur.
  - [x] Implemented dropdown filter menu with category counts (*Alle Widgets*, *Handy-Kacheln*, *Haftnotizen*, *Zeit & Kalender*, *Finanzen & KPI*, *Aktionen & Lager*).
- [x] **Widget Customization Studio & Gear Icon Modal (`WidgetSettingsModal.tsx`, `DesktopWidgetsLayer.tsx`)**:
  - [x] Added gear icon (`Settings`) button to catalog items and desktop widget headers / context menus.
  - [x] Background style options: *Ohne Hintergrund (Transparent)*, *Liquid Glass*, *Dunkel*, and *Standard Solid*.
  - [x] Typography options: *Standard (Sans)*, *Monospace (Code)*, *Serif (Klassisch)*, and *Display (Modern)*.
  - [x] Text color accents: White, Emerald, Indigo, Amber, Sky Blue, and Rose.
- [x] **Digital, Analog & World City Clocks (`WidgetSettingsModal.tsx`, `DesktopWidgetsLayer.tsx`)**:
  - [x] Real-time geometric round analog clock face with animated second, minute, and hour hands.
  - [x] World timezone and city picker (Berlin, London, New York, Tokyo, Sydney, Zurich, Vienna, etc.) with custom labels.
  - [x] 12-hour AM/PM (ENG) and 24-hour time formatting options.
- [x] **Custom Quick Actions (Schnellstarter) Launcher (`WidgetSettingsModal.tsx`, `DesktopWidgetsLayer.tsx`)**:
  - [x] Configurable 4-slot quick launcher for choosing any application (Invoices, Contacts, POS Kasse, Calendar, Stock, Purchases, Restaurant, etc.).
- [x] **Wallpaper Background Layering (`DesktopWidgetsLayer.tsx`)**:
  - [x] Layer level configuration allowing widgets to sit directly on the wallpaper background layer (`zIndex: 1`) or in the floating interactive layer.

### 2. App Store Integration for Widgets, Completely Pristine Desktop Default & Circular Bottom-Right Icon (v21.8.2)
- [x] **App Store Integration (`AppStoreModule.tsx`)**:
  - [x] Moved `widgets` from default pre-installed/pinned modules into the App Store catalog (`AppStoreModule.tsx`).
  - [x] Removed `widgets` from `DEFAULT_STANDARD_MODULES`, `DEFAULT_PINNED_DESKTOP`, and `DEFAULT_PINNED_TASKBAR` in `DesktopWindowWorkspace.tsx`.
  - [x] Users can now enable/install, launch, or pin Widgets directly through the App Store.
- [x] **Zero-Widget Clean Desktop Default (`DesktopWindowWorkspace.tsx`)**:
  - [x] Initialized desktop widget canvas with 0 widgets by default.
  - [x] Implemented automatic purge of legacy sample demo widgets (`widget-notes-1`, `widget-revenue-1`) from browser localStorage so returning users start with an uncluttered screen.
- [x] **Circular Bottom-Right App Icon (`WidgetsIcon.tsx`)**:
  - [x] Replaced the 4-square grid icon with a distinctive custom `WidgetsIcon` featuring 3 rounded squares and a bottom-right circle for high recognizability.
  - [x] Applied `WidgetsIcon` consistently across taskbar shortcuts, Start menu, App Store, Command Palette, and desktop context menus.

### 2. Minimalist Widgets App with Search-Only Header, Clean Empty Desktop Default & Phone-Style Resizing (v21.8.1)
- [x] **Minimalist Widgets Window App (`WidgetsModule.tsx`)**:
  - [x] Removed redundant top navigation headers, buttons (`+ Neue Haftnotiz`, `Widget-Katalog`, `Aktive Widgets`, `Notizen-Editor`), and category filter pills (`Alle`, `Handy-Kacheln`, `Haftnotizen`).
  - [x] Replaced with a single clean, responsive search bar directly filtering widgets and notes.
  - [x] Direct 1-click "+ Auf Desktop anheften" button on all cards with live interactive preview.
  - [x] Integrated pastel color palette selector into sticky note creation card.
- [x] **Clean Empty Desktop Initialization (`DesktopWindowWorkspace.tsx`)**:
  - [x] Initialized desktop widgets to empty array `[]` by default, giving users an uncluttered desktop with zero forced demo widgets.
- [x] **Smartphone-Style Right-Click Resizing & Draggable Sticky Notes (`DesktopWidgetsLayer.tsx`)**:
  - [x] Right-click context menu on pinned desktop widgets includes size adjustments (`Klein`, `Mittel`, `Groß`), virtual desktop scoping, and removal.
  - [x] Resizing restricted specifically to pinned desktop widgets as requested.
  - [x] Draggable sticky notes ("Schiebe-Widgets") come to foreground on click, support free movement, pastel color switching, and quick close.
- [x] **Label Cleanup & Global Naming (`i18n.ts`, `DesktopWidgetsLayer.tsx`, `DesktopWidgetsModal.tsx`)**:
  - [x] Removed all unnecessary "100% offline / lokal" badges and descriptions from widgets and clock displays.
  - [x] Renamed feature to simply "Widgets" globally across all 4 languages (DE, EN, FR, ES).

### 2. Standalone Widgets & Notes Studio App with Phone-Style Grid Widgets & Floating Sticky Notes (v21.8.0)
- [x] **Dedicated Widgets & Notes Studio Window App (`WidgetsModule.tsx`, `DesktopWindowWorkspace.tsx`)**:
  - [x] Implemented standalone `WidgetsModule` window component for comprehensive management of desktop widgets and sticky notes (create, configure, toggle visibility, and delete).
  - [x] Integrated `widgets` into `ActiveModule`, taskbar pinned defaults, desktop shortcuts, Start menu apps list, and context menu launcher.
  - [x] Added virtual desktop scoping support for widgets (display on specific desktop or all virtual desktops).
- [x] **Phone-Style Grid Widgets & Floating Sticky Notes (`DesktopWidgetsLayer.tsx`, `DesktopWidgetsModal.tsx`, `types.ts`)**:
  - [x] Smartphone-style widgets (Revenue KPIs, Live Clocks, Upcoming Invoices Agenda, Low Stock warnings) with right-click context menu "Vom Desktop entfernen" and size presets.
  - [x] Floating draggable sticky notes with header bar, color picker (6 pastel shades), live inline editing, and instant close button.
- [x] **4-Language Localization (`i18n.ts`)**:
  - [x] Complete translations for `module.widgets` and `desc.widgets` across German, English, French, and Spanish.

### 2. Virtual Desktop Taskbar State Synchronization & Window Bring-Forward Fix (v21.7.2)
- [x] **Taskbar Scoping & Window Bring-Forward (`DesktopWindowWorkspace.tsx`)**:
  - [x] Taskbar open/active indicators now accurately evaluate against the currently active virtual desktop, preventing ghost active badges for apps open on other desktops.
  - [x] Clicking a taskbar icon for an app open on another desktop now brings that window onto the active desktop and focuses it immediately.
  - [x] Desktop switching automatically recalibrates `activeWindowId` to the topmost window of the destination desktop.

### 2. Windows 11 Task View Taskbar Icon Button & Minimal Layout (v21.7.1)
- [x] **Windows 11 Task View Taskbar Icon Button (`DesktopWindowWorkspace.tsx`)**:
  - [x] Replaced wide desktop pill bar (`Desktops 1 2 +`) with the authentic Windows 11 overlapping rectangles icon button next to the search box.
  - [x] Clicking the button or pressing `Ctrl+Tab` opens the full Task View modal with virtual desktop previews and open window management.

### 2. Virtual Desktops, Windows 11 Task View, Desktop Widgets & Sticky Notes, Dunning Modal & CRM 360° (v21.7.0)
- [x] **Virtual Desktops & Taskbar Badges (`DesktopWindowWorkspace.tsx`, `TaskViewModal.tsx`, `types.ts`)**:
  - [x] Implemented multi-workspace state (`virtualDesktops`, `activeDesktopId`) with localStorage persistence.
  - [x] Added Windows 10/11 taskbar badge switcher buttons with live window count indicators and "+ Neuer Desktop" creation.
  - [x] Added fullscreen Windows 11 Task View modal (`Ctrl+Tab`) with live desktop management, window closure, and workspace migration.
  - [x] Added keyboard shortcuts (`Ctrl+Alt+Left/Right` for desktop switching, `Ctrl+Shift+D` for new desktop, `Ctrl+Tab` for Task View).
- [x] **Desktop Widgets & Sticky Notes (`DesktopWidgetsLayer.tsx`, `DesktopWidgetsModal.tsx`, `DesktopWindowWorkspace.tsx`)**:
  - [x] Implemented interactive draggable sticky notes layer on the desktop canvas with color selector and live markdown/text notes.
  - [x] Added Desktop Background context menu items ("+ Neue Haftnotiz anheften", "Desktop-Widgets anpassen...").
  - [x] Implemented Desktop Widgets catalog modal with Live Gross Revenue KPI tile, live clock, and today's due agenda.
- [x] **Invoicing Dunning & Payment Reminders (`DunningModal.tsx`, `InvoicesModule.tsx`)**:
  - [x] Multi-level dunning generator (Stufe 1 freundliche Zahlungserinnerung, Stufe 2 2. Mahnung mit Gebühren, Stufe 3 Letzte Mahnung mit Verzugszinsen).
  - [x] 1-click DIN 5008 print view and offline `.EML` email draft download.
- [x] **CRM 360° Profile & Inventory Reorder (`ContactsModule.tsx`, `ProductsModule.tsx`)**:
  - [x] CRM 360° tabs for contact master data, linked invoices, and contact activity history.
  - [x] 1-click "Nachbestellen" for low-stock inventory directly drafting purchase orders in Purchases.
- [x] **Full 4-Language Localization (`i18n.ts`)**:
  - [x] Added complete translations across German, English, French, and Spanish.

### 2. Isolated Context Menu Dismissal & Start Menu State Preservation Fix (v21.6.3)
- [x] **Context Menu Dismissal Isolation (`DesktopWindowWorkspace.tsx`)**:
  - [x] Removed full-screen overlay interception that was causing inside Start Menu clicks to be treated as outside clicks.
  - [x] Clicking anywhere inside the Start Menu (search bar, empty spaces, buttons) now closes only the active context menu while keeping the Start Menu reliably open.
  - [x] Clicking outside the Start Menu on the desktop, windows, or taskbar dismisses both context menu and Start Menu.

### 2. Default Company Profile UX, Start Menu Profile Card Navigation & Incomplete Master Data Invoicing Warnings (v21.6.2)
- [x] **Default Company Name UX (`db.ts` & `SettingsModule.tsx`)**:
  - [x] Pre-filled default company name with "Ihr Firmenname" in default database settings and SettingsModule profile state.
- [x] **Start Menu Profile Card Deep-Link (`DesktopWindowWorkspace.tsx`)**:
  - [x] Clicking the bottom-left profile card in the Start Menu immediately navigates directly to the "Allgemein & Stammdaten" settings section with auto-dismissal of the Start Menu.
  - [x] The Start Menu profile card dynamically displays the user's configured company name (with multilingual "Ihr Firmenname" fallback) instead of a hardcoded "Administrator" label.
- [x] **Incomplete Master Data Guidance (`InvoicesModule.tsx` & `i18n.ts`)**:
  - [x] Added informative alert banners in the Invoices module and invoice creation modal when essential company master data (address, tax ID, or bank info) is missing, complete with a 1-click button to complete data in Settings.
  - [x] Full 4-language i18n support across German, English, French, and Spanish.

### 2. Context Menu Layer Stacking Fix, Start Menu Brand Polish, .EML & vCard Generators & Product Label Barcodes (v21.6.1)
- [x] **Root-Level Context Menu Layering & Dismissal Fix (`DesktopWindowWorkspace.tsx`)**:
  - [x] Implemented fullscreen backdrop and global capture listener (`pointerdown`) so clicking anywhere outside or pressing `Escape` reliably closes active context menus.
  - [x] Added active "Vom Desktop entfernen" toggle to Start Menu right-click menu.
  - [x] Re-anchored Taskbar context menu at `bottom: 54px` with horizontal clamping.
- [x] **Hover Tooltip Overlap Suppression (`DesktopWindowWorkspace.tsx`)**:
  - [x] Suppressed hover tooltips whenever any context menu is open.

### 3. Windows-Style Context Menus, Desktop & Taskbar Drag-and-Drop Pinning & UI Polish (v21.6.0)
- [x] **Windows-Style Context Menus (`DesktopWindowWorkspace.tsx` & `i18n.ts`)**:
  - [x] Right-clicking desktop icons provides options to "App öffnen", "An Taskleiste anheften / Von Taskleiste lösen", "Vom Desktop entfernen", and "System-Einstellungen".
  - [x] Right-clicking Start menu apps provides options to "App öffnen", "Zum Desktop hinzufügen", and "An Taskleiste anheften / Von Taskleiste lösen".
  - [x] Right-clicking Taskbar icons provides standard window controls ("Fenster schließen", "Minimieren", "Maximieren / Wiederherstellen", "App öffnen", and "An Taskleiste anheften / Von Taskleiste lösen").
  - [x] Right-clicking the desktop background opens the canvas context menu ("Symbole links anordnen", "Am Raster ausrichten", "App Store öffnen", "System-Einstellungen").
- [x] **Bi-directional Drag & Drop App Pinning (`DesktopWindowWorkspace.tsx`)**:
  - [x] Dragging an app from the Start Menu onto the desktop canvas automatically adds and snaps it to the desktop grid.
  - [x] Dragging an app onto the taskbar automatically pins it.
- [x] **Start Button Title & i18n Polish (`DesktopWindowWorkspace.tsx` & `i18n.ts`)**:
  - [x] Updated Start button tooltip to clean "Start" (removed "OS").
  - [x] Added full translations across German, English, French, and Spanish for all context menu actions.

### 2. Streamlined Start Menu Header, Auto-Closing Language Switcher & Footer Polish (v21.5.5)
- [x] **Streamlined Start Menu Header (`DesktopWindowWorkspace.tsx`)**:
  - [x] Removed redundant "Standard-Apps" and "Studio" buttons from the Start Menu top header.
  - [x] Removed "Offline Flow OS" subtitle to present a clean, concise company identity.
- [x] **Auto-Closing Language Selection Flyout (`DesktopWindowWorkspace.tsx`)**:
  - [x] Automatically closes Start Menu when opening language switcher so users return cleanly to the desktop without an open flyout.
- [x] **Footer Info Clean-up (`DesktopWindowWorkspace.tsx`)**:
  - [x] Removed "Web-Vorschau (Info)" footer text link for a clean user avatar and name presentation.

### 2. Silent In-Place Desktop Updates & Seamless Automatic Restart (v21.5.4)
- [x] **Silent In-Place Update Execution (`electron/main.cjs`)**:
  - [x] Configured updater spawning to pass `/S` and `--force-run` arguments so update installations run completely silent in the background.
  - [x] Automatically detects and overwrites the existing installation directory without prompting the user for directory path or setup options.
- [x] **Automatic Post-Install Restart & Seamless Handover (`electron/main.cjs` & `electron-builder.json`)**:
  - [x] Ensured clean app exit to free Windows binary file locks and configured `runAfterFinish: true` so the newly installed version starts automatically upon completion.
  - [x] Polished modal in-app feedback to clearly explain the silent update and automatic relaunch.

### 2. Streamlined Non-Zero Time Units, Dynamic Company Name Resolution & Customer Label Polish (v21.5.3)
- [x] **Streamlined Non-Zero Time Formatting (`SupportServicesModule.tsx`)**:
  - [x] Logbook entries and live-timer strings dynamically omit 0-value units (e.g. `6 Sek.` instead of `0 Tage, 00 Std., 00 Min., 06 Sek.`, or `14 Min., 22 Sek.` when under an hour).
- [x] **Dynamic Company Name Resolution (`SupportServicesModule.tsx`)**:
  - [x] Replaced generic "Firmenbestellung" placeholder with the user’s exact company name configured in Settings / Company Profile across all ticket views, staff defaults, and logbook author entries.
- [x] **Multilingual Customer Company Keys (`i18n.ts`)**:
  - [x] Updated and aligned client company labels across all 4 languages (`Kundenfirma` in German, `Client Company` in English, `Entreprise cliente` in French, and `Empresa cliente` in Spanish).

### 2. Support Live-Timer Persistence, Detailed Time Breakdown & Role Sanitization (v21.5.2)
- [x] **Support Live-Timer Persistence & Multi-State Controls (`SupportServicesModule.tsx`)**:
  - [x] Implemented timestamp-based timer persistence in `localStorage`, maintaining running time across ticket navigation, view switches, and app restarts.
  - [x] Added Pause, Resume, Reset, and Stop & Book controls for flexible timer workflow.
  - [x] Added persistent active timer notification banner at the top of the Support module when a timer is running in the background, with 1-click navigation to the active ticket.
  - [x] Added real-time timer status chips in list and kanban card views.
- [x] **Detailed Human-Readable Time Breakdown (`SupportServicesModule.tsx`)**:
  - [x] Added duration formatting in days, hours, minutes, and seconds (e.g., `0 Tage, 00 Std., 14 Min., 22 Sek.`) alongside digital clock (`00:14:22`) and decimal hours (`0.24 h`).
- [x] **Staff & Role Sanitization & Company Profile Default (`SupportServicesModule.tsx`)**:
  - [x] Removed hardcoded sample/personal defaults; newly created tickets default to company profile name (`Firma`).
  - [x] Added quick navigation links to the Staff & Roles configuration dialog directly from ticket assignment fields.
- [x] **System Date Format Integration & 4-Language Localization (`SupportServicesModule.tsx`, `i18n.ts`)**:
  - [x] Harmonized timesheet table dates with configured system date preferences (`DD.MM.YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`).
  - [x] Full translation coverage across all 4 supported languages (`de`, `en`, `fr`, `es`).

### 2. Mobile Sync Network Auto-Detection, Cloud Preview & Electron Background Server Bridge (v21.5.1)
- [x] **Network Target Mode Switcher (`MobileCompanionImportModal.tsx`)**:
  - [x] Added 3 target tabs: Cloud / Web Preview URL (`https://...`), Local LAN WiFi (`http://192.168.x.x:3000`), and Custom IP/Port.
  - [x] Allows mobile devices to send data globally in Cloud Preview environments over cellular (LTE/5G) or outside WiFi without shared local subnet constraints.
- [x] **APIPA 169.254 Exclusion & Intelligent Priority Sorting (`vite.config.ts`, `electron/main.cjs`)**:
  - [x] Filtered out link-local autoconfiguration `169.254.x.x` addresses.
  - [x] Prioritized standard router LAN subnets (`192.168.*`, `10.*`, `172.*`).
- [x] **Electron Embedded Sync Server (`electron/main.cjs`, `electron/preload.cjs`)**:
  - [x] Native Node.js HTTP server on port 3000 inside packaged Windows desktop app.
  - [x] IPC channel `socdof:mobile-sync-received` and `socdof:get-network-ips` for instant desktop sync without polling lag.
- [x] **Troubleshooting & Diagnostics (`MobileCompanionImportModal.tsx`)**:
  - [x] Added interactive accordion explaining connection requirements between Cloud Web Preview and local offline desktop setups.

### 2. Mobile Companion Integration, Camera QR Optical Scanner & Field Service Data Bridge (v21.5.0)
- [x] **Mobile Companion Synchronization Protocol (`mobileCompanionTypes.ts`)**:
  - [x] Established standardized `SOCDOF_MOBILE_COMPANION_V1` payload format with validation for tickets, timesheets, expenses, GPS, and voice note metadata.
- [x] **Optical Live QR Scanner & Staging Modal (`MobileCompanionImportModal.tsx`)**:
  - [x] High-performance in-browser camera scanning powered by `jsQR` with continuous frame detection and visual reticle.
  - [x] Manual paste and drop support for raw JSON or Base64 QR payloads.
  - [x] Date range filter (all, today, 7 days, 30 days) and intelligent ticket matching (ticketNumber, internal ID, composite key).
  - [x] Interactive deduplication resolution with options to skip existing duplicates or merge newly tracked sessions and field expenses.
  - [x] Interactive in-app specification viewer and 1-click copyable prompt for mobile app companion developers/AIs.
- [x] **Support Services Integration (`SupportServicesModule.tsx`)**:
  - [x] Added prominent "Mobile App Sync" ribbon button in header.
  - [x] Mounted modal with automatic persistence to `localStorage` and direct navigation to newly imported tickets.
- [x] **4-Language Localization & Release Notes (`i18n.ts`, `version.ts`, `V21.md`, `package.json`)**:
  - [x] Fully localized all modal controls, guides, tabs, and buttons across German, English, French, and Spanish.

### 2. Smart Low-Stock Reorder Engine, Amazon Multi-Item Remote Cart Generator & Inventory Replenishment Hub (v21.4.2)
- [x] **Smart Low-Stock Reorder Dashboard (`SmartReorderModal.tsx`)**:
  - [x] Automated replenishment calculator scanning inventory for products at or below threshold levels (`min_qty` or global deficit threshold).
  - [x] Configurable target inventory level (`target_stock`) and auto-suggested replenishment quantities.
  - [x] Per-item exclusion toggle (`exclude_from_reorder`) to suppress automated reorder proposals.
  - [x] Instant search, category filters, and out-of-stock highlights.
- [x] **Amazon Multi-Item Remote Cart & Wishlist URL Generator (`productLinkExtractor.ts`, `SmartReorderModal.tsx`)**:
  - [x] Automated ASIN extraction from Amazon URLs and manual ASIN editing inline.
  - [x] Direct Amazon Remote Cart URL compilation (`/gp/aws/cart/add.html`) mapping `ASIN.1=...&Quantity.1=...` to purchase all deficit items in a single combined cart on Amazon.
  - [x] Multi-item Amazon search generator fallback for items without explicit ASINs.
- [x] **Internal Purchase Order Conversion**:
  - [x] Direct 1-click generation of draft SOCDOF Purchase Orders with supplier allocation and warehouse receiving workflows.
- [x] **Product & Procurement Module Integration (`ProductsModule.tsx`, `PurchasesModule.tsx`)**:
  - [x] Added prominent Smart Reorder Hub launcher buttons with live low-stock count badges.
  - [x] Added `min_qty`, `target_stock`, `asin`, and `exclude_from_reorder` inputs to product edit and creation forms.
- [x] **4-Language Localization & Release Notes (`i18n.ts`, `version.ts`, `V19.md`, `package.json`)**:
  - [x] Complete translations across German, English, French, and Spanish.

### 2. Stock Moves KPI Analytics & Journal Export, Full 4-Language Localization & Purchases Enhancement (v21.4.1)
- [x] **Inventory & Stock Moves KPI Analytics Ribbon (`StockMovesModule.tsx`)**:
  - [x] Implemented real-time KPI overview bar for Total Movements, Inbound Volume (`+`), Outbound Volume (`-`), and Inventory Adjustments/Losses.
  - [x] Added 1-click UTF-8 BOM CSV export for stock transfer audit logs.
  - [x] Added dedicated print journal command with formatted print layout.
- [x] **Purchases & Procurement Module Polish (`PurchasesModule.tsx`)**:
  - [x] Added KPI overview cards for Procurement Volume, In-Flight Orders, Goods Received, and Active Suppliers.
  - [x] Built DIN A4 Purchase Order preview with print modal, duplicate order cloning, and deletion safeguards.
- [x] **Comprehensive Localization & Currency Formatting (`i18n.ts`, `POSModule.tsx`, `StockMovesModule.tsx`)**:
  - [x] Replaced hardcoded strings with full 4-language i18n keys (`de`, `en`, `fr`, `es`) in `src/lib/i18n.ts`.
  - [x] Standardized dynamic company currency usage across POS and Stock views.
- [x] **App Store & Core Branding Rebrand**:
  - [x] Rebranded all remaining instances of "Odoo" to "SOCDOF" across the App Store and throughout the entire application.

### 2. Restaurant & POS Integration with ERP Invoicing, Clean Professional Redesign & GoBD Hospitality Receipts (v21.4.0)
- [x] **Unified Database & Invoice Pipeline (`src/lib/db.ts`)**:
  - [x] Upgraded `createPOSCheckout` to atomically generate official paid `Invoice` records (`GASTRO/2026/...` / `POS/2026/...`) and POS orders in Dexie.
  - [x] Directly updates Dashboard KPI revenue counters, Rechnungsjournal, and Accounting metrics without manual reconciliation.
- [x] **Professional Restaurant & Order Taking Overhaul (`src/components/RestaurantModule.tsx`)**:
  - [x] Redesigned layout with high-contrast slate surfaces, responsive header command ribbon, and zero generic "AI" visual tropes.
  - [x] Interactive floor plan with area filtering (*Innenbereich*, *Terrasse*, *Bar & Counter*, *To-Go / Abholung*) and live table occupancy badges.
  - [x] Quick touch order builder with category filters, preparation notes (e.g. *ohne Zwiebeln*), allergen tags, and item steppers.
- [x] **Live Kitchen & Bar Display (KDS) (`src/components/RestaurantModule.tsx`)**:
  - [x] Real-time ticket board with order timers, custom modification badges, and stage transitions (*In Zubereitung*, *Servierbereit*).
- [x] **Gastronomy Billing & GoBD Bewirtungsbeleg (`src/components/RestaurantModule.tsx`)**:
  - [x] Checkout modal supporting Barzahlung (Cash), EC-/Girokarte, and NFC (Apple/Google Pay).
  - [x] Quick note change calculator, customizable tip amounts, and bill splitting across guests.
  - [x] Tax-compliant German Bewirtungsbeleg generation (§ 4 Abs. 5 Nr. 2 EStG) and printable 80mm thermal receipt.
  - [x] Gastro Tagesabschluss (Z-Bon) with payment breakdown and tax rate distribution.
- [x] **Dashboard & Invoices Module Linkage (`Dashboard.tsx` & `InvoicesModule.tsx`)**:
  - [x] Added `Gastro` and `Kasse` visual badges to Rechnungsjournal and Dashboard recent invoices table.
  - [x] Direct navigation from finalized gastro receipt to official ERP invoice.
- [x] **Internationalization & Versioning (`i18n.ts`, `package.json`, `version.ts`, `V21.md`)**:
  - [x] Added all localization strings across DE, EN, FR, and ES.
  - [x] Bumped version to `21.4.0`.

### 2. Comprehensive Calendar Redesign, Collapsible Sidebar & Chronological Agenda Overhaul (v21.3.5)
- [x] **Modern Command Ribbon & Navigation Bar (`CalendarModule.tsx`)**:
  - [x] Created clean top bar with vibrant Calendar logo, prominent "+ Neuer Termin" primary button, and "Heute" date controls.
  - [x] Implemented instant search with clear button and live result counter.
  - [x] Added segmented view switcher (`Tag`, `Arbeitswoche`, `Woche`, `Monat`, `Agenda`), print, and `.ICS` export.
- [x] **Collapsible Navigation Sidebar (`CalendarModule.tsx`)**:
  - [x] Added toggleable drawer button allowing users to collapse or expand the sidebar for maximum screen utilization.
  - [x] Enhanced mini-month calendar with circular day badges and event dots.
  - [x] Upgraded "Meine Kalender" category filters with colored dots, checkboxes, real-time counters, and "Nur Rechnungen" quick toggle.
  - [x] Added "Nächste Termine" upcoming widget with quick event details inspection.
- [x] **Month, Week & Day Canvas Enhancements (`CalendarModule.tsx`)**:
  - [x] Subtle weekend tinting for Saturday/Sunday columns.
  - [x] Event pills with left color accent bars (`border-l-3`), start time prefixes, and invoice receipt badges.
  - [x] Real-time current time line marker on today's column with live red dot indicator.
- [x] **Chronological Grouped Agenda View (`CalendarModule.tsx`)**:
  - [x] Redesigned Agenda to group events by date headers with weekday formatting, duration calculations, and direct invoice linkage.
- [x] **Polished Appointment Modals (`CalendarModule.tsx`)**:
  - [x] New Appointment and Inspector dialogs with quick duration chips (`15m`, `30m`, `45m`, `1h`, `2h`, `Ganztägig`).
  - [x] Storage target routing between Google Calendar and local SOCDOF database.
- [x] **Versioning & Documentation**:
  - [x] Bumped version to `21.3.5` in `package.json`, `src/lib/version.ts`, and updated `versions/V21.md`.

### 2. Adaptive Folder Mini-App Geometry, Calendar Auto-Dismiss & Google Sync UI Polish (v21.3.4)
- [x] **Adaptive Desktop Folder Icon Proportions (`DesktopWindowWorkspace.tsx`)**:
  - [x] Fixed 2-app folder rendering to display balanced square preview icons side-by-side without vertical stretching, oval distortion, or empty placeholder holes.
  - [x] Implemented proportional 1:1 square icon containers for 1-app, 2-app, 3-app, 4-app, and 5+-app desktop folders.
- [x] **Auto-Dismissing Status Banners in Calendar (`CalendarModule.tsx`)**:
  - [x] Added automatic 6-second timeout dismissal for success (green) and error (red) status notification bars.
- [x] **Calendar Branding & Google Sync Button Contrast (`CalendarModule.tsx` & `DocumentationApp.tsx`)**:
  - [x] Removed redundant "OUTLOOK 365" badge from the Calendar header; app is cleanly titled "Kalender".
  - [x] Enhanced Google Sync button styling and text contrast across both light and dark themes.
- [x] **Versioning & Documentation**:
  - [x] Bumped version to `21.3.4` in `package.json`, `src/lib/version.ts`, and updated `versions/V21.md`.

### 2. Symmetrical Vector App Logo & Streamlined Taskbar Search Labeling (v21.3.3)
- [x] **Symmetrical Precision Vector App Logo (`SocdofLogo.tsx` & `src/assets/socdof_icon.svg`)**:
  - [x] Replaced the cropped, off-center raster start button icon with a mathematically centered, high-resolution SVG vector squircle.
  - [x] Rendered crisp, symmetrical Windows 11-inspired 4-color corner accents (Emerald Green `#22c55e`, Sky Blue `#38bdf8`, Coral Red `#ef4444`, Amber Yellow `#f59e0b`).
  - [x] Rendered a modern, bold white "S" lettermark centered with drop shadow and specular rim.
  - [x] Harmonized padding and curvature inside the `w-9 h-9` Windows 11 taskbar start button.
- [x] **Streamlined Taskbar Search Box Labeling (`src/lib/i18n.ts` & `DesktopWindowWorkspace.tsx`)**:
  - [x] Removed redundant `(Strg+K)` / `(Ctrl+K)` string from `nav.search` text across German, English, French, and Spanish.
  - [x] Search pill now cleanly displays `[🔍 Suchen... Ctrl+K]` without duplicated shortcut labels.
- [x] **Versioning & Documentation**:
  - [x] Bumped version to `21.3.3` in `package.json`, `src/lib/version.ts`, and added release notes to `versions/V21.md`.

### 2. Desktop Grid Collision Guard, Folder Drag & Modern Glass Styling (v21.3.2)
- [x] **Desktop Grid Collision Guard**:
  - [x] Implemented collision deduplication and free slot finding so desktop icons and folders never overlap or stack inadvertently.
  - [x] Enabled full drag-and-drop repositioning for desktop folders with coordinate persistence.
- [x] **Modern Frosted Folder Glass**:
  - [x] Redesigned desktop folder containers with liquid frosted glass styling and 2x2 mini icon previews.
- [x] **Google Calendar OAuth Verification**:
  - [x] Verified OAuth popup configuration without offline access conflicts.

### 3. Google OAuth Multi-Account Selection & Firebase Auth Resilience (v21.3.1)
- [x] **Multi-Account Account Chooser (`googleCalendarProvider.setCustomParameters({ prompt: 'select_account' })`)**:
  - [x] Updated Google OAuth configuration to ensure the Google account selection prompt is always displayed, allowing users to choose or switch between any Google account freely.
- [x] **Firebase Auth Error Handling & Resilience**:
  - [x] Implemented graceful handling for user popup closures (`auth/popup-closed-by-user`), browser popup blocking, cancelled requests, and network errors.
- [x] **Calendar Scopes & Bidirectional Sync**:
  - [x] Verified full Google Calendar OAuth scopes (`calendar.events`, `calendar.readonly`) and automated 2-way sync with local events and invoice due dates.
- [x] **Versioning & Documentation**:
  - [x] Bumped version to `21.3.1` in `package.json`, `src/lib/version.ts`, and updated `versions/V21.md`.

### 2. Spotlight Command Palette, Showcase & Documentation Hub Portal & Global Shortcuts (v21.3.0)
- [x] **Spotlight Command Palette (`CommandPaletteModal.tsx` & `DesktopWindowWorkspace.tsx`)**:
  - [x] Implemented global `Ctrl + K` / `Cmd + K` search dialog with module launchers, fast database search (invoices, contacts, products), and quick system action toggles (Theme, Sound, Language).
  - [x] Integrated Windows 11 Taskbar Search Pill button next to the Start Menu.
- [x] **Showcase & Documentation Hub Portal (`DocumentationApp.tsx`)**:
  - [x] Overhauled Documentation app into an interactive multi-page portal featuring:
    - [x] Showcase & Feature Matrix with compliance badges.
    - [x] Releases & Download Hub with Windows `.exe` setup installer links.
    - [x] In-depth User Manual for all core business modules.
    - [x] Keyboard Shortcuts Reference Cheat Sheet.
    - [x] Zero-Cloud & DSGVO Compliance Certification.
    - [x] Official Discord Community (`discord.gg/QW85EaXTgB`) and GitHub links.
- [x] **Global Desktop Keyboard Shortcuts**:
  - [x] `Ctrl + K` / `Cmd + K` Spotlight Search.
  - [x] `F1` Help & Documentation Hub.
  - [x] `Alt + 1..9` Quick-launch / focus pinned taskbar apps.
  - [x] `Ctrl + Space` Toggle Start Menu.
  - [x] `Esc` Dismiss active modal dialogs, flyouts, and search palette.
- [x] **Full 4-Language Localization & Versioning**:
  - [x] Updated `src/lib/i18n.ts` with all translation keys across German, English, French, and Spanish.
  - [x] Bumped version to `21.3.0` in `package.json`, `src/lib/version.ts`, and updated `versions/V21.md`.

### 2. Microsoft Outlook 365 Calendar Layout, End Time & Navigation Chevrons (v21.2.0)
- [x] **Outlook-Style Calendar Interface (`CalendarModule.tsx`)**:
  - [x] Implemented Microsoft Outlook 365 command ribbon with "Neuer Termin" (New Appointment) button and view switchers.
  - [x] Added 5-day Work Week view (Monday–Friday) alongside Day, Week, Month, and Agenda layouts.
  - [x] Built Outlook-style left sidebar with category filter checkboxes and "Anstehende Termine" (Upcoming Appointments) quick list.
- [x] **Start & End Time Controls with Duration Calculation**:
  - [x] Added Start Time and End Time fields in event creation and editing dialogs.
  - [x] Implemented dynamic duration calculation showing duration strings (e.g. `1 Std. 30 Min.` or `45 Min.`).
  - [x] Added 1-click duration preset pills (`+15m`, `+30m`, `+45m`, `+1h`, `+2h`, `Ganztägig`).
- [x] **Sidebar Mini-Calendar Navigation**:
  - [x] Added dedicated `<` and `>` chevron buttons in the top-left mini-calendar to flip through months independently.
  - [x] Rendered active date selection and event indicators across mini-calendar day cells.
- [x] **Documentation & Versioning**:
  - [x] Updated user manual in `DocumentationApp.tsx` with Outlook calendar documentation.
  - [x] Updated `src/lib/i18n.ts` with complete German, English, French, and Spanish localization keys.
  - [x] Bumped version to `21.2.0` in `package.json`, `src/lib/version.ts`, and updated `versions/V21.md`.

### 2. Electron Builder Windows Packaging Schema Alignment (v21.1.1)
- [x] **CI/CD Configuration Schema Fix**:
  - [x] Resolved `configuration.win should be one of these: null` error under `electron-builder` v26.15 schema validator.
  - [x] Removed unsupported `legalTrademarks` field from `win` configuration in `electron-builder.json`.
  - [x] Converted `publisherName` to schema-compliant string array `["Yuri / Strudel"]`.

### 2. Taskbar Calendar Flyout Timezone Alignment & Calendar UX Enhancements (v21.1.0)
- [x] **Taskbar Flyout Timezone Alignment**:
  - [x] Replaced manual timezone-sensitive date slicing with timezone-safe utility functions (`formatLocalDate`, `parseLocalDate`, `isSameCalendarDay`, `isEventOnDate`) in `src/lib/googleCalendar.ts`.
  - [x] Fixed date arithmetic in `DesktopWindowWorkspace.tsx` (`calendarDays` and `selectedDateUnifiedEvents`) so events entered on day X no longer show on day X-1 in the taskbar flyout.
  - [x] Rendered distinct category color indicators (Invoices, Google Calendar, Deadlines, Customer meetings) on mini-calendar day cells in the taskbar flyout.
  - [x] Added quick 1-click "+ Termin im Kalender anlegen" prompt directly on empty day agenda selections.
- [x] **Calendar App UX & Feature Enhancements (`CalendarModule.tsx`)**:
  - [x] Integrated hourly time grid (07:00–22:00) into Week and Day views with clickable slot appointment creation.
  - [x] Added 1-click appointment duplication (`Duplizieren`) in the event details modal.
  - [x] Added RFC 5545 `.ics` iCalendar export download button in the calendar header.
  - [x] Polished category chips, search filters, and responsive layout.

### 2. Google Calendar 2-Way Live Sync, Dedicated Calendar App & Documentation (v21.0.0)
- [x] **Dedicated Calendar Desktop App (`CalendarModule.tsx`)**:
  - [x] Implemented multi-view calendar (Month, Week, Day, Agenda) with fluid view transitions.
  - [x] Built unified event display combining Google Calendar items, customer invoice due dates, and local custom appointments.
  - [x] Implemented interactive appointment creation dialog with start/end time, all-day toggle, category styling, location, and description.
- [x] **Google Calendar 2-Way Live Sync (`googleCalendar.ts`)**:
  - [x] Implemented Google Calendar REST API integration with OAuth 2.0 / Firebase client token flow.
  - [x] Automatic posting of invoice payment due dates directly to the user's selected Google Calendar.
  - [x] Live fetching of Google Calendar appointments with configurable background sync interval (1 min, 2 min, 5 min) and on-demand sync button.
  - [x] Calendar selection selector (choose which Google Calendar receives invoice postings).
- [x] **Dynamic Self-Updating Calendar Icon (`DynamicCalendarIcon.tsx`)**:
  - [x] Reactive calendar icon showing current live month abbreviation and day number across desktop shortcuts, taskbar buttons, and window headers.
- [x] **Taskbar Flyout & App Store Integration**:
  - [x] Upgraded taskbar clock flyout to render unified events (Google Calendar + Invoices) with direct launch button.
  - [x] Added Calendar app to App Store catalog with 1-click install/uninstall and pinning controls.
- [x] **Documentation & Guidelines Updates**:
  - [x] Added user manual chapters for Calendar, Restaurant, and Support Services in `DocumentationApp.tsx`.
  - [x] Updated `INSTRUCTIONS.md` with mandatory requirement to document all new apps and app changes.
- [x] **Localization & Compliance**:
  - [x] Added full German, English, French, and Spanish translations across all calendar views in `src/lib/i18n.ts`.
  - [x] Compliant with 100% Free, Offline-First, and Feasibility Principles.

### 2. Code Signing & 2-Way Calendar Integration (v20.4.0)
- [x] **Windows Code Signing & SmartScreen Warning Resolution**:
  - [x] Created `scripts/create-dev-cert.ps1` to generate a 5-year Authenticode certificate for developer identity `CN=Yuri / Strudel, O=Strudelcode, C=DE` and install it in the local Trusted Root store.
  - [x] Created `scripts/sign-windows-exe.ps1` to apply SHA256 Authenticode signatures and DigiCert RFC-3161 timestamps to all `.exe` setup installers.
  - [x] Updated `electron-builder.json` with developer publisher configuration (`publisherName: "Yuri / Strudel"`) and standardized artifact naming.
  - [x] Added dedicated "Code-Signing & SmartScreen" tab to `WindowsDesktopManagerModal` with interactive PowerShell commands and setup guidance.
- [x] **2-Way Calendar & External Integrations (iCal, Google Calendar, Outlook)**:
  - [x] Created `src/lib/ical.ts` implementing RFC 5545 `.ics` calendar generation for active invoices, payment due dates, and company milestones.
  - [x] Implemented client-side `.ics` import parser with UID-based deduplication and persistent event storage.
  - [x] Built Google Calendar (`webcal://` & web URL template) and Microsoft Outlook 1-click subscription and open actions.
  - [x] Connected custom calendar events to the Windows 11 Taskbar Agenda flyout in `DesktopWindowWorkspace.tsx` alongside invoice due dates.
  - [x] Updated Settings "Verbindungen" UI with 4-language i18n support (DE, EN, FR, ES) in `src/lib/i18n.ts`.

### 2. Language Persistence, Reactive Language Switcher & Start Menu Icon Geometry (v20.3.1)
- [x] **Language Persistence Across App Restarts**:
  - [x] Fixed initialization sequence in `i18n.ts` and `App.tsx` to read the stored language directly from `localStorage` and `IndexedDB` (`company_profile.language`).
  - [x] Prevented startup routines and modal close handlers from resetting the language to English.
- [x] **Reactive Taskbar & Modal Language Selector**:
  - [x] Bound Taskbar and Start Menu language triggers to the reactive `useLanguage()` state.
  - [x] Added synchronization hook in `LanguageSelectionModal` so the currently active language is pre-selected and highlighted when opened.
  - [x] Fixed close button behavior to preserve current settings without overriding.
- [x] **Crisp Start Menu Icon Geometry**:
  - [x] Updated `SocdofLogo.tsx` with bundled asset imports and mathematically proportioned corner radii (`rounded-lg` for 28px taskbar icon, `rounded-xl` for 36-48px dialogs, `rounded-2xl` for 64px hero).
  - [x] Eliminated distortion, clipping, and blurry fallback rendering.

### 2. Italian E-Invoicing (FatturaPA 1.2.2 & SdI Lifecycle) (v20.3.0)
- [x] **Official Custom Brand Icons**:
  - [x] Extracted and integrated the 3 official icon formats (`.ico`, `.png`, `.svg`) provided in `src/assets/`.
  - [x] Updated `public/socdof_icon.ico`, `public/socdof_icon.png`, `public/socdof_icon.svg`, and `public/favicon.svg`.
  - [x] Updated `SocdofLogo.tsx` to render high-resolution brand asset dynamically with fallback.
- [x] **Windows Executable (.exe) Packaging**:
  - [x] Configured `electron-builder.json` with `"win.icon": "public/socdof_icon.ico"` for native Windows installer & executable icons.
  - [x] Configured `electron/main.cjs` to load native `.ico` / `.png` on runtime window startup.

### 2. Fixed Calendar Flyout Dimensions & Pre-Release CI/CD Tagging (v20.1.1)
- [x] **Constant-Height Calendar Flyout**:
  - [x] Fixed `calendarDays` logic in `DesktopWindowWorkspace.tsx` to strictly generate 42 cells (6 full rows × 7 days) for every month.
  - [x] Fixed agenda container height to `h-28` with smooth overflow scroll, completely eliminating window height jumping when switching months.
  - [x] Added multilingual support for weekday headers, month titles, and agenda notices across DE, EN, FR, ES in `src/lib/i18n.ts`.
- [x] **GitHub Release vs. Pre-Release Classification**:
  - [x] Updated `scripts/prepare-release.cjs` to enforce that only root major versions (e.g. `v20.0.0`, `v21.0.0` where `minor === 0 && patch === 0`) are published as full Latest releases.
  - [x] Automatically sets `prerelease: true` and `make_latest: false` for all minor and patch iterations (e.g. `v20.0.9`, `v20.1.0`, `v20.1.1`).
  - [x] Updated `.github/workflows/build-windows-exe.yml` to consume `make_latest` dynamically from release preparation.

### 2. In-App Web Preview Exit Modal & Data Loss Warning (v20.1.0)
- [x] **Interactive In-Page Exit Dialog**:
  - [x] Implemented dedicated in-app modal `WebPreviewModal.tsx` replacing browser-native alerts with a polished user experience.
  - [x] Clearly warns users that data created during web preview is kept only in temporary browser cache and will not be saved permanently upon leaving.
  - [x] Directly highlights the full Windows desktop application with prominent download CTA (`.exe`) linked to GitHub releases.
  - [x] Provides clear dual actions: "Website wirklich verlassen" (bypasses browser dialog and leaves) and "Hier bleiben & weiter testen" (continues preview).
- [x] **Exit Intent & Power Menu Triggers**:
  - [x] Added viewport exit-intent mouse detection (`mouseleave` with `clientY <= 0`) to proactively present options before page close.
  - [x] Integrated seamlessly with the desktop environment Start Menu power/exit action.
- [x] **Quad-Language Translations**:
  - [x] Added full translation keys in German (`de`), English (`en`), French (`fr`), and Spanish (`es`) in `src/lib/i18n.ts`.

### 2. Dynamic Semantic Release Tagging & CI/CD Scalability (v20.0.9)
- [x] **Dynamic Semantic Version Tags**:
  - [x] Replaced single-tag overwriting (`git tag -f v20`) with dedicated semantic version tags (e.g. `v20.0.9`, `v21.0.0`, `v33.0.0`) dynamically extracted from `package.json`.
  - [x] Preserved git history immutability and eliminated release cache conflicts.
- [x] **Universal Multi-Major Pipeline**:
  - [x] Configured GitHub Actions workflow `.github/workflows/build-windows-exe.yml` and `scripts/prepare-release.cjs` to scale dynamically across all future major releases (`v20`, `v21`, `v33`...) without hardcoding.
  - [x] Automated release publication with `make_latest: true` to guarantee immediate in-app update detection.

### 2. Streamlined Backup Settings, Setup Wizard & Snapshot Hygiene (v20.0.8)
- [x] **Backup Settings Decluttering**:
  - [x] Removed outdated setup .cmd button, quick preset pills, notes field, target structure info box, and duplicate header action.
  - [x] Streamlined the backup destination into a clean input with a single, dedicated "Ordner wählen" button.
- [x] **First-Run Backup Setup Wizard**:
  - [x] Created `src/components/BackupSetupModal.tsx` for initial launch onboarding.
  - [x] Provided 3 intuitive options: "Backups aktivieren & Ordner wählen", "Überspringen (Standardverzeichnis beibehalten)", and "Backups deaktivieren".
- [x] **Snapshot Hygiene & Legacy Cleanup**:
  - [x] Automated purging of empty test snapshots from pre-release testing.
  - [x] Prevented automatic background snapshots when database contains zero records.

### 2. Zero Dummy Data Enforcement, Accessible Backup Folder Picker & Snapshot History (v20.0.7)
- [x] **Zero Mock / Example Data Policy**:
  - [x] Removed all dummy company names, fake addresses, placeholder bank accounts, and arbitrary test values from `defaultCompanyProfile` in `src/lib/db.ts`.
  - [x] Added self-healing database seeder logic in `seedInitialDataIfNeeded` to clean legacy dummy data on application boot.
  - [x] Cleaned all misleading placeholder texts across `SettingsModule.tsx` to ensure clean empty states.
  - [x] Formally documented the strict Zero-Mock/Zero-Example-Data rule and User-Friendly Input standard in `INSTRUCTIONS.md`.
- [x] **Accessible Backup Folder Picker & Quick Presets**:
  - [x] Replaced rigid manual text input with modern Directory Picker (`showDirectoryPicker`) and native directory input fallback.
  - [x] Added 1-click Quick Preset location pills (`📁 Documents`, `📁 Downloads`, `📁 Desktop`, `💾 USB Drive`) for non-technical users.
- [x] **Snapshot History Management & Timer Grace Period**:
  - [x] Added "Verlauf leeren" (Clear Snapshot History) action with confirmation dialog.
  - [x] Fixed auto-backup interval timer baseline initialization to prevent redundant empty snapshots on startup.

### 2. Automated GitHub CI/CD Pipeline & In-App Release-Only Update Detection (v20.0.6)
- [x] **Push & Tag Automation Workflow**:
  - [x] Implemented GitHub Actions workflow `.github/workflows/build-windows-exe.yml` triggered on every push (`main`, `master`, `v*`).
  - [x] Automatic check & creation of major root tag (e.g. `v20`, `v19`) if not already present on repository.
  - [x] Automated compilation of Windows Setup installer `.exe` with Electron Builder.
- [x] **Intelligent Release vs. Pre-release Segregation**:
  - [x] Major milestone versions (e.g. `20.0.0`) are published as full GitHub Releases.
  - [x] Intermediate sub-versions and patches (e.g. `20.0.6`, `20.0.5`) are published as GitHub Pre-releases.
- [x] **Release Notes Extraction**:
  - [x] Implemented `scripts/prepare-release.cjs` to extract matching version changelog from `versions/V*.md` directly into the release body.
- [x] **Strict In-App Release Filter**:
  - [x] Hardened `src/lib/updateChecker.ts` to strictly ignore all pre-releases so in-app update prompts are exclusively triggered by full stable releases.

### 2. Automated Database Backups, Web-Vorschau Isolation & FatturaPA XML Importer (v20.0.5)
- [x] **Automated Background Database Backups**:
  - [x] Background scheduler loop in `App.tsx` running `checkAndRunAutoBackup` at user-defined intervals (10m, 30m, 1h, 2h, 6h, 12h, 24h).
  - [x] Full backup UI in Settings (Storage section) with on/off switch, interval selector, custom folder path, manual snapshot trigger, JSON download, and snapshot history with 1-click restore.
- [x] **Web-Vorschau Badge Isolation**:
  - [x] Restricted taskbar "Web-Vorschau" button display strictly to web browser mode (`!isDesktopApp` using `isElectron()` check), ensuring clean desktop native appearance.
- [x] **Italian FatturaPA XML Importer & SdI Parser**:
  - [x] Implemented `src/lib/fatturaPaParser.ts` for parsing XML electronic invoices into SOCDOF Invoice and Contact models.
  - [x] Added XML import button with file dialog in `InvoicesModule.tsx`.
  - [x] Interactive preview modal displaying partner information, tax details, invoice rows, and payment terms before saving to database.

### 2. Automated Update Wizard, Setup-Only Installer Pipeline & Italian FatturaPA (v20.0.4)
- [x] **In-App Automated Update Wizard**:
  - [x] Background GitHub release monitoring on app start with `UpdatePromptModal`.
  - [x] Three action paths: "Jetzt installieren", "Später fragen (Snooze)", "Version überspringen".
  - [x] Download progress bar simulation (MB and percent) and 1-click app close and setup trigger.
- [x] **Setup-Only Packaging Pipeline (No Portable)**:
  - [x] Configured `electron-builder.json` to exclusively build NSIS Windows Setup installer (`SOCDOF.Setup.{version}.exe`).
  - [x] Removed portable build target and portable references from distribution.
- [x] **FatturaPA 1.2.x XML Generator & E-Invoicing**:
  - [x] Implemented `src/lib/fatturaPaGenerator.ts` for Italian electronic invoice generation compliant with Agenzia delle Entrate (SdI) standards.
  - [x] Added XML schema validation check and one-click XML download action in `InvoicesModule` table.

### 2. Web Preview Modal, Update Checker & Exit Confirmation Customization (v20.0.3)
- [x] **Web Preview Guard & Transient Storage Notice**:
  - [x] Implemented `WebPreviewModal.tsx` clarifying in-browser session storage and offering direct GitHub release `.exe` download links.
  - [x] Added `beforeunload` warning event listener in web mode to prevent accidental tab closing without saving.
  - [x] Browser document title dynamically updates to `"SOCDOF - Preview"` in web mode.
  - [x] Integrated colorful SVG data URI favicon fallback for GitHub Pages and web preview environments.
- [x] **Live GitHub Release Update Checker**:
  - [x] Implemented `src/lib/updateChecker.ts` communicating with GitHub API (`Strudelcode/SOCDOF/releases/latest`).
  - [x] Added "Nach Updates suchen" button in Settings with live semver comparison, update status badge, and direct download links.
- [x] **Exit Confirmation Prompt Customization**:
  - [x] Added `disable_exit_prompt` toggle in Settings (Windows section) allowing users to choose between immediate shutdown and modal confirmation.
  - [x] Added `launch_maximized` toggle in Settings.
- [x] **Build & Packaging Configuration**:
  - [x] Configured `electron-builder.json` icon path and launch maximization settings.

### 2. Window Action Buttons Drag Suppression & Titlebar Interaction Fix (v20.0.2)
- [x] **Titlebar Action Buttons Isolation**:
  - [x] Prevented dragging when pressing or clicking down on close (`✕`), minimize (`—`), maximize (`▢`), and split-view snap buttons (`◧` / `◨`).
  - [x] Added `e.stopPropagation()` on `onMouseDown`, `onPointerDown`, and `onDoubleClick` across the action buttons container and buttons.
  - [x] Added defensive `.closest('button, ...')` check inside `startDrag` handler to ignore drag initiation from interactive controls.

### 2. Contacts Modal Viewport Portal & Window Decoupling (v20.0.1)
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

### 8. Italian E-Invoicing (FatturaPA 1.2.2 & SdI Full Lifecycle) & Global Search Polish (v20.3.0)
- [x] **FatturaPA 1.2.2 XML Generator & Schema Compliance**:
  - [x] Support for Italian transmission formats `FPR12` (B2B/B2C) and `FPA12` (Pubblica Amministrazione).
  - [x] Codice Destinatario (7-character for private entities, 6-character for PA), PEC delivery, CIG, CUP, and Bollo Virtuale (2,00 €).
  - [x] Valid tax codes (Codice Fiscale / P.IVA), Natura codes (N1-N7), and Regime Fiscale (RF01-RF19).
- [x] **SdI Receipt & Notification XML Parsing**:
  - [x] Comprehensive parser for Agenzia delle Entrate notification files: `RC` (Ricevuta di Consegna), `NS` (Notifica di Scarto), `MC` (Mancata Consegna), `NE` (Notifica Esito Committente PA), `DT` (Decorrenza Termini), `AT` (Attestazione Trasmissione).
  - [x] Integrated SdI Error Code Catalog (00200, 00201, 00311, 00400, 00404, etc.) with actionable hints in German, English, French, and Spanish.
  - [x] Auto-detection of incoming XML files upon drag-and-drop / upload (distinguishing between invoice XML and SdI notification receipts).
- [x] **FatturaPA & SdI Inspector Modal**:
  - [x] Live XML preview with syntax-colored blocks, copy-to-clipboard, and validation checklist.
  - [x] SdI status management (Not Sent, Sent, Delivered, Rejected, Failed Delivery, PA Accepted, PA Refused).
  - [x] Manual upload and automatic binding of SdI receipts to invoice records.
- [x] **Global Entity Search in Command Palette (`Ctrl+K`)**:
  - [x] Real-time search across CRM Contacts (name, company, email, city), Products (name, SKU, price), Invoices (number, contact, amount), and Navigation actions.
  - [x] Harmonized branding across all search modules.


