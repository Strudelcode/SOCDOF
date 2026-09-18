# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## v23.1.0

### Authentication / Login
- Redesigned the initial sign-in and workstation lock screens as a Windows-style full-screen experience.
- Added blurred wallpaper support using the configured SOCDOF background image.
- Added a live clock and date that follow the configured language, date format, timezone, and seconds setting.
- Added a bottom-left active-user switcher plus an Other User sign-in flow.
- Replaced placeholder avatar symbols on the authentication surface with a neutral gray user silhouette when no image is configured.

### Improved
- Preserved the existing local authentication, recovery, lockout, and multi-user behavior while modernizing the visual login workflow.

## v23.0.0

### 🚀 Neu / What's New
- Added an administrator-only Windows-style Users & Accounts settings category for local account management.
- Added local account creation, profile editing, roles, account types, avatars, activation, auto-lock preferences, password resets, and sign-in security controls.
- Added Start menu power actions for lock, user switching, sign-out, workspace restart, and closing SOCDOF.


### 🌗 Theme / Dark Mode
- Fixed legacy light-only surfaces across the desktop, taskbar, Start menu, search, context menus, windows, modules, Settings, dashboard, tables, cards, dialogs, dropdowns, inputs, buttons, text, borders, hover states, scrollbars, and notifications.
- Preserved Light and Dark modes and added a fully functional Windows System mode that follows the OS appearance setting.
### 🔄 Geändert / Improved
- Removed the redundant always-visible authentication management overlay from the desktop workspace.
- Connected the Start menu user area to account settings, with direct administrator access to Users & Accounts.
- Added complete EN/DE/FR/ES localization for the new account and power workflows.
