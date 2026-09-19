# SOCDOF v23.4.3 Release Notes

**Release date:** 2026-09-19  
**Version:** v23.4.3  
**Channel:** Patch release following v23.2.0  
**Platform:** Windows Desktop (Electron) and offline web workspace

## Safe In-App Updates & Persistent Application State

### Pre-update protection
- Before an Electron in-app update proceeds, the running renderer creates a fresh snapshot of the local IndexedDB database.
- SOCDOF-owned localStorage values are included in the snapshot so account-scoped desktop and App Store state can be recovered.
- The updater stops the update if the snapshot cannot be created or written successfully.

### Installer behavior
- `electron-builder.json` explicitly disables application-data deletion on uninstall.
- The update replaces application binaries and bundled files while persistent user data remains outside the installation payload.
- A timestamped `.socdof.json` pre-update snapshot is written to the configured backup location, with a standard SOCDOF backup directory fallback.

### App installation persistence
- Installed App Store modules are synchronized to the active account-scoped persistence layer.
- Practice & Therapy and other installed modules therefore remain installed after a reload or application restart.
## Settings-Centered User Management Cleanup

- Removed the redundant Start menu account/profile shortcut.
- Centralized local user administration in **Settings → Users & Accounts** for active administrators.
- Corrected EN/DE/FR/ES Users & Accounts translation mapping while preserving the v23.2.0 Therapy Practice module and localization.
- Included the sign-in loading transition and dark-mode hover compatibility fix.


## Windows-Style Login & Lock Screen

- Added a full-screen Windows-inspired sign-in and workstation lock screen.
- Added blurred wallpaper presentation using the configured SOCDOF background image.
- Added a bottom-left active-user switcher and an Other User sign-in option.
- Added live clock and date formatting based on the configured language, date format, timezone, and seconds setting.
- Accounts without an image avatar use a neutral gray user silhouette.

## Windows-Style Users & Accounts

- Added a dedicated administrator-only **Users & Accounts** Settings category.
- Added local account creation and profile management with roles, account types, avatars, activation state, and auto-lock preferences.
- Added administrator password reset controls and sign-in security policy controls.
- Preserved last-active-administrator protection.

## Start Menu Power Controls

- Moved lock, user switching, sign-out, workspace restart, and application close actions into the SOCDOF Start menu power control.
- Removed the redundant always-visible authentication management overlay.
- The Start menu user area routes administrators directly to Users & Accounts.

## Localization & Documentation

- Added DE/EN/FR/ES translations for the new settings and power workflows.
- Updated the in-app documentation with the new account-management and Start menu workflows.

## Compatibility & Scope

- v23.0.0 is an intentional major-version milestone.
- Existing authentication storage, password hashing, recovery, lockout, and authorization behavior remain in place.

## Theme & Dark-Mode Hardening

- Fixed legacy light-only UI surfaces across the desktop and application modules.
- Light, Dark, and Windows System theme modes remain available.
- System mode follows the OS appearance setting and reacts to changes without requiring a restart.


## SOCDOF v23.2.0 — Therapy Practice Workspace

**Release date:** 2026-09-18

### New Practice application
- Offline-first workspace for therapy and consultation practices.
- Client records with contact and notes fields.
- Session documentation with reusable session templates.
- Appointment tracking with status handling.
- Mileage / trip log with distance and reimbursement calculation.
- Billing drafts for later connection to the existing invoice workflow.

### Product integration
- Available through the App Store and App Launcher.
- Opens as a normal SOCDOF desktop window with the same modern, simple visual language as the existing modules.
- No AI-style chat interface or generated clinical content is part of the module.

### Privacy & data handling
- Starts empty and stores practice workspace data locally.
- No third-party cloud account is required for the core workflow.
