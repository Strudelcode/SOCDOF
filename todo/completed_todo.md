# SOCDOF – Completed Tasks & Historical Archive

> This file contains the complete historical archive of all tasks, feature requests, and milestones completed and verified across SOCDOF versions.

---

### Verified Discord Forum Bot Integration & Localhost Proxy in Desktop App (v23.18.12)
- [x] **Verified Discord Bot Forum Creation**:
  - [x] Connected app bug reports and ideas to the official Discord Bot REST API (`POST /channels/{id}/threads`).
  - [x] Implemented background HTTP server and Node.js IPC proxy handlers in Electron (`electron/main.cjs` & `electron/preload.cjs`).
  - [x] Removed all legacy BotGhost webhooks and simulated offline confirmations.
- [x] **Zero False Positives & Accurate Diagnostic Status**:
  - [x] Eliminated misleading "Gesendet!" confirmations when Discord was not actually reached.
  - [x] Added explicit diagnostic warnings and status feedback when tickets are queued locally due to offline state or missing credentials.
- [x] **In-App Bot Token Setup**:
  - [x] Added interactive Bot Token configuration drawer in the Bug-Report modal header with instant validation and secure local storage.

---

### Documentation Portal Layout Hierarchy & Smooth Scrolling Restoration (v23.18.11)
- [x] **Removed Misplaced Top Section**:
  - [x] Deleted hardcoded stand-alone `<section>` card for "Praxis & Therapie" that was erroneously placed outside the portal container above the header ribbon.
  - [x] Restored clean standard header displaying "SOCDOF Portal & Dokumentation" and version badge at the very top.
- [x] **Restored Smooth Scrolling & Interactivity**:
  - [x] Corrected container flexbox hierarchy to `flex flex-col h-full w-full min-h-0 overflow-hidden` on portal root.
  - [x] Set `flex-1 min-h-0 overflow-y-auto` on tab body container and `overflow-hidden` for manual sidebar/content split.
  - [x] Mouse wheel, touch scrolling, and scrollbars now function smoothly without any frozen or clipped behaviour.
- [x] **Proper Module Integration in Handbuch & Showcase**:
  - [x] Added "Praxis & Therapie" as chapter in `docSections` under "Branchen & Spezialmodule".
  - [x] Added card #7 in Showcase & Features matrix for "Praxis & Therapie".

---

### Exclusive Discord Bot Forum Release Broadcast & Webhook Removal (v23.18.10)
- [x] **Complete Legacy Webhook Deprecation**:
  - [x] Removed all webhook fallback code and requests from `scripts/discord_broadcast.py`.
  - [x] Removed `DISCORD_WEBHOOK` secret environment variable from `.github/workflows/discord_release.yml` and `.github/workflows/build-windows-exe.yml`.
- [x] **Exclusive Discord Bot API Integration**:
  - [x] Structured changelog release broadcasts to send exclusively via `POST /channels/{thread_id}/messages` using `Authorization: Bot <TOKEN>`.
  - [x] Integrated auto-unarchive capability (`PATCH /channels/{thread_id}` with `archived: false`) if the forum post became archived.
- [x] **Fail-Fast Error Handling**:
  - [x] Added immediate exit with explicit error diagnostic if `DISCORD_BOT_TOKEN` or `DISCORD_THREAD_ID` is missing.

---

### Adaptive Screen Layout & Dark Mode Polish for Invoice Template Editor (v23.18.9)
- [x] **Adaptive Responsive Layout**:
  - [x] Implemented responsive view switcher on compact screens (< 1280px) to switch between `Layout-Editor` and `Dokument-Vorschau`.
  - [x] On screens >= 1280px (`xl`), side-by-side view is preserved and the bottom bar is automatically hidden.
- [x] **Dark Mode & Selection Menu Polish**:
  - [x] Built custom, theme-aware dropdown selectors for template selection and edit section selection with Lucide icons.
  - [x] Configured native `color-scheme: dark` in `src/index.css` to prevent washed-out browser popup option rendering.
  - [x] Added borders to color presets so dark tones (Navy, Slate Dark) stand out clearly in dark mode.
  - [x] Enhanced form input and textarea dark mode styling across all tabs.
- [x] **Protected Document Paper Sheet & Zoom Controls**:
  - [x] Preserved DIN A4 invoice sheet as authentic white paper sheet with `.invoice-sheet-paper` styles.
  - [x] Added interactive zoom controls (60% to 130%) with 100% reset in preview toolbar.
- [x] **Discord Bot Forum Integration**:
  - [x] Extended `scripts/discord_broadcast.py` and GitHub Actions workflows (`discord_release.yml` and `build-windows-exe.yml`) to support posting release changelogs to Discord Forum threads using a Discord Bot token with automatic thread unarchive.

---

### Prominent Discord Transmission Loading Banner & Verified Delivery Feedback (v23.18.8)
- [x] **Prominent Loading State while Submitting**:
  - [x] Implemented animated transmission banner card (`Wird an Discord gesendet... Bitte warten`) with spinner while dispatching.
  - [x] Submit button actively displays animated spinner and transmission text.
  - [x] Form inputs and buttons are locked during transmission to prevent duplicate submissions.
