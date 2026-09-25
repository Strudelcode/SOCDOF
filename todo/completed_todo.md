# SOCDOF – Completed Tasks & Historical Archive

> This file contains the complete historical archive of all tasks, feature requests, and milestones completed and verified across SOCDOF versions.

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
