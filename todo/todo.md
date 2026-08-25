# SOCDOF – Active Roadmap & Task List

> This file contains all currently open, in-progress, and planned roadmap items. Completed tasks are archived in [completed_todo.md](./completed_todo.md).

---

## 1. Operating Rules

### 1.1 Language & Documentation
- All development notes, release history files (`versions/V*.md`), code comments, and technical guides MUST be written in **English**.
- Multilingual user-facing UI texts are maintained via `src/lib/i18n.ts` (DE, EN, FR, ES).

### 1.2 No Mock / Example Data
- Modules must initialize with clean empty states (e.g. `[]`). Never inject artificial demo/sample records unless explicitly requested.

### 1.3 Task Lifecycle & Archiving
- `[ ]` **Open** – Pending implementation.
- `[-]` **Blocked** – Paused or waiting on clarification.
- `[x]` **Completed** – Move completed tasks to `todo/completed_todo.md` upon completion and verification.

---

## 2. Active Roadmap & Pending Tasks

### 2.1 Native Desktop App & Electron Execution
- [ ] Investigate if `.exe` should launch maximized by default or in true fullscreen.
- [ ] Add an optional toggle in Settings to enable/disable the exit confirmation dialogue.
- [ ] Add automatic search for new stable GitHub releases in Electron mode.
- [ ] Ensure updates are downloaded only after explicit user consent.
- [ ] Quick shortcut/action to open local file explorer / Windows directory.
- [ ] Provide optional standalone `Languages` folder bundled alongside portable `.exe` builds.

### 2.2 Platform & Web Storage Strategy
- [ ] **GitHub Pages Session-Only Storage Check**:
  - [ ] Ensure web demo operates purely in-session without persistent state when intended.
  - [ ] Display clear notice that permanent offline data persistence is reserved for the standalone `.exe` / desktop app.

### 2.3 Calendar & External Integrations
- [ ] Investigate optional two-way / one-way iCal and Google Calendar / Outlook feed synchronization.

### 2.4 System Audit & Polishing
- [ ] Audit all apps, buttons, modal dialogs, error states, and keyboard accessibility for fluid operation.