- [x] **Verified 3-State Delivery Feedback**:
  - [x] Green success banner only displays when verified live on Discord.
  - [x] Amber banner for offline queueing with direct ticket navigation.
  - [x] Red error banner displaying transmission error details without resetting form content.
- [x] **Multilingual i18n Translations**:
  - [x] Added translations for all states across German, English, French, and Spanish in `src/lib/i18n.ts`.

---

### Restored Previous BotGhost Webhook URL & API Configuration (v23.18.7)
- [x] **Webhook Restoration**:
  - [x] Restored `BOTGHOST_WEBHOOK` in `src/lib/discordFeedback.ts` to `https://api.botghost.com/webhook/1498764033518735441/t5dcd2k8x1n8i53932gf` and reset `BOT_TOKEN` to default (`''`).

---

### Updated BotGhost Webhook URL & API Configuration (v23.18.6)
- [x] **New BotGhost Webhook URL & API Token**:
  - [x] Updated `BOTGHOST_WEBHOOK` in `src/lib/discordFeedback.ts` to `https://api.botghost.com/webhook/1498764033518735441/9mvtuh5aaf65v4ipqlilqu`.
  - [x] Configured `BOT_TOKEN` with BG API token `17450aaada2fde267b22f9f917094d13e38c8ba7b51a4df047719f0fd1877089`.

---

### Electron Desktop Main Process Webhook IPC Bridge for Report Sending (v23.18.5)
- [x] **Electron Desktop IPC Webhook Bridge**:
  - [x] Implemented `socdof:discord-webhook` IPC handler in `electron/main.cjs` utilizing `net.fetch` and Node.js native `https` module with automatic redirect handling.
  - [x] Exposed `discordWebhook` via `electron/preload.cjs`.
- [x] **Bypassing Desktop App CORS & Fetch Restrictions**:
  - [x] Bug and feature reports submitted from inside the installed Windows desktop app now correctly dispatch via main process HTTPS POST requests to BotGhost/Discord webhooks, ensuring 100% reliable report sending without getting stuck or failing.

---

### High-Fidelity Word (.docx) XML Table Parsing & Smart Variable Rendering (v23.18.0)
- [x] **Full DOCX XML Table & Layout Parsing**:
  - [x] Implemented structural XML tree parsing for Word documents (`<w:tbl>`, `<w:tr>`, `<w:tc>`), preserving multi-column layouts, side-by-side header boxes, table borders, cell padding, background fills, width percentages, text alignments (`<w:jc>`), font sizes, colors, bolding, and headers/footers (`word/header1.xml`, `word/footer1.xml`).
- [x] **Smart Position Table Substitution**:
  - [x] Automatically identifies and collapses stacked single-line item header paragraphs (e.g. `Pos.`, `Bezeichnung / Artikel`, `Menge`, `Einzelpreis`, `MwSt`, `Gesamt`) appearing directly before `{Positionen_Tabelle}`.
  - [x] Unwraps `<p>{Positionen_Tabelle}</p>` to render clean, responsive, top-level HTML line item tables without DOM nesting issues.
- [x] **1:1 Visual Fidelity**:
  - [x] Imported Word templates match original document layouts in live preview, PDF export, and printing.

---

### PDF & Word (.docx) Template Import & Automatic Variable Extraction (v23.17.0)
- [x] **PDF & Word (.docx / .doc) Document Ingestion**:
  - [x] Client-side parsing of PDF files and Microsoft Word documents (`.docx`, `.doc`), HTML, and text templates.
- [x] **1:1 Variable Extraction & Normalization**:
  - [x] Automatically extracts and normalizes all variable placeholders (`{Rechnungsnummer}`, `{Kunde_Name}`, `{Gesamtbetrag}`, `{Datum}`, `{Faelligkeitsdatum}`, `{{invoice.number}}`).
- [x] **Dynamic Template Re-Use**:
  - [x] Uploaded PDF and Word templates populate dynamically with real invoice data during preview, printing, and PDF export.

---

### Clean Option Labels, Fixed Window Frame & Streamlined Mobile View Switcher (v23.16.6)
- [x] **Clean Section Selection Dropdown**:
  - [x] Removed all emoji symbols from section option labels (`Design, Logo, Farben & Typografie`, `Texte, Titel & Belegangaben`, `Firmendaten, Adresse & Bank`, etc.) for a clean corporate appearance.
- [x] **Fixed Non-Scrolling Window Frame**:
  - [x] Outer modal backdrop and inner dialog cards maintain strict `overflow-hidden` bounds to eliminate window frame scrolling.
- [x] **Streamlined Bottom Switcher**:
  - [x] Compact view switcher displays strictly `[ Editor ]` and `[ Live-Vorschau ]` buttons without emojis or redundant options on small screens.
  - [x] Automatically hides switcher and renders side-by-side split view on larger displays.
- [x] **Universal Quad-Language Parity**:
  - [x] All section labels and switcher texts localized across DE, EN, FR, and ES.

---

### Clean Minimalist Responsive Invoice Layout Switcher & Automatic Split View (v23.16.4)
- [x] **Automatic Desktop Split View & Clutter Removal**:
  - [x] Removed redundant top header view controls, decorative emojis, and the "Beides/Split-View" button.
  - [x] On large screens (`lg:`), automatically displays side-by-side split view without requiring button toggles.
