### CustomerPicker & CRM Contact Integration for Praxis & Therapy (v23.4.2)
- [x] Integrated `CustomerPickerModal` from the contacts CRM into `TherapyPracticeModule.tsx`, matching the Support module UX for selecting customers.
- [x] Enabled auto-filling of patient form fields (name, phone, email, address notes) upon selecting a contact from the CRM.
- [x] Integrated `ContactEditModal` for inline editing of contact details without leaving the Praxis & Therapy workspace.
- [x] Added CRM connection banner and status indicators in the 360° Client Dossier and client creation modals with quick edit, relink, and unlink capabilities.
- [x] Supported quick CRM contact picking and inline editing across appointments, sessions, billing, and mileage logs.
- [x] Added quad-lingual localization in `src/lib/i18n.ts` for all CRM integration actions and labels.

### Unified Practice & Therapy Iconography & Visual Identity Harmonization (v23.4.1)
- [x] Resolved icon discrepancy between App Store (previously Briefcase) and Desktop (previously User avatar silhouette).
- [x] Implemented dedicated, recognizable medical practice iconography (`Hospital` — house/building with central medical cross/plus sign) with soothing healthcare gradient (`bg-gradient-to-br from-teal-600 to-indigo-700`).
- [x] Synchronized the icon across all system surfaces: Desktop shortcuts, Start Menu (pinned & all apps), Taskbar, Window titlebar, App Store catalog and details, App Launcher, and Command Palette (Ctrl+K).
- [x] Added matching identity badge to the top header of `TherapyPracticeModule.tsx`.

### Praxis & Therapy Interconnected Client Dossier & Cross-Module Linking (v23.4.0)
- [x] Implemented comprehensive 360-degree Client Dossier (Akte) in `TherapyPracticeModule.tsx` that links each client with their appointments, sessions, billing drafts, and mileage/house visits.
- [x] Added direct cross-module conversions: convert scheduled/attended appointments directly into clinical sessions, and convert documented therapy sessions into billing drafts.
- [x] Added clickable client badges across Appointments, Sessions, Billing, and Mileage lists that immediately jump to the respective client's dossier.
- [x] Added client filter dropdowns to Appointments, Sessions, Billing, and Mileage tabs to quickly filter records by client.
- [x] Enriched client cards with live relationship indicators: count of linked appointments (with upcoming appointment date), count of documented sessions, and sum of invoice drafts.
- [x] Added direct inline creation actions: `+ Termin`, `+ Sitzung`, `+ Abrechnung`, `+ Fahrt` scoped to a client.
- [x] Completed quad-lingual translation coverage in `src/lib/i18n.ts` for German, English, French, and Spanish.

### Profile Picture Alignment & Centering Stabilization (v23.3.2)
- [x] Fixed avatar alignment on the Lock screen (`LockScreen` in `AuthGate.tsx`): replaced block-level text-centered markup with strict flexbox column centering (`flex flex-col items-center text-center`), eliminating the leftward displacement.
- [x] Added `mx-auto` and `shrink-0` to the `AuthAvatar` component to guarantee centered positioning regardless of parent container layout or CSS styles.
- [x] Added `shrink-0` and `object-cover object-center` to all avatar containers across the Windows 11 Start Menu (`DesktopWindowWorkspace.tsx`) and User Management Settings (`UserManagementSettings.tsx`).
- [x] Extended avatar source handling to seamlessly support local URLs, blob URLs, and data URIs alongside fallback unicode initials and user silhouette icons.

### Dynamic Language Discovery, Search Filtering & Windows-Style Toast Feedback (v23.3.1)
- [x] Subscribed `LanguageSelectionScreen` (in `AuthGate.tsx`) and `LanguageSelectionModal.tsx` to `subscribeDesktopLanguageFiles` for live synchronization whenever language packs are added or modified in `languages/`.
- [x] Implemented intelligent search filtering in language selectors, automatically appearing when >10 languages or custom language packs exist, with instant reset.
- [x] Moved account creation success notification from the center screen overlay to a fixed bottom-right position with a 10-second auto-dismiss timer and smooth fade animation.
- [x] Added complete quad-lingual translations in `src/lib/i18n.ts` for all new toast notifications, search placeholders, result counters, and empty state reset actions.

### Windows 11 Personalization Center, Live Blur & Unsaved Changes Guard (v23.3.0)
- [x] Implemented Windows 11-style Personalization Center in `SettingsModule.tsx` with dedicated sub-tabs: *Wallpaper & Blur*, *Start Menu*, *Colors & Accent*, and *Fonts & Zoom*.
- [x] Live interactive desktop preview mockup with dynamic wallpaper rendering and real-time blur slider (0px to 30px with presets: Sharp, Soft, Medium, Strong).
- [x] Start Menu background customization with custom image upload and dedicated blur control in `DesktopWindowWorkspace.tsx` and `SettingsModule.tsx`.
- [x] Unsaved changes tracking (`isSettingsDirty`) and interactive confirmation dialog on window close with three options: *Save* (persists and closes), *Don’t Save* (discards and closes), and *Cancel* (keeps window open).
- [x] Added persistent fixed bottom-right Save button with real-time unsaved changes badge to `SettingsModule.tsx`, accessible without scrolling.
- [x] Removed country flag icons from the start screen and lock screen language selectors in `AuthGate.tsx`.
- [x] Quad-lingual localization across German, English, French, and Spanish in `src/lib/i18n.ts` for all new personalization categories, blur options, and dialog buttons.

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

