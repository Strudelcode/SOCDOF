# SOCDOF v23.1.1 Release Notes

**Release date:** 2026-09-18  
**Version:** v23.1.1  
**Channel:** Major feature release  
**Platform:** Windows Desktop (Electron) and offline web workspace

## Settings-Centered User Management\n\n- Removed the redundant Start menu account/profile shortcut.\n- User administration remains centralized in **Settings → Wartung & Datensicherheit → Users & Accounts** for active administrators.\n- Corrected EN/DE/FR/ES Users & Accounts translation mapping.\n\n## Windows-Style Login & Lock Screen

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
