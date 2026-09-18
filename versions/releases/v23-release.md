# SOCDOF v23.0.0 Release Notes

**Release date:** 2026-09-18  
**Version:** v23.0.0  
**Channel:** Major feature release  
**Platform:** Windows Desktop (Electron) and offline web workspace

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
