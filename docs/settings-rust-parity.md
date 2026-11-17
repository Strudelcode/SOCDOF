# Native Settings parity — Display and Letterhead

**Branch:** `feature/rust-native-desktop-host`  
**Work started:** 2026-11-17  
**Reference:** `SOCDOF - TS/src/components/apps/SettingsModule.tsx` and `DisplaySettingsSection.tsx`

## Implemented in the native Rust Settings window

### Display
- Added a dedicated Display section and vector-icon navigation entry.
- Interface scaling accepts 75–200%, is validated and persisted in the existing SQLite settings table, and is applied through egui's context zoom factor.
- Night-light preference and requested color temperature (1000–6500 K) are persisted with validation.
- Settings are stored as versioned JSON keys; existing company profile and user preference records are not rewritten.

### Letterhead
- Added a dedicated Letterhead section with logo path/URL, default subject, managing director, commercial-register details, four footer columns, background and DIN 5008 fold-mark preferences.
- Values are trimmed, saved to a separate SQLite settings key and restored on reload.
- Added DE/EN/FR/ES catalogues and a persistence regression test.

## Explicitly not claimed as complete

- Native display enumeration, monitor arrangement, virtual displays, primary-monitor switching, HDR and hardware night-light control require OS-specific Windows/Linux/macOS integrations. The current Display page does not pretend to control those OS features.
- Letterhead metadata is persisted but is not yet wired into every invoice, PDF, DOCX, email and print renderer. That is the next document-rendering parity task.
- TypeScript has additional Display fields and letterhead options; this commit is a functional native foundation, not a 95% parity sign-off.

## Verification gate

- The settings render regression iterates every registered tab at compact and wide widths in dark appearance.
- A new test verifies Display and Letterhead values survive a SQLite settings read-back.
- Do not mark this work accepted until the latest-head Windows and Linux test/build jobs pass and the document-renderer integration is covered by tests.