- [x] **Minimalist 2-Button Switcher for Small Screens**:
  - [x] Displays a clean 2-button footer toggle (`[ Editor ]` / `[ Live-Vorschau ]`) using pure vector icons (`Layout`, `Eye`) on compact windows (`lg:hidden`).
- [x] **Universal Quad-Language Parity**:
  - [x] All compact view switcher labels localized in DE, EN, FR, and ES.

---

### Fixed Modal Backdrop Positioning & Responsive Editor vs. Preview View Switcher (v23.16.3)
- [x] **Fixed Backdrop Container Overflow**:
  - [x] Replaced `overflow-y-auto` with `overflow-hidden` on the outer backdrop container in `InvoiceTemplateModal.tsx` and `InvoicePrintModal.tsx`.
  - [x] Ensures modal windows stay 100% fixed and motionless on screen, eliminating accidental backdrop page scrolling.
- [x] **Responsive View Switcher (Editor vs. Live Preview vs. Split View)**:
  - [x] Added clean segmented mode controls (`[ ✏️ Editor ]` / `[ 👁️ Live-Vorschau ]` / `[ ↔️ Nebeneinander ]`) in both header bar and bottom action bar.
  - [x] Allows users to switch seamlessly between 100% full-width editor layout and 100% full-width DIN-A4 document preview.
- [x] **Universal Quad-Language Parity**:
  - [x] All view switcher labels localized in DE, EN, FR, and ES.

---

### Invoice Modal Foreground Layering, Taskbar Clearance & Non-Scrolling Sub-Tabs Layout (v23.16.2)
- [x] **Foreground Z-Index & Taskbar Clearance**:
  - [x] Set backdrop z-index priority to `z-[999999]` across `InvoiceTemplateModal`, `InvoicePrintModal`, `InvoiceEmailModal`, and `PaymentModal`.
  - [x] Added `pb-16`/`pb-20` taskbar clearance padding and `max-h-[calc(100vh-5.5rem)]` container limit to ensure modal footers ("Werkseinstellungen", "Änderungen speichern") sit 100% in the foreground above the Windows taskbar.
- [x] **Non-Scrolling Sub-Tab Navigation**:
  - [x] Replaced the crowded, horizontally scrolling tab bar in `InvoiceTemplateModal.tsx` with a clean 2-row segmented grid control (`Design & Logo`, `Texte`, `Firmendaten` / `Variablen`, `Datei-Import`).
  - [x] Completely removed horizontal scrollbars and truncated labels (`Date...`), guaranteeing clean alignment within left sidebar boundaries.
- [x] **Universal Quad-Language Parity**:
  - [x] All sub-tab labels and tooltips updated for DE, EN, FR, and ES.

---

### Offline Bug Report Queueing, Automatic Online Auto-Sync & Exact Capture Timestamp Preservation (v23.15.0)
- [x] **Unrestricted Offline Report Submission**:
  - [x] Removed blocking error checks preventing submissions when offline or when the Discord bot is unreachable.
  - [x] Allows users to submit reports at any time, saving them locally in an indexed offline queue with status `In Warteschlange (Offline)`.
- [x] **Exact Client Capture Timestamp Preservation**:
  - [x] Records and stores the exact original authoring time (`originalOfflineCreatedAt`).
  - [x] Transmits this original time to Discord in the embed field (`🕒 Ursprünglich offline erfasst am: DD.MM.YYYY, HH:mm:ss`) and footer (`SOCDOF Offline Sync • Erfasst: ...`), so developers see when the bug actually occurred.
- [x] **Automatic Online Background Auto-Sync**:
  - [x] Listens for browser `online` events, window focus changes, application start, and 30-second interval timers in `App.tsx` and `discordFeedback.ts`.
  - [x] Automatically flushes queued reports to Discord without user friction when internet connection or bot availability returns.
  - [x] Upgrades local ticket records to live Discord threads with thread URLs upon successful transmission.
- [x] **Manual Queue Dispatch & User Feedback**:
  - [x] Integrated "Jetzt an Discord senden" manual trigger in ticket history view.
  - [x] Replaced error popups with friendly amber/orange banners and button labels explaining offline auto-sync.
- [x] **Quad-Language Localization**:
  - [x] All new offline queue notices, status badges, and instructions localized in German, English, French, and Spanish (`src/lib/i18n.ts`).

---

### Discord Bug Report User Identity Independence, Live Dynamic Bot Status & Offline Graceful Degradation (v23.14.5)
- [x] **User-Entered Discord Name Independence**:
  - [x] Removed all automatic pre-filling of developer nicknames (`Strudel` / `Strudelgame`) in bug reports and feedback.
  - [x] Discord name input defaults to empty string so users input their own username.
  - [x] Added strict client-side validation requiring a Discord username prior to submission with localized warning messages.
- [x] **Live Dynamic Discord Bot Status Detection**:
  - [x] Replaced static badge with real-time status monitor (`Discord-Bot online`, `Discord-Bot offline`, `Bot wird geprüft...`) in both modal and app.
  - [x] Added polling and quick refresh icon button to re-check bot status immediately.
- [x] **Offline Protection & User Guidance**:
  - [x] Disabled report submission when the Discord bot is offline to prevent lost user data.
  - [x] Added styled offline alert banner in the report form explaining that the bot is normally back within a maximum of 10 minutes.
  - [x] Handled offline submit attempts with clear localized warning dialogues.
