# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## Version 25.2.1 (2026-11-07)

- 🛠️ **Behoben / Fixed**:
  - The language selection screen now follows the system color scheme (dark/light) from the first paint instead of appearing plain white until the next step.
  - The administrator account created during onboarding no longer asks for a new password immediately after the first sign-in.
  - The first-run backup step no longer reacts without feedback when the folder picker is unavailable, and it is not shown again after it was dismissed.
- 🔄 **Geändert / Improved**:
  - The first account step is now clearly labelled as the administrator account (step 1) in German, English, French and Spanish, including a short note that it manages users, roles and settings.

## Version 25.2.0 (2026-10-31)

- 🛠 **Verbessert / Improved**:
  - Startup splash stays visible until the app is ready, with step-by-step progress (data folder, backups, language files) in the system language. The window no longer closes after a fixed 2.2 seconds during the slow first-run setup.

- 🚀 **Neu / What's New**:
  - Custom roles: Administrators can create roles, rename and delete them, and tick which apps each role may open. Users are assigned one role each.
  - Passwordless accounts for non-admin users with a one-click "<Name> continue" login.
  - Per-person security question on first sign-in (or once for all users).
- 🛠️ **Behoben / Fixed**:
  - Folder watchers on network drives no longer crash the app with "A JavaScript error occurred in the main process"; a failing watcher is dropped and logged.
- 🔄 **Geändert / Improved**:
  - Administrator's own account no longer shows the "Current password" and "Temporary reset" fields.

## Version 25.1.0 (2026-10-31)

- 🚀 **Neu / What's New**:
  - Shared Single-PC Workstation Mode: Optimized for shared computers (workshops, family, small teams) enabling 1-click user switches without password friction while preserving individual desktop wallpaper, pinned apps, and language preferences.
  - 1-Click Start Menu User Switcher: Switch between active user accounts directly from the Start Menu Power flyout without logging out.
  - Portable USB & OneDrive Hardening: Added portable data directory routing for automated backups (`<portableDataDir>/backups`), 1-click data folder explorer access, and cloud drive sync status.
- 🔄 **Geändert / Improved**:
  - Fluid Widescreen Settings: Settings window now stretches to `max-w-[1780px]`, eliminating wide empty side margins on full HD and widescreen displays.
  - Uppercase Initials Avatar System: Replaced lone bullet point avatars with clean, high-contrast uppercase initials matching dynamic system accent colors.
  - Sticky Tab Headers: Made user and account management tab headers sticky with backdrop blur for smooth navigation during long scrolling.
- 🛠️ **Behoben / Fixed**:
  - Fixed card top curvature clipping on scroll in the settings pane.
  - Fixed second user creation error when transitioning from autologin into workstation multi-user mode.

## Version 25.0.0 (2026-10-31)

- 🚀 **Neu / What's New**:
  - Multi-user collaboration & safe mode ("Abgesicherter Modus") with admin setup on first startup, sub-users, and passwordless quick-login.
  - Per-user language profiles ensuring language settings apply per user without global overwriting, plus OS language sync options.
  - Advanced portable architecture with full OneDrive, Dropbox, and QNAP/NAS support and active session collision warnings.
- 🔄 **Geändert / Improved**:
  - App Launcher grid layout spacing increased to prevent multi-line application titles (e.g. "Praxis & Therapie") from overlapping adjacent rows.
  - Polished update splash screens and documentation chapters with clean, natural terminology.
- 🛠️ **Behoben / Fixed**:
  - Resolved multi-user language preference clashes and icon overlap issues on desktop workspaces.
