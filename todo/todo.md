
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

### 2.1 Multi-User Architecture, Authentication & Windows-Style Security
- [ ] **Onboarding Account Type Selector (Personal vs. Business)**:
  - [ ] Choice during initial wizard / user creation: "Individual / Personal User" vs. "Business / Company".
  - [ ] Context-aware settings & module filtering:
    - Personal users enjoy a clean, streamlined interface without corporate overhead (hiding company registration, tax numbers, VAT letterheads, SDI codes).
    - Business users receive full corporate profile configuration (legal name, tax IDs, banking information, letterhead templates, invoice sequences).
  - [ ] Option to switch or convert account type later in the settings.
- [ ] **Multi-User Profile Management & Avatar System**:
  - [ ] Support creating, editing, and switching between multiple local user accounts.
  - [ ] Custom profile pictures (avatar upload with cropping/resizing or preset avatars) displayed on the lock screen, user switcher, start menu, and title bar.
  - [ ] Individual per-user personalization: custom desktop wallpaper (upload or preset themes), accent colors, window layouts, and pinned taskbar apps.
- [ ] **Cryptographically Secure Password Storage (Zero-Knowledge Architecture)**:
  - [ ] Enforce one-way salted cryptographic hashing (PBKDF2-HMAC-SHA256 with 100,000+ iterations or Web Crypto API).
  - [ ] Zero plaintext storage: Passwords can never be reverse-engineered or extracted from files or databases by third-party file access.
  - [ ] Double-entry password verification: "Enter Password" and "Confirm Password" checks with real-time match validation during setup or updates.
- [ ] **Security Question Recovery (Forgot Password Workflow)**:
  - [ ] Setup of security recovery question(s) upon password creation.
  - [ ] Predefined list of security questions (e.g. nickname, birthplace, first pet, mother's maiden name, favorite book, childhood school).
  - [ ] Hashed answer storage (case-insensitive & trimmed) to protect answers from file inspection.
  - [ ] "Forgot Password?" recovery dialog on the lock screen enabling secure password reset and renewal after answering the security question correctly.
- [ ] **Brute-Force Attack Protection & Account Lockout**:
  - [ ] Configurable failed attempt threshold (e.g. 3, 5, or 10 failed login attempts).
  - [ ] Time-based account lockout (e.g. lock login for 5, 10, or 15 minutes with exponential backoff on repeated failures).
  - [ ] Lock screen countdown timer clearly indicating the remaining lockout period.
- [ ] **Windows-Style Lock Screen & Fast User Switching**:
  - [ ] Lock screen interface with clock, wallpaper, user avatar selection carousel, and PIN / password prompt.
  - [ ] Quick lock action (`Win + L` shortcut or Start Menu lock button) allowing fast user switching without closing running background tasks.

### 2.2 Windows-Inspired Settings & Display / Multi-Monitor Management
- [ ] **Windows 11-Inspired Settings Hub**:
  - [ ] Structured sidebar navigation (Accounts & Profiles, Personalization & Wallpapers, Display & Multi-Screen, System & Backups, Privacy & Security).
  - [ ] Focus purely on workspace controls while omitting redundant low-level OS settings (like network adapters or sound drivers).
- [ ] **Multi-Monitor & Extended Display Management**:
  - [ ] Display detection and multi-screen layout settings for multi-monitor setups.
  - [ ] Support "extending" (`Erweitern`) SOCDOF workspaces across multiple monitors (e.g. popping windows out to secondary screens or multi-screen desktop spanning in Electron).
  - [ ] Per-monitor window positioning memory (remembering which monitor an app window was last placed on).

### 2.3 System Optimization & Continuous Polishing
- [ ] Continuous module performance and responsive UX refinements.