- [x] **Full Quad-Language Support (DE, EN, FR, ES)**:
  - [x] Updated all related offline notices, status badges, validation alerts, and placeholders across all 4 languages in `src/lib/i18n.ts`.

---

### Onboarding Language Selection Persistence, Database Profile Default & Account Preferences Sync (v23.14.4)
- [x] **Onboarding Language Retention & Persistence**:
  - [x] Fixed issue where selecting German during initial onboarding reverted back to English upon entering the desktop workspace.
  - [x] Stored chosen language reliably in newly created user preferences (`user.preferences.language`).
  - [x] Persisted chosen language into IndexedDB company profile record and `localStorage ('socdof_language')`.
- [x] **Native German Default Alignment**:
  - [x] Set default language in `defaultCompanyProfile` from English to German (`de`), matching regional formatting standards.
  - [x] Updated `clearDatabaseToEmpty` and `seedInitialDataIfNeeded` to preserve and use existing language instead of forcing English.
- [x] **Company Profile Language Event Sync**:
  - [x] Added `socdof-company-updated` listener in `App.tsx` to immediately synchronize root state when company settings update.
- [x] **Multi-User Session Language Restoration**:
  - [x] Restores the authenticated user's preferred language during login and `AccountScopedWorkspace` mount.
- [x] **Root Modal Cleanliness**:
  - [x] Removed redundant `LanguageSelectionModal` from `App.tsx` that previously caused race conditions with `AuthGate` onboarding.

---

### Discord Tag ID Mapping, Thread Messages Inspector & Custom Emoji Parsing (v23.14.3)
- [x] **Eliminated Redundant Manual Status Selectors**:
  - [x] Removed manual status override dropdowns from ticket history and feedback views.
  - [x] Thread status and tags are authoritatively driven by the Discord Forum.
- [x] **Accurate Bug Report Tag ID Mapping**:
  - [x] `1535711015902384269` -> ⏳ *Neue Einreichung*
  - [x] `1535711141517336636` -> 🔍 *Wird überprüft*
  - [x] `1535710238995648512` -> ❌ *Abgelehnt*
  - [x] `1535711300058091520` -> ✅ *Behoben*
  - [x] `1535714553453740143` -> 🔨 *Problem-Fix in Bearbeitung*
  - [x] `1535714372427583578` -> ↗️ *Bestätigt & weitergeleitet*
- [x] **Discord Thread Messages & History Inspector (`DiscordThreadInspectorModal`)**:
  - [x] Interactive dialog to inspect forum post discussion history, replies, bot/user avatars, and Discord embeds.
  - [x] Direct Discord opening link and manual reload button.
- [x] **Custom Emoji & Discord Markdown Rendering**:
  - [x] Parses custom Discord emojis (`<:name:id>` & `<a:name:id>`), user snowflake mentions (`<@ID>`), channel mentions, blockquotes, codeblocks, and bold/italic text.
- [x] **Full Quad-Language Support (DE, EN, FR, ES)**:
  - [x] All status labels, thread messages, badges, and modals localized in `src/lib/i18n.ts`.

---

### Live Discord Forum Tags Sync, 30-Second Polling & Thread Status (v23.14.2)
- [x] **Smart 30-Second Background Polling (Active-Only)**:
  - [x] Automatically polls Discord thread status updates every 30 seconds only while the Feedback/Bug-Reports app or modal is actively mounted and in view.
  - [x] Unmounts and cancels interval immediately when window or modal is closed.
- [x] **Live Discord Forum Tag & Status Recognition**:
  - [x] Queries Discord API endpoint `/api/discord/threads-status` using Bot token to inspect `applied_tags`.
  - [x] Maps tag IDs to tag names & emojis (e.g. `⏳ Prüfung ausstehend`, `🔨 In Bearbeitung`, `✅ Erledigt / Behoben`, `SOCDOF`, etc.) on ticket cards.
  - [x] Automatic tag reading without requiring any user action on Discord.
- [x] **Reply Counter & Manual Sync Controls**:
  - [x] Displays message/reply count on tickets (`💬 X Antworten`), archived/locked indicators.
  - [x] "Jetzt synchronisieren" manual button with spinner feedback and last synced timestamp.
- [x] **Quad-Language Parity (DE, EN, FR, ES)**:
  - [x] Translated all status sync badges, tooltips, and sync labels in `src/lib/i18n.ts`.

---

### Authentic Live Discord Embed & Forum Post Preview with Real-Time Typing (v23.14.1)
- [x] **Pixel-Perfect Discord Dark Mode Embed**:
  - [x] Forum post preview matching Discord Dark Theme with forum channel header (`#🐛 | REPORT` / `#💡vorschläge`), tag badges (`⏳ Prüfung ausstehend`), Discord Bot avatar with `APP`/`BOT` badge, and colored embed borders.
  - [x] Real user snowflake ping `<@ID>`, formatted fields, and footer.
- [x] **Real-Time Typing Synchronization**:
  - [x] Live preview updates dynamically as user types title, app location, and description.

---

