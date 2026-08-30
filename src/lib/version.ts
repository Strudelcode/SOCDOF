export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = '21.6.0';
export const APP_NAME = 'SOCDOF';
export const APP_FULL_NAME = "Strudel's Organization, Commerce & Documentation Offline Flow";
export const APP_AUTHOR = 'Yuri / Strudel';
export const APP_LOCATION = 'South Tyrol, Italy';
export const APP_COPYRIGHT = '© Strudel';

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '21.6.0',
    date: '2026-08-30',
    title: 'Offline EML Email Drafts, vCard 3.0 Contact Export, Product QR Labels, Margins & 1-Click Duplication',
    highlights: [
      'Universal RFC 822 EML Draft Generator: 1-click generation of fully formatted .eml email drafts with subject, headers, customer address, line items, and bank transfer details (IBAN/BIC) ready for Outlook, Thunderbird, and Apple Mail without external servers',
      'Electronic Business Cards (vCard 3.0): Native .vcf export for all contacts and business partners, enabling instant address book imports into mobile smartphones and email clients',
      'Product Label & Barcode Printing Hub: High-resolution QR code and Code 128 barcode generator with configurable label dimensions (DIN A4 3x8, 2x5, or 62mm/100mm thermal rolls) and 1-click browser printing',
      'Profit Margin Analytics & Duplication Engine: Real-time calculation of absolute profit margin and profit percentage (%) across product catalogs, accompanied by 1-click duplication for invoices and catalog products',
      'Full 4-Language Localization: Complete translation coverage across German, English, French, and Spanish in src/lib/i18n.ts'
    ]
  },
  {
    version: '21.5.1',
    date: '2026-08-28',
    title: 'Mobile Sync Network Auto-Detection, Cloud Preview & Electron Background Server Bridge',
    highlights: [
      'Multi-Mode Network Target Switcher: Seamless switching between Cloud/Web Preview URL (global access from mobile over LTE/5G), Local LAN WiFi (192.168.x.x for installed Desktop .exe), and custom IP/Port setups',
      'APIPA 169.254 Exclusion & Intelligent Priority Sorting: Clean filtering of link-local 169.254 autoconfig subnets, prioritizing standard 192.168.x.x, 10.x.x.x, and 172.x.x.x LAN IPs',
      'Electron Native Background Sync Server: Embedded HTTP listener on port 3000 in packaged desktop app with IPC bridge for instantaneous background data reception',
      'Connection Guidance & Diagnostics: Added interactive troubleshooting accordion explaining network differences between Cloud Web Preview and local offline desktop environments'
    ]
  },
  {
    version: '21.5.0',
    date: '2026-08-28',
    title: 'Mobile Companion Integration, Camera QR Optical Scanner & Field Service Data Bridge',
    highlights: [
      'Mobile Companion Data Bridge: Seamless zero-cloud synchronization of field service timesheets, on-site tickets, travel mileage (km), GPS coordinates, and field expenses between smartphone companion apps and SOCDOF ERP',
      'Optical QR-Code Live Scanner & JSON Import: High-speed camera scanner powered by jsQR with fallback for direct JSON/Base64 payload pasting and staging review',
      'Intelligent Deduplication & Merge Engine: Automated comparison against existing ERP tickets, allowing users to skip duplicates or merge newly tracked work sessions and expenses seamlessly',
      'SOCDOF_MOBILE_COMPANION_V1 Protocol Specification: Standardized offline sync payload schema with comprehensive developer instructions and copyable integration prompts',
      'Full 4-Language Localization: Complete translation coverage across German, English, French, and Spanish in src/lib/i18n.ts'
    ]
  },
  {
    version: '21.4.2',
    date: '2026-08-28',
    title: 'Smart Low-Stock Reorder Engine, Amazon Multi-Item Remote Cart Generator & Inventory Replenishment Hub',
    highlights: [
      'Smart Reorder & Low-Stock Dashboard: Automated replenishment assistant scanning inventory for products at or below threshold levels (min_qty / global threshold) with live deficit calculations',
      'Amazon Multi-Item Remote Cart Integration: 1-click Amazon Cart generation (ASIN mapping) and Amazon Business Wishlist link generation to instantly reorder multiple low-stock items in a single basket',
      'Item Exclusion & ASIN Management: Fine-grained per-product control to exclude specific items from reordering, customize target stock levels, and auto-detect / edit Amazon ASINs',
      'Internal Purchase Order Generation: Direct conversion of replenishment lists into official SOCDOF draft Purchase Orders with vendor assignments and warehouse staging',
      'Full 4-Language Localization: Complete translation coverage across German, English, French, and Spanish in src/lib/i18n.ts'
    ]
  },
  {
    version: '21.4.1',
    date: '2026-08-28',
    title: 'Stock Moves KPI Analytics & Journal Export, Full 4-Language Localization & Purchases Enhancement',
    highlights: [
      'Inventory & Stock Moves KPI Bar: Added live analytics ribbon tracking Total Movements, Inbound Receipts (+), Outbound Issues (-), and Inventory Adjustments/Losses with instant visual metrics',
      'Stock Journal CSV & Print Export: Integrated 1-click audit-compliant CSV export for stock transfer logs and full-screen formatted print layout',
      'Purchases & Procurement Polish: Added KPI Overview cards, DIN A4 Purchase Order preview with print modal, duplicate order workflows, and supplier metrics',
      'Unified POS & Stock Localization: Comprehensive translation coverage across all 4 supported languages (German, English, French, Spanish) in src/lib/i18n.ts'
    ]
  },
  {
    version: '21.4.0',
    date: '2026-08-27',
    title: 'Restaurant & POS Integration with ERP Invoicing, Clean Professional Redesign & GoBD Hospitality Receipts',
    highlights: [
      'Seamless ERP Invoicing Integration: Every finalized restaurant order and POS sale is automatically recorded as an official paid Invoice (GASTRO/2026/...) and POSOrder in the Dexie database, directly updating Dashboard metrics and revenue journals',
      'Professional Non-AI Aesthetic Overhaul: Completely redesigned the RestaurantModule layout with high-contrast slate command ribbons, table floor maps with area filters (Innenbereich, Terrasse, Bar, To-Go), and real-time status indicators',
      'Live Kitchen Display Monitor (KDS): Interactive ticket stream with stage controls (In Zubereitung, Servierbereit), order timers, and special dish preparation notes (e.g. allergens, custom modifications)',
      'Gastronomy Billing & Cash Register: Multi-method checkout supporting Cash, EC/Credit Card, and NFC (Apple/Google Pay) with quick note helpers, live change calculations, customizable tip buttons, and bill splitting',
      'GoBD Hospitality Receipts & Z-Report: Full support for official German tax-compliant Bewirtungsbelege (§ 4 Abs. 5 Nr. 2 EStG) with host, occasion, and guest details, plus 1-click printable thermal receipts and daily Z-reports'
    ]
  },
  {
    version: '21.3.5',
    date: '2026-08-27',
    title: 'Comprehensive Calendar Redesign, Collapsible Sidebar & Chronological Agenda Overhaul',
    highlights: [
      'Modern Streamlined Command Bar: Unified responsive top bar with bold Kalender identity, + Neuer Termin primary action, Heute date navigators, instant search filter, segmented view modes, and print / .ICS export',
      'Collapsible Smart Sidebar: Toggleable navigation drawer with interactive mini-month calendar picker, category filters with real-time counters, Nur Rechnungen quick switch, and upcoming highlights widget',
      'Refined Month & Week Canvas: High-precision grid layout featuring weekend background tones, circular date markers, live current time indicator, and category accent borders',
      'Chronological Grouped Agenda View: Enhanced agenda view with clean date group headers, day-of-week badges, duration calculations, and direct invoice linkage',
      'Polished Appointment Modals: Sleek New Event and Event Inspector dialogs with quick duration chips (15m, 30m, 45m, 1h, 2h, all-day), Google vs Local storage targets, and duplicate/delete actions'
    ]
  },
  {
    version: '21.3.4',
    date: '2026-08-27',
    title: 'Adaptive Folder Mini-App Geometry, Calendar Auto-Dismiss & Google Sync UI Polish',
    highlights: [
      'Adaptive Folder Icon Proportions: Fixed 2-app folder layout to render balanced square preview icons side-by-side with zero vertical stretching or empty placeholder holes',
      'Auto-Dismissing Calendar Banners: Green and red appointment / sync status alerts automatically disappear after 6 seconds without requiring manual close button clicks',
      'Clean Calendar App Header: Removed Outlook 365 branding badge, keeping the header clean and exclusively named "Kalender"',
      'High-Contrast Google Sync Action: Enhanced Google Calendar synchronization button styling with high-contrast text and crisp Google icon in both light and dark modes'
    ]
  },
  {
    version: '21.3.3',
    date: '2026-08-27',
    title: 'Symmetrical Vector App Logo & Streamlined Taskbar Search Labeling',
    highlights: [
      'Symmetrical Precision Vector Logo: Replaced cropped raster start button asset with a crisp, mathematically centered vector squircle featuring Windows-inspired 4-corner accents and bold S lettermark',
      'Harmonious Start Button Alignment: Logo fits the Windows 11 taskbar button with even padding and seamless corner curvature',
      'Streamlined Taskbar Search Box: Removed redundant hotkey strings from search text labels in all 4 languages (de, en, fr, es) for a clean UI next to the dedicated Ctrl+K badge'
    ]
  },
  {
    version: '21.3.2',
    date: '2026-08-27',
    title: 'Desktop Grid Collision Guard, Folder Drag & Modern Glass Styling',
    highlights: [
      'Desktop Grid Collision Guard: Automated grid deduplication ensuring apps and folders never overlap or stack inadvertently',
      'Modern Frosted Folder Glass: Redesigned desktop folder containers with iOS/Windows 11 liquid glass aesthetic and 2x2 mini icon previews',
      'Universal Desktop Drag & Drop: Full support for dragging folders and apps with smooth grid snapping and automatic conflict resolution',
      'Google Calendar Sync Stability: Verified OAuth popup configuration without offline access parameter conflicts'
    ]
  },
  {
    version: '21.3.1',
    date: '2026-08-27',
    title: 'Google OAuth Multi-Account Selector & Firebase Auth Resilience',
    highlights: [
      'Multi-Account Google Login (prompt: select_account): Users can now freely choose, switch, or connect any Google account directly with zero cross-session lock-in',
      'Firebase Auth Error Resilience: Localized and graceful handling of popup closures, browser popup blockers, and network interruptions',
      'Seamless Calendar & OAuth Scopes Provisioning: Integrated Google Calendar readonly and events synchronization permissions'
    ]
  },
  {
    version: '21.3.0',
    date: '2026-08-27',
    title: 'Spotlight Command Palette, Showcase & Documentation Hub Portal & Global Keyboard Shortcuts',
    highlights: [
      'Spotlight Command Palette (Ctrl+K / Cmd+K): Instant overlay search across all business modules, contacts, invoices, products, and fast system actions (Dark/Light mode, Sound toggle, Language selection)',
      'Multi-Page Showcase & Documentation Hub Portal: Complete overhaul of DocumentationApp into an interactive multi-tab showcase portal with Feature Matrix, Release Notes & Download Hub, Step-by-Step User Manual, Keyboard Shortcuts Reference, and Zero-Cloud Security & DSGVO Compliance documentation',
      'Windows Taskbar Search Pill: Integrated quick-launch search button with Ctrl+K shortcut indicator directly on the Windows 11 taskbar',
      'Global Desktop Keyboard Shortcuts: Added native hotkeys for F1 (Help & Documentation Portal), Alt+1..9 (Open/focus pinned taskbar applications), Ctrl+Space (Toggle Start Menu), and Esc (Close active modal/palette/flyout)'
    ]
  },
  {
    version: '21.2.0',
    date: '2026-08-27',
    title: 'Microsoft Outlook 365 Calendar Layout, End Time Controls, Duration Calculation & Mini-Calendar Navigation',
    highlights: [
      'Microsoft Outlook-Style Desktop Calendar: Overhauled CalendarModule.tsx with an authentic Microsoft Outlook 365 command ribbon, sidebar navigation with category checklists, and signature colored accent bars',
      'Full End Time & Duration Management: Added full Start Date, Start Time, End Date, and End Time controls across all event creation and editing dialogs, complete with automatic duration calculation (e.g., 1h 30m) and quick duration preset pills (+15m, +30m, +45m, +1h, +2h, All-day)',
      'Mini-Calendar Month Navigation: Built independent previous and next month chevrons (< >) on the sidebar mini-calendar for seamless month hopping without losing focus',
      'Outlook View Selector: Integrated Day, 5-Day Work Week (Mon–Fri), Full Week, Month, and Agenda view modes with active state indicators',
      'Upcoming Events Sidebar Widget: Added a live "Anstehende Termine" sidebar panel with quick navigation to today, next appointments, and invoices'
    ]
  },
  {
    version: '21.1.1',
    date: '2026-08-27',
    title: 'Electron Builder Windows Packaging Schema Alignment Fix',
    highlights: [
      'CI/CD Packaging Fix: Resolved electron-builder 26.15 schema validation issue by removing unrecognized configuration keys and formatting publisherName as an explicit array',
      'Automated Windows .EXE Builder: Ensured smooth GitHub Actions workflow execution for automated NSIS standalone installer and portable binary generation'
    ]
  },
  {
    version: '21.1.0',
    date: '2026-08-27',
    title: 'Taskbar Calendar Flyout Timezone Fix, Hourly Grid & Calendar App UX Enhancements',
    highlights: [
      'Taskbar Calendar Flyout Timezone Alignment: Fixed timezone-sensitive date parsing where appointments and invoices appeared one day early; integrated timezone-safe date utilities (formatLocalDate, isEventOnDate) across all flyout and agenda components',
      'Hourly Time Grid for Week & Day Views: Added full 7:00–22:00 hourly schedule grids with clickable time slots for rapid appointment scheduling and visual duration blocks',
      'Event Duplication & Quick Clone: Built 1-click event duplication button in appointment details modal for fast template-based scheduling',
      'iCalendar (.ICS) Export: Added instant 1-click RFC 5545 .ics calendar export download for all filtered appointments and invoice due dates',
      'Visual Category Indicators in Taskbar Flyout: Rendered distinct color dots for Invoices (Indigo), Google Calendar (Blue), Deadlines (Rose), and Customer meetings (Emerald) on taskbar mini-calendar day cells',
      'Taskbar Flyout Quick Add: Added 1-click "+ Termin im Kalender anlegen" prompt directly from empty flyout dates to open the Calendar app'
    ]
  },
  {
    version: '21.0.0',
    date: '2026-08-27',
    title: 'Google Calendar 2-Way Live Sync, Dedicated Calendar Desktop App & Windows Taskbar Agenda Integration',
    highlights: [
      'Dedicated Calendar Desktop App: Full-screen interactive calendar module with Month, Week, Day, and Agenda views, category filtering (Invoices, Google Calendar, Custom), date range picker, and quick appointment creation',
      'Dynamic Taskbar & Desktop Calendar Icon: Self-updating dynamic calendar icon showing the live month abbreviation and current day number across desktop shortcuts, taskbar buttons, and window titlebars',
      '2-Way Google Calendar Live Sync: Instant bidirectional synchronization with Google Calendar API (OAuth 2.0 / Firebase Auth token handling), posting invoice payment due dates directly to selected Google Calendars and pulling external appointments seamlessly into SOCDOF with auto-sync interval options',
      'Unified Windows 11 Taskbar Agenda: Taskbar clock flyout aggregates and displays unified Google Calendar appointments, custom events, and invoice due dates with category badges and instant 1-click app navigation',
      'Full 4-Language Localization (DE, EN, FR, ES): Complete UI translations across all calendar views, event forms, sync configuration dialogs, and App Store metadata',
      '100% Free & Offline-First Compliance: Clean local IndexedDB event storage with no telemetry or paywalls, honoring the Feasibility Principle'
    ]
  },
  {
    version: '20.4.0',
    date: '2026-08-26',
    title: 'Code Signing Infrastructure & 2-Way Calendar Integration (iCal, Google Calendar, Outlook)',
    highlights: [
      'Code Signing & SmartScreen Resolution: Created developer certificate creation and Authenticode signing scripts (`create-dev-cert.ps1`, `sign-windows-exe.ps1`) for Yuri / Strudel (Strudelcode) to eliminate Windows SmartScreen warnings on .exe setup binaries',
      '2-Way iCal Calendar Sync: Implemented RFC 5545 calendar export (`.ics`) and import parser for invoice due dates and external calendar schedules with local persistence and deduping',
      'Google Calendar & Outlook 1-Click Integration: Direct calendar subscription links (webcal://) and instant browser launch buttons for Google Calendar and Microsoft Outlook',
      'Windows 11 Agenda Integration: Taskbar calendar popup now aggregates and displays both invoice deadlines and imported custom calendar entries seamlessly',
      'Settings & Desktop Modal UI Polish: Added dedicated Code-Signing guidance in WindowsDesktopManagerModal and full 4-language i18n support (DE, EN, FR, ES)'
    ]
  },
  {
    version: '20.3.1',
    date: '2026-08-26',
    title: 'Language Persistence Fix, Reactive Language Switcher UI & Start Menu Icon Geometry',
    highlights: [
      'Language Persistence Across Restarts: Fixed language initialization in IndexedDB and localStorage so user-selected languages (German, English, French, Spanish) persist seamlessly across app restarts and closures without reverting to English',
      'Reactive Taskbar Language Switcher: Synchronized the taskbar tray and start menu language indicators to reactively reflect the active language in real time and pre-select the current language in the selection modal',
      'Crisp Start Menu Icon Geometry: Refined SocdofLogo rendering with bundled high-resolution asset imports, proportional corner radius curves, and clean scaling across all sizes'
    ]
  },
  {
    version: '20.3.0',
    date: '2026-08-26',
    title: 'Italian E-Invoicing (FatturaPA 1.2.2 & SdI Full Lifecycle) & Global Search Expansion',
    highlights: [
      'Full Italian E-Invoicing (FatturaPA 1.2.2): Complete XML generation and compliance for B2B/B2C (FPR12) and Public Administration (FPA12) transmission formats with Codice Destinatario, PEC, CIG, CUP, Bollo Virtuale, and valid Natura/Regime Fiscale codes',
      'Agenzia delle Entrate (SdI) Notification Parser: Comprehensive parser for official SdI XML receipts (RC, NS, MC, NE, DT, AT) with integrated error catalog and solution hints in 4 languages (DE, EN, FR, ES)',
      'Interactive FatturaPA & SdI Inspector: Dedicated inspection modal featuring live syntax-colored XML inspection, one-click clipboard copying, SdI status transition controls, and receipt attachment workflow',
      'Global Entity Search in Command Palette: Instant fuzzy search across CRM Contacts, Products, Invoices, and Actions with harmonized SOCDOF branding'
    ]
  },
  {
    version: '20.2.0',
    date: '2026-08-26',
    title: 'Custom Brand Icon Assets Integration & Windows Executable Packaging',
    highlights: [
      'Authentic Brand Icon Assets: Replaced mock badge icons with the official custom SOCDOF brand icons (.svg, .png, .ico) provided in `src/assets`',
      'Windows Executable (.exe) Icon Configuration: Configured electron-builder and electron runtime window shell to bundle and display `public/socdof_icon.ico` natively for packaged Windows executables and desktop shortcuts',
      'Unified Web & Desktop Visual Identity: Integrated the authentic icon asset across the Start Menu button, PWA manifest, and browser tab favicons'
    ]
  },
  {
    version: '20.1.1',
    date: '2026-08-26',
    title: 'Fixed Calendar Flyout Dimensions, Pre-release CI/CD Categorization & Multilingual Date Formatting',
    highlights: [
      'Constant-Height Calendar Flyout: Enforced a strict 6-row (42-day) matrix and fixed agenda container so the calendar popup window maintains an exact, stable height across all months without layout jumping',
      'Pre-Release vs Full Release GitHub Tagging: Updated automated release pipeline so minor and patch builds (e.g. v20.0.9, v20.1.0, v20.1.1) are published strictly as Pre-releases with `make_latest: false`, reserving Full Releases for major milestone versions (e.g. v20.0.0, v21.0.0)',
      'Multilingual Calendar Localization: Added localized month names, weekday acronyms, and agenda labels across German, English, French, and Spanish'
    ]
  },
  {
    version: '20.1.0',
    date: '2026-08-26',
    title: 'In-App Web Preview Exit Modal, Data Loss Prevention Warning & Instant Windows Download',
    highlights: [
      'Interactive In-App Exit Modal: Replaced raw browser dialogs with a custom, in-page exit modal featuring clear data persistence warnings, direct download links, and smooth navigation options',
      'Data Loss Notice: Clear warning explains that browser-demo data is temporary and provides instant download for the full 100% offline Windows app',
      'Exit Intent Detection & Start Menu Integration: Triggers seamlessly when leaving the viewport or clicking power/logout actions in web demo mode',
      'Multilingual Support: Fully translated into German, English, French, and Spanish across all dialog states'
    ]
  },
  {
    version: '20.0.9',
    date: '2026-08-26',
    title: 'Dynamic Semantic Release Tagging, Multi-Major Scalability & CI/CD Integrity',
    highlights: [
      'Dynamic Semantic Release Tagging: Replaced static single-tag overwriting with unique, standard semantic version tags (e.g. v20.0.9, v21.0.0, v33.0.0) generated dynamically on each build',
      'Multi-Major Scalability: GitHub Actions release workflow dynamically adapts to any current or future major version without manual pipeline modifications or hardcoded tags',
      'GitHub Releases & API Harmonization: Native release publishing with `make_latest: true` ensures clean git history, prevents tag collision, and allows in-app update checker to resolve latest releases immediately'
    ]
  },
  {
    version: '20.0.8',
    date: '2026-08-26',
    title: 'Streamlined Backup Settings, First-Run Setup Wizard & Automated Snapshot Hygiene',
    highlights: [
      'Streamlined Backup Settings: Removed redundant quick preset buttons, setup .cmd button, notes field, target structure box, and duplicate header button for a distraction-free, elegant layout',
      'Unified Folder Picker: Replaced fragmented controls with a single, clear folder picker button directly attached to the backup path input',
      'First-Run Backup Setup Wizard: Implemented startup onboarding modal prompting users to activate backups with custom folder selection, skip with default downloads path, or disable backups completely',
      'Automated Snapshot Hygiene: Self-cleaning routine purges empty pre-release snapshot artifacts and prevents automatic creation of zero-record snapshots on empty databases'
    ]
  },
  {
    version: '20.0.7',
    date: '2026-08-26',
    title: 'Zero Dummy Data Enforcement, Accessible Backup Folder Picker & Snapshot Management',
    highlights: [
      'Zero Example/Dummy Data Enforcement: Purged all legacy dummy company names, test addresses, and dummy bank accounts from default profiles and database seeders to ensure pristine initial state',
      'Accessible Backup Folder Picker: Replaced rigid manual text paths with interactive native Directory Picker API (`showDirectoryPicker`), folder browser dialog, and 1-click location presets (Documents, Downloads, Desktop, USB Drive)',
      'Backup Snapshot History Cleaner: Added dedicated action to clear and reset local snapshot history with confirmation',
      'Auto-Backup Timer Grace Period: Fixed auto-backup scheduler to prevent redundant empty snapshot creation on initial launch',
      'Updated Development Guidelines: Formally codified the strict Zero-Mock/Zero-Example-Data rule and User-Friendly Input standard in INSTRUCTIONS.md'
    ]
  },
  {
    version: '20.0.6',
    date: '2026-08-26',
    title: 'Automated CI/CD Release Pipeline, Major Tag Validation & Prerelease Isolation',
    highlights: [
      'Automated GitHub Actions CI/CD: On every push/tag, workflow automatically verifies/creates major root tags (e.g. v20), builds Windows Setup .EXE, and publishes GitHub releases',
      'Smart Release vs. Prerelease Separation: Major milestones (e.g. v20.0.0) are published as full Releases, while intermediate increments (e.g. v20.0.6) are published as Prereleases',
      'Automated Documentation Body Extraction: Automatically extracts detailed release notes directly from versions/V*.md into the GitHub release description',
      'Strict In-App Release Filter: In-app update checker specifically targets official full releases, completely ignoring intermediate pre-releases'
    ]
  },
  {
    version: '20.0.5',
    date: '2026-08-26',
    title: 'Automated Database Backups, Web Preview Badge Isolation & FatturaPA XML Importer',
    highlights: [
      'Automated Background Backups: Periodic auto-backup engine with customizable intervals (minutes to hours), custom backup folder path, on/off toggle, and snapshot history with 1-click restore',
      'Web-Vorschau Badge Isolation: Restricted the Web Preview badge in the taskbar exclusively to browser environments, keeping the Desktop Electron app clean and native',
      'FatturaPA XML Importer & SdI Parser: Complete XML parser for Italian electronic invoices (TD01, TD04...) with interactive preview modal, line items extraction, tax verification, and automatic partner & invoice generation',
      'Enhanced Invoices Journal: XML import action button with direct file selection and instant validation'
    ]
  },
  {
    version: '20.0.4',
    date: '2026-08-26',
    title: 'Automated Update Wizard, Setup-Only Installer Pipeline & Italian FatturaPA E-Invoicing Generator',
    highlights: [
      'Automated In-App Update Wizard: Background GitHub release monitoring with interactive UpdatePromptModal (Install Now, Ask Later, Skip Version) and animated download progress simulation',
      'Setup-Only Packaging Pipeline: Streamlined electron-builder to strictly produce standalone Windows NSIS Setup installers (.exe) without portable packages',
      'Italian FatturaPA 1.2.x XML Generator: Built-in generation, validation and direct download of Italian electronic invoices compliant with Agenzia delle Entrate (SdI) standards',
      'Invoices Table SdI Action: One-click FatturaPA XML export directly from the customer invoice journal'
    ]
  },
  {
    version: '20.0.3',
    date: '2026-08-26',
    title: 'Web Preview Modal, GitHub Release Update Checker, Exit Prompt Customization & Favicon Pipeline',
    highlights: [
      'Web Preview Notification & Info Modal: Informative dialog clarifying browser-based transient storage, beforeunload leave protection, and direct links to download the standalone Windows Desktop .exe release on GitHub',
      'Live GitHub Release Update Checker: Integrated automatic and on-demand check against the official Strudelcode/SOCDOF GitHub Releases API with visual status badges, update notifications, and one-click download',
      'Exit Confirmation Toggle: Added customizable security toggle in Settings to allow instant shutdown or modal confirmation',
      'Windows & Launcher Settings: Added options for launch maximization, periodic reminder suppression, and build icon configuration'
    ]
  },
  {
    version: '20.0.2',
    date: '2026-08-25',
    title: 'Window Action Buttons Drag Suppression & Titlebar Interaction Fix',
    highlights: [
      'Window Action Button Isolation: Completely prevented accidental window dragging when pressing down or clicking on close (✕), minimize (—), maximize (▢), or split-view snap buttons',
      'Event Propagation Safeguards: Added strict onMouseDown, onPointerDown, and onDoubleClick event stopPropagation on titlebar action controls with pointer cursor fidelity',
      'Defensive Drag Target Check: Added interactive element detection in startDrag handler to ensure smooth window repositioning exclusively from titlebar surface'
    ]
  },
  {
    version: '20.0.1',
    date: '2026-08-25',
    title: 'Contacts Modal Viewport Portal, Complete Multilingual Docs & Release Documentation Sync',
    highlights: [
      'Contacts Modal UI Fix: Re-anchored contact creation, batch edit, and CSV import dialogs directly to the document root via React Portal, completely resolving window clipping and backdrop bounds',
      'Documentation App Localization: Refactored the entire user documentation manual with real-time multilingual switching (full German & English chapter parity)',
      'Products Modal Portal Integration: Portaled customer allocation details and product creation forms for consistent edge-to-edge modal display',
      'Release Documentation Protocol: Synchronized documentation standards across versions/releases/ and developer instructions'
    ]
  },
  {
    version: '20.0.0',
    date: '2026-08-25',
    title: 'Desktop Workspace Polish, App Store Scrolling, Timezone Persistence & Taskbar Indicator',
    highlights: [
      'Desktop Icon Interaction & Cursor Fix: Replaced corner grab cursors with native pointer clicks and visual grayscale drag feedback',
      'Taskbar Drag-and-Drop Visual Indicator: Added dynamic pulsed vertical insertion guide line for reordering pinned taskbar applications',
      'App Store Vertical Scrolling: Restructured root container with full vertical scrolling (overflow-y-auto) across all categories and apps',
      'Timezone Persistence & Dynamic System Clock: Taskbar clock, digital time, and calendar flyout dynamically format according to configured company timezone',
      'Settings Section & Storage Metric Polish: Renamed section to "Sprache, Region & Zeit" and added comprehensive tooltip explanation for browser IndexedDB storage usage',
      'Structured Contacts Form: Dedicated distinct inputs for ZIP, City, Country, TaxID, and Notes'
    ]
  },
  {
    version: '19.2.2',
    date: '2026-08-25',
    title: 'Support UI Overlap Fix, Free-Text Assignees, Timer Relocation & GitHub Release Toast',
    highlights: [
      'Dynamic GitHub Release Notification: Replaced static versioning in the web preview toast with dynamic GitHub API release fetching',
      'Personal Data & Default Team Cleanup: Removed hardcoded personal names from staff defaults, set default team to "Standard", and default assignee to "Support Agent"',
      'Flexible Assignee Selection & Free-Text Input: Support tickets now allow instant switching between staff dropdown selection and custom free-text input with 1-click list addition',
      'Form Layout & Overlap Fix: Rebuilt ticket details into a clean 2-column responsive layout with vertical label stacking, eliminating dropdown overlaps across all screen resolutions',
      'Timesheet Live-Timer Relocation: Moved the 1-click live work timer directly into the Zeiterfassung (Timesheets) tab with real-time seconds counter and automatic duration booking',
      'High-Contrast Chatter Tabs: Enhanced active and inactive tab contrast for internal notes and activity logging in light and dark modes'
    ]
  },
  {
    version: '19.2.1',
    date: '2026-08-25',
    title: 'Support Settings, Custom Prefix, Ticket Lifecycle Actions & Dark Mode UI Fix',
    highlights: [
      'Support App Settings & Custom Ticket Prefix: Added full configuration modal to define custom ticket prefixes (SUP-, TICK-, IT-), sequence numbering, default rates, and default team assignments',
      'Ticket Lifecycle & Status Actions: Dedicated 1-click actions to complete (Ticket abschließen), reopen, edit, and safely delete tickets with custom confirmation dialogs',
      'Dark Mode Hover UI Fix: Corrected contrast and hover state glitch on the "In Rechnung stellen" and action buttons in dark mode',
      'Multi-Window Responsive GUI: Polished top action ribbon, status workflow pipeline, and detail view layout for edge-to-edge multi-window layouts and varied screen sizes'
    ]
  },
  {
    version: '19.2.0',
    date: '2026-08-25',
    title: 'Support Teams Manager, Contact Auto-Fill, Clean Empty States & English Docs',
    highlights: [
      'Configurable Support Teams: Added full team management dialog allowing adding, renaming, and deleting custom service teams',
      'Automatic Contact Synchronization: Selecting CRM customers automatically populates email, phone number, and company directly',
      'Refined Time Tracking: Direct duration input with preset hour buttons and 1-click live working timer',
      'Internal Logbook & Activity Stream: Replaced external messaging with internal notes and protocol logging',
      'Strict No-Mock Rule: Module initializes with clean empty states without artificial placeholder data',
      'English Documentation & Completed Tasks Archive: Synchronized INSTRUCTIONS.md, AGENTS.md, todo/todo.md, and created todo/completed_todo.md'
    ]
  },
  {
    version: '19.1.5',
    date: '2026-08-25',
    title: 'Customer Support Experience: Form & Chatter, Timesheets & Pipeline',
    highlights: [
      'Customer Support Form & Chatter: Implemented split layout featuring ticket metadata, team assignments, 3-star priority rating, and real-time activity stream',
      'Timesheet Table & Live-Timer: Built integrated timesheet rows with duration calculations, hourly rates, and a 1-click live work timer directly on tickets',
      'Status Workflow Ribbon: Interactive phase pipeline (New, In Progress, Queue, Resolved, Closed) with automatic activity logging',
      'Unified Kanban & List Views: Seamless toggle between multi-column Kanban board and dense sortable table with multi-criteria filtering'
    ]
  },
  {
    version: '19.1.0',
    date: '2026-08-25',
    title: 'Inter-App Navigation, Unified App Registry & Flexible Versioning',
    highlights: [
      'Inter-App Navigation: Connected Dashboard live metrics directly to Accounting (Abrechnung/BWA), Invoices, Stock/Inventory, and Products with acoustic feedback and directional indicators',
      'Harmonized App Naming: Cleaned up and unified module names across German, English, French, and Spanish (e.g. Dashboard, Invoices, Accounting, Products, Inventory, Purchases, POS, Support, Docs, Settings)',
      'Clean Todo Structure: Repositioned Website/GitHub-Pages deployment into dedicated Platform section and streamlined feature roadmap',
      'Flexible Minor Versioning: Updated operational instructions allowing flexible minor/feature increments (v19.1.0, v19.1.5) for distinct feature milestones'
    ]
  },
  {
    version: '19.0.5',
    date: '2026-08-25',
    title: 'Customer Support Services & Intelligent Product Link Importer',
    highlights: [
      'Intelligent Product Web-Link Importer: Added optional URL import field for Amazon, Otto, MediaMarkt and online shops with automated extraction of title, price, category, domain and image icon',
      'Local Image Upload & Overrides: Support uploading custom offline product images (Base64 IndexedDB) and full override capability on all imported product fields',
      'Customer Product Allocation: Live tracking in inventory showing how many units of each product were assigned to customers with drilldown invoice modal',
      'Customer Support & Services App: New dedicated module for tracking customer support tickets, service times, hourly rates, tags, responsible staff, and billable hours',
      'App Store & Multilingual Integration: Registered Customer Support in App Store with full EN/DE/FR/ES translations and desktop workspace shortcut'
    ]
  },
  {
    version: '19.0.4',
    date: '2026-08-25',
    title: 'Custom Date Ranges, Regional Time Settings & Documentation Architecture',
    highlights: [
      'Custom Date Ranges: Added full custom date range filtering ("Benutzerdefiniert") with start and end date inputs across Dashboard and Accounting (BWA / UStVA)',
      'Expanded Time & Regional Settings: Bundled language, currency, date formats (DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY), selectable timezones, and optional seconds toggle in taskbar clock',
      'Documentation Architecture: Established INSTRUCTIONS.md and AGENTS.md for structured operational guidelines and keep README.md focused for end-users',
      'Updated Todo Registry: Synchronized all completed tasks and milestones into todo/todo.md'
    ]
  },
  {
    version: '19.0.3',
    date: '2026-08-25',
    title: 'Windows 11 Calendar & Agenda Flyout, Exit Confirmation & Standby Polish',
    highlights: [
      'Interactive Calendar & Agenda Flyout: Clicking the taskbar clock opens an authentic Windows 11 calendar popup with live seconds, weekday/date header, interactive month navigation, and quick "Heute" reset',
      'Termine & Fälligkeiten: Agenda section inside the calendar flyout displays upcoming due dates and open invoices with 1-click navigation to invoices',
      'App Exit Confirmation: Clicking "Beenden" in the Start Menu presents a clean dialog ("SOCDOF beenden?") with explicit options to shutdown, restart or cancel',
      'SOCDOF Standby & Lockscreen: Updated shutdown and restart overlays to native SOCDOF branding'
    ]
  },
  {
    version: '19.0.2',
    date: '2026-08-25',
    title: 'Duplicate Tooltip Bugfix & Desktop Hover Polish',
    highlights: [
      'Duplicate Tooltip Fix: Removed native HTML title attributes from desktop app icons and folders to prevent duplicate browser/OS tooltips appearing over the custom SOCDOF design tooltip',
      'Unified Desktop UX: Tooltip rendering is now consistent and clean across both Web Preview and native Electron .exe Desktop app'
    ]
  },
  {
    version: '19.0.1',
    date: '2026-08-25',
    title: 'Desktop Startup Polish, Start Menu Search Fix & Icon Tooltips',
    highlights: [
      'Clean Desktop Launch: Application boots directly into the SOCDOF workspace without auto-opening unnecessary windows',
      'App Name Tooltips: Desktop icons and app folders reveal full titles via smooth ~0.6s hover tooltips',
      'Start Menu Search Fix: Interacting with the start menu search field no longer closes the start menu unexpectedly',
      'Streamlined Start Menu: Removed redundant ".EXE Download" and "Windows App" quick options for a clean 4-button quick bar',
      'Terminology Polish: Replaced legacy "Odoo-Prinzip" references with native "SOCDOF-Prinzip: Doppelte Lagerbuchführung"',
      'Dedicated Application Icon: Explicit SOCDOF app icon branding for Windows .exe package builds'
    ]
  },
  {
    version: '19.0.0',
    date: '2026-08-24',
    title: 'Smart Desktop App Folders, App Store Harmony & Taskbar Streamline',
    highlights: [
      'Smart Desktop App Folders: Drag-and-Drop app grouping creating Android/iOS-style squircle folders with live 2x2 mini icon preview',
      'Interactive Folder Modal: Clean popup view with inline rename, quick app launching, and dissolve folder actions',
      'App Store Typography & Branding: Renamed all instances of "Odoo App Store" to "App Store" with uniform font weights',
      'Taskbar Tray Streamline: Removed redundant local app reminder button for a clean, distraction-free native desktop status bar',
      'Release Versioning & /versions/ documentation: Formally added V19.md, V18.md, V17.md and versioning guidelines',
      'Copyright & Origin: Updated copyright to © Strudel (Yuri, South Tyrol, Italy)'
    ]
  },
  {
    version: '18.3.5',
    date: '2026-08-24',
    title: 'Native Windows Folder Picker & GitHub Pages Base Fix',
    highlights: [
      'Nativer Windows-Ordnerdialog beim Starten: Installationsordner wird beim Ausführen der .cmd/.bat/.ps1 direkt über ein grafisches Windows-Auswahlfenster gewählt',
      'GitHub Pages & Offline Index.html Fix: Relative Basispfade (base: ./) beheben weiße Bildschirme auf strudelcode.github.io/SOCDOF/ und lokalen HTML-Deployments',
      'Vereinfachter Setup-Assistent im Web-Interface: Keine Vorabauswahl im Browser nötig, Direktdownload für .cmd, .bat und .ps1',
      'Automatische Erstellung der Ordnerstruktur (\\Data, \\Backups, \\Exports, \\Config) und Desktop-Verknüpfung'
    ]
  },
  {
    version: '18.3.4',
    date: '2026-08-24',
    title: 'Windows Desktop Setup & Local Directory Hierarchy Wizard',
    highlights: [
      'Echter Windows Setup-Assistent (Setup_SOCDOF_Windows.cmd & Install_SOCDOF_Wizard.ps1) mit interaktiver Pfadauswahl',
      'Automatische Erstellung der lokalen Ordnerstruktur (\\Data, \\Backups, \\Exports, \\Config) auf der PC-Festplatte',
      'Vollständig autarke Offline-Ausführung ohne Cloud-URLs (kein Google 403 Forbidden Fehler mehr)',
      'Konfigurierbare Windows-Pfadverwaltung direkt im Einstellungsbereich "Speicher & Datensicherung"',
      'Verknüpfung zu GitHub Releases für vorkompilierte Electron & NSIS .exe Pakete'
    ]
  },
  {
    version: '18.3.3',
    date: '2026-08-24',
    title: 'Pure Windows OS Experience & Enhanced Language Controls',
    highlights: [
      'Vollständiger Fokus auf Windows 11 Desktop-Fensterverwaltung (Web-Vollbildmodus & Banner entfernt)',
      'Optimierter, kontrastreicher Sprachauswahl-Dialog mit Standard-Englisch und Vektorflaggen',
      'Einheitliches Versions- und Status-Widget in den Einstellungen & Dokumentation',
      'Verbindung der Versionsdaten mit README.md, Status.md und System-Status-Karten'
    ]
  },
  {
    version: '18.3.2',
    date: '2026-08-24',
    title: 'Community Integration & Kalender-Status Korrektur',
    highlights: [
      'Kalender-Status zeigt standardmäßig "Nicht verbunden (Inaktiv)" bis zur echten Kopplung',
      'Offizielles GitHub-Repository (https://github.com/Strudelcode/SOCDOF) verknüpft',
      'Support-Verlinkung ausschließlich auf den Discord-Server (https://discord.gg/QW85EaXTgB)',
      'Offizielles SOCDOF Vektor-Logo als Startbutton, Header & PWA-Icon integriert',
      'Standard-Firmenname auf "Strudel\'s Test GmbH" gesetzt'
    ]
  },
  {
    version: '18.3.1',
    date: '2026-08-24',
    title: 'Windows Desktop Launcher & Sound System',
    highlights: [
      'Automatischer Generator für Windows .bat & .ps1 Desktop-Starter',
      'Akustisches Feedback-System mit Stummschalt-Funktion für alle Interaktionen',
      'Windows Dark Mode & DIN-5008 Light Mode mit dynamischen Akzentfarben'
    ]
  },
  {
    version: '18.3.0',
    date: '2026-08-20',
    title: 'Windows 11 Desktop Workspace & Offline ERP Core',
    highlights: [
      'Verschiebbare, skalierbare Mehrfenster-Umgebung mit Aero Snap Andocken',
      'DIN 5008 Rechnungen, Angebote, Lieferscheine & GiroCode QR-Rechnungen',
      'Restaurant & POS-Kassenmodul mit grafischem Tischplan & Bon-Split',
      '100% Offline-Datenbank (Dexie / IndexedDB) mit 1-Klick JSON-Backup'
    ]
  }
];
