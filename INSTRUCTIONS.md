# SOCDOF Development & Agent Guidelines (Instructions)

This document defines the core operational standards, versioning protocols, and development workflows for SOCDOF.

---

## 1. Versioning Rules

- **SemVer Format**: `v<Major>.<Minor>.<Patch>` (e.g., `v19.0.3`).
- **Minor & Patch Updates**: When adding features, polishing UI, or fixing bugs within the current generation, increment minor or patch versions autonomously (e.g. `v19.0.3` -> `v19.0.4` or `v19.1.0`).
- **Major Version Constraint**: A new major version (e.g., `v20.0.0`) **must never** be initiated automatically. It requires explicit user discussion and consent.
- **Synchronized Version Declarations**: Every version increment must be updated across all designated locations simultaneously:
  1. `package.json` (`"version": "19.x.x"`)
  2. `src/lib/version.ts` (`APP_VERSION = '19.x.x'` and add entry to `VERSION_HISTORY`)
  3. `versions/V<Major>.md` (e.g. `versions/V19.md` - detailed release notes)
  4. `todo/todo.md` (check off completed items with `[x]`)

---

## 2. Todo Workflow (`todo/todo.md`)

- Always consult `todo/todo.md` for upcoming roadmap milestones, bug fixes, and feature backlogs.
- When completing a task:
  - Mark it completed in `todo/todo.md` with `- [x]`.
  - Add relevant technical notes if necessary.
- Do not remove pending tasks without user consent.

---

## 3. Architecture & Offline-First Principles

- **Offline-First Storage**: Local database persistence via IndexedDB (`Dexie.js` in `src/lib/db.ts`).
- **Privacy & GDPR Compliance**: No unsolicited remote tracking, no external database dependencies for core operations.
- **Desktop Window Manager**: Windows 11 fluent desktop workspace with draggable, resizable, minimizable windows, taskbar, start menu, and calendar flyout.
- **Electron Standalone Packaging**: Standalone `.exe` installer and portable builds via `electron-builder.json` and `electron/main.cjs`.

---

## 4. Quality & Build Verification

Before finishing any modification turn:
1. Run `npm run lint` (`lint_applet` / TypeScript check) to ensure no type errors.
2. Run `npm run build` (`compile_applet`) to verify successful production compilation.
