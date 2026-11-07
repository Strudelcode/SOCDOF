# Changelog

All notable changes to SOCDOF are documented here. The release workflow reads
the section matching the pushed tag; a release fails if this file has no
matching, non-empty section.

## [0.1.0] - 2026-11-07

### Added

- Native Rust core with SQLite schema v2, integer-cent money handling, contacts,
  products, stock movements, invoices, users, company settings, backups,
  instance locking and DIN 5008 invoice PDFs.
- Tauri 2 desktop foundation with a real database/backup screen, German,
  English, French and Spanish texts, light/dark system theme support and a
  command layer that delegates to the shared Rust core.
- Signed Tauri updater integration for release builds. Linux AppImage, Windows
  NSIS and macOS app bundles can check the GitHub release endpoint and install
  signed updates; the app then restarts through the process plugin.
- CI packaging for Linux (AppImage, `.deb`), Windows (portable ZIP, NSIS, MSI)
  and macOS (universal DMG), plus a real WebView/command smoke test under Xvfb.
- Changelog-driven release notes, GitHub Releases with checksums, a generated
  `latest.json` updater manifest and a Discord release announcement using the
  existing bot/thread secrets.

### Preview scope

This release is the Rust desktop foundation, not yet a 1:1 replacement for the
legacy Electron application. Contacts, products, invoices and users already
exist in the core, but the remaining modules are tracked in
[`RUST_MIGRATION.md`](RUST_MIGRATION.md). The legacy application remains
unchanged in `SOCDOF - TS`.