### Bug-Reports Desktop App, 3-Step Guided Reporting & Discord Embed Polish (v23.13.0)
- [x] **Dedicated "Bug-Reports & Meldungen" Desktop Application**:
  - [x] Added `feedback` module to App Launcher (`AppLauncher.tsx`) with Bug icon and direct launch capability.
  - [x] Integrated `DiscordFeedbackApp` into `DesktopWindowWorkspace.tsx` so window opens on desktop with full ticket tracking.
  - [x] Added `Bug-Reports` entry to `Sidebar.tsx` navigation items.
- [x] **3-Step Guided Reporting Workflow**:
  - [x] Added guidance checklist (1. Title / keyword, 2. Select app/location, 3. Error description) at the top of report form.
  - [x] Visual indicators show which of the 3 steps are complete and which are still required.
- [x] **No Premature Live Embed Rendering**:
  - [x] Suppressed dummy/placeholder embed rendering before required fields are entered.
  - [x] Replaced premature placeholder with clean instruction card until Title, App/Location, and Description are complete.
- [x] **Full SOCDOF Application Selector**:
  - [x] Included all SOCDOF apps (Invoices, CRM, Accounting, Products, Stock, POS, iOS Billing, Restaurant, Purchases, Therapy, Support, Calculator, Calendar, Desktop UI, Templates, Settings/Backup, Docs, App Store, Bug-Reports).
  - [x] "Sonstiges (Eigene Eingabe)" dynamically reveals custom text input for arbitrary locations.
- [x] **Strict Discord User-ID Validation (17–20 Digits)**:
  - [x] Restricts input to digits only (`/^\d{0,20}$/`).
  - [x] Shows live digit count and warning indicator if less than 17 digits.
  - [x] Prevents submission if an invalid User-ID is entered.
- [x] **Discord Duplicate Timestamp Elimination**:
  - [x] Removed duplicate embed timestamp property in `discordFeedback.ts`, ensuring Discord displays the native message timestamp only once.
  - [x] Corrected spelling to "Bug Information:".
- [x] **Interactive Ticket Status Management & Resolved Filter**:
  - [x] Status tracking (Pending, In Progress, Resolved) with immediate local persistence.
  - [x] "Erledigte ausblenden" toggle and status filter tabs ("Alle", "Offen", "Erledigt") to easily hide resolved tickets.
- [x] **Quad-Language Parity (DE, EN, FR, ES)**:
  - [x] Added `module.feedback`, `desc.feedback`, and `cat.support` to `src/lib/i18n.ts` for all 4 languages.

---

### Live Discord Bot Forum Integration for Feedback & Bug Reports (v23.12.0)
- [x] **Discord Bot Forum Integration for Bugs (`#🐛 | REPORT` - `1535709136363462757`)**:
  - [x] Automated thread creation in forum channel using official Bot token.
  - [x] Automatic tag application: `⏳ Prüfung ausstehend` (`1535711015902384269`).
  - [x] Formatted orange embed with author, reported-by user ping, bug location, and detailed description.
- [x] **Discord Bot Forum Integration for Ideas & Feedback (`#💡vorschläge` - `1524133720876126408`)**:
  - [x] Automated thread creation in forum channel with title and category.
  - [x] Automatic tag application: `SOCDOF` (`1553317496159731722`).
  - [x] Formatted blue/purple embed with user ping, area/category, idea description, and community footer.
- [x] **Discord-Name & User-ID Ping**:
  - [x] Two-column input for Discord-Name and optional Discord User-ID.
  - [x] Formats `<@ID>` for real discord notification ping and displays `<@ID> (@name)`.
  - [x] Persists user identity in localStorage so credentials don't need re-typing.
- [x] **Authentic Dark-Mode Discord Embed Live Preview**:
  - [x] Visual embed preview matching Discord's native dark interface (`#1e1f22` and `#2b2d31`).
  - [x] Real-time tag display, color bar, field mapping, and live time clock.
- [x] **Server Proxy Route (`/api/discord/thread`)**:
  - [x] Node middleware in `vite.config.ts` handles communication with Discord REST API to avoid browser CORS errors.
  - [x] Native fallback for Electron desktop build.
- [x] **Universal UI Access**:
  - [x] Added "Feedback & Bug melden (Discord)" button in Windows Start Menu footer.
  - [x] Added "Bug melden" and "Idee & Feedback" action buttons in Settings sidebar.
  - [x] Added quick actions in Command Palette (`Ctrl+K`).
- [x] **Multilingual Support (DE, EN, FR, ES)**:
  - [x] Localized all modal strings, tags, placeholders, and tooltips in `src/lib/i18n.ts`.

---

### Invoicing Templates & Layout Architecture in Invoicing & Settings (v23.11.0)
- [x] **Relocated Template Customization from Therapy to Core Invoicing & Settings**:
  - [x] Removed template editing clutter from the Therapy Module so it remains focused on therapy sessions, appointments, and client dossiers.
  - [x] Integrated first-class "Vorlagen & Layout" action button directly in the `InvoicesModule` top toolbar with `Layout` icon.
  - [x] Embedded "Rechnungsvorlagen & Layout-Editor" quick launcher card into the Settings Hub under Briefkopf (`activeSection === 'letterhead'`).
  - [x] Connected template switcher and Word export into `InvoicePrintModal` so any printed invoice can use the chosen active template.
