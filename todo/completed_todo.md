### Consolidated User Management & Profile Personalization in Settings (v23.2.5)
- [x] Removed the floating top-right person/gear icon overlay from `AccountScopedWorkspace.tsx`.
- [x] Consolidated profile editing (avatar photo upload, desktop wallpaper, personal/business account type, auto-lock timeout, and own password change) into `SettingsModule` under *Users & Accounts*.
- [x] Provided a 3-tab experience for administrators: *My Profile & Personalization*, *User Management* (all local accounts), and *Security Policies*.
- [x] Provided a direct profile launcher in the Start menu footer bottom-left, opening Settings focused directly on the user account module.
- [x] Added quad-lingual translations (DE, EN, FR, ES) for all new user profile settings, wallpaper, and password change labels.

### Localization Alignment & Crisp Vector Flag Rendering (v23.2.4)
- [x] Corrected rotated start menu and power action translation strings across German, English, French, and Spanish dictionaries.
- [x] Fixed Windows Unicode emoji font degradation (rendering "DE DE") by adding built-in crisp vector SVG flags for supported languages in `FlagIcon`.
- [x] Added missing system status storage tooltip entries in French and Spanish language catalogs (achieving 100% dictionary key parity).

### Dark Mode Persistence & Auth Activity Event Fix (v23.2.3)
- [x] Fixed dark theme consistency by preventing user appearance preferences from falling back to light mode when unconfigured.
- [x] Isolated session activity heartbeats from dispatching global auth change events on user mouse clicks and keystrokes.
- [x] Synchronized theme toggling across company settings, user preferences, and root DOM classes (`document.documentElement.classList`).

### Responsive First-Run Account Onboarding & Authentication Refinements (v23.2.2)
- [x] Initial onboarding flow enforces language selection before presenting the primary account setup screen.
- [x] Onboarding modal layout refactored with responsive padding, container height limits, and scrolling support for compact laptop displays.
- [x] Swapped out decorative avatar symbols for a clean neutral gray user silhouette with support for immediate photo upload or removal.
- [x] Real-time password strength meter bar with visual level indications and clear red asterisk markers (`*`) on all mandatory fields.
- [x] Localized security questions dropdown, custom question input, and offline recovery notice.
- [x] Redirects user to the login screen with a success confirmation banner after account creation instead of auto-logging in.

### Settings-Centered User Management Cleanup (v23.2.1)
- [x] Removed the redundant Start menu account/profile shortcut.
- [x] Kept local user administration centralized in Settings under Users & Accounts for active administrators.
- [x] Corrected the EN/DE/FR/ES Users & Accounts translation block mapping without removing the Therapy Practice localization.
- [x] Added the sign-in loading transition and dark-mode hover compatibility fix.

### Therapy Practice Workspace (v23.2.0)
- [x] Added an offline-first Practice workspace with clean empty states for clients, sessions, appointments, mileage, and billing drafts.
- [x] Added session templates for initial interview, standard session, crisis intervention, and final report.
- [x] Added Practice integration to the desktop window system, launcher, command palette, and App Store.
- [x] Added EN/DE/FR/ES UI localization and language-package entries.
- [x] Added version, release notes, changelog, and in-app documentation updates.

### Windows-Style Login & Lock Screen Redesign (v23.1.0)
- [x] **Windows-Inspired Authentication Surface**:
  - [x] Redesigned sign-in and workstation lock screens with a full-screen blurred wallpaper presentation.
  - [x] Added live clock/date formatting using configured language, date format, timezone, and seconds settings.
  - [x] Added bottom-left active-user switching and an Other User sign-in option.
  - [x] Added neutral gray user silhouette rendering when no image avatar is configured.

### Windows-Style Users & Accounts and Start Menu Power Controls (v23.0.0)
- [x] **Administrator-Only Users & Accounts Settings**:
  - [x] Added a dedicated Windows-inspired Settings category restricted to active administrators.
  - [x] Added local account creation, editing, roles, account types, avatars, activation state, auto-lock preferences, and administrator password resets.
  - [x] Added sign-in security controls for failed-attempt thresholds, lockout duration, and exponential backoff.
  - [x] Preserved last-active-administrator protection through the existing authentication service.
- [x] **Windows-Style Start Menu Power Actions**:
  - [x] Moved lock, switch-user, sign-out, workspace restart, and application-close actions into the Start menu power control.
  - [x] Removed the redundant always-visible authentication management overlay.
  - [x] Connected the Start menu user area to account settings and administrator Users & Accounts management.
- [x] **Localization & Documentation**:
  - [x] Added EN/DE/FR/ES translations for the new settings and power workflows.
  - [x] Updated the in-app documentation with the new account-management and Start menu workflows.

