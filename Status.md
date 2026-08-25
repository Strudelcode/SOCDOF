# SOCDOF Project Status and Handover Guide

> **Project:** SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)  
> **Repository:** Strudelcode/SOCDOF (`https://github.com/Strudelcode/SOCDOF`)  
> **Target platforms:** Windows Electron desktop application and browser/PWA build  
> **Default language:** English (`en`)  
> **Current project version:** **v19.0.0**  
> **Last updated:** 2026-08-25  

---

## 1. Executive summary and architecture

SOCDOF is a local-first business organization application with a Windows 11-inspired desktop workspace. It brings contacts, products, inventory, purchasing, sales, invoicing, POS workflows, settings, and documentation together in one application.

The primary desktop target is an Electron application. A browser and GitHub Pages build is also supported. Application data is stored locally in IndexedDB through Dexie.js; no remote backend is required for the core workflows.

The desktop workspace provides:

- Draggable, resizable, minimizable, and maximizable application windows.
- Windows-style snap behavior for left, right, and full-screen layouts.
- A centered taskbar with running-app indicators, active states, notification badges, pinned icons, and a system tray.
- A Start menu with pinned applications, search, quick tools, user profile, and simulated power options.
- Native desktop lifecycle behavior with application modules rendered in floating windows.
- A Windows setup assistant with a native folder picker for `.cmd`, `.bat`, and `.ps1` launchers.
- Relative asset paths for GitHub Pages subdirectories and locally opened builds.

---

## 2. Current release and recent history

The current project version is **v19.0.0**. Detailed release notes are maintained in [`versions/`](./versions/).

- **v19:** Language synchronization, accent-color contrast, configurable date formats, native-app download reminder handling, and save confirmations.
- **v18.3.5:** Robust Windows setup scripts, native folder picker, simplified setup modal, relative build paths, and automated Windows release workflow.
- **v18.3.4:** Windows installation assistant, local directory management, configurable storage paths, and GitHub Releases links.
- **v18.3.3:** Windows desktop focus, simplified language selection, centralized version model, and integrated changelog.
- **v18.3.2:** Calendar status correction, GitHub and Discord links, branding, and default company profile.
- **v18.3.1:** Windows launchers, sound feedback, and theme switching.
- **v18.3.0:** Windows desktop core, finance/invoicing modules, and Dexie/IndexedDB persistence.

---

## 3. Implemented areas

### Desktop and system experience

- Windows-style desktop workspace and multi-window management.
- Start menu, taskbar, system tray, snapping, and window state handling.
- Light mode, dark mode, accent colors, and optional sound feedback.
- Startup language selection and responsive translation handling.

### Business modules

- Dashboard and KPIs.
- Contacts for customers and suppliers.
- Products and master data.
- Inventory and stock movements.
- Purchasing and supplier bills.
- Invoices, offers, delivery notes, PDF printing, and QR payment data.
- Accounting reports including BWA, EÜR, UStVA, and Z-reports.
- POS and restaurant workflows, table maps, order splitting, and kitchen display.
- Settings, company profile, local storage, backups, and import/export.
- Documentation and integrated help.

### Supported languages

- English (`en`) – default
- German (`de`)
- French (`fr`)
- Spanish (`es`)

---

## 4. Windows packaging and deployment

### Electron build

The Electron entry point is `electron/main.cjs`. Packaging is configured in `electron-builder.json` and supports:

- NSIS installer with selectable installation directory.
- Portable Windows executable.
- Desktop and Start menu shortcuts.

### GitHub Actions

- `.github/workflows/build-windows-exe.yml` builds Windows packages for tags or manual workflow runs.
- `.github/workflows/deploy-pages.yml` builds and deploys the browser version to GitHub Pages.

Release publication requires an intentional version decision and successful verification.

---

## 5. Key files

| Path | Purpose |
|---|---|
| `electron/main.cjs` | Electron main process |
| `electron-builder.json` | Windows packaging configuration |
| `src/lib/version.ts` | Central version and release data |
| `src/lib/db.ts` | Dexie/IndexedDB database and backup engine |
| `src/lib/i18n.ts` | Translation engine |
| `src/lib/windowsExeDownloader.ts` | Windows launcher and setup-script generation |
| `src/components/DesktopWindowWorkspace.tsx` | Desktop, taskbar, Start menu, and window workspace |
| `src/components/SettingsModule.tsx` | Settings, company profile, and storage controls |
| `src/components/DocumentationApp.tsx` | Integrated documentation and changelog |
| `versions/` | Release history by major version |
| `todo/todo.md` | Planned work and working instructions |
| `README.md` | Public project overview and user instructions |

---

## 6. Verification

Run the following checks after relevant code changes:

```bash
npm run lint
npm run build
```

Also perform relevant manual checks in the browser build and, where applicable, in the packaged Electron application. Record failed or unavailable checks in the corresponding version notes.
