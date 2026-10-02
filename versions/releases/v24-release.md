# SOCDOF v24 Release Overview

## v24.6.2 — Polished Settings Overview & Clear Section Navigation

- Replaced the low-contrast native compact-window selector with a grouped themed menu that supports Escape and outside-click dismissal.
- Refined the settings overview with a neutral local workspace state, concise quick access, and dynamic accent-aware cards.
- Improved keyboard semantics and documented settings navigation in German, English, French, and Spanish.

## v24.6.1 — System-Default Onboarding & Descriptive App Cards

- First-account setup always starts with System appearance selected, even when an existing company profile stores another theme.
- App templates and individually selected modules use responsive icon-led cards with translated descriptions and clear selected states.
- Added onboarding and app selection guidance to the in-app guide in German, English, French, and Spanish.

## v24.6.0 — Responsive Settings Navigation

- Replaced the horizontally clipped mobile category strip with a grouped settings selector that fits compact windows and keeps all sections directly reachable.
- Adapted the toolbar/search row, overview cards, and quick preference layout to narrow content widths.
- Preserved the existing desktop sidebar navigation.

## v24.5.0 — Optional First-Account Workspace Setup

### Key Capabilities in v24.5.0:

1. **Optional First-Run Personalization**:
   - Choose an accent color, light/dark/system theme, and a local desktop wallpaper while creating the first administrator account.
   - Live appearance previews restore the previous appearance when setup is skipped; preferences are saved to the new local account when accepted.

2. **App Templates & Selection**:
   - Start with personal, business, practice, or retail-oriented app selections, then toggle individual apps.
   - Personal accounts omit business-only apps; module selection and desktop/taskbar pins are saved in the account scope.

3. **Quad-Language Localization**:
   - All new setup interface text is available in German, English, French, and Spanish.

## v24.2.0 — Mobile Therapy Dossier Timer & Window Auto-Fit (Phase 12)

### Key Capabilities in v24.2.0:

1. **Mobile Consultation Timer**:
   - Per-client start/stop timer in the therapy dossier on compact screens.
   - Crash-safe persistence; live second-by-second display.

2. **Quick Session Note Bottom Sheet**:
   - Capture intervention & progress notes immediately after stopping the timer.
   - Duration auto-derived from the consultation timer and booked into the session history.

3. **Live Window Auto-Fit**:
   - Open windows maximize automatically when the viewport shrinks below smartphone width; geometry is restored when enlarging again.

4. **Calendar Day View Fix**:
   - No more duplicate desktop day list under the mobile hour agenda on narrow windows.

5. **Web-Preview Parity Notice**:
   - Settings shows a browser-only banner explaining Electron-only surfaces; update install and backup folder picking ship full web fallbacks for true 1:1 browser testing.
   - Phases 14 & 15 (Settings, App Store & Documentation) visually verified at 380px.

6. **Dynamic ERP Dashboard & Anti-Clash Colors (Roadmap 2.1)**:
   - KPI cards, filters and list accents follow the custom accent color live; secondary metrics (POS revenue, inventory) deliberately use the contrasting companion color.
   - New POS revenue KPI card and a Quick Launchpad with one-tap actions (invoice, POS sale, contact, stock booking).

---

## v24.1.0 — Mobile Calendar & Support Time-Tracking (Responsive Phases 10 & 11)

### Key Capabilities in v24.1.0:

1. **Mobile Calendar Day Agenda**:
   - Hour-marker timeline (07:00 – 22:00) with one-tap empty slot quick-creation.
   - Quick appointment creation bottom sheet with touch-optimized inputs, duration chips, category and storage destination.
   - Floating quick-add button and next-upcoming-event quick bar for instant orientation.

2. **Mobile Support & Time Tracking**:
   - Compact live time-recording widget with running timer pulse and direct ticket jump.
   - Touch-friendly service ticket card stack with status badges, booked hours and quick actions.
   - Responsive header with icon-only primary actions on compact screens.

---

## v24.0.0 — Mobile-Window Responsive Layout & Adaptive UI System

SOCDOF v24 introduces a comprehensive mobile-window responsive architecture that adapts the entire offline-first ERP and workspace experience when windows are resized to compact smartphone proportions or viewed on touch devices.

### Key Capabilities in v24.0.0:

1. **Adaptive Window Breakpoint Engine**:
   - Windows dynamically switch from expansive multi-column desktop tables to structured, compact mobile card stacks when window width shrinks below mobile thresholds.
   - Eliminates awkward horizontal scrolling and clipped UI controls.

2. **Mobile-Optimized Authentication, Lock Screen & Login**:
   - Responsive clock and date typography with native touch swipe gestures to unlock.
   - Fluid avatar selector and thumb-friendly touch targets (min 44px) for rapid user switching.
   - Mobile-adapted account recovery and password reset flows with smooth scrolling and keyboard avoidance.

3. **Multi-Language & Ergonomic Polish**:
   - 100% synchronized across English, German, French, and Spanish (`src/lib/i18n.ts`).
   - Retains dynamic accent color glow and anti-clash companion contrast across all screen sizes.
