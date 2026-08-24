# SOCDOF Project Status & AI Handover Guide

> **Project Name:** SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)  
> **Repository Origin:** Strudelcode/SOCDOF (`https://github.com/Strudelcode/SOCDOF`)  
> **Target Platform:** 100% Local Offline ERP & Windows Desktop Suite (React 19 + Vite + Dexie.js + Tailwind CSS)  
> **Default Language:** English (`en`)  
> **Current Version:** **v18.3.5**  
> **Last Updated:** 2026-08-24  

---

## 1. Executive Summary & Architecture

SOCDOF is an offline-first enterprise management system running in the browser and as a packaged desktop client with a dedicated **Windows 11 Desktop Experience (`DesktopWindowWorkspace.tsx`)**:
- Draggable, resizable, minimizable, and maximizable multi-window workspace.
- Windows Aero snap detection (left/right half-screen, top full-screen).
- Centered Windows 11 taskbar with running app indicators, active underlines, notification count badges, drag-and-drop pinned icons, and system tray.
- Windows 11 Start Menu with pinned apps, fast search, quick tool shortcuts, user profile, and power options (shutdown/restart simulation).
- Dedicated desktop app lifecycle with all modules rendered in native floating window instances.
- **Pure Desktop OS Focus:** Legacy web-fullscreen view mode and top banners have been completely removed.
- **Windows Setup-Assistent mit nativer Ordnerauswahl:** Beim Starten der `.cmd`, `.bat` oder `.ps1` öffnet sich direkt ein nativer grafischer Windows-Ordnerauswahldialog (`FolderBrowserDialog`). Die Ordnerstruktur (`\Data`, `\Backups`, `\Exports`, `\Config`), Startskripte und Desktop-Verknüpfung werden automatisch am gewählten Ort angelegt.
- **GitHub Pages & Offline Index.html Support:** Durch `base: './'` in `vite.config.ts` und relative Asset-Links funktioniert das gebaute Projekt nahtlos auf `https://strudelcode.github.io/SOCDOF/`, in Subverzeichnissen sowie direkt als lokale HTML-Datei ohne weiße Bildschirme.

All data is stored purely on the client side inside **IndexedDB via Dexie.js** (`src/lib/db.ts`). No remote backend is required.

---

## 2. Version History & Recent Updates

### v18.3.5 (Current Release — 2026-08-24)
- 🗂️ **Nativer Windows-Ordnerauswahldialog & 100% robuster Script-Launcher:**
  - **Batch & CMD Fix (PowerShell EncodedCommand):** Die `.cmd` und `.bat` Setup-Skripte nutzen jetzt eine atomare, Base64-codierte UTF-16LE PowerShell-Ausführung. Dadurch werden alle klassischen Windows-Batch-Syntaxfehler (Klammern `()`, Pipes `|`, Anführungszeichen, vorzeitiges Schließen des Fensters) zu 100% eliminiert.
  - Der Installationsassistent öffnet zuverlässig den grafischen Windows `FolderBrowserDialog`.
  - Der Benutzer wählt seinen Wunschordner (z. B. `C:\SOCDOF` oder `D:\Programme\SOCDOF`) interaktiv auf seinem PC aus.
  - Automatische Erstellung der Verzeichnisstruktur (`\Data`, `\Backups`, `\Exports`, `\Config`), Startskripte und Desktop-Verknüpfung (`SOCDOF Desktop.lnk`) mit Windows MessageBox-Erfolgsmeldung.
- 🧹 **Bereinigtes Download-Modal:**
  - Überflüssige Tabs (*Ordnerstruktur* und *Lokaler Speicher*) wurden vollständig aus dem Setup-Fenster entfernt.
  - Fokussiertes Interface mit klarem 3-Schritte-Ablauf, Direktdownload für `.cmd`, `.bat` und `.ps1` sowie PWA-Verknüpfung.
- 🌐 **GitHub Pages & Standalone Offline Fix:**
  - Konfiguration von `base: './'` in `vite.config.ts` und relative Pfade in `index.html`.
  - Behebt den leeren/weißen Bildschirm auf `https://strudelcode.github.io/SOCDOF/` und ermöglicht direktes lokales Öffnen der erzeugten `index.html`.
- ⚙️ **Automatisierter GitHub Actions Release Workflow:** `.github/workflows/build-windows-exe.yml` zur Erzeugung von NSIS-Installern und Portable `.exe` Dateien bei Git-Tags.

