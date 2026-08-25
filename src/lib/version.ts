export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = '20.0.1';
export const APP_NAME = 'SOCDOF';
export const APP_FULL_NAME = "Strudel's Organization, Commerce & Documentation Offline Flow";
export const APP_AUTHOR = 'Yuri';
export const APP_LOCATION = 'South Tyrol, Italy';
export const APP_COPYRIGHT = '© Strudel';

export const VERSION_HISTORY: VersionRelease[] = [
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
