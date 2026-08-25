# SOCDOF Development & Agent Guidelines (Instructions)

This document defines the core operational standards, versioning protocols, and development workflows for SOCDOF.

---

## 1. Language & Documentation Standards

- **English by Default**: All development documentation, release notes under `versions/`, code comments, commit messages, and internal guides MUST be written in **English**.
- **Multilingual UI**: End-user facing UI strings, labels, and dialogues must be integrated through the centralized i18n system (`src/lib/i18n.ts`) supporting all 4 languages (German, English, French, Spanish).

---

## 2. No Mock / Placeholder Example Data Rule

- **Clean Real-World Apps**: Do NOT pre-fill or inject artificial demo records, dummy contacts, fake support tickets, or sample items into new or existing modules.
- **Empty States**: Every module must initialize with clean empty states (e.g. `[]`), clear onboarding guides, and intuitive creation action buttons.
- Users input their own genuine data.

---

## 3. Versioning Rules

- **SemVer Format**: `v<Major>.<Minor>.<Patch>` (e.g., `v19.1.5`, `v19.2.0`).
- **Flexible Minor & Patch Updates**: When adding new features, major UX improvements, or module integrations, increment to a clean minor version (e.g. `v19.1.0`, `v19.2.0`). For smaller enhancements and bug fixes, increment patch versions (e.g. `v19.1.1`, `v19.1.5`).
- **Major Version Constraint**: A new major version (e.g., `v20.0.0`) **must never** be initiated automatically. It requires explicit user discussion and consent.
- **Synchronized Version Declarations**: Every version increment must be updated across all designated locations simultaneously:
  1. `package.json` (`"version": "19.x.x"`)
  2. `src/lib/version.ts` (`APP_VERSION = '19.x.x'` and add entry to `VERSION_HISTORY`)
  3. `versions/V<Major>.md` (e.g. `versions/V19.md` - detailed release notes in English)
  4. `todo/todo.md` and `todo/completed_todo.md`

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