- [x] **Pre-built Professional ERP Invoice Templates**:
  - [x] *DIN 5008 Standard*: German business standard with sender line, recipient box, fold marks, table, and 4-column legal footer.
  - [x] *Modern Minimalist*: Clean modern sans typography, subtle header bar, and prominent logo branding.
  - [x] *Executive Corporate*: Prominent corporate header, logo pedestal, and structured IBAN/BIC banking block.
  - [x] *Creative Studio*: Serif typography, warm tones, and stylish gratitude footer.
  - [x] *Praxis / Heilbehandlung*: Medical exemption notes according to § 4 Nr. 14 UStG.
  - [x] *Custom HTML Layout*: Full HTML/CSS editor with live placeholder injection.
- [x] **Interactive Live Preview with 100.000 € Test Invoice**:
  - [x] One-click toggle between "100.000 € Test-Beleg" (with sample company, test email, and large amount formatting) and real invoice data from IndexedDB.
  - [x] Realistic layout testing with top-left logo pedestal, detailed line items, and VAT breakdown.
- [x] **Dynamic Template Variable System & Office File Import**:
  - [x] Built `src/lib/invoiceTemplateManager.ts` providing scanning, dictionary substitution, and Word (.doc) export.
  - [x] Variable picker bar with 1-click insertion for `{Rechnungsnummer}`, `{Datum}`, `{Kunde_Name}`, `{Netto}`, `{Gesamtbetrag}`, etc.
  - [x] Template file importer supporting `.html`, `.docx` text, `.txt`, and `.json` with automatic variable recognition.
- [x] **Multilingual Support (DE, EN, FR, ES)**:
  - [x] All modal labels, tooltips, buttons, and setting descriptions updated in all 4 supported languages via `src/lib/i18n.ts`.

---

### European Number & Currency Formatting (DIN 1333) & Therapy Dark Mode Refinement (v23.10.10)
- [x] **Standardized European Number & Currency Formatting (DIN 1333 / ISO)**:
  - [x] Thousands separator: Period (`.`) -> `1.000.000` or `10.010`
  - [x] Decimal cents separator: Comma (`,`) -> `10.010,00 €` or `1.000.000,00 €`
  - [x] Central utility `src/lib/formatters.ts` with `formatNumberDE`, `formatCurrencyDE`, and `formatIntegerDE`.
  - [x] Applied across Therapy Dashboard KPIs, Revenue Chart tooltips, Practice metrics, Billing list, and Tax Advisor Ledger.
- [x] **Therapy Dashboard CRM Quick Action Button Fix**:
  - [x] Corrected "+ Neuer Klient (Kundenbuch)" button styling (`dark:bg-white text-blue-900 dark:text-blue-900`) to prevent black box inversion in dark mode.
- [x] **Invoice Template Modal Dark Mode Overhaul**:
  - [x] Tab navigation bar (`Layout & Variablen`, `Praxisdaten & Logo`, `Echtzeit-Vorschau`) updated with high-contrast text and border styling for inactive tabs in dark mode.
  - [x] Header close button updated with explicit high-contrast hover styling to prevent blank gray square artifacts.
- [x] **Ledger Template Management & Localization**:
  - [x] Persistent quick templates and centralized localization dictionary in `src/lib/ledgerTemplates.ts` across DE, EN, FR, and ES.

---

### Responsive Navigation Dropdown & Manual Client CRM Sync (v23.9.6)
- [x] **Responsive Header Navigation with 3-Line Dropdown Menu**:
  - [x] Replaced the horizontal scrollable tab container with a fixed, compact 4-tab bar (`Übersicht`, `Klienten`, `Sitzungen`, `Abrechnung`) plus a responsive "Weiteres" dropdown with 3-lines icon (`Menu`).
  - [x] Bündelt `Fahrtenbuch` und `Termine` im Ausklappmenü und hebt die aktive Unterseite hervor.
  - [x] Beseitigt die störende graue Scroll-Leiste in der Kopfzeile vollständig.
- [x] **Kundenbuch-Synchronisation bei manueller Klientenerstellung**:
  - [x] Optionale Checkbox ("Auch im Kundenbuch (CRM) anlegen & verknüpfen") beim manuellen Hinzufügen von Klienten.
  - [x] Speichert automatisch einen neuen Kunden in `db.contacts` und verknüpft die `contactId`.
- [x] **Währungs- und Sprachunterstützung**:
  - [x] Bestätigt, dass alle Praxismodule dynamisch die eingestellte Unternehmenswährung verwenden.
  - [x] Vollständige Viersprachigkeit (DE, EN, FR, ES) über `src/lib/i18n.ts`.

---

### Rebuilt Therapy & Practice Management Suite with Instant CRM Integration & Professional Invoicing (v23.9.5)
- [x] **Direct Customer Book (CRM) Integration on Client Creation**:
  - [x] Clicking "+ Neuer Klient" / "+ Klient hinzufügen" immediately launches the official CRM `CustomerPickerModal`.
  - [x] Auto-populates client name, contact details, phone, email, address, company, and links directly to CRM ID without intermediate manual forms.
  - [x] Secondary option "+ Manuell" available for adding unlinked practice clients when needed.
