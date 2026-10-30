export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = '24.12.0';
export const APP_NAME = 'SOCDOF';
export const APP_FULL_NAME = "Strudel's Organization, Commerce & Documentation Offline Flow";
export const APP_AUTHOR = 'Yuri / Strudel';
export const APP_LOCATION = 'South Tyrol, Italy';
export const APP_COPYRIGHT = '© Strudel';

import { ARCHIVED_VERSION_HISTORY } from './versionArchive';

/**
 * Active major version releases (V24).
 * Kept concise and fast for everyday builds and rapid agent development.
 */
export const CURRENT_VERSION_HISTORY: VersionRelease[] = [
  {
    version: '24.12.0',
    date: '2026-10-30',
    title: 'Word-Style Tables Redesign & Modern Spreadsheet Features',
    highlights: [
      'Word-Style Ribbon: Compact tab bar (File, Home, Insert, View) with an underline on the active tab and grouped buttons with small labels',
      'Color Rows: Font and fill colors are picked from a Word-style color row instead of separate tiles',
      'Cell Formatting: Bold, italic, underline, alignment, font and fill colors per cell',
      'Formula Bar & Functions: Active cell reference with formula bar and one-click SUMME, MITTELWERT, MAX, MIN and ANZAHL over the cells above',
      'Keyboard Navigation: Enter, arrow keys and Tab move between cells; status bar shows the active cell and filled cell count'
    ]
  },
  {
    version: '24.11.4',
    date: '2026-10-30',
    title: 'Desktop App Icon Grid Spacing & Multi-Line Label Anti-Collision Fix',
    highlights: [
      'Anti-Collision Grid Geometry: Increased desktop icon vertical step from 96px to 116px, ensuring comfortable clearance between adjacent app rows',
      'Multi-Line Title Protection: Bounded desktop icon container height to 104px max with top-aligned content, preventing two-line titles (e.g. Praxis & Therapie) from overlapping lower icons',
      'Automatic Coordinate Migration: Migrated legacy saved icon positions seamlessly to the new spacing without slot collisions or misplaced apps',
      'Responsive Mobile & Folder Spacing: Synchronized folder items and mobile workspace grid to 114px vertical clearance'
    ]
  },
  {
    version: '24.11.3',
    date: '2026-10-30',
    title: 'Installer Bootstrapper Visual Redesign & Natural Manual Text Polish',
    highlights: [
      'Modernized Bootstrapper UI: Redesigned the update screen with fluent typography, status-colored steps, and a glowing gradient progress bar',
      'Cleaner Update Typography: Replaced harsh all-caps titles with natural badges (Automatische Systemaktualisierung / Automatic System Update)',
      'Natural Phrasing Polish: Removed awkward "geräuschlos" wording across manuals and dialogs, replacing with natural background update descriptions',
      'De-hyped Documentation: Eliminated AI-sounding performance buzzwords from the Version History chapter in favor of clean, neutral release filters'
    ]
  },
  {
    version: '24.11.2',
    date: '2026-10-30',
    title: 'OS Language Auto-Detection, Setup Localization & Multi-Language Network Dialogs',
    highlights: [
      'Automatic First-Run Language Detection: Adopts the computer/OS language (German, English, French, Spanish) on first setup with English as reliable fallback',
      'Settings System Sync Toggle: New toggle card in Settings under Language & Region to keep the application language continuously synchronized with the PC',
      'Manual Choice Preservation: Selecting any language manually preserves the user preference and disables OS override automatically',
      'Multi-Language Network Conflict Dialogs: Native network lock warning and takeover dialogs are fully localized in German, English, French, and Spanish',
      'Setup.exe Language Selector: Windows installer allows selecting the desired language on launch, pre-selecting the operating system locale'
    ]
  },
  {
    version: '24.11.1',
    date: '2026-10-30',
    title: 'QNAP & Shared Drive Portable Mode Support & Single-Instance Net Protection',
    highlights: [
      'Custom NSIS Installer Directory: Setup.exe allows selecting any custom folder or mapped network drive (oneClick: false, allowToChangeInstallationDirectory: true)',
      'Multi-Workstation Network Lock: Real-time network session tracking (network_session.lock) detects who is currently active and on which PC',
      'Interactive Conflict Resolution: When a shared database is already open, offers clean Exit, Remote-Save & Close request, or Force Continue',
      'Remote Auto-Save & Graceful Exit: Workstations poll for close requests, automatically save state and close cleanly so other colleagues can take over safely',
      'Shared Database Redirection: In portable/shared mode, all data, backups and configurations are anchored to the shared drive rather than local AppData'
    ]
  },
  {
    version: '24.11.0',
    date: '2026-10-28',
    title: 'Text Editor Word Processor, German Spell Check & Word List',
    highlights: [
      'New Text Editor Module: Word-style text editor with File, Home, Insert and Review ribbon tabs, save and open for text and HTML files, and undo/redo',
      'Offline German Spell Check: Misspelled words are underlined and listed in a proofing panel with suggestions, ignore and add-to-dictionary actions',
      'Word List & Statistics: Shows word frequencies and a status bar with word count, character count and the active language',
      'Full Quad-Lingual Support: Text Editor UI, documentation and launcher entries are available in German, English, French and Spanish'
    ]
  },
  {
    version: '24.10.7',
    date: '2026-10-18',
    title: 'Button Navigation Box Isolation, Card Shadow Exemptions & Dev Script Sanitization',
    highlights: [
      'Card Glow Selector Hardening: Excluded directional borders (border-t/b/l/r/x/y), dividers, buttons, and form controls from ambient card box-shadows in src/index.css',
      'Navigation Bar Visual Fix: Eliminated spurious glowing border frames enclosing the Zurück and Weiter/Submit action buttons in the Reports & Feedback module',
      'Unified Button Sizing & Hierarchy: Unified button padding (px-5 py-2.5 rounded-xl) across all 3 wizard steps with explicit shadow-none dividers',
      'Dev Script Sanitization: Removed redundant CLI flags from package.json dev script preventing duplicate port and host flag crashes during server pre-warming'
    ]
  },
  {
    version: '24.10.6',
    date: '2026-10-18',
    title: 'Reports & Feedback UI Refinement, Button Symmetry & Navigation Auto-Scroll',
    highlights: [
      'Reports & Feedback Action Bar Alignment: Balanced Back and Submit buttons with equal heights, matching border styling, and active-click feedback',
      'Responsive Button Wrapping: Upgraded bottom navigation across all 3 wizard steps with responsive flex layout preventing overlap on narrower screens',
      'Navigation Auto-Scroll: Ensured wizard view and step transitions smoothly scroll to the top so headers and status alerts are never clipped',
      'Bot Token Security Guidance: Re-verified strict isolation of VITE_DISCORD_BOT_TOKEN in root .env avoiding any UI credential leaks'
    ]
  },
  {
    version: '24.10.5',
    date: '2026-10-17',
    title: 'Enhanced SOCDOF Update Center, Interactive Push Simulation & Taskbar Tray Indicator',
    highlights: [
      'Interactive Push Notification Testing: Direct in-app trigger for bottom-right update banners and 1-minute assistant testing',
      'Taskbar System Tray Update Indicator: Subtle animated icon and badge in the desktop taskbar when updates are available',
      'Settings Modernization: Streamlined Updates tab with last-checked timestamp, release channel indicator, background automation toggles, and data preservation guarantee',
      'Cleaned Redundant UI: Removed duplicate checks from Windows desktop tab and reinforced independent SOCDOF native identity'
    ]
  },
  {
    version: '24.10.4',
    date: '2026-10-17',
    title: 'Native SOCDOF Update Center, Bottom-Right Push Notifications & Strict Secret Isolation',
    highlights: [
      'Native Update Center in Settings: Integrated dedicated Updates & System tab with in-place version checking, update banners, and restart instructions',
      'Windows-Style Bottom-Right Push Notifications: Replaced intrusive modals with non-disruptive toasts offering quick Snooze and Download actions',
      'Quad-Lingual Update Assistant: Full DE, EN, FR, ES localization explaining the ~1 minute download time and automatic system restart',
      'Strict Secret Isolation: Removed all UI bot token inputs, securing credentials strictly in git-ignored .env (VITE_DISCORD_BOT_TOKEN)',
      'Independent Identity: Added brand independence principles to INSTRUCTIONS.md, avoiding derivative third-party copycat branding'
    ]
  },
  {
    version: '24.10.3',
    date: '2026-10-16',
    title: 'Silent Background Auto-Update, Process Lock Prevention & Verified Release Pipeline',
    highlights: [
      'Automatic Background Update: Existing installations are auto-detected so desktop updates proceed immediately without requiring manual button clicks',
      'Windows Process Lock Elimination: Gracefully terminates and releases file locks on running SOCDOF processes before installer execution to prevent partial updates',
      'Verified Setup Download Pipeline: Bypasses stale local setup files from old versions (e.g. in Downloads folder), strictly querying GitHub for the verified latest release',
      'Electron Native Clean Handoff: Electron waits on PID termination before spawning the installer, ensuring zero file collisions',
      'Accurate Executable Discovery: Dynamically locates the newly updated SOCDOF executable across Registry, LocalAppData, and custom install directories'
    ]
  },
  {
    version: '24.10.2',
    date: '2026-10-15',
    title: 'Obsidian Squircle Icon, Gradient Action Button & Structured Installer Layout',
    highlights: [
      'Modern squircle app icon: Integrated rounded 20px corners, ambient glow, and subtle glass border ring, eliminating raw square edges',
      'High-end action button: Replaced flat button with a rich gradient (blurple to deep indigo), subtle top highlight, and hover animation',
      'Clean typography hierarchy: Removed clunky static pill enclosures, adopting crisp unboxed subtitle and typographic separators',
      'Balanced information layout: Added a dark feature & status card to eliminate empty vertical voids in both setup and installing states',
      'Synchronized pristine NSIS assets: Regenerated all installer bitmaps with true alpha transparency and squircle branding'
    ]
  },
  {
    version: '24.10.1',
    date: '2026-10-14',
    title: 'Discord-Style Frameless Installer, Crisp Assets & Instant Splash Launch',
    highlights: [
      'Frameless, sleek Discord-style installer window with centered high-res logo and responsive Install button',
      'Accurate installation status flow: Displays "Wird installiert..." during setup and smoothly transitions to "Wird gestartet..." on launch',
      'Eliminated blue border stripes, header bands, and low-res graphics across all installer assets',
      'Regenerated ultra-clean, modern anti-aliased dark BMP and PNG installer graphics matching the true SOCDOF visual identity',
      'Instantaneous startup splash display with non-blocking fonts and borderless window configuration'
    ]
  },
  {
    version: '24.10.0',
    date: '2026-10-13',
    title: 'Selectable Installer & Immediate Branded Startup Splash',
    highlights: [
      'Selectable Windows installation directory while retaining per-user installation under Local AppData by default',
      'Added a compact branded startup splash that appears while the SOCDOF workspace initializes, then closes when the main window is ready',
      'Applied SOCDOF installer header and sidebar branding to the location-selection setup flow',
      'Added a lightweight Windows bootstrapper that opens immediately, downloads the latest setup with real progress, and supports a custom installation directory'
    ]
  },
  {
    version: '24.9.1',
    date: '2026-10-13',
    title: 'Smart Homescreen Download Intelligence & Version-Aware Update Prompts',
    highlights: [
      'Smart Homescreen Download Intelligence: download banners and prompts only appear if the desktop app has not yet been downloaded, or if a newer/higher version is officially published on GitHub releases',
      'Persistent Download State Tracking: automatically records downloaded and installed versions across sessions and suppresses obsolete download banners',
      'One-Click Installed Status Toggle: added an intuitive "Already downloaded" badge and 1-click status toggle in CustomDownloadModal and Start Menu',
      'Context-Aware Taskbar Tray & Toasts: updated Web Preview taskbar tooltips and disabled repetitive notification toasts when the app is already downloaded'
    ]
  },
  {
    version: '24.9.0',
    date: '2026-10-12',
    title: 'Discord-Style One-Click Installer & Frameless Startup Splash Window',
    highlights: [
      'One-Click Modern Installation: replaced the legacy multi-step Windows setup wizard with a seamless Discord/Claude-style One-Click installer installing silently to %LOCALAPPDATA%',
      'Eliminated Wizard Prompts: removed all confusing legacy dialogs ("Installationsoption wählen", "Für wen installieren", "Weiter/Abbrechen") for zero-friction setup',
      'Native Frameless Startup Splash: introduced an instant, dark glassmorphic startup window (320x380 px) with animated pulsing logo and shimmer progress bar, eliminating 10-15s blank launch waits',
      'Seamless Transition: automatically reveals full-screen main window and destroys splash window the exact moment DOM and Electron runtime finish loading'
    ]
  },
  {
    version: '24.8.9',
    date: '2026-10-12',
    title: 'Multilingual BotGhost Webhook Translation Engine (Original, German & English)',
    highlights: [
      'Automatic Dual-Language Translation: user bug reports and feature ideas are automatically translated into German (german_...) and English (english_...) prior to BotGhost webhook dispatch',
      'Original Input Preservation: user inputs are strictly preserved in their unaltered form across standard and original_ variables',
      'HTTP 429 Prevention via Batched Pipeline: bundled all text fields (title, description, location, subarea) into a single batched translation call per language with multi-tier fallback to MyMemory and original text',
      'Context-Aware Anonymity & Mentions: anonymous submitters are formatted as (@Anonym) in German and (@Anonymous) in English, while real Discord mentions (<@...>) and usernames are kept untouched',
      'Complete 8-Way Variable Matrix & Top-Level Keys: provides all short and long webhook variable formats alongside top-level JSON fields for seamless BotGhost embedding'
    ]
  },
  {
    version: '24.8.8',
    date: '2026-10-11',
    title: 'Custom Download Hub, Setup Companion & Background "Updating to Version..." Splash',
    highlights: [
      'Custom Download Hub & Setup Companion: introduced a dedicated, interactive download screen featuring direct Windows .EXE installer downloads, live download progress indicator, and a 4-step installation companion guide',
      'Windows SmartScreen Guidance: integrated an intuitive visual explanation for Windows Defender SmartScreen ("More Info" -> "Run Anyway") ensuring seamless first-time installation for new users',
      'Native Background "Updating to Version..." Splash: when SOCDOF closes during automated updates to allow NSIS to replace binary files, a lightweight native frameless Windows splash window stays active on the user\'s screen showing real-time updating status and progress',
      'In-App Update & Splash Preview: integrated a live simulation test button allowing users to preview and test the exact "Updating to Version..." window directly in the browser and manual'
    ]
  },
  {
    version: '24.8.7',
    date: '2026-10-10',
    title: 'High-Performance Dual-Major Changelog Preset & Comprehensive User Manual Expansion',
    highlights: [
      'Dual-major default preset (V24 & V23): the documentation changelog now defaults to loading exclusively the two newest major version cycles, pruning initial DOM nodes and ensuring smooth 60fps scrolling',
      'Instant older release on-demand loading: added explicit "Show older versions (V22, V21...)" and "Reset filters (V24 & V23)" controls alongside full-archive keyword search across all 240+ releases',
      'Expanded Documentation & Manual: integrated 8 comprehensive new chapters into the manual (Products & Inventory, Purchasing & Suppliers, Hospitality & Restaurant Suite, Commercial Calculator & Margin Math, Desktop Widgets & Taskbar Pins, App Store Modular Management, Invoice Sync & Cash Book, Power-User Shortcuts & Window Snapping)',
      'Enhanced Showcase Matrix: enriched feature showcase with dedicated interactive overview cards for Hospitality & Dining, Customer Support Tickets, and Desktop Widgets'
    ]
  },
  {
    version: '24.8.6',
    date: '2026-10-10',
    title: 'Manual Changelog Performance Optimization & Progressive Loading',
    highlights: [
      'Progressive changelog rendering: the documentation app now initially renders the newest 15 releases instead of rendering all 240+ releases simultaneously, eliminating tab-switching frame drops and scroll lag',
      'On-demand version expansion: introduced intuitive controls ("Load more versions (+20)" and "Load all") to load older releases progressively without freezing the DOM',
      'Adaptive search & major filters: searching keywords or clicking specific major version pills (v24.x, v23.x...) immediately surfaces all matching releases without pagination restrictions'
    ]
  },
  {
    version: '24.8.5',
    date: '2026-10-10',
    title: 'Solid Opaque Popover Surfaces & Ambient Theme Exemption',
    highlights: [
      'Eliminated semi-transparent popovers: exempted popover menus, dropdowns, and flyout dialogs from ambient blurred frosted glass transparency rules so they always render 100% solid and opaque',
      'Foreground clarity: enforced high z-index (z-50) and rich elevation shadows on Rechnungs-Sync and Praxis navigation menus to prevent any background text or cards from bleeding through',
      'Solid inner cards: ensured status summaries and toggle rows inside dropdowns retain crisp, high-contrast, non-translucent background surfaces in both light and dark modes'
    ]
  },
  {
    version: '24.8.4',
    date: '2026-10-10',
    title: 'Praxis App Toolbar Alignment, Popout Stacking Context & Foreground Fix',
    highlights: [
      'Z-index stacking context elevation: raised the practice top navigation bar above the main content canvas so the Rechnungs-Sync dropdown menu renders completely in the foreground',
      'Resolved visual bleed: eliminated overlap where dashboard action pills (+ Neuer Klient) and KPI cards were drawn on top of the open sync popout menu',
      'Logical toolbar grouping: placed Kassenbuch (table / spreadsheet export) on the left side of the practice toolbar alongside navigation tabs',
      'Clean popout anchoring: moved Rechnungs-Sync to the rightmost position so its sync options popout menu opens inward with right-aligned boundary without stranding the table button',
      'Responsive boundary constraint: capped sync popout maximum width to prevent viewport overflows on narrow windows'
    ]
  },
  {
    version: '24.8.3',
    date: '2026-10-09',
    title: 'Single-User Auto-Login (Direct to Desktop), Multi-User Safeguard & Standard Discord Channel Naming',
    highlights: [
      'Single-User Auto-Login option in Settings: skip the login screen and launch directly into the desktop workspace without password prompts on startup',
      'Strict single-user protection: auto-login can only be activated when exactly 1 account exists, and creating a second user is strictly prevented while auto-login is active',
      'Comprehensive security controls: configure auto-login in Security Policies with live status badges, warnings in the user creation panel, and error enforcement',
      'Desktop bypass on login screen: display instant direct-entry button on explicit logout so single users can return to the desktop with a single click',
      'Normalized Discord channel labeling: updated idea and feedback forum channel labels to standard clean text (#💡idea-suggestions)'
    ]
  },
  {
    version: '24.8.2',
    date: '2026-10-08',
    title: 'Company Contacts with Sub-contacts, Split Name Fields & Country Live Autocomplete',
    highlights: [
      'Company-first contact workflow: create business contacts with company name only (Fa.) without requiring personal individual name inputs',
      'Full sub-contacts (Kontaktpersonen) support for companies: manage team members with first name, last name, email, phone, role, and primary contact star toggle',
      'Divided first and last name fields: separated first name and last name into dedicated inputs across individual contacts and company sub-contacts',
      'Interactive live country autocomplete with keyboard navigation: real-time suggestions with flag emojis, localized names, and ISO codes on typing, navigable via arrow keys and Enter',
      'Sub-contact visibility in contact details and deep search integration: view all colleagues in ContactDetailModal with 1-click copy and find companies by employee details'
    ]
  },
  {
    version: '24.8.1',
    date: '2026-10-07',
    title: 'Reports App Icon Enhancement, Universal Label Alignment & GUI Layout Polish',
    highlights: [
      'Introduced dedicated DynamicReportsIcon with high-DPI squircle gradient, layered micro-badge, and multi-size variants (sm, md, lg, xl)',
      'Universal module label alignment across all 4 languages: shortened to clean "Reports" / "Rapports" / "Reportes" across desktop icons, Start Menu, taskbar, sidebar, and launcher, preventing awkward text clipping',
      'Enhanced Discord contact callout in Step 3 with prominent bold badge and clear explanation',
      'Responsive split layout for report wizard and live Discord preview card across medium and large displays'
    ]
  },
  {
    version: '24.8.0',
    date: '2026-10-07',
    title: 'Guided 3-Step Report Wizard, Persistent Live Discord Embed Preview & Desktop Icon GUI Polish',
    highlights: [
      'Introduced a guided 3-step report wizard for the Reports app: Step 1 Category Selection (Bug, Idea, Feedback), Step 2 Details & Location with App Picker, Step 3 Contact & Submission',
      'Persistent Live Discord Embed Preview: preview card is permanently visible right beside the wizard across all 3 steps, reacting in real time to every keystroke and selection',
      'Prominent Discord Contact prompt: boldly highlighted callout for optional & recommended Discord username / User ID so dev team can reply and ping users on the server',
      'Fixed desktop and window icon GUI flaws: eliminated obsolete --tw-ring-color style creating dark ring artifacts in window headers, separated active indicator bar from desktop icon label, and enabled graceful two-line text wrapping'
    ]
  },
  {
    version: '24.7.9',
    date: '2026-10-07',
    title: 'Praxis App Icon & Header Banner GUI Polish',
    highlights: [
      'Fixed Praxis header banner app icon: replaced disparate generic office building glyph with official dedicated medical/therapy practice symbol (Hospital house with plus sign)',
      'Upgraded app icon container from washed-out translucent glass to a solid crisp white card with high-contrast accent-colored icon, perfectly harmonizing with adjacent solid action buttons',
      'Unified practice module icon gradients across App Launcher, Desktop Window Workspace titlebars, App Store, and Command Palette to prevent teal color clashes'
    ]
  },
  {
    version: '24.7.8',
    date: '2026-10-06',
    title: 'Harmonious Color Balance, Anti-Clash Companion Tones & Practice GUI Refinements',
    highlights: [
      'Eliminated hardcoded teal/green buttons, badges, borders, and icons across the Practice module (Client details, Sessions list, Modals, Ledgers), binding all elements dynamically to user accent color',
      'Refined contrasting companion color mathematics to prevent unwanted green/cyan hues for warm accents (Sunset Gold, Amber, Orange, Red pair harmoniously with Indigo)',
      'Softened background radial gradients and backdrop orbs into a gentle, relaxing watercolor ambient ambiance without blotchy color patches',
      'Balanced dual-series monthly chart with anchored baseline indicators for zero-value series and normalized KPI card padding'
    ]
  },
  {
    version: '24.7.7',
    date: '2026-10-06',
    title: 'Harmonized Solid Action Buttons, Chart Guidelines & Viewport Optimization',
    highlights: [
      'Standardized all Practice header quick actions to crisp, solid white buttons with sharp accent color typography, eliminating all translucent ghosting',
      'Added subtle dashed gridlines to the monthly trend chart for clear visual financial scale and orientation',
      'Refined dashboard vertical rhythm, card padding, and bottom breathing room to present upcoming appointments and recent sessions clearly within the window',
      'Streamlined button copy (+ Neuer Klient, + Sitzung, + Abrechnung) for clean responsive presentation'
    ]
  },
  {
    version: '24.7.6',
    date: '2026-10-06',
    title: 'Praxis GUI Polish: Header Banner Buttons, Chart Zero-Value Rendering, Grammar & Metrics Alignment',
    highlights: [
      'Fixed low-contrast and washed-out buttons in the Practice welcome banner, removing background haze and adding high-contrast borders and active hover states',
      'Eliminated ghost pill stubs in monthly revenue/sessions charts for months with zero recorded volume, replacing them with clean baseline markers',
      'Resolved duplicate currency figures under "Durchschnitt pro Sitzung" in Practice metrics, showing descriptive session count context instead',
      'Corrected German singular/plural grammar on session KPI cards ("1 dokumentierte Sitzung" vs "X dokumentierte Sitzungen")',
      'Enhanced bottom scroll padding in the Practice module to prevent bottom cards from clipping at the window edge'
    ]
  },
  {
    version: '24.7.5',
    date: '2026-10-06',
    title: 'Monochromatic Ambient Background Gradient Harmonization',
    highlights: [
      'Eliminated unexpected green/cyan hue shifts in window backgrounds when selecting warm accents like Sunset Gold or Red',
      'Unified all ambient background radial gradients, backdrop orbs, and preview swatches to derive purely from the active accent color',
      'Reserved contrasting companion tones strictly for comparison metrics and dual data series to avoid conflicting colors on workspace canvas',
      'Verified smooth ambient gradient rendering across light and dark themes'
    ]
  },
  {
    version: '24.7.4',
    date: '2026-10-06',
    title: 'Soft Ambient Background Gradient & Harmonious Frosted Glass Aesthetics',
    highlights: [
      'Replaced harsh contrast borders with a dreamy, softly blurred ambient color gradient flowing gently in the window background',
      'Refined card and panel containers into elegant frosted glass surfaces with subtle translucency and gentle borders, allowing the background ambient wash to shine through without sterile white glare',
      'Embedded organic blurred gradient aura backdrops into the Practice module and application windows matching the selected accent color and complementary companion tone',
      'Added live interactive visual preview in Settings under Personalization & Colors with instant quad-lingual reactive feedback',
      'Guaranteed pure white preservation for printable invoices, cash receipts, and document export previews'
    ]
  },
  {
    version: '24.7.3',
    date: '2026-10-05',
    title: 'Vibrant Color & Contrast Mode Across All Apps (Weniger Weiß & Mehr Farbe)',
    highlights: [
      'Expanded the color contrast mode across the entire desktop suite to reduce plain sterile white in all windows (Invoices, Accounting, Contacts, Practice, Products, Calendar, etc.)',
      'Transforms window backgrounds into subtle dual-ambient color gradients matching the selected accent color',
      'Infuses cards, boxes, and panels with elegant soft pastel washes and distinctive colored borders with enhanced contrast',
      'Maintains clean printable invoice sheets and pure white export preview documents',
      'Full quad-lingual localization in German, English, French, and Spanish'
    ]
  },
  {
    version: '24.7.2',
    date: '2026-10-05',
    title: 'Colorful Practice Mode (Farbiger Praxis-Modus) for Enhanced Contrast & Reduced Plain White',
    highlights: [
      'Added an optional "Colorful Practice Mode" setting in Settings -> Personalization & Colors to reduce plain white backgrounds in the Practice app',
      'When enabled, applies soft rich accent color washes and distinct colored card borders around boxes and containers',
      'Persisted across app restarts via localStorage with instant reactive preview and quad-lingual translations (DE, EN, FR, ES)'
    ]
  },
  {
    version: '24.7.1',
    date: '2026-10-05',
    title: 'Praxis Sync Popout Menu, Searchable Client Filter Dialog & Streamlined View Controls',
    highlights: [
      'Replaced cumbersome top banners with a compact, dedicated "Rechnungs-Sync" options popout in the header with live sync statistics, real-time sync toggle, and 1-click full sync',
      'Introduced a searchable in-app Client Filter dialog (TherapyClientFilterModal) in Billing and Sessions with instant keyboard search, client details (city, phone, email, invoice counts), and reset actions',
      'Refined the Billing View mode control into an intuitive "Ansicht: Tabelle / Kästchen" dropdown with clear descriptions and checkmark indicators',
      'Full quad-lingual support across German, English, French, and Spanish'
    ]
  },
  {
    version: '24.7.0',
    date: '2026-10-05',
    title: 'Praxis & Invoices Real-Time Two-Way Synchronization Engine',
    highlights: [
      'Built-in real-time auto-synchronization between Therapy Practice (Praxis & Therapie) and the SOCDOF Invoices app (db.invoices)',
      '1-Click "Sync All with Invoices" action in both module top bar and billing header with animated progress and detailed verification counts',
      'Two-way payment status synchronization: payment registrations in the Invoices app automatically reflect live in Praxis billing and vice versa',
      'Automated session-to-invoice synchronization creating official invoices immediately upon saving clinical session documentation',
      'Visual sync status badges in Table View and Card View with 1-click manual retry triggers and quick links to the Invoices app',
      'Full quad-lingual translations across German, English, French, and Spanish'
    ]
  },
  {
    version: '24.6.9',
    date: '2026-10-04',
    title: 'Handbook Version Filtering & Release Search Engine',
    highlights: [
      'Added interactive Major Version filter pills (v24.x, v23.x, v22.x, etc.) in the Documentation Handbook',
      'Integrated real-time keyword and version search engine with instant highlight matches across titles, dates, versions, and release notes',
      'Added clear search reset controls, result counters, and zero-match empty states with quick reset actions',
      'Full quad-lingual support across German, English, French, and Spanish'
    ]
  },
  {
    version: '24.6.8',
    date: '2026-10-04',
    title: 'Default Table View & Seamless Invoices App Transfer Synchronization',
    highlights: [
      'Set Table View (Tabellenansicht) as the default view for billing invoices with persistent view mode memory',
      'Fixed and strengthened full synchronization when transferring billing entries to the Invoices app (db.invoices & db.contacts)',
      'Added atomic batch state updating (onSaveBatchBilling) to prevent race conditions during bulk transfer',
      'Smoothed selection toolbar rendering with fluid entrance animations and zero layout distortion'
    ]
  },
  {
    version: '24.6.7',
    date: '2026-10-04',
    title: 'Fix False "Post existiert nicht mehr" in Discord Ticket Overview',
    highlights: [
      'Resolved false deleted flag on Discord reports created via BotGhost and webhooks',
      'Restricted remote Discord channel sync exclusively to valid 17-20 digit snowflake thread IDs',
      'Prevented HTTP 401/403 permission/unauthorized states from incorrectly marking tickets as deleted',
      'Added automatic self-healing for legacy reports that had false deleted status flags in local storage'
    ]
  },
  {
    version: '24.6.6',
    date: '2026-10-04',
    title: 'Multi-Selection Checkboxes, 1-Click Paid Bulk Actions & Direct Invoicing Sync',
    highlights: [
      'Added checkboxes to every invoice item and a Master Select All checkbox in both Table and Card (Kästchen) views',
      'Introduced a dedicated Bulk Action Toolbar with 1-click "Mark as Paid" (no payment method prompt required) and "Mark as Open"',
      'Added bulk synchronization and export of selected billing items directly to the Invoices app (db.invoices)',
      'Integrated direct edit pencil buttons across all client cards, hourly rate badges, session boxes, and invoice rows',
      'Complete multilingual support across German, English, French, and Spanish'
    ]
  },
  {
    version: '24.6.5',
    date: '2026-10-04',
    title: 'Direct Edit Pencils & Hourly Rate Controls for Therapy Practice Boxes',
    highlights: [
      'Added direct edit pencil buttons across all client cards, invoices, sessions, and appointment boxes.',
      'Prominent Stundensatz (hourly rate) badge on client cards with direct edit pencil and inline quick-save in client dossier.',
      'Expanded client edit modal with hourly rate, billing/insurance type, full postal address, and birth date.',
      'Introduced card view (Kästchen-Ansicht) toggle for invoices in Therapy Billing with direct amount/fee editing.',
      'Connected invoice editing and delete actions to billing items in the client dossier.'
    ]
  },
  {
    version: '24.6.4',
    date: '2026-10-04',
    title: 'Disable Automatic Browser Fullscreen Hijacking',
    highlights: [
      'Removed automatic HTML5 fullscreen request on pointerdown in web browser view when clicking apps or desktop icons.',
      'Auto-fullscreen on launch is now strictly restricted to the native Electron desktop app when configured in settings.',
      'Manual fullscreen toggle remains accessible via F11 or the taskbar button on demand.'
    ]
  },
  {
    version: '24.6.3',
    date: '2026-10-04',
    title: 'Arbitrary Click-to-Open & Edit for Therapy Sessions',
    highlights: [
      'Users can now click directly on any session card in the Sessions overview, Dashboard recent logs, or Client history to immediately open and edit it.',
      'Centralized the session editing modal with full clinical notes, intervention suggestions, date, duration, fee, and billing draft generation.',
      'Added explicit edit buttons, hover cues, and quad-lingual translations (DE, EN, FR, ES) for seamless session navigation.'
    ]
  },
  {
    version: '24.6.2',
    date: '2026-10-02',
    title: 'Polished Settings Overview & Clear Section Navigation',
    highlights: [
      'Replaced the low-contrast native compact-window selector with a grouped, themed menu that closes on Escape or outside click.',
      'Refined the settings home with clean workspace empty states, clearer quick access, and dynamic accent/companion colors.',
      'Improved keyboard accessibility and documented settings navigation in German, English, French, and Spanish.'
    ]
  },
  {
    version: '24.6.1',
    date: '2026-10-02',
    title: 'System-Default Onboarding & Descriptive App Cards',
    highlights: [
      'First-account theme now consistently defaults to System, even when a previous company profile specified another mode.',
      'Replaced compact app checkboxes with responsive, icon-led cards showing descriptions and clear selection states.',
      'Documented the optional onboarding workflow in German, English, French, and Spanish.'
    ]
  },
  {
    version: '24.6.0',
    date: '2026-10-02',
    title: 'Responsive Settings Navigation',
    highlights: [
      'Replaced clipped horizontal settings tabs on compact windows with a grouped, accessible section selector.',
      'Adapted the settings toolbar, overview cards, and quick preferences for narrow windows while preserving desktop navigation.',
      'Verified TypeScript, production build, and managed preview readiness.'
    ]
  },
  {
    version: '24.5.0',
    date: '2026-10-02',
    title: 'Optional First-Account Workspace Setup',
    highlights: [
      'Optional first-account setup for accent color, light/dark/system appearance, desktop wallpaper, and app templates.',
      'Business and retail templates for invoices, accounting, inventory, purchases, and point of sale, with individually selectable apps.',
      'Setup preferences are stored locally and scoped to the new account; users can skip setup and personalize the workspace later.',
      'Complete German, English, French, and Spanish localization.'
    ]
  },
  {
    version: '24.4.0',
    date: '2026-10-01',
    title: 'Word (.docx) Multi-Page Table Engine, Templates Folder Watcher & PDF Stationery Placement',
    highlights: [
      'Deep Word (.docx) Table AST Engine: Full support for multi-page tables with vertical cell merges (w:vMerge restart/continue), cantSplit row boundaries, and nested table resolution.',
      'Desktop Templates Folder Watcher: Real-time synchronization of the templates/ directory (%APPDATA%/socdof/templates) with live auto-sync badge and Explorer integration.',
      'Interactive PDF Stationery Placement: Interactive DIN-A4 canvas with drag-and-drop token placement, live coordinate calculations, and dedicated token properties inspector.',
      'PDF-to-Image Rendering: High-resolution client-side rendering of PDF letterhead backgrounds via pdfjs-dist for crisp print fidelity.',
      'Full quad-language i18n support across German, English, French, and Spanish.'
    ]
  },
  {
    version: '24.3.0',
    date: '2026-10-01',
    title: 'Default Edge-to-Edge Borderless Fullscreen & Top-Edge Quick Window Controls',
    highlights: [
      'Default Fullscreen Launch: SOCDOF automatically starts edge-to-edge covering the entire screen and Windows taskbar out of the box.',
      'Top-Right Floating Quick Controls: Added dedicated Minimieren (Minimize), Vollbild/Fenster-Modus umschalten (F11), and Abmelden (Logout) pill at the top of the screen.',
      'Universal F11 & Minimize Window Controls: Global F11 shortcut support across Lock Screen, Login, Desktop, and active windows with native Electron window minimization and Web Fullscreen API parity.',
      'Settings Toggle: Added a persistent toggle in System Settings to control whether SOCDOF starts in Fullscreen Mode by default.',
      'Full quad-language i18n support across German, English, French, and Spanish.'
    ]
  },
  {
    version: '24.2.0',
    date: '2026-09-30',
    title: 'Mobile Therapy Dossier Timer, Window Auto-Fit Hardening & Responsive Verification (Phase 12)',
    highlights: [
      'Mobile consultation live timer in the client dossier: start/stop per client, crash-safe localStorage persistence, live running display with pulse state.',
      'Quick session note bottom sheet: capture intervention & progress note directly from the dossier, duration auto-derived from the running timer.',
      'Live viewport auto-fit for open windows: shrinking the viewport below 768px maximizes all open windows instead of leaving them clipped; enlarging restores last geometry.',
      'Fixed duplicate day view rendering in the calendar on narrow windows (desktop day list no longer shows below the mobile hour agenda).',
      'Full quad-language coverage for all new therapy mobile surfaces (DE, EN, FR, ES) and documentation portal chapters updated.'
    ]
  },
  {
    version: '24.1.0',
    date: '2026-09-30',
    title: 'Mobile Calendar Day Agenda & Support Time-Tracking Layouts (Responsive Phases 10 & 11)',
    highlights: [
      'Mobile calendar day view with hour-marker agenda timeline: empty slots are one-tap quick-create targets with live pre-filled times.',
      'Quick appointment creation bottom sheet with touch-optimized 44px+ inputs, duration chips, category & storage destination selection.',
      'Floating quick-add action button and next-upcoming-event quick bar in mobile day view.',
      'Mobile time-tracking widget & touch-friendly ticket card stack replacing the desktop table in compact windows.',
      'Responsive support header with icon-only primary actions on narrow screens.'
    ]
  },
  {
    version: '24.0.0',
    date: '2026-09-30',
    title: 'Mobile-Window Responsive Layout & Adaptive UI System',
    highlights: [
      'Introduced responsive mobile window layouts: shrinking windows below breakpoint thresholds triggers intuitive mobile card views and bottom touch actions.',
      'Mobile-optimized Windows 11 Lock Screen & Login: refined typography, fluid touch-friendly avatar selection, and adaptive credential forms.',
      'Touch-friendly mobile container architecture across all core modules and modals.'
    ]
  },
];

/**
 * Full combined release history for the Documentation & Changelog application.
 */
export const VERSION_HISTORY: VersionRelease[] = [
  ...CURRENT_VERSION_HISTORY,
  ...ARCHIVED_VERSION_HISTORY
];