### v18.3.4 (2026-08-24)
- 💻 **Echter Windows Desktop Setup-Assistent (`Setup_SOCDOF_Windows.cmd` & `Install_SOCDOF_Wizard.ps1`):**
  - Interaktive Auswahl des Zielinstallationspfads auf dem PC.
  - Automatische Erstellung der vollständigen Verzeichnisstruktur (`\Data`, `\Backups`, `\Exports`, `\Config`).
  - Automatische Erstellung einer Desktop-Verknüpfung (`SOCDOF Desktop.lnk`) und Startskript.
  - Vollständige Behebung von Google 403 Forbidden Fehlern: App läuft 100% lokal ohne Abhängigkeit zu Sandbox-Cloud-URLs.
- ⚙️ **Windows-Pfadverwaltung in den Einstellungen:** Unter *Speicher & Datensicherung* kann der Speicherort für Backups und lokale Daten direkt hinterlegt und angepasst werden.
- 🐙 **GitHub Releases Verlinkung:** Direkter Absprung zu vorkompilierten Electron / NSIS `.exe` Binärpaketen.

### v18.3.3 (2026-08-24)
- 🪟 **Pure Windows OS Focus:** The legacy web-fullscreen view mode and top switch banners were completely removed. SOCDOF now boots directly and exclusively into the windowed desktop environment.
- 🌐 **Simplified Language Selection Dialog:**
  - Standard, clean vertical list layout replacing redundant nested dropdowns and bottom quick-select grids.
  - High contrast in both light and dark modes.
  - Default badge on English with clear `Skip (Default: English)` footer.
  - Pixel-perfect vector SVG flags (`FlagIcon.tsx`).
- ⚙️ **Centralized Version Model (`src/lib/version.ts`):** 
  - Dynamic version display (`SOCDOF 18.3.5`) synchronized across `SettingsModule.tsx` (bottom-left system status card), `DocumentationApp.tsx`, `README.md`, and `Status.md`.
- 📖 **Changelog Section in Documentation App:** Interactive release history added to the integrated user manual.

### v18.3.2 (2026-08-24)
- 🔄 **Calendar Sync Indicator:** Corrected Google/iCal status badge to "Nicht verbunden (Inaktiv)" until explicit feed copy/connection.
- 🐙 **Open Source GitHub Integration:** Verlinkung des offiziellen Repositories `https://github.com/Strudelcode/SOCDOF` in Startmenü, Handbuch und Einstellungsübersicht.
- 💬 **Discord Support Integration:** Support ausschließlich über den offiziellen Discord-Server `https://discord.gg/QW85EaXTgB`.
- 🎨 **SOCDOF Branding:** Offizielles Logo (weißes S mit Windows-Farbrahmen) als Favicon, PWA-Icon, Taskleisten-Startbutton und Dashboard-Header.
- 🏢 **Firmenprofil-Standard:** Standard-Firmenname auf *Strudel's Test GmbH* aktualisiert.

### v18.3.1 (2026-08-24)
- 🚀 **Windows Desktop Launcher:** Automatischer Generator für Windows `.bat` und `.ps1` Starterskripte.
- 🔊 **Sound-Feedback:** Akustisches Feedback-System mit Stummschalt-Funktion.
- 🌓 **Theme Switching:** Dark Mode und DIN-konformer Light Mode mit dynamischen Akzentfarben.

### v18.3.0 (2026-08-20)
- 🖥️ **Windows 11 Desktop Core:** Multi-Window-Manager mit Taskleiste, Startmenü und Fenster-Snapping.
- 💶 **Finanz- & Fakturamodule:** Vollständige BWA, EÜR, UStVA Voranmeldung und DIN 5008 Rechnungsgenerator.
- 💾 **IndexedDB Engine:** 100% Offline-Datenhaltung über Dexie.js mit JSON-Import/Export.

---

## 3. Implemented Features & Modules

### A. Windows Installation & Setup Wizard (`src/lib/windowsExeDownloader.ts`)
- **Native GUI Folder Dialog:** Öffnet beim Ausführen der `.cmd` / `.bat` / `.ps1` einen Windows `FolderBrowserDialog` zur freien Ordnerauswahl auf dem Rechner.
- **Automatische Verzeichnisstruktur:** Erstellt `%TARGET_DIR%`, `\Data`, `\Backups`, `\Exports` und `\Config`.
- **Offline Self-Contained Launcher:** Schreibt die autarke `index.html` und `SOCDOF_Starten.bat` lokal.
- **Desktop Shortcut:** Erstellt `SOCDOF Desktop.lnk` auf dem Windows-Desktop via WScript Shell.

### B. System Accent Colors (100% Functional & Live)
- **Engine:** `src/lib/accent.ts` + `src/index.css`
- **Presets Available:** `indigo`, `purple`, `blue`, `emerald`, `sky`, `amber`, `rose`, `teal`, `violet`, plus custom hex picker.

