
# SOCDOF – Active Roadmap & Task List

> This file contains all currently open, in-progress, and planned roadmap items. Completed tasks are archived in [completed_todo.md](./completed_todo.md).

---

> ## 1. Operating Rules & Guidelines
> 
> ### 1.1 Language & Documentation
> - All development notes, release history files (`versions/V*.md`), code comments, and technical guides MUST strictly be written in **English**.
> - Multilingual user-facing UI texts are maintained via `src/lib/i18n.ts` (DE, EN, FR, ES).
> 
> ### 1.2 No Mock / Example Data Rule
> - Modules must initialize with clean empty states (e.g. `[]`). Never inject artificial demo/sample records unless explicitly requested.
> 
> ### 1.3 Two-File Todo Management & Archiving Rule
> - **Active Tasks**: `todo/todo.md` is strictly reserved for open (`[ ]`) and in-progress items.
> - **Completed Tasks**: As soon as an item is finished and verified, move it directly to `todo/completed_todo.md` with `[x]` and archive details to keep the active list concise and actionable.

---

## 2. Active Roadmap & Pending Tasks

### 2.1 Multi-User Profiles & Windows-Style Authentication
- [ ] **Windows-Style Lock Screen & User Profile Selection**:
  - [ ] Implement a Windows-inspired startup/login screen with user avatar selection, PIN / password input, and account switching.
  - [ ] Support adding multiple local user accounts with custom usernames, avatars, and security credentials.
  - [ ] **Secure Credential Storage & Hashing**: Store passwords securely using cryptographic hashing (e.g. PBKDF2 / SHA-256 with salt) or secure vault mechanics rather than plaintext.
  - [ ] **Per-User Profile Isolation**:
    - [ ] Separate settings per user: personalized wallpaper, desktop widgets, taskbar layout, pinned apps, and language/theme preferences.
    - [ ] Optional isolation of user-specific documents, notes, and local workspace data.
  - [ ] Lock screen shortcut (`Win + L` equivalent or Start Menu lock button) to switch users quickly without closing running workspaces.

### 2.2 Storage Inspector & Per-Module Disk Space Analyzer
- [ ] **Granular Module & Feature Storage Breakdown**:
  - [ ] Add a comprehensive "Storage & Data Footprint" inspector in the Settings module.
  - [ ] Calculate and display the exact storage consumption (Bytes, KB, MB) per ERP module (Invoices, Products, Contacts, Stock, Accounting, Calendar, Notes/Widgets, Backups).
  - [ ] Visualize storage distribution with clean interactive gauges or visual breakdown bars.
  - [ ] **Multi-User Storage Usage**: Display how much storage is occupied by each individual user account and its respective configurations/files.
  - [ ] Detail view showing which large records, attachments, or historical snapshots consume the most disk space, with quick optimization/cleanup tools.

### 2.3 System Optimization & Continuous Polishing
- [ ] Continuous module performance and responsive UX refinements.