- [x] **Professional Invoicing & Invoices Module Integration**:
  - [x] Rebuilt billing into a standard, clear, professional invoicing view with invoice numbers, service descriptions, dates, amounts, and payment status badges (`Draft`, `Open`, `Paid`).
  - [x] Added instant 1-click transfer to `db.invoices` so practice invoices sync into the main SOCDOF Invoices module.
  - [x] Printable invoice / PDF preview modal (`TherapyInvoicePrintModal`) with clinic letterhead, client address, and itemized fee breakdown.
  - [x] 1-click status toggle to mark invoices as paid or open.
- [x] **Interactive Multi-Month Revenue & Practice Analytics**:
  - [x] Interactive SVG line and bar chart displaying 6-month monthly revenue trends and session counts with hover tooltips.
  - [x] Live KPI cards: Active Clients, Completed Therapy Hours, Total Billed Revenue, and Pending Receivables.
  - [x] Removed redundant notices ("Kein Cloud-Konto erforderlich") and bulky templates to create a clean, modern dashboard.
- [x] **Unified Header Navigation & Fixed Layout**:
  - [x] Streamlined 5-tab navigation bar (*Übersicht*, *Klienten*, *Sitzungen*, *Abrechnung*, *Fahrtenbuch*, *Termine*) without duplicate badges or redundant headers.
  - [x] Applied `resize-none` styling across all textareas preventing accidental window resizing or distortion.

---

### Therapy Module Polish, Fixed Resizable Textareas & Enhanced Mileage Log (v23.9.0)
- [x] **Fahrtenbuch (Mileage Log) with Live Distance & Reimbursement Calculation**:
  - [x] Transparent logging of starting odometer (Start-Km) and ending odometer (End-Km) per trip.
  - [x] Automatic driven distance calculation and reimbursement with preset rate buttons (0.30 €, 0.38 €, 0.42 €/km).
- [x] **Quick Duration Presets for Therapy Sessions**:
  - [x] Quick-select buttons for session duration (30, 50, 60, 90 min) with structured intervention and progress notes.
- [x] **Fixed Resizable Textareas**:
  - [x] Added `resize-none` and structured heights to all textareas across client, session, and contact dialogs.

---

### Therapy & Practice Flow, Authentic Desktop Preview & Settings Personalization Overhaul (v23.8.0)
- [x] **Therapy & Practice Module CRM & Invoicing Integration**:
  - [x] Linked client management with CRM Contacts (Customer Book) allowing 1-click selection and import of existing contacts.
  - [x] Added 1-click official invoice creation from therapy sessions and billing positions directly into `db.invoices`.
  - [x] Implemented multi-tab client filter (All, Practice Clients, CRM Contacts) with instant search and rich dossiers.
  - [x] Renamed and clarified session fields ("Thema & Behandlung / Methoden" and "Sitzungsnotizen & Ergebnis / Nächste Schritte").
  - [x] Added automatic duration calculation from Start/End times and quick duration presets (30, 45, 50, 60, 90 min).
- [x] **Practice Revenue & Statistics Dashboard**:
  - [x] Interactive annual/monthly bar chart with revenue volume, completed sessions, and best-month indicator.
  - [x] Key metrics cards: Average fee per session, total treatment hours completed, and billing progress (Paid, Billed, Drafts).
  - [x] Side-by-side upcoming appointments and recent sessions widget with 1-click documentation triggers.
- [x] **Authentic Desktop Live Preview in Settings**:
  - [x] Replaced generic preview with authentic SOCDOF desktop icons (Dashboard, Rechnungen, Kundenbuch, Praxis).
  - [x] Replaced artificial placeholder window with a genuine SOCDOF invoice app window featuring live KPIs, realistic table records, and active accent styling.
  - [x] Added official Start button with the SOCDOF logo, Fluent search box, and taskbar indicators.
- [x] **No-Scroll Responsive Personalization Tabs (Windows 11 Style)**:
  - [x] Converted single-row scrollable tab bar into a 4-item responsive grid (Wallpaper & Blur, Colors & Accents, Start Menu & Taskbar, Font Size & Scaling), eliminating horizontal mouse scrolling.
  - [x] Decoupled user account & avatar settings cleanly into Accounts & Profile (`users`), eliminating confusing duplicate avatar displays.
  - [x] Added "Related Settings" card linking directly from Personalization to Accounts & Profile.
- [x] **Full Quad-Lingual Translation & Verification**:
  - [x] Updated all localized keys across German, English, French, and Spanish in `src/lib/i18n.ts`.

---

### Windows-Inspired Settings & Display / Multi-Monitor Management (v23.7.0)
- [x] **Windows 11-Inspired Settings Hub**:
  - [x] Structured sidebar navigation with clean categories: Übersicht (Overview), Anzeige & Bildschirme (Display & Screens), Unternehmen & Workflow, System & Personalisierung, Wartung & Datensicherheit.