### C. Startup Language Selection & Multi-Language i18n
- **Engine:** `src/lib/i18n.ts` + `src/components/LanguageSelectionModal.tsx` + `src/components/FlagIcon.tsx`
- **Default Language:** English (`en`).
- **Supported Languages:** 🇺🇸 English (`en`), 🇩🇪 German (`de`), 🇫🇷 French (`fr`), 🇪🇸 Spanish (`es`).

### D. Core Offline ERP Modules
1. **Dashboard & KPIs (`Dashboard.tsx`):** Real-time analytics, open invoices, low stock indicators.
2. **Invoices & Sales (`InvoicesModule.tsx`):** DIN 5008 invoices, fold marks, QR-code payment data (GiroCode / EPC-QR), PDF printing.
3. **Accounting & Financial Reports (`AccountingModule.tsx`):** BWA, EÜR, UStVA Voranmeldung, Z-Report (Z-Bon).
4. **CRM & Contacts (`ContactsModule.tsx`):** Customer & supplier directory.
5. **Products & Master Data (`ProductsModule.tsx`):** Article catalog, prices, taxes, stock thresholds.
6. **Inventory & Stock Moves (`StockMovesModule.tsx`):** Double-entry stock transfers.
7. **Purchasing & RFQs (`PurchasesModule.tsx`):** Purchase orders & supplier bills.
8. **Point of Sale & Restaurant (`POSModule.tsx` + `IOSBillingModule.tsx` + `RestaurantModule.tsx`):** Table maps, order splitting, KDS.
9. **Settings & Backup (`SettingsModule.tsx`):** Master data, DIN 5008 letterhead, accents, dynamic version status widget, local backup paths.
10. **Documentation & Help (`DocumentationApp.tsx` + `TutorialModal.tsx`):** Complete user manual with integrated changelog.

---

## 4. GitHub Actions & Automated Windows .EXE Releases

We have established two automated CI/CD workflows:

### A. Automatic Windows `.exe` Installer & Portable Builder (`.github/workflows/build-windows-exe.yml`)
- **Triggered by:** Pushing any Git Tag (e.g. `v18.3.5`, `git tag v18.3.5 && git push origin v18.3.5`) or manually via the GitHub Actions tab (`workflow_dispatch`).
- **Build runner:** `windows-latest`
- **Output:**
  1. `SOCDOF Setup 18.3.5.exe` (NSIS Installer with custom directory selector, start menu & desktop shortcuts)
  2. `SOCDOF 18.3.5.exe` (Standalone Portable Executable)
- **Automatic GitHub Release:** The workflow automatically publishes a new GitHub Release with download links for the `.exe` files attached!

### B. Automatic GitHub Pages Deployment (`.github/workflows/deploy-pages.yml`)
- **Triggered by:** Any commit push to the `main` branch.
- **Output:** Builds `dist/` and deploys directly to `https://strudelcode.github.io/SOCDOF/`.

---

## 5. Key Files Reference

| Path | Purpose |
|------|---------|
| `/.github/workflows/build-windows-exe.yml` | GitHub Actions workflow to build and attach NSIS + Portable `.exe` to GitHub Releases |
| `/.github/workflows/deploy-pages.yml` | GitHub Actions workflow for automatic deployment to GitHub Pages |
| `/electron/main.cjs` | Electron main process entry point for packaged desktop builds |
| `/electron-builder.json` | Packaging configuration for NSIS installer and portable Windows `.exe` |
| `/src/lib/version.ts` | Single source of truth for version number (`v18.3.5`) and changelog |
| `/src/lib/windowsExeDownloader.ts` | Windows Setup Wizard (`.cmd`, `.bat`, `.ps1`) with native GUI folder picker & structure generator |
| `/src/components/WindowsDesktopManagerModal.tsx` | Windows installation wizard dialog with 3-step guide & direct download actions |
| `/vite.config.ts` | Vite configuration with `base: './'` for GitHub Pages (`strudelcode.github.io/SOCDOF/`) and offline builds |
| `/README.md` | Comprehensive project readme with updated version history & directory guide |
| `/Status.md` | AI handover and state documentation (ALWAYS updated) |
| `/src/components/DesktopWindowWorkspace.tsx` | Windows 11 desktop workspace, taskbar, start menu, system tray |
| `/src/components/SettingsModule.tsx` | System settings and dynamic version/storage status card with local paths |
| `/src/components/DocumentationApp.tsx` | User manual with integrated changelog chapter |
| `/src/lib/i18n.ts` | Reactive translation engine with full English default fallback |
| `/src/lib/db.ts` | Dexie IndexedDB schemas, default company profile, and backup engine |

---

## 6. Verification & Validation
- Run `npm run lint` or `compile_applet` to ensure 0 TypeScript errors.
- Version is consistently displayed as `SOCDOF 18.3.5` across the app.
