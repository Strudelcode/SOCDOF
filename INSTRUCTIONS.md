# SOCDOF Development & Agent Guidelines (Instructions)

This document defines the core operational standards, versioning protocols, and development workflows for SOCDOF.

---

## 1. Language & Documentation Standards

- **English by Default for Code & Documentation**: All development documentation, release notes under `versions/`, code comments, commit messages, and internal developer guides MUST be written in **English**.
- **Mandatory User Documentation Updates (`DocumentationApp.tsx` & Docs)**:
  - Whenever a new application/module is introduced or existing applications undergo significant functional modifications, a dedicated chapter **MUST ALWAYS** be added or updated in the in-app User Manual / Documentation module (`src/components/DocumentationApp.tsx`).
  - The documentation chapter must clearly describe the module's core purpose, key workflows, button functions, integration options, and keyboard/UI shortcuts in both **German** and **English**.
  - All documentation files (such as `versions/` notes and release overviews) must be kept synchronized with all active application features.
- **Mandatory 4-Language UI (German, English, French, Spanish)**:
  - Whenever any UI feature, screen, label, text, button, dialog, modal, placeholder, setting, toast, or notification is added or modified, it **MUST ALWAYS** be defined and translated across **ALL 4 supported languages** in `src/lib/i18n.ts` (`en` = English, `de` = German, `fr` = French, `es` = Spanish).
  - Never leave untranslated, single-language, or hardcoded strings in newly modified user-facing interfaces.
  - All components must reference translations using `t('key')` or `useTranslation()` from `src/lib/i18n.ts`.

---

## 2. No Mock / Placeholder Example Data Rule & User-Friendly Inputs

- **Clean Real-World Apps & Pristine Defaults**: Do NOT pre-fill or inject artificial demo records, dummy contacts, fake support tickets, sample invoices, or dummy settings/company values (e.g. fake test companies like "Strudel's Test GmbH", dummy IBANs, fake bank names, or arbitrary default paths).
- **Empty Settings & Profile Defaults**: All company profiles, letterhead configs, bank fields, tax numbers, and backup configurations must initialize with clean, empty strings (`''`) or neutral descriptive input placeholders (e.g. `placeholder="Firmenname eingeben"`).
- **Empty States**: Every module must initialize with clean empty states (e.g. `[]`), clear onboarding guides, and intuitive creation action buttons.
- **User-Friendly UI (No Path-Typing Barriers)**: Many end-users do not know technical file paths (e.g., `C:\SOCDOF\Backups`). Technical inputs such as directory paths must always be paired with intuitive folder/file pickers (`showDirectoryPicker` / native folder dialogs) and convenient 1-click location presets (e.g., `Documents`, `Downloads`, `Desktop`, `USB Drive`).
- Users input their own genuine data in a clean, unpolluted workspace.

---

## 3. Versioning & Release Documentation Rules

- **SemVer Format**: `v<Major>.<Minor>.<Patch>` (e.g., `v20.0.0`, `v20.1.0`).
- **Flexible Minor & Patch Updates**: When adding new features, major UX improvements, or module integrations, increment to a clean minor version (e.g. `v20.1.0`, `v20.2.0`). For smaller enhancements and bug fixes, increment patch versions (e.g. `v20.0.1`, `v20.0.5`).
- **Major Version Constraint**: A new major version (e.g., `v21.0.0`) **must never** be initiated automatically. It requires explicit user discussion and consent.
- **Synchronized Version Declarations**: Every version increment must be updated across all designated locations simultaneously:
  1. `package.json` (`"version": "20.x.x"`)
  2. `src/lib/version.ts` (`APP_VERSION = '20.x.x'` and add entry to `VERSION_HISTORY`)
  3. `versions/V<Major>.md` (e.g. `versions/V20.md` - detailed changelog notes in English)
  4. `versions/releases/v<Major>-release.md` (e.g. `versions/releases/v20-release.md` - comprehensive release documentation and feature overview in English)
  5. `todo/todo.md` and `todo/completed_todo.md`
- **Release Documentation in `versions/releases/`**:
  - Whenever new features or major capabilities are added, update the corresponding release document in `versions/releases/` (e.g., `versions/releases/v20-release.md`).
  - This file serves as the official, comprehensive release overview detailing all functional capabilities, architecture updates, and user-facing features in English.

---

## 4. Todo & Task Management Workflow

- **Active Tasks**: `todo/todo.md` is strictly reserved for open, in-progress, and planned roadmap items.
- **Completed Archive**: As soon as a task is completed, move it to `todo/completed_todo.md` with `[x]` and relevant implementation notes to keep the active todo list clean and manageable.
- **100% Free, Offline & Feasibility Principle**:
  - All features in SOCDOF must be 100% free, privacy-first, and work offline without requiring paid cloud subscriptions, proprietary API keys, or monthly infrastructure charges.
  - If a task on the roadmap is identified as not relevant, infeasible, or requiring paid/cloud dependencies, it can be cancelled by moving it to `todo/completed_todo.md` marked with a strike-through (e.g. `~~[ ] Task name (Cancelled: reason)~~`) or removed from `todo/todo.md`.
- Never delete completed tasks permanently; always archive them in `todo/completed_todo.md`.

---

## 5. Publisher & Desktop Branding Identity

- **Publisher / Author**: The official publisher and author name for Windows binaries, packages, and certificates is strictly **`Yuri / Strudel`** (Organization: `Strudelcode`).
- **Code Signing**: Binaries in `release/` are signed with the developer Authenticode certificate for `CN=Yuri / Strudel, O=Strudelcode` so that Windows SmartScreen and installer dialogs accurately present the publisher as **Yuri / Strudel**.
- **No Intrusive Web Popups**: The web preview must remain clean and unobtrusive. Never attach aggressive auto-triggering mouseleave/exit-intent popups.

---

## 6. Architecture & Offline-First Principles

- **Offline-First Storage**: Local database persistence via IndexedDB (`Dexie.js` in `src/lib/db.ts`) and `localStorage`.
- **Privacy & GDPR Compliance**: No unsolicited remote tracking, no external database dependencies for core operations.
- **Desktop Window Manager**: Windows 11 fluent desktop workspace with draggable, resizable, minimizable windows, taskbar, start menu, and calendar flyout.
- **Electron Standalone Packaging**: Standalone `.exe` installer and portable builds via `electron-builder.json` and `electron/main.cjs`.

---

## 6. Quality & Build Verification

Before finishing any modification turn:
1. Run `npm run lint` (`lint_applet` / TypeScript check) to ensure no type errors.
2. Run `npm run build` (`compile_applet`) to verify successful production compilation.