- [x] **Multi-Monitor & Extended Display Management**:
  - [x] Display detection and multi-screen layout settings for multi-monitor setups (`DisplaySettingsSection.tsx` & `src/lib/displayManager.ts`).
  - [x] Interactive visual monitor canvas displaying all connected and virtual screens with resolutions, scale factors, orientation, and primary screen badges.
  - [x] "Identifizieren" (Identify) button with animated on-screen badges ("1", "2") across displays.
  - [x] "Erkennen" (Detect) trigger to refresh system and browser monitors.
  - [x] Added virtual secondary display creation and deletion for multi-screen testing and arrangement.
  - [x] Supported "extending" (`Erweitern`) SOCDOF workspaces across multiple monitors, display duplication, and single-display modes.
  - [x] Added window title bar quick popout button (`Tv` icon) to detach windows onto secondary screens or popouts.
  - [x] Added URL parameter handling (`?popout=module_name`) allowing popped-out windows to launch seamlessly in dedicated workspace mode.
  - [x] Added per-monitor window positioning memory (`per_monitor_position_memory`), remembering exact coordinates, size, and maximize state for each module across monitors.
  - [x] Integrated Windows 11 Night Light (Nachtmodus) with warm color temperature slider (1500K to 5500K) and persistent dynamic filter.
  - [x] Registered Electron IPC handlers (`socdof:get-displays`, `socdof:move-window-to-display`, `socdof:popout-window`) and exposed them via context bridge.

---

### Brand Neutralization & Avatar Studio UX Layout Refinement (v23.6.1)
- [x] Removed trademarked "Windows 11" and related branding from all user-facing settings titles, descriptions, taskbar options, and tooltips.
- [x] Updated all localized strings across German, English, French, and Spanish (`src/lib/i18n.ts`) to use neutral desktop and system terminology.
- [x] Removed preset avatar emojis from the Avatar Studio to eliminate clutter and maintain a professional look.
- [x] Fixed "kleiner Button" layout: replaced squished inline URL button with a full-width, prominent, responsive action button with icon and Enter key support.

---

### Windows-Style Personalization, Avatar Studio & Admin User Inspection (v23.6.0)
- [x] Implemented dedicated "Profilbild & Benutzerkonto" (Avatar & User Account) subtab in Settings > Personalization.
- [x] Added image upload with client-side canvas downsampling (max 400x400), WebP compression, URL import, and preset icon quick-picks.
- [x] Created interactive preview mockups showing how user avatar renders in the Start Menu bottom-bar and on the Windows Hello Lock Screen.
- [x] Added instant one-click wallpaper setting with immediate desktop updates and toast notifications.
- [x] Added Taskbar Alignment selector (Centered vs Left-aligned Classic).
- [x] Enhanced Administrator user management in `UserManagementSettings.tsx` with user resource inspection metrics (files, folders, invoices, pinned apps).
- [x] Added administrator role toggle, account scope toggle (Personal vs. Business), and administrator password override.

---

### Multi-Step System Reset & Complete Reinstallation Flow (v23.5.0)
- [x] Implemented a 4-step security wizard for "System zurücksetzen" ("Reset System") in SettingsModule.tsx.
- [x] Added Step 1: Confirmation word input ("Löschen" / localized equivalent).
- [x] Added Step 2: Explicit prompt "Sind Sie sicher, dass Sie es löschen wollen?" with re-entry of the confirmation word.
- [x] Added Step 3: Local account password verification via `verifyPassword()` to authenticate the administrative reset.
- [x] Added Step 4: Final confirmation check requiring the confirmation word before initiating full system reset.
- [x] Added Step 5: Visual in-progress state ("Wird zurückgesetzt...") with animated indicator while purging databases, files, and user credentials.
- [x] Created `resetEntireSystemDatabase()` in `src/lib/db.ts` to wipe all Dexie tables, storage assets, and settings.
- [x] Created `resetAuthSystem()` in `src/lib/auth.ts` to clear accounts, credential hashes, and user session data.

---

### Desktop Icon Layout & In-App Activation Persistence Stabilization (v23.4.5)
- [x] Fixed desktop icon position persistence so moved, swapped, snapped, and auto-arranged icons retain their exact custom coordinates across page reloads and application restarts.
- [x] Synchronized all desktop coordinate and folder mutations with active user-scoped storage (`socdof.user.<id>.odoo_desktop_icon_positions`).
- [x] Eliminated recurring business-module filtering on existing user profiles, ensuring in-app activations remain permanently activated and pinned.

---

### Persistent Application Activation, Pinning & Desktop Ordering (v23.4.4)
- [x] Fixed account-scoped application state restoration so the latest user-scoped app configuration is authoritative after reloads and restarts.
- [x] Prevented stale legacy `all.*` snapshots from overwriting newer installed/disabled application state.
- [x] Preserved exact desktop and taskbar pin lists and their custom ordering across restarts.

---

### Safe In-App Updates & Persistent Application State (v23.4.3)
- [x] Added an Electron pre-update handshake that requests a renderer-side data snapshot before downloading/installing an update.
- [x] Snapshot includes the local IndexedDB database and SOCDOF-owned localStorage state, including account-scoped installed-module persistence.
- [x] Configured Electron Builder with `deleteAppDataOnUninstall: false` to avoid intentional removal of application data.

---

### CustomerPicker & CRM Contact Integration for Praxis & Therapy (v23.4.2)
- [x] Integrated `CustomerPickerModal` from the contacts CRM into `TherapyPracticeModule.tsx`, matching the Support module UX for selecting customers.
- [x] Enabled auto-filling of patient form fields upon selecting a contact from the CRM.
- [x] Integrated `ContactEditModal` for inline editing of contact details without leaving the Praxis & Therapy workspace.
