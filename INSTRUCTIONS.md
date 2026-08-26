# SOCDOF Development & Agent Guidelines (Instructions)

This document defines the core operational standards, versioning protocols, and development workflows for SOCDOF.

---

## 1. Language & Documentation Standards

- **English by Default**: All development documentation, release notes under `versions/`, code comments, commit messages, and internal guides MUST be written in **English**.
- **Multilingual UI**: End-user facing UI strings, labels, and dialogues must be integrated through the centralized i18n system (`src/lib/i18n.ts`) supporting all 4 languages (German, English, French, Spanish).

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
- Never delete tasks permanently; always archive completed tasks in `todo/completed_todo.md`.

---

## 5. Architecture & Offline-First Principles

- **Offline-First Storage**: Local database persistence via IndexedDB (`Dexie.js` in `src/lib/db.ts`) and `localStorage`.
- **Privacy & GDPR Compliance**: No unsolicited remote tracking, no external database dependencies for core operations.
- **Desktop Window Manager**: Windows 11 fluent desktop workspace with draggable, resizable, minimizable windows, taskbar, start menu, and calendar flyout.
- **Electron Standalone Packaging**: Standalone `.exe` installer and portable builds via `electron-builder.json` and `electron/main.cjs`.

---

## 6. Quality & Build Verification

Before finishing any modification turn:
1. Run `npm run lint` (`lint_applet` / TypeScript check) to ensure no type errors.
2. Run `npm run build` (`compile_applet`) to verify successful production compilation.

